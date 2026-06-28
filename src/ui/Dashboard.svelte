<script lang="ts">
	import { onMount } from "svelte";
	import { Notice, type TFile } from "obsidian";
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
	import { formatDate, hostOf, scoreVariant } from "./helpers";

	import * as Card from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Badge } from "$lib/components/ui/badge";
	import { Spinner } from "$lib/components/ui/spinner";
	import * as Alert from "$lib/components/ui/alert";
	import PlayIcon from "@lucide/svelte/icons/play";
	import InfoIcon from "@lucide/svelte/icons/info";
	import FileSearchIcon from "@lucide/svelte/icons/file-search";

	let { plugin }: { plugin: SafiSiteAuditPlugin } = $props();

	let items = $state<AuditListItem[]>([]);
	let selected = $state<AuditReport | null>(null);
	let selectedFile = $state<TFile | null>(null);
	let running = $state(false);
	let url = $state("");
	let pages = $state("");

	function refresh() {
		items = listAudits(plugin.app, plugin.settings);
	}
	onMount(refresh);

	async function open(item: AuditListItem) {
		const report = await readAudit(plugin.app, item.file);
		if (!report) {
			new Notice("Could not read this audit's report data.");
			return;
		}
		selected = report;
		selectedFile = item.file;
	}

	function back() {
		selected = null;
		selectedFile = null;
		refresh();
	}

	async function run() {
		const target = url.trim();
		if (!target) {
			new Notice("Enter a URL to audit.");
			return;
		}
		running = true;
		try {
			const report = await runAudit(
				{ url: target, maxPages: pages ? Number(pages) : undefined },
				plugin.settings,
			);
			const file = await saveAudit(plugin.app, plugin.settings, report);
			url = "";
			pages = "";
			refresh();
			selected = report;
			selectedFile = file;
			new Notice(`Audit saved: ${file.name}`);
		} catch (e) {
			new Notice(`Audit failed: ${(e as Error).message}`);
		} finally {
			running = false;
		}
	}
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
	{#if selected}
		<ReportView report={selected} file={selectedFile} {plugin} onBack={back} />
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Run a new audit</Card.Title>
				<Card.Description>
					Crawls the site and saves the report to “{plugin.settings.auditFolder}”.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Field.FieldGroup>
					<Field.Field>
						<Field.FieldLabel for="ssa-url">Website URL</Field.FieldLabel>
						<Input
							id="ssa-url"
							placeholder="https://example.com"
							bind:value={url}
							disabled={running}
							onkeydown={(e) => e.key === "Enter" && run()}
						/>
					</Field.Field>
					<Field.Field>
						<Field.FieldLabel for="ssa-pages">Pages</Field.FieldLabel>
						<Input
							id="ssa-pages"
							type="number"
							min="1"
							placeholder={String(plugin.settings.defaultMaxPages)}
							bind:value={pages}
							disabled={running}
						/>
						<Field.FieldDescription>
							Leave empty to crawl up to {plugin.settings.defaultMaxPages} pages.
						</Field.FieldDescription>
					</Field.Field>
				</Field.FieldGroup>
			</Card.Content>
			<Card.Footer>
				<Button onclick={run} disabled={running}>
					{#if running}
						<Spinner data-icon="inline-start" />
						Auditing…
					{:else}
						<PlayIcon data-icon="inline-start" />
						Run audit
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>

		{#if items.length === 0}
			<Alert.Root>
				<InfoIcon />
				<Alert.Title>No audits yet</Alert.Title>
				<Alert.Description>
					Run your first audit above. Saved audits appear here.
				</Alert.Description>
			</Alert.Root>
		{:else}
			<div class="flex flex-col gap-2">
				{#each items as item (item.file.path)}
					<Card.Root
						role="button"
						tabindex={0}
						class="cursor-pointer transition-colors hover:bg-accent"
						onclick={() => open(item)}
						onkeydown={(e) => (e.key === "Enter" || e.key === " ") && open(item)}
					>
						<Card.Header>
							<Card.Title class="flex items-center gap-2 text-base">
								<FileSearchIcon class="size-4" />
								{hostOf(item.url)}
							</Card.Title>
							<Card.Description>
								{formatDate(item.date)} · {item.pages} page{item.pages === 1 ? "" : "s"}
							</Card.Description>
							<Card.Action>
								<Badge variant={scoreVariant(item.score)}>{item.score}</Badge>
							</Card.Action>
						</Card.Header>
					</Card.Root>
				{/each}
			</div>
		{/if}
	{/if}
</div>
