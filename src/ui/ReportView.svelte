<script lang="ts">
	import { TFile } from "obsidian";
	import type { AuditReport, Finding } from "safi-studio-scanner";
	import type SafiSiteAuditPlugin from "../main";
	import { openInObsidian } from "../audit-store";
	import { hostOf, scoreVariant, severityVariant } from "./helpers";

	import * as Card from "$lib/components/ui/card";
	import * as Tabs from "$lib/components/ui/tabs";
	import * as Table from "$lib/components/ui/table";
	import * as Accordion from "$lib/components/ui/accordion";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Progress } from "$lib/components/ui/progress";
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

	function issues(findings: Finding[]): Finding[] {
		return findings.filter((f) => f.status === "fail" || f.status === "warn");
	}

	function openNote() {
		if (!path) return;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) openInObsidian(plugin.app, file);
	}
</script>

<div class="flex flex-col gap-4">
	{#if path}
		<div class="flex items-center">
			<Button variant="outline" size="sm" class="ml-auto" onclick={openNote}>
				<FileTextIcon data-icon="inline-start" />
				Open note
			</Button>
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>{hostOf(report.startUrl)}</Card.Title>
			<Card.Description>{report.pagesScanned} pages scanned · {report.startUrl}</Card.Description>
			<Card.Action>
				<Badge variant={scoreVariant(report.score)} class="text-base">{report.score}/100</Badge>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<Progress value={report.score} max={100} />
		</Card.Content>
	</Card.Root>

	<Tabs.Root value="categories">
		<Tabs.List>
			<Tabs.Trigger value="categories">Categories</Tabs.Trigger>
			<Tabs.Trigger value="pages">Pages</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="categories">
			<Card.Root>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Category</Table.Head>
								<Table.Head class="text-right">Score</Table.Head>
								<Table.Head class="text-right">Pass</Table.Head>
								<Table.Head class="text-right">Warn</Table.Head>
								<Table.Head class="text-right">Fail</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each report.categories as cat (cat.category)}
								<Table.Row>
									<Table.Cell class="font-medium">{cat.category}</Table.Cell>
									<Table.Cell class="text-right">
										<Badge variant={scoreVariant(cat.score)}>{cat.score}</Badge>
									</Table.Cell>
									<Table.Cell class="text-right">{cat.pass}</Table.Cell>
									<Table.Cell class="text-right">{cat.warn}</Table.Cell>
									<Table.Cell class="text-right">{cat.fail}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="pages">
			<Accordion.Root type="single" class="w-full">
				{#each report.pages as page, i (page.url)}
					{@const probs = issues(page.findings)}
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
													<Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
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
