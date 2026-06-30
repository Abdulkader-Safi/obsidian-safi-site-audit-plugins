<script lang="ts">
	import { TFile } from "obsidian";
	import type { AuditReport, Finding } from "safi-studio-scanner";
	import type SafiSiteAuditPlugin from "../main";
	import { openInObsidian } from "../audit-store";
	import {
		buildIssues,
		formatDate,
		grade,
		gradeVariant,
		hostOf,
		pct,
		scoreVariant,
		statusDot,
		statusTotals,
		type Issue,
	} from "./helpers";
	import { icon } from "./icon";
	import ScoreGauge from "./ScoreGauge.svelte";

	let {
		report,
		path,
		plugin,
	}: {
		report: AuditReport;
		path: string | null;
		plugin: SafiSiteAuditPlugin;
	} = $props();

	const totals = $derived(statusTotals(report));
	const issues = $derived(buildIssues(report));
	const categoryNames = $derived(report.categories.map((c) => c.category));

	let tab = $state<"categories" | "pages">("categories");

	// Category scores, sortable.
	let sort = $state<"worst" | "best" | "az">("worst");
	const sortedCategories = $derived(
		[...report.categories].sort((a, b) => {
			if (sort === "az") return a.category.localeCompare(b.category);
			return sort === "worst" ? a.score - b.score : b.score - a.score;
		}),
	);

	// Issue filters.
	let sevFilter = $state<string[]>(["fail", "warn", "info"]);
	let catFilter = $state("all");
	let query = $state("");
	const filteredIssues = $derived(
		issues.filter((i) => {
			if (!sevFilter.includes(i.status)) return false;
			if (catFilter !== "all" && i.category !== catFilter) return false;
			const q = query.trim().toLowerCase();
			if (q && !`${i.title} ${i.message} ${i.ruleId}`.toLowerCase().includes(q)) return false;
			return true;
		}),
	);

	function toggleSev(s: string) {
		sevFilter = sevFilter.includes(s) ? sevFilter.filter((x) => x !== s) : [...sevFilter, s];
	}

	function statusLabel(status: Issue["status"]): string {
		return status === "fail" ? "Error" : status === "warn" ? "Warning" : "Info";
	}

	function statusBadge(status: Issue["status"]): "destructive" | "secondary" | "outline" {
		return status === "fail" ? "destructive" : status === "warn" ? "secondary" : "outline";
	}

	function pageIssues(findings: Finding[]): Finding[] {
		return findings.filter((f) => f.status === "fail" || f.status === "warn");
	}

	function openNote() {
		if (!path) return;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) openInObsidian(plugin.app, file);
	}
</script>

