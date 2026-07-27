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

/** Short form for dense lists: the time for today, the date otherwise. */
export function formatDateShort(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	const today = new Date();
	const sameDay =
		d.getDate() === today.getDate() &&
		d.getMonth() === today.getMonth() &&
		d.getFullYear() === today.getFullYear();
	return sameDay
		? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
		: d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function grade(score: number): string {
	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 60) return "D";
	return "F";
}

/** Traffic-light class for a 0-100 score: green good, amber middling, red bad. */
export function scoreTone(score: number): string {
	if (score >= 80) return "is-good";
	if (score >= 50) return "is-mid";
	return "is-bad";
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

/** Findings worth showing on a page row: everything that did not pass. */
export function pageIssueCount(page: PageReport): number {
	let n = 0;
	for (const f of page.findings) if (f.status !== "pass") n++;
	return n;
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

export function formatMetricValue(value: string | number | null, unit?: string): string {
	if (value === null || value === "") return "None";
	const text = typeof value === "number" ? value.toLocaleString() : value;
	return unit ? `${text} ${unit}` : text;
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
