<script lang="ts">
	import type { AuditReport } from "../scanner";
	import {
		buildIssues,
		categoryLabel,
		pathOf,
		statusLabel,
		statusTone,
		statusTotals,
		type Issue,
	} from "./helpers";

	let { report }: { report: AuditReport } = $props();

	const issues = $derived(buildIssues(report));
	const totals = $derived(statusTotals(report));
	const categories = $derived(report.categories.map((c) => c.category));

	let statusFilter = $state<string[]>(["fail", "warn", "info"]);
	let catFilter = $state("all");
	let query = $state("");

	const filtered = $derived(
		issues.filter((i) => {
			if (!statusFilter.includes(i.status)) return false;
			if (catFilter !== "all" && i.category !== catFilter) return false;
			const q = query.trim().toLowerCase();
			if (q && !`${i.title} ${i.message} ${i.ruleId}`.toLowerCase().includes(q)) return false;
			return true;
		}),
	);

	function toggle(status: string) {
		statusFilter = statusFilter.includes(status)
			? statusFilter.filter((s) => s !== status)
			: [...statusFilter, status];
	}

	// A rule can hit hundreds of pages; show a readable slice and let the row expand.
	const PAGE_PREVIEW = 12;
	let expanded = $state<Record<string, boolean>>({});
	function shown(issue: Issue): string[] {
		return expanded[issue.ruleId] ? issue.pages : issue.pages.slice(0, PAGE_PREVIEW);
	}
</script>

<div class="ssa-panel">
	<div class="ssa-filters">
		<div class="ssa-segmented">
			<button class="ssa-seg" class:is-on={statusFilter.includes("fail")} onclick={() => toggle("fail")}>
				<span class="ssa-seg-count">{totals.fail}</span> failed
			</button>
			<button class="ssa-seg" class:is-on={statusFilter.includes("warn")} onclick={() => toggle("warn")}>
				<span class="ssa-seg-count">{totals.warn}</span> warnings
			</button>
			<button class="ssa-seg" class:is-on={statusFilter.includes("info")} onclick={() => toggle("info")}>
				<span class="ssa-seg-count">{totals.info}</span> info
			</button>
		</div>
		<select class="ssa-select" bind:value={catFilter} aria-label="Filter by category">
			<option value="all">Every category</option>
			{#each categories as c (c)}
				<option value={c}>{categoryLabel(c)}</option>
			{/each}
		</select>
		<input class="ssa-input ssa-input-search" placeholder="Search rules" bind:value={query} />
	</div>

	{#if filtered.length === 0}
		<p class="ssa-empty-line">Nothing matches these filters.</p>
	{:else}
		<div class="ssa-list">
			{#each filtered as issue (issue.ruleId)}
				<details class="ssa-row">
					<summary class="ssa-row-head">
						<span class="ssa-mark {statusTone(issue.status)}" aria-hidden="true"></span>
						<span class="ssa-row-main">
							<span class="ssa-row-title">{issue.title}</span>
							<span class="ssa-row-sub">{categoryLabel(issue.category)} · {issue.ruleId}</span>
						</span>
						<span class="ssa-row-count">
							{issue.pages.length}
							<span class="ssa-row-count-unit">{issue.pages.length === 1 ? "page" : "pages"}</span>
						</span>
					</summary>
					<div class="ssa-row-body">
						<p class="ssa-row-msg">
							<span class="ssa-status-word {statusTone(issue.status)}">{statusLabel(issue.status)}</span>
							{issue.message}
						</p>
						{#if issue.fix}
							<div class="ssa-fix">
								<span class="ssa-fix-label">How to fix</span>
								<p class="ssa-fix-text">{issue.fix}</p>
							</div>
						{/if}
						<div class="ssa-affected">
							<span class="ssa-affected-label">Affected pages</span>
							<ul class="ssa-affected-list">
								{#each shown(issue) as page (page)}
									<li title={page}>{pathOf(page)}</li>
								{/each}
							</ul>
							{#if issue.pages.length > PAGE_PREVIEW}
								<button
									class="ssa-link-btn"
									onclick={() => (expanded = { ...expanded, [issue.ruleId]: !expanded[issue.ruleId] })}
								>
									{expanded[issue.ruleId]
										? "Show fewer"
										: `Show all ${issue.pages.length} pages`}
								</button>
							{/if}
						</div>
					</div>
				</details>
			{/each}
		</div>
	{/if}
</div>
