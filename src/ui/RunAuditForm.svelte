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
			Crawls the site, checks every page against 94 rules, and saves the report to
			<span class="ssa-newrun-folder">{folder}</span> as Markdown, JSON and HTML.
		</p>
	</div>

	<div class="ssa-card ssa-form-card">
		<div class="ssa-field">
			<label class="ssa-field-label" for="ssa-url">Website URL</label>
			<input
				class="ssa-input ssa-input-lg"
				id="ssa-url"
				type="url"
				placeholder="https://example.com"
				bind:value={url}
				disabled={running}
				onkeydown={(e) => e.key === "Enter" && submit()}
			/>
		</div>
		<div class="ssa-field ssa-field-narrow">
			<label class="ssa-field-label" for="ssa-pages">Pages to crawl</label>
			<div class="ssa-field-desc" id="ssa-pages-desc">
				Leave empty to crawl up to {defaultPages} pages. Large crawls take a few minutes.
			</div>
			<input
				class="ssa-input ssa-input-lg"
				id="ssa-pages"
				type="number"
				min="1"
				placeholder={String(defaultPages)}
				aria-describedby="ssa-pages-desc"
				bind:value={pages}
				disabled={running}
			/>
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
			<span class="ssa-newrun-hint">
				{running ? "You can keep working while this runs." : `Saved to ${folder}/<site>`}
			</span>
		</div>
	</div>

	{#if running && progress}
		<div class="ssa-progress" role="status" aria-live="polite">
			<div class="ssa-progress-head">
				<span class="ssa-progress-phase">{phaseText}</span>
				<span class="ssa-progress-pct">{percent}%</span>
			</div>
			<div class="ssa-progress-track">
				<span class="ssa-progress-fill" style="width:{percent}%"></span>
			</div>
			<div class="ssa-progress-meta">
				<span class="ssa-progress-sub">
					{#if progress.checksTotal > 0}
						{progress.checksDone.toLocaleString()} of {progress.checksTotal.toLocaleString()} checks
					{/if}
				</span>
				{#if progress.url}
					<span class="ssa-progress-url">{progress.url}</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
