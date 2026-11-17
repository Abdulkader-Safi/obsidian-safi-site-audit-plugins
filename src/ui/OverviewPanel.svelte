<script lang="ts">
	import type { AuditReport } from "../scanner";
	import type { RunPoint } from "../audit-state";
	import {
		brokenPages,
		buildIssues,
		categoryLabel,
		formatDay,
		newRuleIds,
		pathOf,
		pct,
		scoreBand,
		signed,
		statusBuckets,
		statusTotals,
		trendClass,
	} from "./helpers";
	import { icon } from "./icon";

	let {
		report,
		previous,
		history,
		onOpenRule,
		onShowRules,
		onShowBroken,
	}: {
		report: AuditReport;
		previous: AuditReport | null;
		history: RunPoint[];
		onOpenRule: (ruleId: string) => void;
		onShowRules: () => void;
		onShowBroken: () => void;
	} = $props();

	const FIX_ROWS = 8;
	const BROKEN_ROWS = 5;

	const totals = $derived(statusTotals(report));
	const prevTotals = $derived(previous ? statusTotals(previous) : null);
	const broken = $derived(brokenPages(report));
	const prevBroken = $derived(previous ? brokenPages(previous) : null);
	const newBroken = $derived(
		prevBroken ? broken.filter((p) => !prevBroken.some((q) => q.url === p.url)).length : 0,
	);

	const issues = $derived(buildIssues(report).filter((i) => i.status === "fail" || i.status === "warn"));
	const newIds = $derived(newRuleIds(report, previous));
	let fixFilter = $state<"all" | "fail" | "warn">("all");
	const fixRows = $derived(issues.filter((i) => fixFilter === "all" || i.status === fixFilter).slice(0, FIX_ROWS));
	const fixGroups = $derived(
		(["fail", "warn"] as const)
			.map((s) => ({ status: s, label: s === "fail" ? "Failed" : "Warnings", rows: fixRows.filter((i) => i.status === s) }))
			.filter((g) => g.rows.length > 0),
	);

	const prevCats = $derived(new Map((previous?.categories ?? []).map((c) => [c.category, c.score])));
	const categories = $derived([...report.categories].sort((a, b) => a.score - b.score));

	const buckets = $derived(statusBuckets(report));
	const bucketList = $derived([
		{ key: "2xx", n: buckets["2xx"], tone: "is-ok" },
		{ key: "3xx", n: buckets["3xx"], tone: "is-mid" },
		{ key: "4xx", n: buckets["4xx"], tone: "is-bad" },
		{ key: "5xx", n: buckets["5xx"], tone: "is-bad" },
	]);

	// ---- score history chart, drawn in a fixed viewBox that scales with the card
	// Drawn at the card's real width so text stays 11px however wide the pane is.
	let chartWidth = $state(520);
	const W = $derived(Math.max(280, chartWidth));
	const H = 170;
	const X0 = 34;
	const X1 = $derived(W - 12);
	const Y0 = 22;
	const Y1 = 136;
	const scores = $derived(history.map((h) => h.score));
	const yMin = $derived(Math.min(50, Math.floor(Math.min(...scores, 100) / 10) * 10));
	const yOf = (v: number) => Y1 - ((v - yMin) / (100 - yMin)) * (Y1 - Y0);
	const xOf = (i: number, n: number) => (n === 1 ? (X0 + X1) / 2 : X0 + 16 + (i * (X1 - X0 - 32)) / (n - 1));
	const points = $derived(history.map((h, i) => ({ ...h, x: xOf(i, history.length), y: yOf(h.score) })));
	const gridLines = $derived([yMin, Math.round((yMin + 100) / 2), 100]);

	// Sparkline for the health card: same history, no axes.
	const spark = $derived.by(() => {
		if (scores.length < 2) return "";
		const lo = Math.min(...scores) - 2;
		const hi = Math.max(...scores) + 2;
		return scores
			.map((s, i) => `${(3 + (i * 90) / (scores.length - 1)).toFixed(1)},${(27 - ((s - lo) / (hi - lo || 1)) * 24).toFixed(1)}`)
			.join(" ");
	});
	const sparkEnd = $derived(spark ? spark.split(" ").at(-1)!.split(",").map(Number) : null);
</script>

