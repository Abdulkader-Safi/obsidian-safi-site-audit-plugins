import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFolder } from "obsidian";
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
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path.toLowerCase().contains(lower));
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

export class SafiSiteAuditSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: SafiSiteAuditPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Audit folder")
			.setDesc("Vault folder where audit notes are saved and listed in the dashboard.")
			.addText((text) => {
				text.setPlaceholder("Site Audits")
					.setValue(this.plugin.settings.auditFolder)
					.onChange(async (value) => {
						this.plugin.settings.auditFolder = value.trim() || "Site Audits";
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl, (path) => {
					this.plugin.settings.auditFolder = path;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Default pages")
			.setDesc("Pages to crawl when the run dialog's page field is left empty.")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.defaultMaxPages))
					.onChange(async (value) => {
						const n = Number(value);
						this.plugin.settings.defaultMaxPages = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Concurrency")
			.setDesc("How many pages to fetch in parallel.")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.concurrency))
					.onChange(async (value) => {
						const n = Number(value);
						this.plugin.settings.concurrency = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("PageSpeed Insights API key")
			.setDesc("Optional. Enables Core Web Vitals and accessibility checks via Google PSI.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("AIza…")
					.setValue(this.plugin.settings.psiKey)
					.onChange(async (value) => {
						this.plugin.settings.psiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("User agent")
			.setDesc("Optional override for the crawler's User-Agent header.")
			.addText((text) =>
				text
					.setPlaceholder("SafiStudioScanner/0.1")
					.setValue(this.plugin.settings.userAgent)
					.onChange(async (value) => {
						this.plugin.settings.userAgent = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
