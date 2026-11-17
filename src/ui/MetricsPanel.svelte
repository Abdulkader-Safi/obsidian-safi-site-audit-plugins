<!--
	Measurements: "which measurements are out of range, on how many pages, and what
	does one page measure?"

	Site-wide out-of-range rows lead (problems are site patterns, e.g. one rule on
	every page), then a page list, worst first, beside the chosen page's values.
	Deviations from the dashboard-design component patterns:
	- Notes that are not numeric targets live in tooltips (title), keeping the tab wordless.
	- Range bars stand in for bullet graphs: the scanner gives a target band, not a single goal.
-->
<script lang="ts">
	import type { AuditReport, MetricTable, MetricValue, PageReport } from "../scanner";
	import {
		categoryLabel,
		flaggedCount,
		formatMetricValue,
		groupMetrics,
		isFlagged,
		outOfRange,
		parseRange,
		pathOf,
		pct,
		type MetricRange,
	} from "./helpers";
	import { icon } from "./icon";

	let { report, previous }: { report: AuditReport; previous: AuditReport | null } = $props();

	// Cards this long span two grid rows so short cards can stack beside them.
	const TALL_VALUES = 6;

	const withMetrics = $derived(report.pages.filter((p) => (p.metrics?.length ?? 0) > 0));
	const issues = $derived(outOfRange(report));

	/** Out-of-range row the page list is narrowed to. */
	let focus = $state<string | null>(null);
	let query = $state("");
	let selectedUrl = $state("");

	const focused = $derived(issues.find((i) => i.id === focus) ?? null);
	const pageList = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const only = focused ? new Set(focused.pages) : null;
		return withMetrics
			.filter((p) => (!only || only.has(p.url)) && (!q || p.url.toLowerCase().includes(q)))
			.map((p) => ({ page: p, flagged: flaggedCount(p) }))
			.sort((a, b) => b.flagged - a.flagged);
	});
	const page = $derived(
		pageList.find((p) => p.page.url === selectedUrl)?.page ?? pageList[0]?.page ?? null,
	);

	const groups = $derived(
		(page ? groupMetrics(page.metrics ?? []) : []).map((g) => ({
			category: g.category,
			values: g.metrics.filter((m): m is MetricValue => m.kind === "value"),
			tables: g.metrics.filter((m): m is MetricTable => m.kind === "table"),
		})),
	);
	const flagged = $derived(
		groups.flatMap((g) => g.values).filter((m) => isFlagged(m.status))
			.sort((a, b) => Number(b.status === "bad") - Number(a.status === "bad")),
	);
	const tables = $derived(groups.flatMap((g) => g.tables));
	// Tall cards lead: with dense flow, the short ones then fill the column beside them.
	const valueGroups = $derived(
		groups.filter((g) => g.values.length).sort((a, b) => Number(b.values.length >= TALL_VALUES) - Number(a.values.length >= TALL_VALUES)),
	);

	const prevMetrics = $derived.by(() => {
		const prevPage = previous?.pages.find((p) => p.url === page?.url);
		return new Map((prevPage?.metrics ?? []).flatMap((m) => (m.kind === "value" ? [[m.id, m.value] as const] : [])));
	});
	function was(m: MetricValue): string | null {
		if (!prevMetrics.has(m.id)) return null;
		const before = prevMetrics.get(m.id) ?? null;
		return before === m.value ? null : formatMetricValue(before);
	}

	function pick(id: string) {
		focus = focus === id ? null : id;
		selectedUrl = "";
	}

	// Tables can run to hundreds of rows; show a readable slice.
	const TABLE_ROWS = 8;
	let openTables = $state<Record<string, boolean>>({});
	function numericCols(m: MetricTable): boolean[] {
		return m.columns.map(
			(_, ci) => m.rows.length > 0 && m.rows.every((r) => typeof r[ci] === "number" || /^[\d.,%\s-]+$/.test(String(r[ci]))),
		);
	}

	function spread(low: number | null, high: number | null, unit?: string): string {
		if (low === null || high === null) return "";
		const u = unit ? ` ${unit}` : "";
		return low === high ? `${low.toLocaleString()}${u}` : `${low.toLocaleString()}–${high.toLocaleString()}${u}`;
	}
</script>

