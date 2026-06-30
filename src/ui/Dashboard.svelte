<script lang="ts">
	import { onMount } from "svelte";
	import { Notice, type TFile, type EventRef } from "obsidian";
	import type { AuditReport } from "safi-studio-scanner";
	import type SafiSiteAuditPlugin from "../main";
	import {
		listAudits,
		readAudit,
		saveAudit,
		type AuditListItem,
	} from "../audit-store";
	import { runAudit } from "../audit-runner";
	import ReportView from "./ReportView.svelte";
	import RunAuditForm from "./RunAuditForm.svelte";
	import { formatDate, hostOf, scoreVariant } from "./helpers";
	import { icon } from "./icon";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	type Mode = "empty" | "new" | "detail";

	let items = $state<AuditListItem[]>([]);
	let mode = $state<Mode>("empty");
	let selected = $state<AuditReport | null>(null);
	let selectedPath = $state<string | null>(null);
	let running = $state(false);

	function refresh() {
		items = listAudits(plugin.app, plugin.settings);
	}

	onMount(() => {
		refresh();
		// New files aren't in the metadata cache immediately; refresh the list once Obsidian
		// finishes indexing so freshly-run audits appear without a manual reload.
		const ref: EventRef = plugin.app.metadataCache.on("resolved", refresh);
		return () => plugin.app.metadataCache.offref(ref);
	});

	function startNew() {
		mode = "new";
		selected = null;
		selectedPath = null;
	}

	async function open(item: AuditListItem) {
		const report = await readAudit(plugin.app, item.file);
		if (!report) {
			new Notice("Could not read this audit's report data.");
			return;
		}
		selected = report;
		selectedPath = item.file.path;
		mode = "detail";
	}

	async function run(url: string, pages: number | undefined) {
		if (!url) {
			new Notice("Enter a URL to audit.");
			return;
		}
		running = true;
		try {
			const report = await runAudit({ url, maxPages: pages }, plugin.settings);
			const file: TFile = await saveAudit(plugin.app, plugin.settings, report);
			// Show it immediately from the in-memory report (cache may lag), then reconcile.
			selected = report;
			selectedPath = file.path;
			mode = "detail";
			items = [
				{ file, url: report.startUrl, date: report.generatedAt, score: report.score, pages: report.pagesScanned },
				...items.filter((i) => i.file.path !== file.path),
			];
			new Notice(`Audit saved: ${file.name}`);
		} catch (e) {
			new Notice(`Audit failed: ${(e as Error).message}`);
		} finally {
			running = false;
		}
	}
</script>

<div class="ssa-layout">
	<aside class="ssa-sidebar">
		<div class="ssa-sidebar-head">
			<span use:icon={"gauge"}></span>
			<span>Safi Site Audit</span>
			<button class="ssa-btn ssa-btn-primary ssa-btn-sm ssa-spacer" onclick={startNew} disabled={running}>
				<span use:icon={"plus"}></span>
				New
			</button>
		</div>
		<div class="ssa-sidebar-list">
			{#if items.length === 0}
				<p class="ssa-empty-note">No audits yet.</p>
			{:else}
				{#each items as item (item.file.path)}
					<button
						class="ssa-audit-row"
						class:is-active={selectedPath === item.file.path}
						onclick={() => open(item)}
					>
						<span class="ssa-audit-row-top">
							<span class="ssa-audit-row-host">{hostOf(item.url)}</span>
							<span class="ssa-badge ssa-badge-{scoreVariant(item.score)}">{item.score}</span>
						</span>
						<span class="ssa-audit-row-date">{formatDate(item.date)}</span>
					</button>
				{/each}
			{/if}
		</div>
	</aside>

	<main class="ssa-main">
		{#if mode === "detail" && selected}
			<ReportView report={selected} path={selectedPath} {plugin} />
		{:else if mode === "new"}
			<RunAuditForm
				defaultPages={plugin.settings.defaultMaxPages}
				folder={plugin.settings.auditFolder}
				{running}
				onSubmit={run}
			/>
		{:else}
			<div class="ssa-empty">
				<div class="ssa-empty-media">
					<span use:icon={"gauge"}></span>
				</div>
				<div class="ssa-empty-title">No audit selected</div>
				<div class="ssa-empty-desc">Pick an audit from the sidebar, or run a new one.</div>
				<button class="ssa-btn ssa-btn-primary ssa-mt" onclick={startNew}>
					<span use:icon={"plus"}></span>
					New audit
				</button>
			</div>
		{/if}
	</main>
</div>