{#snippet delta(now: number, before: number | null | undefined, lowerIsBetter: boolean)}
	{#if before == null}
		<span class="ssa-faint">first run</span>
	{:else if before < 5 && lowerIsBetter}
		<!-- A tiny base never shouts: "was 1" instead of a red +200%. -->
		<span class="ssa-faint">was {before.toLocaleString()}</span>
	{:else}
		<span class="ssa-delta {trendClass(now - before, lowerIsBetter)}">{signed(now - before)}</span>
		<span class="ssa-faint">vs {before.toLocaleString()}</span>
	{/if}
{/snippet}

<div class="ssa-overview">
	<div class="ssa-kpis">
		<section class="ssa-card ssa-kpi">
			<span class="ssa-kpi-label">Health score</span>
			<div class="ssa-kpi-value">
				<span class="ssa-kpi-number">{report.score}</span>
				<span class="ssa-kpi-unit">/ 100</span>
				{#if spark && sparkEnd}
					<svg class="ssa-spark" viewBox="0 0 96 30" aria-hidden="true">
						<polyline points={spark} />
						<circle cx={sparkEnd[0]} cy={sparkEnd[1]} r="2.5" />
					</svg>
				{/if}
			</div>
			<div class="ssa-kpi-delta">{@render delta(report.score, previous?.score, false)}</div>
		</section>

		<section class="ssa-card ssa-kpi">
			<span class="ssa-kpi-label">Failed checks</span>
			<div class="ssa-kpi-value">
				<span class="ssa-kpi-number">{totals.fail.toLocaleString()}</span>
				<span class="ssa-kpi-unit">of {totals.total.toLocaleString()}</span>
			</div>
			<div class="ssa-kpi-delta">{@render delta(totals.fail, prevTotals?.fail, true)}</div>
		</section>

		<section class="ssa-card ssa-kpi">
			<span class="ssa-kpi-label">Warnings</span>
			<div class="ssa-kpi-value">
				<span class="ssa-kpi-number">{totals.warn.toLocaleString()}</span>
				<span class="ssa-kpi-unit">of {totals.total.toLocaleString()}</span>
			</div>
			<div class="ssa-kpi-delta">{@render delta(totals.warn, prevTotals?.warn, true)}</div>
		</section>

		<section class="ssa-card ssa-kpi">
			<span class="ssa-kpi-label">Broken pages</span>
			<div class="ssa-kpi-value">
				<span class="ssa-kpi-number" class:is-bad={broken.length > 0}>{broken.length}</span>
				<span class="ssa-kpi-unit">of {report.pagesScanned}</span>
			</div>
			<div class="ssa-kpi-delta">
				{#if newBroken > 0}<span class="ssa-tag is-bad">{newBroken} new</span>{/if}
				{@render delta(broken.length, prevBroken?.length, true)}
			</div>
		</section>
	</div>

	<div class="ssa-overview-main">
		<section class="ssa-card is-flush ssa-fix-card">
			<div class="ssa-card-head has-rule">
				<h3 class="ssa-card-title">Fix first</h3>
				<div class="ssa-segmented" role="group" aria-label="Show">
					<button class="ssa-seg" class:is-on={fixFilter === "all"} aria-pressed={fixFilter === "all"} onclick={() => (fixFilter = "all")}>All</button>
					<button class="ssa-seg" class:is-on={fixFilter === "fail"} aria-pressed={fixFilter === "fail"} onclick={() => (fixFilter = "fail")}>
						Failed <span class="ssa-seg-count">{totals.fail.toLocaleString()}</span>
					</button>
					<button class="ssa-seg" class:is-on={fixFilter === "warn"} aria-pressed={fixFilter === "warn"} onclick={() => (fixFilter = "warn")}>
						Warnings <span class="ssa-seg-count">{totals.warn.toLocaleString()}</span>
					</button>
				</div>
			</div>
			{#if fixRows.length === 0}
				<div class="ssa-card-empty">
					<span class="ssa-badge" use:icon={"check"}></span>
					<span>Nothing to fix here</span>
				</div>
			{:else}
				{#each fixGroups as group (group.status)}
					<span class="ssa-group-label">{group.label}</span>
					{#each group.rows as issue (issue.ruleId)}
						<button class="ssa-rule-row" onclick={() => onOpenRule(issue.ruleId)}>
							<span class="ssa-rule-top">
								<span class="ssa-mark {issue.status === 'fail' ? 'is-fail' : 'is-warn'}" aria-label={issue.status === "fail" ? "Failed" : "Warning"}></span>
								<span class="ssa-rule-text">
									<span class="ssa-rule-title">{issue.title}</span>
									<span class="ssa-rule-meta">{categoryLabel(issue.category)} · {issue.ruleId}</span>
								</span>
								{#if newIds.has(issue.ruleId)}<span class="ssa-tag is-bad">New</span>{/if}
								<span class="ssa-rule-pages">{issue.pages.length} {issue.pages.length === 1 ? "page" : "pages"}</span>
								<span class="ssa-rule-chevron" use:icon={"chevron-right"}></span>
							</span>
							<span class="ssa-share" aria-hidden="true"><span style="width:{pct(issue.pages.length, report.pagesScanned)}%"></span></span>
						</button>
					{/each}
				{/each}
				<div class="ssa-card-foot">
					<button class="ssa-link-btn is-accent" onclick={onShowRules}>Show all {issues.length} rules</button>
				</div>
			{/if}
		</section>

		<section class="ssa-card is-flush ssa-cats-card">
			<div class="ssa-card-head">
				<h3 class="ssa-card-title">Categories</h3>
				{#if previous}<span class="ssa-legend"><span class="ssa-legend-tick"></span>last run</span>{/if}
			</div>
			<div class="ssa-cat-list">
				{#each categories as cat (cat.category)}
					{@const before = prevCats.get(cat.category)}
					<div class="ssa-cat">
						<span class="ssa-cat-name" title={categoryLabel(cat.category)}>{categoryLabel(cat.category)}</span>
						<span class="ssa-cat-track">
							<span class="ssa-cat-fill {scoreBand(cat.score)}" style="width:{cat.score}%"></span>
							{#if before != null}<span class="ssa-cat-tick" style="left:{before}%" title="Last run: {before}"></span>{/if}
						</span>
						<span class="ssa-cat-score">{cat.score}</span>
						<span class="ssa-cat-delta {before != null ? trendClass(cat.score - before, false, 3) : 'is-flat'}">
							{before != null ? signed(cat.score - before) : ""}
						</span>
					</div>
				{/each}
			</div>
		</section>
	</div>

	<div class="ssa-overview-bottom">
		<section class="ssa-card is-flush">
			<div class="ssa-card-head">
				<h3 class="ssa-card-title">Score history</h3>
				<span class="ssa-faint">{history.length} {history.length === 1 ? "run" : "runs"}</span>
			</div>
			{#if history.length < 2}
				<p class="ssa-card-note">History shows from the second run of this site.</p>
			{:else}
				<div class="ssa-chart-wrap" bind:clientWidth={chartWidth}>
				<svg class="ssa-chart" width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="Health score over {history.length} runs, from {history[0].score} to {report.score}">
					{#each gridLines as g (g)}
						<line class="ssa-chart-grid" x1={X0} x2={X1} y1={yOf(g)} y2={yOf(g)} />
						<text class="ssa-chart-axis" x={X0 - 8} y={yOf(g) + 4} text-anchor="end">{g}</text>
					{/each}
					<polyline class="ssa-chart-line" points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
					{#each points as p, i (p.date)}
						{@const last = i === points.length - 1}
						<circle class="ssa-chart-dot" class:is-last={last} cx={p.x} cy={p.y} r={last ? 4 : 3} />
						<text class="ssa-chart-value" class:is-last={last} x={p.x} y={p.y - 10} text-anchor="middle">{p.score}</text>
						<text class="ssa-chart-axis" class:is-last={last} x={p.x} y={H - 10} text-anchor="middle">{formatDay(p.date, false)}</text>
					{/each}
				</svg>
				</div>
			{/if}
		</section>

		<section class="ssa-card is-flush">
			<div class="ssa-card-head">
				<h3 class="ssa-card-title">Pages</h3>
				<span class="ssa-faint">{report.pagesScanned} crawled</span>
			</div>
			<div class="ssa-pages-body">
				<div class="ssa-status-bar" role="img" aria-label={bucketList.map((b) => `${b.key}: ${b.n}`).join(", ")}>
					{#each bucketList as b (b.key)}
						{#if b.n > 0}<span class="ssa-status-seg {b.tone}" style="flex-grow:{b.n}"></span>{/if}
					{/each}
				</div>
				<div class="ssa-status-legend">
					{#each bucketList as b (b.key)}
						<span class="ssa-status-item">
							<span class="ssa-mark {b.n ? b.tone : 'is-none'}"></span>
							<span class="ssa-muted">{b.key}</span>
							<strong class:ssa-faint={!b.n}>{b.n || "—"}</strong>
						</span>
					{/each}
				</div>
				{#if broken.length === 0}
					<p class="ssa-card-note is-inline">No broken pages</p>
				{:else}
					<span class="ssa-label">Broken</span>
					<ul class="ssa-broken-list">
						{#each broken.slice(0, BROKEN_ROWS) as page (page.url)}
							<li>
								<span class="ssa-tag is-bad">{page.status || "ERR"}</span>
								<a class="ssa-broken-path" href={page.url} title={page.url} rel="noopener">{pathOf(page.url)}</a>
							</li>
						{/each}
					</ul>
					{#if broken.length > BROKEN_ROWS}
						<button class="ssa-link-btn is-accent" onclick={onShowBroken}>Show all {broken.length}</button>
					{/if}
				{/if}
			</div>
		</section>
	</div>
</div>
