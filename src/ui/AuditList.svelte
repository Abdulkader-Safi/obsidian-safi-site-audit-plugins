<script lang="ts">
	import { onMount } from "svelte";
	import type { EventRef } from "obsidian";
	import type SafiSiteAuditPlugin from "../main";
	import { listAudits, type AuditListItem } from "../audit-store";
	import { progressPercent, type AuditProgress } from "../audit-runner";
	import { formatDateShort, groupBySite, hostOf, scoreBand } from "./helpers";
	import { icon } from "./icon";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	let items = $state<AuditListItem[]>([]);
	let activePath = $state<string | null>(null);
	let running = $state(false);
	let runUrl = $state("");
	let progress = $state<AuditProgress | null>(null);
	let filter = $state("");

	const groups = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		return groupBySite(q ? items.filter((i) => i.url.toLowerCase().includes(q)) : items);
	});
	const runHost = $derived(running ? hostOf(runUrl) : "");
	const runIsNewSite = $derived(running && !groups.some((g) => g.host === runHost));

	function refresh() {
		items = listAudits(plugin.app, plugin.settings);
	}

	function sync() {
		activePath = plugin.state.path;
		running = plugin.state.running;
		runUrl = plugin.state.runUrl;
		progress = plugin.state.progress;
		refresh();
	}

	onMount(() => {
		sync();
		// A finished run adds files Obsidian has not indexed yet, so rebuild the list
		// once the metadata cache settles as well as whenever the shared state moves.
		const cacheRef: EventRef = plugin.app.metadataCache.on("resolved", refresh);
		const stateRef: EventRef = plugin.state.onChange(sync);
		return () => {
			plugin.app.metadataCache.offref(cacheRef);
			plugin.state.offref(stateRef);
		};
	});
</script>

{#snippet runningRow()}
	<div class="ssa-run-row is-running" role="status">
		<span class="ssa-run-date">Running now</span>
		<span class="ssa-run-pages">
			{progress?.phase === "checking" ? `${progress.pagesDone} of ${progress.pagesTotal} pages` : `${progress?.pagesFound ?? 0} pages found`}
		</span>
		<span class="ssa-run-score ssa-chip-score is-accent">{progress ? progressPercent(progress) : 0}%</span>
	</div>
{/snippet}

<div class="ssa-rail">
	<div class="ssa-rail-head">
		<span class="ssa-rail-mark" use:icon={"activity"}></span>
		<span class="ssa-rail-name">Site audits</span>
	</div>
	<div class="ssa-rail-actions">
		<button class="ssa-btn ssa-btn-block mod-cta" onclick={() => plugin.startNewAudit()} disabled={running}>
			<span use:icon={"plus"}></span>
			New audit
		</button>
		{#if items.length > 0}
			<div class="ssa-search">
				<span class="ssa-search-icon" use:icon={"search"}></span>
				<input class="ssa-input" type="search" placeholder="Find a site" aria-label="Find a site" bind:value={filter} />
			</div>
		{/if}
	</div>

	<div class="ssa-rail-list">
		{#if runIsNewSite}
			<section class="ssa-site">
				<h3 class="ssa-site-host" title={runHost}>{runHost}</h3>
				{@render runningRow()}
			</section>
		{/if}
		{#if items.length === 0 && !running}
			<p class="ssa-rail-note">No audits yet</p>
		{:else if groups.length === 0 && filter}
			<p class="ssa-rail-note">No site matches "{filter}"</p>
		{:else}
			{#each groups as group (group.host)}
				<section class="ssa-site">
					<h3 class="ssa-site-host" title={group.host}>{group.host}</h3>
					{#if running && group.host === runHost}{@render runningRow()}{/if}
					{#each group.runs as item (item.file.path)}
						<button
							class="ssa-run-row"
							class:is-on={activePath === item.file.path}
							onclick={() => void plugin.openAudit(item)}
						>
							<span class="ssa-run-date">{formatDateShort(item.date)}</span>
							<span class="ssa-run-pages">{item.pages} pages</span>
							<span class="ssa-run-score ssa-chip-score {scoreBand(item.score)}">{item.score}</span>
						</button>
					{/each}
				</section>
			{/each}
		{/if}
	</div>
</div>
