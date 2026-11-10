import {
	AbstractInputSuggest,
	App,
	PluginSettingTab,
	Setting,
	TFolder,
	type SettingDefinitionItem,
} from "obsidian";
import type SafiSiteAuditPlugin from "./main";

export interface SafiSiteAuditSettings {
	auditFolder: string;
	defaultMaxPages: number;
	concurrency: number;
	psiKey: string;
	userAgent: string;
}

export const DEFAULT_SETTINGS: SafiSiteAuditSettings = {
	auditFolder: "Site Audits",
	defaultMaxPages: 20,
	concurrency: 5,
	psiKey: "",
	userAgent: "",
};

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, private input: HTMLInputElement, private onPick: (path: string) => void) {
		super(app, input);
	}
	getSuggestions(query: string): TFolder[] {
		const lower = query.toLowerCase();
		return this.app.vault.getAllFolders().filter((f) => f.path.toLowerCase().contains(lower));
	}
	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.setText(folder.path);
	}
	selectSuggestion(folder: TFolder) {
		this.input.value = folder.path;
		this.input.trigger("input");
		this.onPick(folder.path);
		this.close();
	}
}

interface Row {
	name: string;
	desc: string;
	aliases?: string[];
	/** Adds the control to a row whose name and description are already set. */
	build: (setting: Setting) => void;
}

export class SafiSiteAuditSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SafiSiteAuditPlugin) {
		super(app, plugin);
	}

	private positiveInt(value: string, fallback: number): number {
		const n = Number(value);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
	}

	private rows(): Row[] {
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		return [
			{
				name: "Audit folder",
				desc: "Vault folder where audit notes are saved and listed in the dashboard.",
				aliases: ["location", "path"],
				build: (setting) =>
					setting.addText((text) => {
						text.setPlaceholder("Site Audits")
							.setValue(s.auditFolder)
							.onChange(async (value) => {
								s.auditFolder = value.trim() || "Site Audits";
								await save();
							});
						new FolderSuggest(this.app, text.inputEl, (path) => {
							s.auditFolder = path;
							void save();
						});
					}),
			},
			{
				name: "Default pages",
				desc: "Pages to crawl when the run dialog's page field is left empty.",
				aliases: ["max pages", "crawl limit"],
				build: (setting) =>
					setting.addText((text) =>
						text
							.setPlaceholder("20")
							.setValue(String(s.defaultMaxPages))
							.onChange(async (value) => {
								s.defaultMaxPages = this.positiveInt(value, 20);
								await save();
							}),
					),
			},
			{
				name: "Concurrency",
				desc: "How many pages to fetch in parallel.",
				aliases: ["parallel", "speed"],
				build: (setting) =>
					setting.addText((text) =>
						text
							.setPlaceholder("5")
							.setValue(String(s.concurrency))
							.onChange(async (value) => {
								s.concurrency = this.positiveInt(value, 5);
								await save();
							}),
					),
			},
			{
				name: "PageSpeed Insights API key",
				desc: "Optional. Enables Core Web Vitals and accessibility checks via Google PSI.",
				aliases: ["psi", "core web vitals", "google"],
				build: (setting) =>
					setting.addText((text) => {
						text.inputEl.type = "password";
						text.setPlaceholder("AIza...")
							.setValue(s.psiKey)
							.onChange(async (value) => {
								s.psiKey = value.trim();
								await save();
							});
					}),
			},
			{
				name: "User agent",
				desc: "Optional override for the crawler's User-Agent header.",
				aliases: ["crawler", "header"],
				build: (setting) =>
					setting.addText((text) =>
						text
							.setPlaceholder("SafiStudioScanner/0.1")
							.setValue(s.userAgent)
							.onChange(async (value) => {
								s.userAgent = value;
								await save();
							}),
					),
			},
		];
	}

	// Obsidian 1.13+ renders the tab from these, and indexes them for settings search.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.rows().map(({ name, desc, aliases, build }) => ({
			name,
			desc,
			aliases,
			render: (setting: Setting) => build(setting),
		}));
	}

	// ponytail: fallback for Obsidian 1.7.2 to 1.12, which never call getSettingDefinitions.
	// Drop it once minAppVersion reaches 1.13.0.
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const row of this.rows()) {
			row.build(new Setting(containerEl).setName(row.name).setDesc(row.desc));
		}
	}
}
