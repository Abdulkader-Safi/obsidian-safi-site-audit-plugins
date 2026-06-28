import { render, type AuditReport } from "safi-studio-scanner";

// Each audit is one Markdown note: small frontmatter for the dashboard list, the SDK's
// rendered Markdown for human reading, and the full report JSON in a fenced block so the
// dashboard can render the rich view without re-crawling.

const FENCE = "ssa-report-json";

export function buildNote(report: AuditReport): string {
	const frontmatter = [
		"---",
		"ssa_audit: true",
		`url: ${JSON.stringify(report.startUrl)}`,
		`date: ${JSON.stringify(report.generatedAt)}`,
		`score: ${report.score}`,
		`pages: ${report.pagesScanned}`,
		"---",
		"",
	].join("\n");

	const body = render(report, "md");
	const data = `\n\n## Report data\n\n\`\`\`${FENCE}\n${JSON.stringify(report)}\n\`\`\`\n`;
	return frontmatter + body + data;
}

export function parseNote(content: string): AuditReport | null {
	const re = new RegExp("```" + FENCE + "\\n([\\s\\S]*?)\\n```");
	const m = content.match(re);
	if (!m) return null;
	try {
		return JSON.parse(m[1]) as AuditReport;
	} catch {
		return null;
	}
}

export function auditFileName(report: AuditReport): string {
	let host = report.startUrl;
	try {
		host = new URL(report.startUrl).hostname || report.startUrl;
	} catch {
		/* keep raw */
	}
	const safeHost = host.replace(/[^a-z0-9.-]/gi, "-").replace(/^-+|-+$/g, "") || "site";
	const d = new Date(report.generatedAt);
	const stamp = isNaN(d.getTime())
		? "audit"
		: d.toISOString().slice(0, 16).replace(/[T:]/g, "-");
	return `${safeHost}-${stamp}.md`;
}
