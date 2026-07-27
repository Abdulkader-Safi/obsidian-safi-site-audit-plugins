import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryLabel, formatDateShort, groupBySite, pathOf } from "../src/ui/helpers.ts";
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
