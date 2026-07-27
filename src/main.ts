import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, SafiSiteAuditSettingTab, type SafiSiteAuditSettings } from "./settings";
import {
	AuditDashboardView,
	AuditListView,
	VIEW_TYPE_SITE_AUDIT,
	VIEW_TYPE_SITE_AUDIT_LIST,
} from "./view";
import { AuditState } from "./audit-state";
import { readAudit, saveAudit, type AuditListItem } from "./audit-store";
import { runAudit } from "./audit-runner";

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
		const report = await readAudit(this.app, item.file);
		if (!report) {
			new Notice("Could not read this audit's report data.");
			return;
		}
		this.state.showReport(item.file.path, report);
		await this.activateDashboard();
	}

	startNewAudit(url = ""): void {
		this.state.showRunForm(url);
		void this.activateDashboard();
	}

	/** Runs the crawl, saves the three exports, and shows the result. */
	async runAndSave(url: string, maxPages: number | undefined): Promise<void> {
		if (!url) {
			new Notice("Enter a URL to audit.");
			return;
		}
		this.state.setRunning(true);
		try {
			const report = await runAudit({ url, maxPages }, this.settings, (progress) => {
				this.state.setRunning(true, progress);
			});
			const { note } = await saveAudit(this.app, this.settings, report);
			// Show it straight from the in-memory report; the metadata cache may lag.
			this.state.showReport(note.path, report);
			new Notice(`Audit saved to ${note.parent?.path ?? this.settings.auditFolder}`);
		} catch (e) {
			new Notice(`Audit failed: ${(e as Error).message}`);
		} finally {
			this.state.setRunning(false);
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
