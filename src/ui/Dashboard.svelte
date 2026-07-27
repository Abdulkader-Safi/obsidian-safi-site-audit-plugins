<script lang="ts">
	import { onMount } from "svelte";
	import type { EventRef } from "obsidian";
	import type { AuditReport } from "../scanner";
	import type SafiSiteAuditPlugin from "../main";
	import type { AuditProgress } from "../audit-runner";
	import type { DashboardMode } from "../audit-state";
	import ReportView from "./ReportView.svelte";
	import RunAuditForm from "./RunAuditForm.svelte";
	import { icon } from "./icon";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	// Mirrors of the plugin's shared state, so the sidebar and this tab stay in step.
	let mode = $state<DashboardMode>("empty");
	let report = $state<AuditReport | null>(null);
	let path = $state<string | null>(null);
	let running = $state(false);
	let progress = $state<AuditProgress | null>(null);
	let draftUrl = $state("");

	function sync() {
		mode = plugin.state.mode;
		report = plugin.state.report;
		path = plugin.state.path;
		running = plugin.state.running;
		progress = plugin.state.progress;
		draftUrl = plugin.state.draftUrl;
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
</script>

<div class="ssa-view">
	{#if mode === "detail" && report}
		<ReportView {report} {path} {plugin} onRerun={(url) => plugin.startNewAudit(url)} />
	{:else if mode === "new"}
		<RunAuditForm
			defaultPages={plugin.settings.defaultMaxPages}
			folder={plugin.settings.auditFolder}
			bind:url={draftUrl}
			{running}
			{progress}
			onSubmit={(url, pages) => void plugin.runAndSave(url, pages)}
		/>
	{:else}
		<div class="ssa-blank">
			<h2 class="ssa-blank-title">Nothing selected</h2>
			<p class="ssa-blank-text">
				Pick a run from the sidebar, or audit a site. Every run is saved as Markdown, JSON and
				HTML in a folder named after the site.
			</p>
			<button class="ssa-btn ssa-btn-primary" onclick={() => plugin.startNewAudit()}>
				<span use:icon={"plus"}></span>
				New audit
			</button>
		</div>
	{/if}
</div>
