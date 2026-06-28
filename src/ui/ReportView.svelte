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

	import * as Card from "$lib/components/ui/card";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Table from "$lib/components/ui/table";
	import * as Accordion from "$lib/components/ui/accordion";
	import * as Select from "$lib/components/ui/select";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { cn } from "$lib/utils";
	import ScoreGauge from "./ScoreGauge.svelte";
	import FileTextIcon from "@lucide/svelte/icons/file-text";

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

<div class="flex flex-col gap-4">
	<!-- Overview header -->
	<Card.Root>
		<Card.Content class="flex flex-wrap items-center gap-6 pt-6">
			<ScoreGauge value={report.score} />
			<div class="flex min-w-48 flex-col gap-1">
				<div class="flex items-center gap-2">
					<span class="text-lg font-semibold">{hostOf(report.startUrl)}</span>
					<Badge variant={gradeVariant(report.score)}>Grade {grade(report.score)}</Badge>
				</div>
				<span class="truncate text-sm text-muted-foreground">{report.startUrl}</span>
				<span class="text-sm text-muted-foreground">
					{formatDate(report.generatedAt)} · {report.pagesScanned} pages crawled
				</span>
				{#if path}
					<div class="mt-1">
						<Button variant="outline" size="sm" onclick={openNote}>
							<FileTextIcon data-icon="inline-start" />
							Open note
						</Button>
					</div>
				{/if}
			</div>
			<div class="ml-auto flex gap-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-emerald-500">{totals.pass}</div>
					<div class="text-xs text-muted-foreground">Passed · {pct(totals.pass, totals.total)}%</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-amber-500">{totals.warn}</div>
					<div class="text-xs text-muted-foreground">Warnings · {pct(totals.warn, totals.total)}%</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-red-500">{totals.fail}</div>
					<div class="text-xs text-muted-foreground">Failed · {pct(totals.fail, totals.total)}%</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Tabs.Root value="categories">
		<Tabs.List>
			<Tabs.Trigger value="categories">Categories &amp; issues</Tabs.Trigger>
			<Tabs.Trigger value="pages">Pages</Tabs.Trigger>
		</Tabs.List>

		<!-- Categories + issues (each issue lists the pages it appears on) -->
		<Tabs.Content value="categories" class="flex flex-col gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Category scores</Card.Title>
					<Card.Action>
						<ToggleGroup.Root type="single" bind:value={sort} variant="outline" size="sm">
							<ToggleGroup.Item value="worst">Worst</ToggleGroup.Item>
							<ToggleGroup.Item value="best">Best</ToggleGroup.Item>
							<ToggleGroup.Item value="az">A–Z</ToggleGroup.Item>
						</ToggleGroup.Root>
					</Card.Action>
				</Card.Header>
				<Card.Content class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
					{#each sortedCategories as cat (cat.category)}
						<div class="flex items-center gap-3">
							<span class="w-36 shrink-0 truncate text-sm">{cat.category}</span>
							<span class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
								<span class="block h-full rounded-full bg-primary" style="width:{cat.score}%"></span>
							</span>
							<span class="w-8 shrink-0 text-right text-sm font-medium">{cat.score}</span>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Issues</Card.Title>
					<Card.Description>{issues.length} rules flagged across {report.pagesScanned} pages</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<ToggleGroup.Root type="multiple" bind:value={sevFilter} variant="outline" size="sm">
							<ToggleGroup.Item value="fail">Errors {totals.fail}</ToggleGroup.Item>
							<ToggleGroup.Item value="warn">Warnings {totals.warn}</ToggleGroup.Item>
							<ToggleGroup.Item value="info">Info {totals.info}</ToggleGroup.Item>
						</ToggleGroup.Root>
						<Select.Root type="single" bind:value={catFilter}>
							<Select.Trigger class="w-44">
								{catFilter === "all" ? "All categories" : catFilter}
							</Select.Trigger>
							<!-- Portal into the plugin container so the scoped theme tokens, border
							     reset and font reach the dropdown (default portal targets <body>,
							     where bg-popover/border resolve to nothing → transparent menu). -->
							<Select.Content portalProps={{ to: ".safi-site-audit" }}>
								<Select.Item value="all">All categories</Select.Item>
								{#each categoryNames as c (c)}
									<Select.Item value={c}>{c}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Input placeholder="Filter…" bind:value={query} class="h-8 w-40" />
					</div>

					{#if filteredIssues.length === 0}
						<p class="py-4 text-center text-sm text-muted-foreground">No issues match these filters.</p>
					{:else}
						<Accordion.Root type="multiple" class="w-full">
							{#each filteredIssues as issue (issue.ruleId)}
								<Accordion.Item value={issue.ruleId}>
									<Accordion.Trigger>
										<span class="flex min-w-0 flex-1 items-start gap-2 pr-2 text-left">
											<span class={cn("mt-[6px] size-2 shrink-0 rounded-full", statusDot(issue.status))}></span>
											<span class="flex min-w-0 flex-1 flex-col gap-0.5">
												<span class="flex flex-wrap items-center gap-2">
													<span class="font-medium">{issue.title}</span>
													<Badge variant={statusBadge(issue.status)}>{statusLabel(issue.status)}</Badge>
													<Badge variant="outline">{issue.category}</Badge>
												</span>
												<span class="text-sm font-normal text-muted-foreground">{issue.message}</span>
											</span>
											<Badge variant="secondary" class="ml-2 shrink-0 self-start">
												{issue.pages.length} page{issue.pages.length === 1 ? "" : "s"}
											</Badge>
										</span>
									</Accordion.Trigger>
									<Accordion.Content>
										<div class="flex flex-col gap-1 pl-4">
											<span class="text-xs font-medium text-muted-foreground">Affected pages</span>
											{#each issue.pages as p (p)}
												<span class="truncate text-sm">{p}</span>
											{/each}
										</div>
									</Accordion.Content>
								</Accordion.Item>
							{/each}
						</Accordion.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- Per-page view (kept) -->
		<Tabs.Content value="pages">
			<Accordion.Root type="single" class="w-full">
				{#each report.pages as page, i (page.url)}
					{@const probs = pageIssues(page.findings)}
					<Accordion.Item value={`page-${i}`}>
						<Accordion.Trigger>
							<span class="flex w-full items-center gap-2 pr-2">
								<Badge variant={scoreVariant(page.score)}>{page.score}</Badge>
								<span class="truncate">{page.url}</span>
								<span class="ml-auto text-muted-foreground">{probs.length} issue{probs.length === 1 ? "" : "s"}</span>
							</span>
						</Accordion.Trigger>
						<Accordion.Content>
							{#if probs.length === 0}
								<p class="text-muted-foreground">No issues found on this page.</p>
							{:else}
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>Severity</Table.Head>
											<Table.Head>Issue</Table.Head>
											<Table.Head>Details</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each probs as f, fi (`${f.ruleId}-${fi}`)}
											<Table.Row>
												<Table.Cell>
													<Badge variant={statusBadge(f.status)}>{statusLabel(f.status)}</Badge>
												</Table.Cell>
												<Table.Cell class="font-medium">{f.title}</Table.Cell>
												<Table.Cell class="text-muted-foreground">{f.message}</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							{/if}
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
