import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { AuditReport } from "./scanner";
import { auditFileName, buildNote, parseNote } from "./report-file";
import type { SafiSiteAuditSettings } from "./settings";

export interface AuditListItem {
	file: TFile;
	url: string;
	date: string;
	score: number;
	pages: number;
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const p = normalizePath(path);
	if (!app.vault.getAbstractFileByPath(p)) {
		await app.vault.createFolder(p).catch(() => {});
	}
}

export function listAudits(app: App, settings: SafiSiteAuditSettings): AuditListItem[] {
	const folder = app.vault.getAbstractFileByPath(normalizePath(settings.auditFolder));
	if (!(folder instanceof TFolder)) return [];
	const items: AuditListItem[] = [];
	for (const child of folder.children) {
		if (!(child instanceof TFile) || child.extension !== "md") continue;
		const fm = app.metadataCache.getFileCache(child)?.frontmatter as
			| { ssa_audit?: boolean; url?: string; date?: string; score?: number; pages?: number }
			| undefined;
		if (!fm?.ssa_audit) continue;
		items.push({
			file: child,
			url: fm.url ?? "",
			date: fm.date ?? "",
			score: typeof fm.score === "number" ? fm.score : 0,
			pages: typeof fm.pages === "number" ? fm.pages : 0,
		});
	}
	items.sort((a, b) => (a.date < b.date ? 1 : -1));
	return items;
}

export async function readAudit(app: App, file: TFile): Promise<AuditReport | null> {
	return parseNote(await app.vault.cachedRead(file));
}

export async function saveAudit(
	app: App,
	settings: SafiSiteAuditSettings,
	report: AuditReport,
): Promise<TFile> {
	await ensureFolder(app, settings.auditFolder);
	const base = auditFileName(report).replace(/\.md$/, "");
	let path = normalizePath(`${settings.auditFolder}/${base}.md`);
	let i = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = normalizePath(`${settings.auditFolder}/${base}-${i}.md`);
		i++;
	}
	return app.vault.create(path, buildNote(report));
}

export async function openInObsidian(app: App, file: TFile): Promise<void> {
	await app.workspace.getLeaf("tab").openFile(file);
}
