import type { AuditReport, Severity, Status } from "safi-studio-scanner";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}

export function scoreVariant(score: number): BadgeVariant {
	if (score >= 80) return "default";
	if (score >= 50) return "secondary";
	return "destructive";
}

export function severityVariant(sev: Severity): BadgeVariant {
	if (sev === "error") return "destructive";
	if (sev === "warning") return "secondary";
	return "outline";
}

export function statusVariant(status: Status): BadgeVariant {
	if (status === "fail") return "destructive";
	if (status === "warn") return "secondary";
	if (status === "pass") return "default";
	return "outline";
}

export function grade(score: number): string {
	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 60) return "D";
	return "F";
}

export function gradeVariant(score: number): BadgeVariant {
	if (score >= 80) return "default";
	if (score >= 60) return "secondary";
	return "destructive";
}

// ponytail: traffic-light data-viz colors. There's no green/amber semantic token in the
// shadcn palette, and a score bar genuinely needs them.
export function barColor(score: number): string {
	if (score >= 80) return "bg-emerald-500";
	if (score >= 50) return "bg-amber-500";
	return "bg-red-500";
}

export function statusDot(status: Status): string {
	if (status === "fail") return "bg-red-500";
	if (status === "warn") return "bg-amber-500";
	if (status === "info") return "bg-sky-500";
	return "bg-emerald-500";
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
