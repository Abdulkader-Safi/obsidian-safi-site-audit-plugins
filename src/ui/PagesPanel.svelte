<script lang="ts">
	import type { AuditReport, Finding, PageReport } from "../scanner";
	import { categoryLabel, pageIssueCount, pathOf, scoreTone, statusLabel, statusTone } from "./helpers";

	let { report }: { report: AuditReport } = $props();

	let query = $state("");
	let order = $state<"worst" | "crawl">("worst");

	const pages = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = q ? report.pages.filter((p) => p.url.toLowerCase().includes(q)) : report.pages;
		return order === "worst" ? [...list].sort((a, b) => a.score - b.score) : list;
	});

	function problems(page: PageReport): Finding[] {
		return page.findings.filter((f) => f.status !== "pass");
	}
</script>

<div class="ssa-panel">
	<div class="ssa-filters">
		<div class="ssa-segmented">
			<button class="ssa-seg" class:is-on={order === "worst"} onclick={() => (order = "worst")}>
				Lowest score
			</button>
			<button class="ssa-seg" class:is-on={order === "crawl"} onclick={() => (order = "crawl")}>
				Crawl order
			</button>
		</div>
		<input class="ssa-input ssa-input-search" placeholder="Search pages" bind:value={query} />
	</div>

	{#if pages.length === 0}
		<p class="ssa-empty-line">No page matches that search.</p>
	{:else}
		<div class="ssa-list">
			{#each pages as page (page.url)}
				{@const found = problems(page)}
				<details class="ssa-row">
					<summary class="ssa-row-head">
						<span class="ssa-score-chip {scoreTone(page.score)}">{page.score}</span>
						<span class="ssa-row-main">
							<span class="ssa-row-title" title={page.url}>{pathOf(page.url)}</span>
							<span class="ssa-row-sub">HTTP {page.status}</span>
						</span>
						<span class="ssa-row-count">
							{pageIssueCount(page)}
							<span class="ssa-row-count-unit">{found.length === 1 ? "issue" : "issues"}</span>
						</span>
					</summary>
					<div class="ssa-row-body">
						{#if found.length === 0}
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
									{#each found as f, i (`${f.ruleId}-${i}`)}
										<tr>
											<td>
												<span class="ssa-status-word {statusTone(f.status)}">{statusLabel(f.status)}</span>
											</td>
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
	{/if}
</div>