<!-- Value against its target band. Scale runs from 0 past the band and the value. -->
{#snippet rangeBar(value: string | number | null, range: MetricRange, status: string | undefined)}
	{#if typeof value === "number"}
		{@const hi = Math.max(range.max * 1.5, value * 1.08, 1)}
		<span class="ssa-range" title="Target {range.min}–{range.max}">
			<span class="ssa-range-band" style="left:{(range.min / hi) * 100}%;width:{((range.max - range.min) / hi) * 100}%"></span>
			<span class="ssa-range-dot {status === 'bad' ? 'is-bad' : status === 'warn' ? 'is-mid' : ''}" style="left:{Math.min(100, (value / hi) * 100)}%"></span>
		</span>
	{/if}
{/snippet}

{#snippet valueText(m: MetricValue)}
	<span class="ssa-value" class:is-bad={m.status === "bad"} class:is-missing={m.value === null || m.value === ""}>
		{formatMetricValue(m.value)}
	</span>
	{#if m.unit && m.value !== null && m.value !== ""}<span class="ssa-unit">{m.unit}</span>{/if}
{/snippet}

<div class="ssa-panel">
	{#if withMetrics.length === 0}
		<div class="ssa-card ssa-empty">
			<span class="ssa-badge" use:icon={"ruler"}></span>
			<h3 class="ssa-card-title">No measurements</h3>
			<p class="ssa-faint">Run this site again to collect them.</p>
		</div>
	{:else}
		<section class="ssa-card is-flush">
			<div class="ssa-card-head has-rule">
				<h3 class="ssa-card-title">Out of range</h3>
				<span class="ssa-faint">
					{issues.length} {issues.length === 1 ? "measurement" : "measurements"} · {withMetrics.length} pages
				</span>
			</div>
			{#if issues.length === 0}
				<div class="ssa-oor-clear">
					<span class="ssa-mark is-pass" aria-hidden="true"></span>
					Every measurement in range
				</div>
			{:else}
				<div class="ssa-oor-head">
					<span>Measurement</span>
					<span>Flagged values</span>
					<span class="is-num">Pages</span>
				</div>
				{#each issues as row (row.id)}
					<button class="ssa-oor-row" class:is-on={focus === row.id} aria-pressed={focus === row.id} onclick={() => pick(row.id)}>
						<span class="ssa-oor-main">
							<span class="ssa-mark {row.status === 'bad' ? 'is-bad' : 'is-mid'}" aria-label={row.status === "bad" ? "Problem" : "Warning"}></span>
							<span class="ssa-rule-text">
								<span class="ssa-rule-title">{row.label}</span>
								<span class="ssa-rule-meta">{categoryLabel(row.category)}</span>
							</span>
						</span>
						<span class="ssa-oor-cell">
							{spread(row.low, row.high, row.unit) || "—"}
							{#if row.range}<span class="ssa-faint"> · target {row.range.min}–{row.range.max}</span>{/if}
						</span>
						<span class="is-num ssa-oor-pages">
							{#if row.bad}<span class="ssa-tag is-bad">{row.bad} bad</span>{/if}
							{row.pages.length}<span class="ssa-faint"> / {withMetrics.length}</span>
						</span>
						<span class="ssa-share ssa-oor-share" aria-hidden="true">
							<span class:is-bad={row.status === "bad"} style="width:{pct(row.pages.length, withMetrics.length)}%"></span>
						</span>
					</button>
				{/each}
			{/if}
		</section>

		<div class="ssa-measure">
			<section class="ssa-card is-flush ssa-measure-list">
				<div class="ssa-card-head">
					<h3 class="ssa-card-title">Pages</h3>
					{#if focused}
						<button class="ssa-btn ssa-filter mod-cta" onclick={() => (focus = null)} title="Show all pages">
							{focused.label}
							<span class="ssa-chip-check" use:icon={"x"}></span>
						</button>
					{:else}
						<span class="ssa-faint">{withMetrics.length}</span>
					{/if}
				</div>
				<div class="ssa-measure-search">
					<div class="ssa-search">
						<span class="ssa-search-icon" use:icon={"search"}></span>
						<input class="ssa-input" type="search" placeholder="Filter by path" aria-label="Filter pages" bind:value={query} />
					</div>
				</div>
				<div class="ssa-measure-pages" role="listbox" aria-label="Pages">
					{#each pageList as item (item.page.url)}
						<button
							class="ssa-measure-page"
							class:is-on={page?.url === item.page.url}
							role="option"
							aria-selected={page?.url === item.page.url}
							title={item.page.url}
							onclick={() => (selectedUrl = item.page.url)}
						>
							<span class="ssa-ppath">{pathOf(item.page.url)}</span>
							{#if item.flagged}
								<span class="ssa-tag is-mid">{item.flagged}</span>
							{:else}
								<span class="ssa-faint">0</span>
							{/if}
						</button>
					{:else}
						<p class="ssa-card-note">No pages match</p>
					{/each}
				</div>
			</section>

			{#if page}
				{@render pageDetail(page)}
			{/if}
		</div>
	{/if}
</div>

{#snippet pageDetail(p: PageReport)}
	<div class="ssa-measure-detail">
		<div class="ssa-measure-title">
			<a class="ssa-measure-path" href={p.url} title={p.url} rel="noopener">{pathOf(p.url)}</a>
			<span class="ssa-tag">{p.status || "ERR"}</span>
			<span class="ssa-faint">Score {p.score} · {flagged.length} flagged</span>
		</div>

		{#if flagged.length}
			<div class="ssa-flag-tiles">
				{#each flagged as m (m.id)}
					{@const range = parseRange(m.note)}
					{@const before = was(m)}
					<div class="ssa-card ssa-flag-tile" title={m.note ?? ""}>
						<span class="ssa-flag-label">
							<span class="ssa-mark {m.status === 'bad' ? 'is-bad' : 'is-mid'}" aria-label={m.status === "bad" ? "Problem" : "Warning"}></span>
							{m.label}
						</span>
						<span class="ssa-flag-value">{@render valueText(m)}</span>
						{#if range}{@render rangeBar(m.value, range, m.status)}{/if}
						<span class="ssa-faint">
							{range ? `Target ${range.min}–${range.max}` : categoryLabel(m.category)}{before !== null ? ` · was ${before}` : ""}
						</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="ssa-metric-groups">
			{#each valueGroups as g (g.category)}
				<section class="ssa-card is-flush" class:is-tall={g.values.length >= TALL_VALUES}>
					<div class="ssa-card-head"><h3 class="ssa-card-title">{categoryLabel(g.category)}</h3></div>
					<dl class="ssa-values">
						{#each g.values as m (m.id)}
							{@const range = parseRange(m.note)}
							{@const before = was(m)}
							<div class="ssa-value-row" title={m.note ?? ""}>
								<dt>
									{m.label}
									{#if before !== null}<span class="ssa-was">was {before}</span>{/if}
								</dt>
								<dd>
									{#if range}{@render rangeBar(m.value, range, m.status)}{/if}
									{#if isFlagged(m.status)}
										<span class="ssa-mark {m.status === 'bad' ? 'is-bad' : 'is-mid'}" aria-label={m.status === "bad" ? "Problem" : "Warning"}></span>
									{/if}
									{@render valueText(m)}
								</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
		</div>

		{#if tables.length}
			<div class="ssa-metric-tables">
				{#each tables as m (m.id)}
					{@const num = numericCols(m)}
					{@const open = openTables[m.id]}
					<section
						class="ssa-card is-flush"
						class:is-wide={m.columns.length >= 3}
						class:is-tall={(open ? m.rows.length : Math.min(TABLE_ROWS, m.rows.length)) >= TABLE_ROWS}
					>
						<div class="ssa-card-head">
							<h3 class="ssa-card-title">{m.label}</h3>
							<span class="ssa-faint">{m.total.toLocaleString()}</span>
						</div>
						<div class="ssa-scroll-x">
							<table class="ssa-table">
								<thead>
									<tr>
										{#each m.columns as col, ci (ci)}
											<th class:is-num={num[ci]}>{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each open ? m.rows : m.rows.slice(0, TABLE_ROWS) as row, ri (ri)}
										<tr>
											{#each row as cell, ci (ci)}
												<td class:is-num={num[ci]} class:ssa-cell-muted={ci > 0}>{cell}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if m.rows.length > TABLE_ROWS || m.total > m.rows.length}
							<div class="ssa-card-foot">
								<span class="ssa-faint">
									{(open ? m.rows.length : Math.min(TABLE_ROWS, m.rows.length)).toLocaleString()} of {m.total.toLocaleString()}
								</span>
								{#if m.rows.length > TABLE_ROWS}
									<button class="ssa-link-btn is-accent" onclick={() => (openTables = { ...openTables, [m.id]: !open })}>
										{open ? "Show fewer" : "Show all"}
									</button>
								{/if}
							</div>
						{/if}
					</section>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}