<div class="ssa-report">
	<!-- Overview header -->
	<div class="ssa-card">
		<div class="ssa-overview">
			<ScoreGauge value={report.score} />
			<div class="ssa-overview-meta">
				<div class="ssa-overview-host">
					<span class="ssa-overview-host-name">{hostOf(report.startUrl)}</span>
					<span class="ssa-badge ssa-badge-{gradeVariant(report.score)}">Grade {grade(report.score)}</span>
				</div>
				<span class="ssa-overview-url">{report.startUrl}</span>
				<span class="ssa-overview-sub">
					{formatDate(report.generatedAt)} · {report.pagesScanned} pages crawled
				</span>
				{#if path}
					<div class="ssa-mt">
						<button class="ssa-btn ssa-btn-outline ssa-btn-sm" onclick={openNote}>
							<span use:icon={"file-text"}></span>
							Open note
						</button>
					</div>
				{/if}
			</div>
			<div class="ssa-stats">
				<div class="ssa-stat">
					<div class="ssa-stat-num ssa-stat-pass">{totals.pass}</div>
					<div class="ssa-stat-label">Passed · {pct(totals.pass, totals.total)}%</div>
				</div>
				<div class="ssa-stat">
					<div class="ssa-stat-num ssa-stat-warn">{totals.warn}</div>
					<div class="ssa-stat-label">Warnings · {pct(totals.warn, totals.total)}%</div>
				</div>
				<div class="ssa-stat">
					<div class="ssa-stat-num ssa-stat-fail">{totals.fail}</div>
					<div class="ssa-stat-label">Failed · {pct(totals.fail, totals.total)}%</div>
				</div>
			</div>
		</div>
	</div>

	<div>
		<div class="ssa-tablist">
			<button class="ssa-tab" class:is-active={tab === "categories"} onclick={() => (tab = "categories")}>
				Categories &amp; issues
			</button>
			<button class="ssa-tab" class:is-active={tab === "pages"} onclick={() => (tab = "pages")}>
				Pages
			</button>
		</div>

		{#if tab === "categories"}
			<!-- Categories + issues (each issue lists the pages it appears on) -->
			<div class="ssa-tabpanel">
				<div class="ssa-card">
					<div class="ssa-card-header">
						<div class="ssa-card-title">Category scores</div>
						<div class="ssa-card-action">
							<div class="ssa-toggles">
								<button class="ssa-toggle" class:is-active={sort === "worst"} onclick={() => (sort = "worst")}>Worst</button>
								<button class="ssa-toggle" class:is-active={sort === "best"} onclick={() => (sort = "best")}>Best</button>
								<button class="ssa-toggle" class:is-active={sort === "az"} onclick={() => (sort = "az")}>A–Z</button>
							</div>
						</div>
					</div>
					<div class="ssa-cats">
						{#each sortedCategories as cat (cat.category)}
							<div class="ssa-cat-row">
								<span class="ssa-cat-name">{cat.category}</span>
								<span class="ssa-cat-bar">
									<span class="ssa-cat-bar-fill" style="width:{cat.score}%"></span>
								</span>
								<span class="ssa-cat-score">{cat.score}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="ssa-card">
					<div class="ssa-card-header">
						<div>
							<div class="ssa-card-title">Issues</div>
							<div class="ssa-card-desc">{issues.length} rules flagged across {report.pagesScanned} pages</div>
						</div>
					</div>
					<div class="ssa-card-content">
						<div class="ssa-filters">
							<div class="ssa-toggles">
								<button class="ssa-toggle" class:is-active={sevFilter.includes("fail")} onclick={() => toggleSev("fail")}>Errors {totals.fail}</button>
								<button class="ssa-toggle" class:is-active={sevFilter.includes("warn")} onclick={() => toggleSev("warn")}>Warnings {totals.warn}</button>
								<button class="ssa-toggle" class:is-active={sevFilter.includes("info")} onclick={() => toggleSev("info")}>Info {totals.info}</button>
							</div>
							<select class="ssa-select" bind:value={catFilter}>
								<option value="all">All categories</option>
								{#each categoryNames as c (c)}
									<option value={c}>{c}</option>
								{/each}
							</select>
							<input class="ssa-input" placeholder="Filter…" bind:value={query} />
						</div>

						{#if filteredIssues.length === 0}
							<p class="ssa-no-results">No issues match these filters.</p>
						{:else}
							<div class="ssa-accordion">
								{#each filteredIssues as issue (issue.ruleId)}
									<details class="ssa-acc-item">
										<summary class="ssa-acc-trigger">
											<span class="ssa-issue-head">
												<span class="ssa-dot {statusDot(issue.status)}"></span>
												<span class="ssa-issue-title">{issue.title}</span>
												<span class="ssa-badge ssa-badge-{statusBadge(issue.status)}">{statusLabel(issue.status)}</span>
												<span class="ssa-badge ssa-badge-outline">{issue.category}</span>
												<span class="ssa-badge ssa-badge-secondary ssa-push">
													{issue.pages.length} page{issue.pages.length === 1 ? "" : "s"}
												</span>
											</span>
										</summary>
										<div class="ssa-acc-content">
											<div class="ssa-issue-body">
												<p class="ssa-issue-msg">{issue.message}</p>
												<div class="ssa-pages">
													<span class="ssa-pages-label">Affected pages</span>
													{#each issue.pages as p (p)}
														<span class="ssa-page-url">{p}</span>
													{/each}
												</div>
											</div>
										</div>
									</details>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Per-page view -->
			<div class="ssa-accordion">
				{#each report.pages as page, i (page.url)}
					{@const probs = pageIssues(page.findings)}
					<details class="ssa-acc-item" name="ssa-pages">
						<summary class="ssa-acc-trigger">
							<span class="ssa-page-row">
								<span class="ssa-badge ssa-badge-{scoreVariant(page.score)}">{page.score}</span>
								<span class="ssa-page-name">{page.url}</span>
								<span class="ssa-page-count">{probs.length} issue{probs.length === 1 ? "" : "s"}</span>
							</span>
						</summary>
						<div class="ssa-acc-content">
							{#if probs.length === 0}
								<p class="ssa-cell-muted">No issues found on this page.</p>
							{:else}
								<table class="ssa-table">
									<thead>
										<tr>
											<th>Severity</th>
											<th>Issue</th>
											<th>Details</th>
										</tr>
									</thead>
									<tbody>
										{#each probs as f, fi (`${f.ruleId}-${fi}`)}
											<tr>
												<td>
													<span class="ssa-badge ssa-badge-{statusBadge(f.status)}">{statusLabel(f.status)}</span>
												</td>
												<td class="ssa-cell-strong">{f.title}</td>
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
</div>
