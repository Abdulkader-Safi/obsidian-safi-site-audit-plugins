<script lang="ts">
	import { icon } from "./icon";
	import { progressPercent, type AuditProgress } from "../audit-runner";

	let {
		defaultPages,
		folder,
		url = $bindable(""),
		running,
		progress,
		onSubmit,
	}: {
		defaultPages: number;
		folder: string;
		/** Owned by the dashboard, so "Run again" can prefill it. */
		url?: string;
		running: boolean;
		progress: AuditProgress | null;
		onSubmit: (url: string, pages: number | undefined) => void;
	} = $props();

	let pages = $state("");

	const percent = $derived(progress ? progressPercent(progress) : 0);
	const phaseText = $derived.by(() => {
		if (!progress) return "";
		if (progress.phase === "crawling") {
			return `Crawling · ${progress.pagesFound} of up to ${progress.pagesTotal} pages found`;
		}
		if (progress.phase === "checking") {
			return `Checking · ${progress.pagesDone} of ${progress.pagesTotal} pages audited`;
		}
		return "Writing the report";
	});

	function submit() {
		onSubmit(url.trim(), pages ? Number(pages) : undefined);
	}
</script>

<div class="ssa-newrun">
	<div class="ssa-newrun-intro">
		<h2 class="ssa-newrun-title">Audit a site</h2>
		<p class="ssa-newrun-lede">
			Crawls the site, checks every page against 94 rules, and writes the report to
			<span class="ssa-newrun-folder">{folder}</span> as Markdown, JSON and HTML.
		</p>
	</div>

	<div class="ssa-field-group">
		<div class="ssa-field">
			<label class="ssa-field-label" for="ssa-url">Website URL</label>
			<input
				class="ssa-input ssa-input-lg"
				id="ssa-url"
				placeholder="https://example.com"
				bind:value={url}
				disabled={running}
				onkeydown={(e) => e.key === "Enter" && submit()}
			/>
		</div>
		<div class="ssa-field">
			<label class="ssa-field-label" for="ssa-pages">Pages to crawl</label>
			<input
				class="ssa-input ssa-input-num"
				id="ssa-pages"
				type="number"
				min="1"
				placeholder={String(defaultPages)}
				bind:value={pages}
				disabled={running}
			/>
			<div class="ssa-field-desc">
				Empty crawls up to {defaultPages}. Large crawls take a few minutes.
			</div>
		</div>
	</div>

	<div class="ssa-newrun-actions">
		<button class="ssa-btn mod-cta" onclick={submit} disabled={running}>
			{#if running}
				<span class="ssa-spinner"></span>
				Auditing
			{:else}
				<span use:icon={"play"}></span>
				Run audit
			{/if}
		</button>
	</div>

	{#if running && progress}
		<div class="ssa-progress">
			<div class="ssa-progress-head">
				<span class="ssa-progress-phase">{phaseText}</span>
				<span class="ssa-progress-pct">{percent}%</span>
			</div>
			<div class="ssa-progress-track">
				<span class="ssa-progress-fill" style="width:{percent}%"></span>
			</div>
			{#if progress.checksTotal > 0}
				<div class="ssa-progress-sub">
					{progress.checksDone.toLocaleString()} of {progress.checksTotal.toLocaleString()} checks
				</div>
			{/if}
			{#if progress.url}
				<div class="ssa-progress-url">{progress.url}</div>
			{/if}
		</div>
	{/if}
</div>
