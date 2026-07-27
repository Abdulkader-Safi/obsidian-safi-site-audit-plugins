import { render, type AuditReport } from "./scanner";

// Every audit writes three sibling exports into a folder named after the site:
//
//   Site Audits/example.com/2026-06-28-15-30.md      <- human reading, opened in Obsidian
//   Site Audits/example.com/2026-06-28-15-30.json    <- full report, what the dashboard reads
//   Site Audits/example.com/2026-06-28-15-30.html    <- standalone report, opens outside Obsidian
//
// The note carries only small frontmatter plus the rendered Markdown. Earlier versions
// embedded the whole report as JSON inside the note, which made large audits slow to
// open; the data now lives in its own file Obsidian never has to parse as a note.

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

	return frontmatter + render(report, "md");
}

export function buildJson(report: AuditReport): string {
	return JSON.stringify(report);
}

export function buildHtml(report: AuditReport): string {
	return render(report, "html");
}

/**
 * Read a report out of a legacy note that embedded its JSON in a fenced block.
 * Audits saved by 0.5.x and earlier still open this way.
 */
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

/** Folder name for a site: its hostname, reduced to characters safe in a vault path. */
export function siteFolderName(report: AuditReport): string {
	let host = report.startUrl;
	try {
		host = new URL(report.startUrl).hostname || report.startUrl;
	} catch {
		/* keep raw */
	}
	return host.replace(/[^a-z0-9.-]/gi, "-").replace(/^-+|-+$/g, "") || "site";
}

/** Base name shared by a run's three exports: a minute-precision timestamp. */
export function runBaseName(report: AuditReport): string {
	const d = new Date(report.generatedAt);
	if (isNaN(d.getTime())) return "audit";
	return d.toISOString().slice(0, 16).replace(/[T:]/g, "-");
}
