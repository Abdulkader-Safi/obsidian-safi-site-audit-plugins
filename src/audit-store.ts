import { App, TFile, normalizePath } from "obsidian";
import type { AuditReport } from "./scanner";
import { buildHtml, buildJson, buildNote, parseNote, runBaseName, siteFolderName } from "./report-file";
import type { SafiSiteAuditSettings } from "./settings";

export interface AuditListItem {
	/** The Markdown note. Its sibling exports share this path with a different extension. */
	file: TFile;
	url: string;
	date: string;
	score: number;
	pages: number;
}

export interface SavedAudit {
	note: TFile;
	json: TFile;
	html: TFile;
}

/** Sibling export path for a note, e.g. ".../2026-06-28-15-30.json". */
export function siblingPath(notePath: string, ext: "json" | "html"): string {
	return notePath.replace(/\.md$/, `.${ext}`);
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const p = normalizePath(path);
	if (!app.vault.getAbstractFileByPath(p)) {
		await app.vault.createFolder(p).catch(() => {
			/* already created by a concurrent run */
		});
	}
}

export function listAudits(app: App, settings: SafiSiteAuditSettings): AuditListItem[] {
	const prefix = `${normalizePath(settings.auditFolder)}/`;
	const items: AuditListItem[] = [];

	// Notes now live one level down, in a folder per site, so scan the subtree
	// rather than one folder's direct children.
	for (const file of app.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(prefix)) continue;
		const fm = app.metadataCache.getFileCache(file)?.frontmatter as
			| { ssa_audit?: boolean; url?: string; date?: string; score?: number; pages?: number }
			| undefined;
		if (!fm?.ssa_audit) continue;
		items.push({
			file,
			url: fm.url ?? "",
			date: fm.date ?? "",
			score: typeof fm.score === "number" ? fm.score : 0,
			pages: typeof fm.pages === "number" ? fm.pages : 0,
		});
	}

	items.sort((a, b) => (a.date < b.date ? 1 : -1));
	return items;
}

/**
 * Full report for a listed audit. Reads the JSON export, falling back to the JSON
 * embedded in the note by 0.5.x and earlier.
 */
export async function readAudit(app: App, note: TFile): Promise<AuditReport | null> {
	const json = app.vault.getAbstractFileByPath(siblingPath(note.path, "json"));
	if (json instanceof TFile) {
		try {
			return JSON.parse(await app.vault.cachedRead(json)) as AuditReport;
		} catch {
			return null;
		}
	}
	return parseNote(await app.vault.cachedRead(note));
}

export async function saveAudit(
	app: App,
	settings: SafiSiteAuditSettings,
	report: AuditReport,
): Promise<SavedAudit> {
	const folder = `${settings.auditFolder}/${siteFolderName(report)}`;
	await ensureFolder(app, settings.auditFolder);
	await ensureFolder(app, folder);

	// All three exports share one base name, so a run stays together in the folder.
	const stamp = runBaseName(report);
	let base = stamp;
	let i = 2;
	while (app.vault.getAbstractFileByPath(normalizePath(`${folder}/${base}.md`))) {
		base = `${stamp}-${i}`;
		i++;
	}

	const path = (ext: string) => normalizePath(`${folder}/${base}.${ext}`);
	const note = await app.vault.create(path("md"), buildNote(report));
	const json = await app.vault.create(path("json"), buildJson(report));
	const html = await app.vault.create(path("html"), buildHtml(report));
	return { note, json, html };
}

export async function openInObsidian(app: App, file: TFile): Promise<void> {
	await app.workspace.getLeaf("tab").openFile(file);
}

/**
 * Hand a file to the OS, for the HTML export that Obsidian cannot render itself.
 * Returns false when the host build exposes no such method, so the caller can show
 * the path instead.
 */
export function openExternally(app: App, path: string): boolean {
	const open = (app as App & { openWithDefaultApp?: (p: string) => Promise<void> })
		.openWithDefaultApp;
	if (typeof open !== "function") return false;
	void open.call(app, normalizePath(path));
	return true;
}
