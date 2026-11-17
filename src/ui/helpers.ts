import type { AuditListItem } from "../audit-store";
import type { AuditReport, Metric, PageReport, Severity, Status, ValueStatus } from "../scanner";

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
}

/** Path only, for page lists where every row repeats the same origin. */
export function pathOf(url: string): string {
	try {
		const u = new URL(url);
		return (u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "")) + u.search;
	} catch {
		return url;
	}
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Short form for the sidebar: the full date and time on every row. Two runs of
 * the same site on the same day are common, so a bare time says nothing, and the
 * year has to be there for an audit history that spans one.
 */
export function formatDateShort(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Day only, for chart axes and the compare picker: "Nov 3, 2026". */
export function formatDay(iso: string, withYear = true): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		...(withYear ? { year: "numeric" } : {}),
	});
}

/**
 * Quiet band for a 0-100 score. Healthy scores get no colour at all; only scores
 * that need attention turn warm, so the eye lands on the problem.
 */
export function scoreBand(score: number): "is-bad" | "is-mid" | "is-ok" {
	if (score < 50) return "is-bad";
	if (score < 80) return "is-mid";
	return "is-ok";
}

/** "+7", "−12", "0". Uses a real minus sign so the column lines up. */
export function signed(n: number): string {
	if (n === 0) return "0";
	return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * Colour class for a change. Lower-is-better metrics (failures, warnings) flip.
 * Changes smaller than `min` stay neutral so noise does not shout.
 */
export function trendClass(delta: number, lowerIsBetter = false, min = 1): string {
	if (Math.abs(delta) < min) return "is-flat";
	const better = lowerIsBetter ? delta < 0 : delta > 0;
	return better ? "is-good" : "is-bad";
}

/**
 * Accepts what people type ("example.com", "https://example.com/blog") and returns
 * a crawlable URL, or null when it cannot be one.
 */
export function normalizeAuditUrl(input: string): string | null {
	const raw = input.trim();
	if (!raw) return null;
	const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
	try {
		const u = new URL(withScheme);
		if (u.protocol !== "http:" && u.protocol !== "https:") return null;
		if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
		return u.toString();
	} catch {
		return null;
	}
}

export function statusTone(status: Status): string {
	if (status === "fail") return "is-fail";
	if (status === "warn") return "is-warn";
	if (status === "info") return "is-info";
	return "is-pass";
}

export function statusLabel(status: Status): string {
	if (status === "fail") return "Failed";
	if (status === "warn") return "Warning";
	if (status === "info") return "Info";
	return "Passed";
}

export function severityLabel(sev: Severity): string {
	if (sev === "error") return "Error";
	if (sev === "warning") return "Warning";
	return "Info";
}

/** Category ids arrive as "core-seo" / "url-structure"; show them as words. */
export function categoryLabel(category: string): string {
	const special: Record<string, string> = {
		"core-seo": "Core SEO",
		eeat: "E-E-A-T",
		"url-structure": "URL structure",
		psi: "PageSpeed",
	};
	if (special[category]) return special[category];
	const words = category.replace(/-/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface StatusTotals {
	pass: number;
	warn: number;
	fail: number;
	info: number;
	total: number;
}

export function statusTotals(report: AuditReport): StatusTotals {
	const t: StatusTotals = { pass: 0, warn: 0, fail: 0, info: 0, total: 0 };
	for (const page of report.pages) {
		for (const f of page.findings) {
			t[f.status]++;
			t.total++;
		}
	}
	return t;
}

export interface Issue {
	ruleId: string;
	title: string;
	category: string;
	severity: Severity;
	status: Status;
	message: string;
	fix?: string;
	pages: string[];
}

const RANK: Record<Status, number> = { fail: 3, warn: 2, info: 1, pass: 0 };

/** Group non-passing findings by rule, tracking which pages each one appears on. */
export function buildIssues(report: AuditReport): Issue[] {
	const map = new Map<string, Issue>();
	for (const page of report.pages) {
		for (const f of page.findings) {
			if (f.status === "pass") continue;
			let issue = map.get(f.ruleId);
			if (!issue) {
				issue = {
					ruleId: f.ruleId,
					title: f.title,
					category: f.category,
					severity: f.severity,
					status: f.status,
					message: f.message,
					fix: f.fix,
					pages: [],
				};
				map.set(f.ruleId, issue);
			}
			if (RANK[f.status] > RANK[issue.status]) {
				issue.status = f.status;
				issue.message = f.message;
			}
			if (!issue.pages.includes(page.url)) issue.pages.push(page.url);
		}
	}
	return [...map.values()].sort(
		(a, b) => RANK[b.status] - RANK[a.status] || b.pages.length - a.pages.length,
	);
}

export function pct(part: number, whole: number): number {
	return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function countFindings(report: AuditReport): number {
	let n = 0;
	for (const page of report.pages) n += page.findings.length;
	return n;
}

export function pageCounts(page: PageReport): { fail: number; warn: number } {
	let fail = 0;
	let warn = 0;
	for (const f of page.findings) {
		if (f.status === "fail") fail++;
		else if (f.status === "warn") warn++;
	}
	return { fail, warn };
}

/** A page that did not load: 4xx, 5xx, or no response at all (status 0). */
export function isBroken(page: PageReport): boolean {
	return page.status >= 400 || page.status < 100;
}

export function isRedirect(page: PageReport): boolean {
	return page.status >= 300 && page.status < 400;
}

export function brokenPages(report: AuditReport): PageReport[] {
	return report.pages.filter(isBroken);
}

export interface StatusBuckets {
	"2xx": number;
	"3xx": number;
	"4xx": number;
	"5xx": number;
}

/** Pages by HTTP status class. No response at all counts with 5xx, as a server error. */
export function statusBuckets(report: AuditReport): StatusBuckets {
	const b: StatusBuckets = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
	for (const p of report.pages) {
		if (p.status >= 200 && p.status < 300) b["2xx"]++;
		else if (isRedirect(p)) b["3xx"]++;
		else if (p.status >= 400 && p.status < 500) b["4xx"]++;
		else b["5xx"]++;
	}
	return b;
}

/** Rules failing or warning now that were clean (or absent) in the earlier run. */
export function newRuleIds(report: AuditReport, previous: AuditReport | null): Set<string> {
	const ids = new Set<string>();
	if (!previous) return ids;
	const before = new Set<string>();
	for (const page of previous.pages)
		for (const f of page.findings) if (f.status === "fail" || f.status === "warn") before.add(f.ruleId);
	for (const page of report.pages)
		for (const f of page.findings)
			if ((f.status === "fail" || f.status === "warn") && !before.has(f.ruleId)) ids.add(f.ruleId);
	return ids;
}

// ---- sidebar grouping ----

export interface SiteGroup {
	host: string;
	runs: AuditListItem[];
	/** Score of the most recent run. */
	latest: number;
}

/** One group per site, newest run first, matching the folder-per-site layout on disk. */
export function groupBySite(items: AuditListItem[]): SiteGroup[] {
	const map = new Map<string, AuditListItem[]>();
	for (const item of items) {
		const host = hostOf(item.url);
		const runs = map.get(host);
		if (runs) runs.push(item);
		else map.set(host, [item]);
	}
	return [...map.entries()]
		.map(([host, runs]) => ({ host, runs, latest: runs[0]?.score ?? 0 }))
		.sort((a, b) => a.host.localeCompare(b.host));
}

// ---- metrics (scanner 1.0.x) ----

/** Only trouble gets coloured; a healthy measurement reads as ordinary text. */
export function metricTone(status: ValueStatus | undefined): string {
	if (status === "bad") return "is-bad";
	if (status === "warn") return "is-mid";
	if (status === "missing") return "is-missing";
	return "";
}

/** The value alone; the unit is set in a smaller, fainter span beside it. */
export function formatMetricValue(value: string | number | null): string {
	if (value === null || value === "") return "None";
	if (typeof value === "number") return value.toLocaleString();
	// Published / updated dates arrive as ISO timestamps; the day is what matters.
	return /^\d{4}-\d{2}-\d{2}T/.test(value) ? formatDay(value) : value;
}

export interface MetricRange {
	min: number;
	max: number;
}

/** The scanner writes targets as "Recommended 30 to 60"; anything else is not a range. */
export function parseRange(note: string | undefined): MetricRange | null {
	const m = note?.match(/recommended\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i);
	if (!m) return null;
	const min = Number(m[1]);
	const max = Number(m[2]);
	return min <= max ? { min, max } : null;
}

export function isFlagged(status: ValueStatus | undefined): status is "bad" | "warn" {
	return status === "bad" || status === "warn";
}

/** Measurements out of range on this page. */
export function flaggedCount(page: PageReport): number {
	let n = 0;
	for (const m of page.metrics ?? []) if (isFlagged(m.status)) n++;
	return n;
}

export interface OutOfRange {
	id: string;
	label: string;
	category: string;
	unit?: string;
	/** Worst status seen on any page. */
	status: "bad" | "warn";
	/** Pages where it is out of range, worst first. */
	pages: string[];
	bad: number;
	/** Spread of the flagged numeric values, when they are numbers. */
	low: number | null;
	high: number | null;
	range: MetricRange | null;
}

/**
 * One row per measurement that is out of range anywhere on the site, with the
 * pages it hits. Sorted: anything bad first, then by how many pages it reaches.
 */
export function outOfRange(report: AuditReport): OutOfRange[] {
	const map = new Map<string, OutOfRange>();
	for (const page of report.pages) {
		for (const m of page.metrics ?? []) {
			if (m.kind !== "value" || !isFlagged(m.status)) continue;
			let row = map.get(m.id);
			if (!row) {
				row = {
					id: m.id,
					label: m.label,
					category: m.category,
					unit: m.unit,
					status: m.status,
					pages: [],
					bad: 0,
					low: null,
					high: null,
					range: parseRange(m.note),
				};
				map.set(m.id, row);
			}
			if (m.status === "bad") {
				row.status = "bad";
				row.bad++;
				row.pages.unshift(page.url);
			} else row.pages.push(page.url);
			if (typeof m.value === "number") {
				row.low = row.low === null ? m.value : Math.min(row.low, m.value);
				row.high = row.high === null ? m.value : Math.max(row.high, m.value);
			}
		}
	}
	return [...map.values()].sort(
		(a, b) => Number(b.status === "bad") - Number(a.status === "bad") || b.pages.length - a.pages.length,
	);
}

export interface MetricGroup {
	category: string;
	metrics: Metric[];
}

/** Page metrics bucketed by category, categories in alphabetical order. */
export function groupMetrics(metrics: Metric[]): MetricGroup[] {
	const map = new Map<string, Metric[]>();
	for (const m of metrics) {
		const list = map.get(m.category);
		if (list) list.push(m);
		else map.set(m.category, [m]);
	}
	return [...map.entries()]
		.map(([category, list]) => ({ category, metrics: list }))
		.sort((a, b) => a.category.localeCompare(b.category));
}
