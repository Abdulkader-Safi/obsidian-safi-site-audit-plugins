import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component } from "svelte";
import Dashboard from "./ui/Dashboard.svelte";
import AuditList from "./ui/AuditList.svelte";
import type SafiSiteAuditPlugin from "./main";

export const VIEW_TYPE_SITE_AUDIT = "safi-site-audit-view";
export const VIEW_TYPE_SITE_AUDIT_LIST = "safi-site-audit-list";

abstract class SvelteView extends ItemView {
	private component: Record<string, unknown> | null = null;

	constructor(leaf: WorkspaceLeaf, protected plugin: SafiSiteAuditPlugin) {
		super(leaf);
	}

	/** Class on contentEl; styles.css uses it to drop padding and fill the pane. */
	protected abstract rootClass(): string;
	protected abstract root(): Component<{ plugin: SafiSiteAuditPlugin }>;

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass(this.rootClass());
		this.component = mount(this.root(), {
			target: this.contentEl,
			props: { plugin: this.plugin },
		}) as Record<string, unknown>;
	}

	async onClose() {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
	}
}

/** The full-width report, in a main-area tab. */
export class AuditDashboardView extends SvelteView {
	getViewType(): string {
		return VIEW_TYPE_SITE_AUDIT;
	}
	getDisplayText(): string {
		return "Site Audit";
	}
	getIcon(): string {
		return "gauge";
	}
	protected rootClass(): string {
		return "safi-site-audit";
	}
	protected root() {
		return Dashboard as Component<{ plugin: SafiSiteAuditPlugin }>;
	}
}

/** The audit history, in the sidebar. */
export class AuditListView extends SvelteView {
	getViewType(): string {
		return VIEW_TYPE_SITE_AUDIT_LIST;
	}
	getDisplayText(): string {
		return "Site audits";
	}
	getIcon(): string {
		return "gauge";
	}
	protected rootClass(): string {
		return "safi-site-audit-list";
	}
	protected root() {
		return AuditList as Component<{ plugin: SafiSiteAuditPlugin }>;
	}
}
