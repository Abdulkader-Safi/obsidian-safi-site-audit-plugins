<script lang="ts">
	import type { AuditReport, Status } from "../scanner";
	import {
		buildIssues,
		categoryLabel,
		newRuleIds,
		pathOf,
		pct,
		statusLabel,
		statusTone,
		statusTotals,
		type Issue,
	} from "./helpers";
	import { icon } from "./icon";

	let {
		report,
		previous,
		focusRule = null,
	}: { report: AuditReport; previous: AuditReport | null; focusRule?: string | null } = $props();

	const issues = $derived(buildIssues(report));
	const totals = $derived(statusTotals(report));
	const newIds = $derived(newRuleIds(report, previous));
	const categories = $derived(report.categories.map((c) => c.category));

	const STATUSES: { key: Status; word: string }[] = [
		{ key: "fail", word: "Failed" },
		{ key: "warn", word: "Warnings" },
		{ key: "info", word: "Info" },
	];

	// Opening on a rule from Overview: make sure its status is visible. The panel is
	// re-keyed on focusRule, so reading it once here is enough.
	function initialFilter(): Status[] {
		const base: Status[] = ["fail", "warn"];
		const s = focusRule ? buildIssues(report).find((i) => i.ruleId === focusRule)?.status : undefined;
		return s && !base.includes(s) ? [...base, s] : base;
	}

	let statusFilter = $state<Status[]>(initialFilter());
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

	const STEP = 25;
	let limit = $state(STEP);
	const groups = $derived.by(() => {
		const shown = filtered.slice(0, limit);
		return STATUSES.map((s) => ({
			...s,
			total: filtered.filter((i) => i.status === s.key).length,
			rows: shown.filter((i) => i.status === s.key),
		})).filter((g) => g.rows.length > 0);
	});

	function toggle(status: Status) {
		statusFilter = statusFilter.includes(status)
			? statusFilter.filter((s) => s !== status)
			: [...statusFilter, status];
		limit = STEP;
	}

	function clearFilters() {
		statusFilter = ["fail", "warn", "info"];
		catFilter = "all";
		query = "";
	}

	// A rule can hit hundreds of pages; show a readable slice and let the row expand.
	const PAGE_PREVIEW = 12;
	let expanded = $state<Record<string, boolean>>({});
	function shown(issue: Issue): string[] {
		return expanded[issue.ruleId] ? issue.pages : issue.pages.slice(0, PAGE_PREVIEW);
	}

	function focusOnMount(node: HTMLElement, active: boolean) {
		if (active) requestAnimationFrame(() => node.scrollIntoView({ block: "nearest" }));
	}
</script>

<div class="ssa-panel">
	<div class="ssa-filters">
		{#each STATUSES as s (s.key)}
			{@const on = statusFilter.includes(s.key)}
			<button class="ssa-btn ssa-filter" class:mod-cta={on} aria-pressed={on} onclick={() => toggle(s.key)}>
				{#if on}<span class="ssa-chip-check" use:icon={"check"}></span>{/if}
				{s.word}
				<span class="ssa-chip-count">{totals[s.key].toLocaleString()}</span>
			</button>
		{/each}
		<span class="ssa-filters-spacer"></span>
		<select class="ssa-select dropdown" bind:value={catFilter} aria-label="Filter by category">
			<option value="all">All categories</option>
			{#each categories as c (c)}
				<option value={c}>{categoryLabel(c)}</option>
			{/each}
		</select>
		<div class="ssa-search ssa-search-inline">
			<span class="ssa-search-icon" use:icon={"search"}></span>
			<input class="ssa-input" type="search" placeholder="Search rules" aria-label="Search rules" bind:value={query} />
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="ssa-card ssa-empty">
			<span class="ssa-badge" use:icon={"search"}></span>
			<h3 class="ssa-card-title">No rules match</h3>
			<p class="ssa-faint">
				{[
					catFilter !== "all" ? categoryLabel(catFilter) : "",
					query.trim() ? `"${query.trim()}"` : "",
					STATUSES.filter((s) => statusFilter.includes(s.key)).map((s) => s.word).join(", ") || "No status",
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<button class="ssa-btn" onclick={clearFilters}>Clear filters</button>
		</div>
	{:else}
		<div class="ssa-card is-flush">
			<div class="ssa-list-head">
				<span>Rule</span>
				<span>Pages affected</span>
			</div>
			{#each groups as group (group.key)}
				<span class="ssa-group-label">{group.word} · {group.total} {group.total === 1 ? "rule" : "rules"}</span>
				{#each group.rows as issue (issue.ruleId)}
					<details class="ssa-row" open={issue.ruleId === focusRule} use:focusOnMount={issue.ruleId === focusRule}>
						<summary class="ssa-row-head">
							<span class="ssa-rule-top">
								<span class="ssa-mark {statusTone(issue.status)}" aria-label={statusLabel(issue.status)}></span>
								<span class="ssa-rule-text">
									<span class="ssa-rule-title" title={issue.title}>{issue.title}</span>
									<span class="ssa-rule-meta" title={issue.ruleId}>{categoryLabel(issue.category)} · {issue.ruleId}</span>
								</span>
								{#if newIds.has(issue.ruleId)}<span class="ssa-tag is-bad">New</span>{/if}
								<span class="ssa-rule-pages">{issue.pages.length} {issue.pages.length === 1 ? "page" : "pages"}</span>
								<span class="ssa-row-chevron" use:icon={"chevron-down"}></span>
							</span>
							<span class="ssa-share" aria-hidden="true"><span style="width:{pct(issue.pages.length, report.pagesScanned)}%"></span></span>
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
								<span class="ssa-label">Affected pages · {issue.pages.length}</span>
								<ul class="ssa-affected-list">
									{#each shown(issue) as page (page)}
										<li>
											<a href={page} title={page} rel="noopener">{pathOf(page)}</a>
										</li>
									{/each}
								</ul>
								{#if issue.pages.length > PAGE_PREVIEW}
									<button
										class="ssa-link-btn is-accent"
										onclick={() => (expanded = { ...expanded, [issue.ruleId]: !expanded[issue.ruleId] })}
									>
										{expanded[issue.ruleId] ? "Show fewer" : `Show all ${issue.pages.length} pages`}
									</button>
								{/if}
							</div>
						</div>
					</details>
				{/each}
			{/each}
			<div class="ssa-card-foot">
				<span class="ssa-faint">{Math.min(limit, filtered.length)} of {filtered.length} rules</span>
				{#if filtered.length > limit}
					<button class="ssa-link-btn is-accent" onclick={() => (limit += STEP)}>Show more</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
