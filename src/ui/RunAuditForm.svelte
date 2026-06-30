<script lang="ts">
	import { icon } from "./icon";

	let {
		defaultPages,
		folder,
		running,
		onSubmit,
	}: {
		defaultPages: number;
		folder: string;
		running: boolean;
		onSubmit: (url: string, pages: number | undefined) => void;
	} = $props();

	let url = $state("");
	let pages = $state("");

	function submit() {
		onSubmit(url.trim(), pages ? Number(pages) : undefined);
	}
</script>

<div class="ssa-card ssa-card-narrow">
	<div class="ssa-card-header">
		<div>
			<div class="ssa-card-title">Run a new audit</div>
			<div class="ssa-card-desc">Crawls the site and saves the report to “{folder}”.</div>
		</div>
	</div>
	<div class="ssa-card-content">
		<div class="ssa-field-group">
			<div class="ssa-field">
				<label class="ssa-field-label" for="ssa-url">Website URL</label>
				<input
					class="ssa-input"
					id="ssa-url"
					placeholder="https://example.com"
					bind:value={url}
					disabled={running}
					onkeydown={(e) => e.key === "Enter" && submit()}
				/>
			</div>
			<div class="ssa-field">
				<label class="ssa-field-label" for="ssa-pages">Pages</label>
				<input
					class="ssa-input"
					id="ssa-pages"
					type="number"
					min="1"
					placeholder={String(defaultPages)}
					bind:value={pages}
					disabled={running}
				/>
				<div class="ssa-field-desc">
					Leave empty to crawl up to {defaultPages} pages. Multi-page crawls can take a minute.
				</div>
			</div>
		</div>
	</div>
	<div class="ssa-card-footer">
		<button class="ssa-btn ssa-btn-primary" onclick={submit} disabled={running}>
			{#if running}
				<span class="ssa-spinner"></span>
				Auditing…
			{:else}
				<span use:icon={"play"}></span>
				Run audit
			{/if}
		</button>
	</div>
</div>
