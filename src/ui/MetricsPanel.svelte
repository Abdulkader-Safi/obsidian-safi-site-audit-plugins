<script lang="ts">
	import type { AuditReport } from "../scanner";
	import { categoryLabel, formatMetricValue, groupMetrics, metricTone, pathOf } from "./helpers";

	let { report }: { report: AuditReport } = $props();

	// Measurements are per page, so the panel reads one page at a time.
	const withMetrics = $derived(report.pages.filter((p) => (p.metrics?.length ?? 0) > 0));
	let selectedUrl = $state("");
	const page = $derived(
		withMetrics.find((p) => p.url === selectedUrl) ?? withMetrics[0] ?? null,
	);
	const groups = $derived(page ? groupMetrics(page.metrics ?? []) : []);
</script>

<div class="ssa-panel">
	{#if withMetrics.length === 0}
		<p class="ssa-empty-line">
			This audit has no measurements. Re-run it to collect them.
		</p>
	{:else}
		<div class="ssa-filters">
			<select class="ssa-select ssa-select-wide dropdown" bind:value={selectedUrl} aria-label="Page to measure">
				{#each withMetrics as p (p.url)}
					<option value={p.url}>{pathOf(p.url)}</option>
				{/each}
			</select>
			<span class="ssa-filters-note">
				{page?.metrics?.length ?? 0} measurements on this page
			</span>
		</div>

		{#each groups as group (group.category)}
			<section class="ssa-metric-group">
				<h3 class="ssa-metric-cat">{categoryLabel(group.category)}</h3>

				{#if group.metrics.some((m) => m.kind === "value")}
					<div class="ssa-metric-grid">
						{#each group.metrics as m (m.id)}
							{#if m.kind === "value"}
								<div class="ssa-metric">
									<span class="ssa-metric-label">{m.label}</span>
									<span class="ssa-metric-value {metricTone(m.status)}">
										{formatMetricValue(m.value, m.unit)}
									</span>
									{#if m.note}
										<span class="ssa-metric-note">{m.note}</span>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				{#each group.metrics as m (m.id)}
					{#if m.kind === "table"}
						<div class="ssa-metric-table">
							<div class="ssa-metric-table-head">
								<span class="ssa-metric-table-label">{m.label}</span>
								{#if m.total > m.rows.length}
									<span class="ssa-metric-table-note">
										showing {m.rows.length} of {m.total.toLocaleString()}
									</span>
								{/if}
							</div>
							<div class="ssa-scroll-x">
								<table class="ssa-table">
									<thead>
										<tr>
											{#each m.columns as col (col)}
												<th>{col}</th>
											{/each}
										</tr>
									</thead>
									<tbody>
										{#each m.rows as row, ri (ri)}
											<tr>
												{#each row as cell, ci (ci)}
													<td class="ssa-cell-muted">{cell}</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				{/each}
			</section>
		{/each}
	{/if}
</div>
