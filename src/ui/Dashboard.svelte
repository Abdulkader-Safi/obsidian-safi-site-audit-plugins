<script lang="ts">
	import { onMount } from "svelte";
	import type { EventRef } from "obsidian";
	import type { AuditReport } from "../scanner";
	import type SafiSiteAuditPlugin from "../main";
	import { progressPercent, type AuditProgress } from "../audit-runner";
	import type { DashboardMode, ReportContext } from "../audit-state";
	import { listAudits } from "../audit-store";
	import ReportView from "./ReportView.svelte";
	import RunAuditForm from "./RunAuditForm.svelte";
	import { hostOf, pathOf } from "./helpers";
	import { icon } from "./icon";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	// Mirrors of the plugin's shared state, so the sidebar and this tab stay in step.
	let mode = $state<DashboardMode>("empty");
	let report = $state<AuditReport | null>(null);
	let context = $state<ReportContext>({ earlier: [], previous: null, history: [] });
	let path = $state<string | null>(null);
	let loadingUrl = $state("");
	let running = $state(false);
	let runUrl = $state("");
	let progress = $state<AuditProgress | null>(null);
	let recent = $state<string[]>([]);
	let error = $state<{ url: string; message: string } | null>(null);
	let draftUrl = $state("");
	let hasAudits = $state(false);

	function sync() {
		const s = plugin.state;
		mode = s.mode;
		report = s.report;
		context = s.context;
		path = s.path;
		loadingUrl = s.loadingUrl;
		running = s.running;
		runUrl = s.runUrl;
		progress = s.progress;
		recent = s.recent;
		error = s.error;
		draftUrl = s.draftUrl;
		hasAudits = listAudits(plugin.app, plugin.settings).length > 0;
	}

	onMount(() => {
		sync();
		const ref: EventRef = plugin.state.onChange(sync);
		return () => plugin.state.offref(ref);
	});

	// Keep the typed URL on the shared state so it survives switching views.
	$effect(() => {
		plugin.state.draftUrl = draftUrl;
	});

	const percent = $derived(progress ? progressPercent(progress) : 0);
	const pagesLine = $derived.by(() => {
		if (!progress || progress.phase === "starting") return "Starting";
		if (progress.phase === "crawling") return `${progress.pagesFound} of up to ${progress.pagesTotal} pages found`;
		if (progress.phase === "checking") return `${progress.pagesDone} of ${progress.pagesTotal} pages checked`;
		return "Writing the report";
	});
</script>

<div class="ssa-view">
	<div class="ssa-container">
		{#if mode === "loading"}
			<div class="ssa-report" aria-busy="true">
				<header class="ssa-head">
					<div class="ssa-head-id">
						<h2 class="ssa-head-host">{hostOf(loadingUrl)}</h2>
						<span class="ssa-skel" style="width:22rem"></span>
					</div>
					<div class="ssa-head-actions">
						<span class="ssa-pill"><span class="ssa-spinner"></span>Loading report</span>
					</div>
				</header>
				<div class="ssa-tabs"><span class="ssa-skel" style="width:20rem;margin-bottom:10px"></span></div>
				<div class="ssa-kpis">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="ssa-card ssa-kpi">
							<span class="ssa-skel" style="width:40%"></span>
							<span class="ssa-skel ssa-skel-lg" style="width:55%"></span>
							<span class="ssa-skel" style="width:35%"></span>
						</div>
					{/each}
				</div>
				<div class="ssa-overview-main">
					<div class="ssa-card ssa-skel-block"></div>
					<div class="ssa-card ssa-skel-block"></div>
				</div>
			</div>
		{:else if mode === "detail" && report}
			<ReportView
				{report}
				{path}
				{plugin}
				{context}
				{running}
				{progress}
				onRerun={(url) => void plugin.runAndSave(url, undefined)}
			/>
		{:else if mode === "failed" && error}
			<div class="ssa-center">
				<div class="ssa-panel-card ssa-failed" role="alert">
					<span class="ssa-badge is-bad" use:icon={"x"}></span>
					<h2 class="ssa-panel-title">Audit failed</h2>
					<p class="ssa-panel-sub">Couldn't audit {hostOf(error.url)}</p>
					<code class="ssa-error-code">{error.message}</code>
					<div class="ssa-panel-actions is-center">
						<button class="ssa-btn" onclick={() => plugin.startNewAudit(error?.url)}>Edit URL</button>
						<button class="ssa-btn mod-cta" onclick={() => error && void plugin.runAndSave(error.url, undefined)}>
							Try again
						</button>
					</div>
				</div>
			</div>
		{:else if mode === "new" && running}
			<div class="ssa-center">
				<div class="ssa-panel-card ssa-running" role="status" aria-live="polite">
					<h2 class="ssa-panel-title ssa-with-spinner">
						<span class="ssa-spinner"></span>
						Auditing {hostOf(runUrl)}
					</h2>
					<div class="ssa-run-progress">
						<div class="ssa-run-progress-head">
							<span>{pagesLine}</span>
							<span class="ssa-faint">{percent}%</span>
						</div>
						<div class="ssa-bar is-lg"><span class="ssa-bar-fill is-accent" style="width:{percent}%"></span></div>
					</div>
					<div class="ssa-tiles">
						<div class="ssa-tile">
							<span class="ssa-tile-label">Pages found</span>
							<span class="ssa-tile-value">{(progress?.pagesFound ?? 0).toLocaleString()}</span>
						</div>
						<div class="ssa-tile">
							<span class="ssa-tile-label">Pages checked</span>
							<span class="ssa-tile-value">{(progress?.pagesDone ?? 0).toLocaleString()}</span>
						</div>
						<div class="ssa-tile">
							<span class="ssa-tile-label">Checks</span>
							<span class="ssa-tile-value">{(progress?.checksDone ?? 0).toLocaleString()}</span>
						</div>
					</div>
					{#if recent.length}
						<div class="ssa-recent">
							<span class="ssa-label">Latest pages</span>
							<ul class="ssa-recent-list">
								{#each recent as url (url)}
									<li title={url}>{pathOf(url)}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		{:else if mode === "new"}
			<div class="ssa-center">
				<RunAuditForm
					defaultPages={plugin.settings.defaultMaxPages}
					folder={plugin.settings.auditFolder}
					bind:url={draftUrl}
					canCancel={hasAudits}
					onCancel={() => plugin.state.showEmpty()}
					onSubmit={(url, pages) => void plugin.runAndSave(url, pages)}
				/>
			</div>
		{:else}
			<div class="ssa-center">
				<div class="ssa-blank">
					<span class="ssa-badge" use:icon={"activity"}></span>
					<h2 class="ssa-panel-title">{hasAudits ? "Nothing selected" : "No audits yet"}</h2>
					<p class="ssa-panel-sub">
						{hasAudits ? "Pick a run from the sidebar." : "Crawl a site to see its health and SEO issues."}
					</p>
					<button class="ssa-btn mod-cta" onclick={() => plugin.startNewAudit()}>
						<span use:icon={"plus"}></span>
						New audit
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
