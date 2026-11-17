import assert from "node:assert/strict";
import { test } from "node:test";
import {
	brokenPages,
	flaggedCount,
	outOfRange,
	parseRange,
	categoryLabel,
	formatDateShort,
	formatMetricValue,
	groupBySite,
	newRuleIds,
	normalizeAuditUrl,
	pathOf,
	scoreBand,
	signed,
	statusBuckets,
	trendClass,
} from "../src/ui/helpers.ts";
import type { AuditReport, Finding } from "../src/scanner.ts";
import type { AuditListItem } from "../src/audit-store.ts";

// The sidebar row is the one place a date has to be readable at a glance, so it
// is the one piece of formatting worth pinning down.
test("formatDateShort always carries the date, not just the time", () => {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 8);
	const shown = formatDateShort(today.toISOString());
	assert.match(shown, /\d/, "shows the day of the month");
	assert.ok(shown.length > 8, `expected a date and a time, got "${shown}"`);
});

test("formatDateShort carries the year, whichever year it is", () => {
	assert.match(formatDateShort("2020-06-28T15:30:00.000Z"), /2020/);
	const year = new Date().getFullYear();
	assert.match(formatDateShort(`${year}-06-28T15:30:00.000Z`), new RegExp(String(year)));
});

test("formatDateShort passes through a date it cannot parse", () => {
	assert.equal(formatDateShort("nonsense"), "nonsense");
});

test("pathOf strips the origin so page lists are readable", () => {
	assert.equal(pathOf("https://example.com/"), "/");
	assert.equal(pathOf("https://example.com/blog/post/"), "/blog/post");
	assert.equal(pathOf("https://example.com/search?q=a"), "/search?q=a");
	assert.equal(pathOf("not a url"), "not a url");
});

test("categoryLabel spells out the ids the scanner returns", () => {
	assert.equal(categoryLabel("core-seo"), "Core SEO");
	assert.equal(categoryLabel("eeat"), "E-E-A-T");
	assert.equal(categoryLabel("structured-data"), "Structured data");
});

test("groupBySite buckets runs by host, newest run first in each", () => {
	const item = (url: string, date: string, score: number) =>
		({ file: { path: `${url}-${date}` }, url, date, score, pages: 10 }) as AuditListItem;
	// listAudits hands over a newest-first list; grouping must preserve that order.
	const groups = groupBySite([
		item("https://a.com", "2026-07-27", 90),
		item("https://b.com", "2026-07-26", 50),
		item("https://a.com", "2026-07-20", 70),
	]);
	assert.deepEqual(
		groups.map((g) => g.host),
		["a.com", "b.com"],
	);
	assert.equal(groups[0].runs.length, 2);
	assert.equal(groups[0].latest, 90);
});

test("normalizeAuditUrl accepts bare domains and rejects what cannot be crawled", () => {
	assert.equal(normalizeAuditUrl("example.com"), "https://example.com/");
	assert.equal(normalizeAuditUrl("  http://example.com/blog "), "http://example.com/blog");
	assert.equal(normalizeAuditUrl("http://localhost:3000"), "http://localhost:3000/");
	assert.equal(normalizeAuditUrl("abdulkadersafi"), null);
	assert.equal(normalizeAuditUrl("ftp://example.com"), null);
	assert.equal(normalizeAuditUrl(""), null);
});

test("trendClass flips for lower-is-better metrics and ignores small changes", () => {
	assert.equal(trendClass(7), "is-good");
	assert.equal(trendClass(-12, true), "is-good");
	assert.equal(trendClass(8, true), "is-bad");
	assert.equal(trendClass(2, false, 3), "is-flat");
	assert.equal(signed(-12), "−12");
	assert.equal(signed(0), "0");
});

test("scoreBand stays quiet above 80", () => {
	assert.equal(scoreBand(97), "is-ok");
	assert.equal(scoreBand(80), "is-ok");
	assert.equal(scoreBand(64), "is-mid");
	assert.equal(scoreBand(38), "is-bad");
});

test("statusBuckets, brokenPages and newRuleIds read a report the way the overview shows it", () => {
	const finding = (ruleId: string, status: "fail" | "warn" | "pass") =>
		({ ruleId, category: "core-seo", severity: "error", title: ruleId, status, message: "" }) as Finding;
	const page = (url: string, status: number, findings: Finding[] = []) => ({ url, status, score: 80, findings });
	const report = {
		startUrl: "https://a.com",
		generatedAt: "2026-11-10",
		pagesScanned: 4,
		score: 80,
		categories: [],
		pages: [
			page("https://a.com/", 200, [finding("meta", "fail"), finding("alt", "warn")]),
			page("https://a.com/old", 301),
			page("https://a.com/gone", 404),
			page("https://a.com/down", 0),
		],
	} as AuditReport;
	const prev = { ...report, pages: [page("https://a.com/", 200, [finding("meta", "fail"), finding("alt", "pass")])] } as AuditReport;
	assert.deepEqual(statusBuckets(report), { "2xx": 1, "3xx": 1, "4xx": 1, "5xx": 1 });
	assert.deepEqual(brokenPages(report).map((p) => p.url), ["https://a.com/gone", "https://a.com/down"]);
	assert.deepEqual([...newRuleIds(report, prev)], ["alt"]);
	assert.equal(newRuleIds(report, null).size, 0);
});

test("parseRange reads the scanner's targets and nothing else", () => {
	assert.deepEqual(parseRange("Recommended 30 to 60"), { min: 30, max: 60 });
	assert.deepEqual(parseRange("Recommended 0.1 to 2.5"), { min: 0.1, max: 2.5 });
	assert.equal(parseRange("Exactly one"), null);
	assert.equal(parseRange("51 internal, 3 external"), null);
	assert.equal(parseRange(undefined), null);
});

test("outOfRange groups flagged measurements across pages, bad first", () => {
	const v = (id: string, value: number, status?: "ok" | "warn" | "bad") =>
		({ kind: "value", id, category: "performance", label: id, value, unit: "KB", status, note: "Recommended 10 to 100" }) as const;
	const page = (url: string, metrics: ReturnType<typeof v>[]) => ({ url, status: 200, score: 90, findings: [], metrics });
	const report = {
		startUrl: "https://a.com",
		generatedAt: "",
		pagesScanned: 3,
		score: 90,
		categories: [],
		pages: [
			page("https://a.com/1", [v("size", 120, "warn"), v("dupes", 4, "warn")]),
			page("https://a.com/2", [v("size", 400, "bad"), v("dupes", 6, "warn")]),
			page("https://a.com/3", [v("size", 50, "ok"), v("dupes", 2, "warn")]),
		],
	} as unknown as AuditReport;
	const rows = outOfRange(report);
	assert.deepEqual(rows.map((r) => [r.id, r.status, r.pages.length]), [["size", "bad", 2], ["dupes", "warn", 3]]);
	assert.equal(rows[0].pages[0], "https://a.com/2", "bad pages lead");
	assert.deepEqual([rows[0].low, rows[0].high], [120, 400]);
	assert.deepEqual(rows[0].range, { min: 10, max: 100 });
	assert.equal(flaggedCount(report.pages[1]), 2);
});

test("formatMetricValue shows ISO dates as a day and keeps other strings", () => {
	assert.match(formatMetricValue("2026-07-23T12:21:13+00:00"), /2026/);
	assert.doesNotMatch(formatMetricValue("2026-07-23T12:21:13+00:00"), /T12/);
	assert.equal(formatMetricValue("https://a.com/"), "https://a.com/");
	assert.equal(formatMetricValue(null), "None");
	assert.equal(formatMetricValue(1204), (1204).toLocaleString());
});
