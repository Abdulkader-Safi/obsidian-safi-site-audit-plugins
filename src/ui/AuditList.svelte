<script lang="ts">
	import { onMount } from "svelte";
	import type { EventRef } from "obsidian";
	import type SafiSiteAuditPlugin from "../main";
	import { listAudits, type AuditListItem } from "../audit-store";
	import { formatDateShort, groupBySite, scoreTone } from "./helpers";
	import { icon } from "./icon";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	let items = $state<AuditListItem[]>([]);
	let activePath = $state<string | null>(null);
	let running = $state(false);
	let filter = $state("");

	const groups = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		return groupBySite(q ? items.filter((i) => i.url.toLowerCase().includes(q)) : items);
	});

	function refresh() {
		items = listAudits(plugin.app, plugin.settings);
	}

	function sync() {
		activePath = plugin.state.path;
		running = plugin.state.running;
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

<div class="ssa-rail">
	<div class="ssa-rail-head">
		<span class="ssa-rail-mark" use:icon={"gauge"}></span>
		<span class="ssa-rail-name">Site audits</span>
	</div>

	<div class="ssa-rail-actions">
		<button
			class="ssa-btn ssa-btn-block mod-cta"
			onclick={() => plugin.startNewAudit()}
			disabled={running}
		>
			<span use:icon={"plus"}></span>
			New audit
		</button>
	</div>

	{#if items.length > 0}
		<div class="ssa-rail-filter">
			<input class="ssa-input" placeholder="Find a site" bind:value={filter} />
		</div>
	{/if}

	<div class="ssa-rail-list">
		{#if items.length === 0}
			<p class="ssa-rail-note">Nothing audited yet.</p>
		{:else if groups.length === 0}
			<p class="ssa-rail-note">No site matches “{filter}”.</p>
		{:else}
			{#each groups as group (group.host)}
				<section class="ssa-site">
					<h3 class="ssa-site-host" title={group.host}>{group.host}</h3>
					{#each group.runs as item (item.file.path)}
						<button
							class="ssa-run-row"
							class:is-on={activePath === item.file.path}
							onclick={() => void plugin.openAudit(item)}
						>
							<span class="ssa-run-date">{formatDateShort(item.date)}</span>
							<span class="ssa-run-pages">{item.pages} pages</span>
							<span class="ssa-run-score {scoreTone(item.score)}">{item.score}</span>
						</button>
					{/each}
				</section>
			{/each}
		{/if}
	</div>
</div>
