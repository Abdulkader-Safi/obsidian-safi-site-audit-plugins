import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, SafiSiteAuditSettingTab, type SafiSiteAuditSettings } from "./settings";
import {
	AuditDashboardView,
	AuditListView,
	VIEW_TYPE_SITE_AUDIT,
	VIEW_TYPE_SITE_AUDIT_LIST,
} from "./view";
import { AuditState, type Comparison } from "./audit-state";
import { listAudits, readAudit, saveAudit, type AuditListItem } from "./audit-store";
import { runAudit } from "./audit-runner";
import type { AuditReport } from "./scanner";
import { hostOf } from "./ui/helpers";

export default class SafiSiteAuditPlugin extends Plugin {
	settings: SafiSiteAuditSettings = DEFAULT_SETTINGS;
	/** Shared by the sidebar list and the dashboard tab. */
	state = new AuditState();

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_SITE_AUDIT, (leaf) => new AuditDashboardView(leaf, this));
		this.registerView(VIEW_TYPE_SITE_AUDIT_LIST, (leaf) => new AuditListView(leaf, this));

		this.addRibbonIcon("gauge", "Open Safi Site Audit", () => {
			void this.openWorkspace();
		});

		this.addCommand({
			id: "open-site-audit-dashboard",
			name: "Open dashboard",
			callback: () => void this.openWorkspace(),
		});

		this.addCommand({
			id: "run-site-audit",
			name: "Run a new audit",
			callback: () => {
				this.state.showRunForm();
				void this.openWorkspace();
			},
		});

		this.addSettingTab(new SafiSiteAuditSettingTab(this.app, this));
	}

	/** Sidebar list on the left, report in a main-area tab. */
	async openWorkspace(): Promise<void> {
		await this.activateList();
		await this.activateDashboard();
	}

	async activateDashboard(): Promise<void> {
		const { workspace } = this.app;
		const leaf: WorkspaceLeaf =
			workspace.getLeavesOfType(VIEW_TYPE_SITE_AUDIT)[0] ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SITE_AUDIT, active: true });
		await workspace.revealLeaf(leaf);
	}

	async activateList(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_SITE_AUDIT_LIST)[0];
		const leaf = existing ?? workspace.getLeftLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_SITE_AUDIT_LIST, active: true });
		await workspace.revealLeaf(leaf);
	}

	/** Picked from the sidebar: load the report and show it in the dashboard tab. */
	async openAudit(item: AuditListItem): Promise<void> {
		this.state.showLoading(item.file.path, item.url);
		await this.activateDashboard();
		const report = await readAudit(this.app, item.file);
		// Another run was picked while this one loaded; let that one win.
		if (this.state.path !== item.file.path) return;
		if (!report) {
			new Notice("Could not read this audit's report data.");
			this.state.showEmpty();
			return;
		}
		await this.showWithContext(item.file.path, report);
	}

	/** Show a report with its site's earlier runs, the run before it, and the score history. */
	private async showWithContext(path: string, report: AuditReport): Promise<void> {
		const host = hostOf(report.startUrl);
		// Date filter as well as path: a run just saved may not be indexed yet.
		const earlier = listAudits(this.app, this.settings).filter(
			(i) => i.file.path !== path && hostOf(i.url) === host && i.date < report.generatedAt,
		);
		const history = [
			...earlier
				.slice(0, 7)
				.reverse()
				.map((i) => ({ date: i.date, score: i.score })),
			{ date: report.generatedAt, score: report.score },
		];
		const previous = earlier[0] ? await this.loadComparison(earlier[0]) : null;
		this.state.showReport(path, report, { earlier, previous, history });
	}

	private async loadComparison(item: AuditListItem): Promise<Comparison | null> {
		const report = await readAudit(this.app, item.file);
		return report ? { path: item.file.path, date: item.date, report } : null;
	}

	/** The "vs" picker in the report header. */
	async compareWith(path: string): Promise<void> {
		const item = this.state.context.earlier.find((i) => i.file.path === path);
		if (!item) return;
		this.state.setComparison(await this.loadComparison(item));
	}

	startNewAudit(url = ""): void {
		this.state.showRunForm(url);
		void this.activateDashboard();
	}

	/**
	 * Runs the crawl, saves the three exports, and shows the result. Started from a
	 * report ("Run again"), the old report stays on screen until the new one lands.
	 */
	async runAndSave(url: string, maxPages: number | undefined): Promise<void> {
		if (!url) {
			new Notice("Enter a URL to audit.");
			return;
		}
		if (this.state.running) return;
		if (this.state.mode !== "detail") this.state.showRunForm(url);
		this.state.startRun(url);
		try {
			const report = await runAudit({ url, maxPages }, this.settings, (progress) => {
				this.state.setProgress(progress);
			});
			const { note } = await saveAudit(this.app, this.settings, report);
			// Show it straight from the in-memory report; the metadata cache may lag.
			await this.showWithContext(note.path, report);
			new Notice(`Audit saved to ${note.parent?.path ?? this.settings.auditFolder}`);
		} catch (e) {
			this.state.draftUrl = url;
			this.state.showFailed(url, (e as Error).message || String(e));
		} finally {
			this.state.endRun();
		}
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<SafiSiteAuditSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
