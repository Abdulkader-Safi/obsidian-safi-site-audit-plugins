import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import Dashboard from "./ui/Dashboard.svelte";
import type SafiSiteAuditPlugin from "./main";

export const VIEW_TYPE_SITE_AUDIT = "safi-site-audit-view";

export class AuditDashboardView extends ItemView {
	private component: Record<string, unknown> | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: SafiSiteAuditPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SITE_AUDIT;
	}
	getDisplayText(): string {
		return "Site Audit";
	}
	getIcon(): string {
		return "gauge";
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("safi-site-audit");
		this.component = mount(Dashboard, {
			target: this.contentEl,
			props: { plugin: this.plugin },
		});
	}

	async onClose() {
		if (this.component) {
			unmount(this.component);
			this.component = null;
		}
	}
}
