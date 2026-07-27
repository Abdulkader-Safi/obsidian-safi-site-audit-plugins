<script lang="ts">
	import { Notice, TFile } from "obsidian";
	import type { AuditReport } from "../scanner";
	import type SafiSiteAuditPlugin from "../main";
	import { openExternally, openInObsidian, siblingPath } from "../audit-store";
	import {
		categoryLabel,
		countFindings,
		formatDate,
		hostOf,
		scoreTone,
		statusTotals,
	} from "./helpers";
	import { icon } from "./icon";
	import ScoreGauge from "./ScoreGauge.svelte";
	import IssuesPanel from "./IssuesPanel.svelte";
	import PagesPanel from "./PagesPanel.svelte";
	import MetricsPanel from "./MetricsPanel.svelte";

	let {
		report,
		path,
		plugin,
		onRerun,
	}: {
		report: AuditReport;
		path: string | null;
		plugin: SafiSiteAuditPlugin;
		onRerun: (url: string) => void;
	} = $props();

	const totals = $derived(statusTotals(report));
	const checks = $derived(countFindings(report));

	let tab = $state<"issues" | "pages" | "metrics">("issues");
	let sort = $state<"worst" | "best" | "az">("worst");

	const sortedCategories = $derived(
		[...report.categories].sort((a, b) => {
			if (sort === "az") return categoryLabel(a.category).localeCompare(categoryLabel(b.category));
			return sort === "worst" ? a.score - b.score : b.score - a.score;
		}),
	);

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
			<a class="ssa-head-url" href={report.startUrl} rel="noopener">{report.startUrl}</a>
			<p class="ssa-head-meta">
				{formatDate(report.generatedAt)}
				<span class="ssa-sep">·</span>
				{report.pagesScanned.toLocaleString()} pages
				<span class="ssa-sep">·</span>
				{checks.toLocaleString()} checks
			</p>
		</div>
		<div class="ssa-head-actions">
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
			<button class="ssa-btn" onclick={() => onRerun(report.startUrl)}>
				<span use:icon={"refresh-cw"}></span>
				Run again
			</button>
		</div>
	</header>

	<section class="ssa-score">
		<ScoreGauge value={report.score} />
		<div class="ssa-score-body">
			<div
				class="ssa-split"
				role="img"
				aria-label="{totals.pass} passed, {totals.warn} warnings, {totals.fail} failed, {totals.info} informational"
			>
				{#if totals.pass}<span class="ssa-split-seg is-pass" style="flex-grow:{totals.pass}"></span>{/if}
				{#if totals.warn}<span class="ssa-split-seg is-warn" style="flex-grow:{totals.warn}"></span>{/if}
				{#if totals.fail}<span class="ssa-split-seg is-fail" style="flex-grow:{totals.fail}"></span>{/if}
				{#if totals.info}<span class="ssa-split-seg is-info" style="flex-grow:{totals.info}"></span>{/if}
			</div>
			<dl class="ssa-tallies">
				<div class="ssa-tally">
					<dt>Passed</dt>
					<dd class="is-pass">{totals.pass.toLocaleString()}</dd>
				</div>
				<div class="ssa-tally">
					<dt>Warnings</dt>
					<dd class="is-warn">{totals.warn.toLocaleString()}</dd>
				</div>
				<div class="ssa-tally">
					<dt>Failed</dt>
					<dd class="is-fail">{totals.fail.toLocaleString()}</dd>
				</div>
				<div class="ssa-tally">
					<dt>Info</dt>
					<dd class="is-info">{totals.info.toLocaleString()}</dd>
				</div>
			</dl>
		</div>
	</section>

	<section class="ssa-cats-block">
		<div class="ssa-block-head">
			<h3 class="ssa-block-title">Category scores</h3>
			<div class="ssa-segmented">
				<button class="ssa-seg" class:is-on={sort === "worst"} onclick={() => (sort = "worst")}>Worst</button>
				<button class="ssa-seg" class:is-on={sort === "best"} onclick={() => (sort = "best")}>Best</button>
				<button class="ssa-seg" class:is-on={sort === "az"} onclick={() => (sort = "az")}>A–Z</button>
			</div>
		</div>
		<div class="ssa-cats">
			{#each sortedCategories as cat (cat.category)}
				<div class="ssa-cat">
					<span class="ssa-cat-name" title={categoryLabel(cat.category)}>{categoryLabel(cat.category)}</span>
					<span class="ssa-cat-track">
						<span class="ssa-cat-fill {scoreTone(cat.score)}" style="width:{cat.score}%"></span>
					</span>
					<span class="ssa-cat-score">{cat.score}</span>
				</div>
			{/each}
		</div>
	</section>

	<nav class="ssa-tabs">
		<button class="ssa-tab" class:is-on={tab === "issues"} onclick={() => (tab = "issues")}>Issues</button>
		<button class="ssa-tab" class:is-on={tab === "pages"} onclick={() => (tab = "pages")}>Pages</button>
		<button class="ssa-tab" class:is-on={tab === "metrics"} onclick={() => (tab = "metrics")}>
			Measurements
		</button>
	</nav>

	{#if tab === "issues"}
		<IssuesPanel {report} />
	{:else if tab === "pages"}
		<PagesPanel {report} />
	{:else}
		<MetricsPanel {report} />
	{/if}
</div>
