<script lang="ts">
	import { onMount } from "svelte";
	import { Notice, type TFile, type EventRef } from "obsidian";
	import type { AuditReport } from "safi-studio-scanner";
	import type SafiSiteAuditPlugin from "../main";
	import {
		listAudits,
		readAudit,
		saveAudit,
		type AuditListItem,
	} from "../audit-store";
	import { runAudit } from "../audit-runner";
	import ReportView from "./ReportView.svelte";
	import RunAuditForm from "./RunAuditForm.svelte";
	import { formatDate, hostOf, scoreVariant } from "./helpers";

	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import * as Empty from "$lib/components/ui/empty";
	import { cn } from "$lib/utils";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import GaugeIcon from "@lucide/svelte/icons/gauge";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	type Mode = "empty" | "new" | "detail";

	let items = $state<AuditListItem[]>([]);
	let mode = $state<Mode>("empty");
	let selected = $state<AuditReport | null>(null);
	let selectedPath = $state<string | null>(null);
	let running = $state(false);

	function refresh() {
		items = listAudits(plugin.app, plugin.settings);
	}

	onMount(() => {
		refresh();
		// New files aren't in the metadata cache immediately; refresh the list once Obsidian
		// finishes indexing so freshly-run audits appear without a manual reload.
		const ref: EventRef = plugin.app.metadataCache.on("resolved", refresh);
		return () => plugin.app.metadataCache.offref(ref);
	});

	function startNew() {
		mode = "new";
		selected = null;
		selectedPath = null;
	}

	async function open(item: AuditListItem) {
		const report = await readAudit(plugin.app, item.file);
		if (!report) {
			new Notice("Could not read this audit's report data.");
			return;
		}
		selected = report;
		selectedPath = item.file.path;
		mode = "detail";
	}

	async function run(url: string, pages: number | undefined) {
		if (!url) {
			new Notice("Enter a URL to audit.");
			return;
		}
		running = true;
		try {
			const report = await runAudit({ url, maxPages: pages }, plugin.settings);
			const file: TFile = await saveAudit(plugin.app, plugin.settings, report);
			// Show it immediately from the in-memory report (cache may lag), then reconcile.
			selected = report;
			selectedPath = file.path;
			mode = "detail";
			items = [
				{ file, url: report.startUrl, date: report.generatedAt, score: report.score, pages: report.pagesScanned },
				...items.filter((i) => i.file.path !== file.path),
			];
			new Notice(`Audit saved: ${file.name}`);
		} catch (e) {
			new Notice(`Audit failed: ${(e as Error).message}`);
		} finally {
			running = false;
		}
	}
</script>

<div class="flex h-full min-h-0">
	<aside class="flex w-64 shrink-0 flex-col border-r bg-muted/30">
		<div class="flex items-center gap-2 border-b p-3">
			<GaugeIcon class="size-4" />
			<span class="font-semibold">Safi Site Audit</span>
			<Button size="sm" class="ml-auto" onclick={startNew} disabled={running}>
				<PlusIcon data-icon="inline-start" />
				New
			</Button>
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
			{#if items.length === 0}
				<p class="p-2 text-sm text-muted-foreground">No audits yet.</p>
			{:else}
				<!-- ponytail: native row, not <Button> — the button primitive forces a fixed
				     height and whitespace-nowrap, which squeezes this two-line item. -->
				{#each items as item (item.file.path)}
					<Button
						variant={selectedPath === item.file.path ? "default" : "ghost"}
						onclick={() => open(item)}
						class="flex flex-col justify-start items-start h-fit! py-2! px-4!"
					>
						<span class="flex w-full justify-between items-center gap-2">
							<span class="truncate text-sm font-medium">{hostOf(item.url)}</span>
							<Badge variant={scoreVariant(item.score)} class="ml-auto shrink-0">{item.score}</Badge>
						</span>
						<span class="text-xs w-full flex justify-start items-center text-muted-foreground">{formatDate(item.date)}</span>
					</Button>
				{/each}
			{/if}
		</div>
	</aside>

	<main class="min-w-0 flex-1 overflow-y-auto p-4">
		{#if mode === "detail" && selected}
			<ReportView report={selected} path={selectedPath} {plugin} />
		{:else if mode === "new"}
			<RunAuditForm
				defaultPages={plugin.settings.defaultMaxPages}
				folder={plugin.settings.auditFolder}
				{running}
				onSubmit={run}
			/>
		{:else}
			<Empty.Root class="h-full">
				<Empty.Header>
					<Empty.Media variant="icon">
						<GaugeIcon />
					</Empty.Media>
					<Empty.Title>No audit selected</Empty.Title>
					<Empty.Description>
						Pick an audit from the sidebar, or run a new one.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button onclick={startNew}>
						<PlusIcon data-icon="inline-start" />
						New audit
					</Button>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</main>
</div>
