<script lang="ts">
	import type { AuditReport, PageReport } from "../scanner";
	import {
		categoryLabel,
		isBroken,
		isRedirect,
		pageCounts,
		pathOf,
		scoreBand,
		signed,
		statusLabel,
		statusTone,
		trendClass,
	} from "./helpers";
	import { icon } from "./icon";

	type Filter = "all" | "broken" | "redirects" | "low";

	let {
		report,
		previous,
		filter = $bindable<Filter>("all"),
	}: { report: AuditReport; previous: AuditReport | null; filter?: Filter } = $props();

	let query = $state("");
	const STEP = 50;
	let limit = $state(STEP);

	const LOW = 70;
	/** A score only means something for a page that actually loaded. */
	const scored = (p: PageReport) => !isBroken(p) && !isRedirect(p);
	const tests: Record<Filter, (p: PageReport) => boolean> = {
		all: () => true,
		broken: isBroken,
		redirects: isRedirect,
		low: (p) => scored(p) && p.score < LOW,
	};
	const counts = $derived(
		Object.fromEntries((Object.keys(tests) as Filter[]).map((k) => [k, report.pages.filter(tests[k]).length])) as Record<Filter, number>,
	);

	// Broken first, then redirects, then the lowest scores: worst news at the top.
	const rank = (p: PageReport) => (isBroken(p) ? 0 : isRedirect(p) ? 1 : 2);
	const pages = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return report.pages
			.filter((p) => tests[filter](p) && (!q || p.url.toLowerCase().includes(q)))
			.sort((a, b) => rank(a) - rank(b) || a.score - b.score);
	});

	const prevByUrl = $derived(new Map((previous?.pages ?? []).map((p) => [p.url, p])));

	function change(page: PageReport): { text: string; tone: string } {
		if (!previous) return { text: "—", tone: "is-flat" };
		const before = prevByUrl.get(page.url);
		if (!before) return { text: "new", tone: isBroken(page) ? "is-bad" : "is-flat" };
		if (!scored(page) || !scored(before)) {
			return before.status !== page.status
				? { text: `was ${before.status || "ERR"}`, tone: "is-flat" }
				: { text: "—", tone: "is-flat" };
		}
		const d = page.score - before.score;
		return { text: signed(d), tone: trendClass(d, false, 3) };
	}

	function statusChip(page: PageReport): string {
		if (isBroken(page)) return "is-bad";
		if (isRedirect(page)) return "is-mid";
		return "";
	}
</script>

<div class="ssa-panel">
	<div class="ssa-filters">
		<div class="ssa-segmented" role="group" aria-label="Show pages">
			{#each [["all", "All"], ["broken", "Broken"], ["redirects", "Redirects"], ["low", `Below ${LOW}`]] as [key, label] (key)}
				<button
					class="ssa-seg"
					class:is-on={filter === key}
					aria-pressed={filter === key}
					onclick={() => {
						filter = key as Filter;
						limit = STEP;
					}}
				>
					{label} <span class="ssa-seg-count">{counts[key as Filter]}</span>
				</button>
			{/each}
		</div>
		<span class="ssa-filters-spacer"></span>
		<div class="ssa-search ssa-search-inline">
			<span class="ssa-search-icon" use:icon={"search"}></span>
			<input class="ssa-input" type="search" placeholder="Filter by path" aria-label="Filter by path" bind:value={query} />
		</div>
	</div>

	{#if pages.length === 0}
		<div class="ssa-card ssa-empty">
			<span class="ssa-badge" use:icon={filter === "broken" ? "check" : "search"}></span>
			<h3 class="ssa-card-title">{filter === "broken" && !query ? "No broken pages" : "No pages match"}</h3>
			{#if query || filter !== "all"}
				<button
					class="ssa-btn"
					onclick={() => {
						query = "";
						filter = "all";
					}}>Show all pages</button
				>
			{/if}
		</div>
	{:else}
		<div class="ssa-card is-flush ssa-scroll-x">
			<div class="ssa-ptable">
				<div class="ssa-prow is-head">
					<span>Page</span>
					<span>Status</span>
					<span>Score</span>
					<span class="is-num">Failed</span>
					<span class="is-num">Warnings</span>
					<span class="is-num">vs last run</span>
					<span></span>
				</div>
				{#each pages.slice(0, limit) as page (page.url)}
					{@const c = pageCounts(page)}
					{@const ch = change(page)}
					{@const problems = page.findings.filter((f) => f.status !== "pass")}
					<details class="ssa-prow-wrap">
						<summary class="ssa-prow">
							<span class="ssa-ppath" title={page.url}>{pathOf(page.url)}</span>
							<span><span class="ssa-tag {statusChip(page)}">{page.status || "ERR"}</span></span>
							<span class="ssa-pscore">
								{#if scored(page)}
									<span class="ssa-pscore-num">{page.score}</span>
									<span class="ssa-bar"><span class="ssa-bar-fill {scoreBand(page.score)}" style="width:{page.score}%"></span></span>
								{:else}
									<span class="ssa-faint">—</span>
								{/if}
							</span>
							<span class="is-num" class:is-bad={c.fail >= 5}>{scored(page) ? c.fail : "—"}</span>
							<span class="is-num">{scored(page) ? c.warn : "—"}</span>
							<span class="is-num ssa-delta {ch.tone}">{ch.text}</span>
							<span class="ssa-row-chevron" use:icon={"chevron-down"}></span>
						</summary>
						<div class="ssa-prow-body">
							{#if problems.length === 0}
								<p class="ssa-row-msg">Every check passed on this page.</p>
							{:else}
								<table class="ssa-table">
									<thead>
										<tr>
											<th class="ssa-col-status">Status</th>
											<th>Check</th>
											<th>Result</th>
										</tr>
									</thead>
									<tbody>
										{#each problems as f, i (`${f.ruleId}-${i}`)}
											<tr>
												<td><span class="ssa-status-word {statusTone(f.status)}">{statusLabel(f.status)}</span></td>
												<td>
													<span class="ssa-cell-strong">{f.title}</span>
													<span class="ssa-cell-faint">{categoryLabel(f.category)}</span>
												</td>
												<td class="ssa-cell-muted">{f.message}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</details>
				{/each}
			</div>
			<div class="ssa-card-foot">
				<span class="ssa-faint">{Math.min(limit, pages.length)} of {pages.length} pages</span>
				{#if pages.length > limit}
					<button class="ssa-link-btn is-accent" onclick={() => (limit = pages.length)}>Show all</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
