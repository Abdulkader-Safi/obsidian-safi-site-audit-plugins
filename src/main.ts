import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, SafiSiteAuditSettingTab, type SafiSiteAuditSettings } from "./settings";
import { AuditDashboardView, VIEW_TYPE_SITE_AUDIT } from "./view";

export default class SafiSiteAuditPlugin extends Plugin {
	settings: SafiSiteAuditSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_SITE_AUDIT, (leaf) => new AuditDashboardView(leaf, this));

		this.addRibbonIcon("gauge", "Open Safi Site Audit", () => this.activateView());

		this.addCommand({
			id: "open-site-audit-dashboard",
			name: "Open dashboard",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new SafiSiteAuditSettingTab(this.app, this));
	}

	async activateView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_SITE_AUDIT)[0];
		const leaf = existing ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SITE_AUDIT, active: true });
		await workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<SafiSiteAuditSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
