<script lang="ts">
	import { Notice, TFile } from "obsidian";
	import type { AuditReport } from "../scanner";
	import type SafiSiteAuditPlugin from "../main";
	import type { ReportContext } from "../audit-state";
	import { progressPercent, type AuditProgress } from "../audit-runner";
	import { openExternally, openInObsidian, siblingPath } from "../audit-store";
	import { buildIssues, countFindings, formatDate, formatDay, hostOf } from "./helpers";
	import { icon } from "./icon";
	import OverviewPanel from "./OverviewPanel.svelte";
	import IssuesPanel from "./IssuesPanel.svelte";
	import PagesPanel from "./PagesPanel.svelte";
	import MetricsPanel from "./MetricsPanel.svelte";

	let {
		report,
		path,
		plugin,
		context,
		running,
		progress,
		onRerun,
	}: {
		report: AuditReport;
		path: string | null;
		plugin: SafiSiteAuditPlugin;
		context: ReportContext;
		running: boolean;
		progress: AuditProgress | null;
		onRerun: (url: string) => void;
	} = $props();

	type Tab = "overview" | "issues" | "pages" | "metrics";
	let tab = $state<Tab>("overview");
	/** Rule the Issues tab opens on, set when a Fix first row is clicked. */
	let focusRule = $state<string | null>(null);
	let pageFilter = $state<"all" | "broken" | "redirects" | "low">("all");

	const checks = $derived(countFindings(report));
	const ruleCount = $derived(buildIssues(report).length);
	const previous = $derived(context.previous?.report ?? null);
	const percent = $derived(progress ? progressPercent(progress) : 0);
	const runLine = $derived.by(() => {
		if (!progress || progress.phase === "starting") return "starting";
		if (progress.phase === "crawling") return `${progress.pagesFound} pages found`;
		if (progress.phase === "checking") return `${progress.pagesDone} of ${progress.pagesTotal} pages`;
		return "saving";
	});

	function go(next: Tab) {
		if (next !== "issues") focusRule = null;
		tab = next;
	}

	function openNote() {
		if (!path) return;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) void openInObsidian(plugin.app, file);
	}

	function openHtml() {
		if (!path) return;
		const html = siblingPath(path, "html");
		if (!plugin.app.vault.getAbstractFileByPath(html)) {
			new Notice("This audit has no HTML export. Run it again to create one.");
			return;
		}
		if (!openExternally(plugin.app, html)) new Notice(`HTML export saved at ${html}`);
	}
</script>

<div class="ssa-report">
	<header class="ssa-head">
		<div class="ssa-head-id">
			<h2 class="ssa-head-host">{hostOf(report.startUrl)}</h2>
			<p class="ssa-head-meta">
				<a class="ssa-head-url" href={report.startUrl} rel="noopener">{report.startUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
				<span>
					{formatDate(report.generatedAt)}
					<span class="ssa-sep">·</span>{report.pagesScanned.toLocaleString()} pages
					<span class="ssa-sep">·</span>{checks.toLocaleString()} checks
				</span>
			</p>
		</div>
		<div class="ssa-head-actions">
			{#if context.earlier.length > 0}
				<label class="ssa-compare">
					<span class="ssa-faint">vs</span>
					<select
						aria-label="Compare with an earlier run"
						value={context.previous?.path ?? ""}
						onchange={(e) => void plugin.compareWith(e.currentTarget.value)}
					>
						{#each context.earlier as run (run.file.path)}
							<option value={run.file.path}>{formatDay(run.date)}</option>
						{/each}
					</select>
					<span class="ssa-compare-chevron" use:icon={"chevron-down"}></span>
				</label>
				<span class="ssa-head-divider" aria-hidden="true"></span>
			{/if}
			{#if path}
				<button class="ssa-btn" onclick={openNote}>
					<span use:icon={"file-text"}></span>
					Open note
				</button>
				<button class="ssa-btn" onclick={openHtml}>
					<span use:icon={"external-link"}></span>
					HTML report
				</button>
			{/if}
			{#if running}
				<span class="ssa-pill is-accent" role="status">
					<span class="ssa-spinner"></span>
					Running <span class="ssa-muted">{runLine}</span>
				</span>
			{:else}
				<button class="ssa-btn mod-cta" onclick={() => onRerun(report.startUrl)}>
					<span use:icon={"refresh-cw"}></span>
					Run again
				</button>
			{/if}
		</div>
	</header>

	{#if running}
		<div class="ssa-stale">
			<div class="ssa-bar is-thin"><span class="ssa-bar-fill is-accent" style="width:{percent}%"></span></div>
			<span class="ssa-faint">Showing the {formatDay(report.generatedAt)} run until the new one finishes</span>
		</div>
	{/if}

	<div class="ssa-tabs" role="tablist" aria-label="Report sections">
		<button class="ssa-tab" class:is-on={tab === "overview"} role="tab" aria-selected={tab === "overview"} onclick={() => go("overview")}>
			Overview
		</button>
		<button class="ssa-tab" class:is-on={tab === "issues"} role="tab" aria-selected={tab === "issues"} onclick={() => go("issues")}>
			Issues <span class="ssa-count">{ruleCount}</span>
		</button>
		<button class="ssa-tab" class:is-on={tab === "pages"} role="tab" aria-selected={tab === "pages"} onclick={() => go("pages")}>
			Pages <span class="ssa-count">{report.pagesScanned}</span>
		</button>
		<button class="ssa-tab" class:is-on={tab === "metrics"} role="tab" aria-selected={tab === "metrics"} onclick={() => go("metrics")}>
			Measurements
		</button>
	</div>

	{#if tab === "overview"}
		<OverviewPanel
			{report}
			{previous}
			history={context.history}
			onOpenRule={(id) => {
				focusRule = id;
				tab = "issues";
			}}
			onShowRules={() => go("issues")}
			onShowBroken={() => {
				pageFilter = "broken";
				go("pages");
			}}
		/>
	{:else if tab === "issues"}
		{#key focusRule}
			<IssuesPanel {report} {previous} {focusRule} />
		{/key}
	{:else if tab === "pages"}
		<PagesPanel {report} {previous} bind:filter={pageFilter} />
	{:else}
		<MetricsPanel {report} {previous} />
	{/if}
</div>
