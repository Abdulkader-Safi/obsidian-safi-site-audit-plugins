<script lang="ts">
	import { normalizeAuditUrl } from "./helpers";

	let {
		defaultPages,
		folder,
		url = $bindable(""),
		canCancel,
		onCancel,
		onSubmit,
	}: {
		defaultPages: number;
		folder: string;
		/** Owned by the dashboard, so "Edit URL" can prefill it. */
		url?: string;
		canCancel: boolean;
		onCancel: () => void;
		onSubmit: (url: string, pages: number | undefined) => void;
	} = $props();

	let pages = $state("");
	// Only complain once the field has been left or submitted, not on every keystroke.
	// A prefilled URL (Edit URL after a failure) is checked straight away.
	let touched = $state(initiallyFilled());
	function initiallyFilled(): boolean {
		return url.trim() !== "";
	}

	const normalized = $derived(normalizeAuditUrl(url));
	const showError = $derived(touched && url.trim() !== "" && !normalized);

	function submit() {
		touched = true;
		if (!normalized) return;
		onSubmit(normalized, pages ? Number(pages) : undefined);
	}
</script>

<form
	class="ssa-panel-card ssa-form"
	onsubmit={(e) => {
		e.preventDefault();
		submit();
	}}
>
	<div class="ssa-form-head">
		<h2 class="ssa-panel-title">New audit</h2>
		<p class="ssa-panel-sub">Saved to {folder}/&lt;site&gt; in your vault</p>
	</div>

	<div class="ssa-field">
		<label class="ssa-field-label" for="ssa-url">Site URL</label>
		<input
			class="ssa-input"
			class:is-invalid={showError}
			id="ssa-url"
			type="text"
			inputmode="url"
			autocomplete="url"
			spellcheck="false"
			placeholder="https://example.com"
			aria-invalid={showError}
			aria-describedby="ssa-url-desc"
			bind:value={url}
			onblur={() => (touched = true)}
		/>
		<span class="ssa-field-desc" class:is-bad={showError} id="ssa-url-desc">
			{showError ? "Enter a full URL, like https://example.com" : "Crawling starts here and follows internal links"}
		</span>
	</div>

	<div class="ssa-field">
		<label class="ssa-field-label" for="ssa-pages">Pages to crawl</label>
		<input
			class="ssa-input ssa-input-narrow"
			id="ssa-pages"
			type="number"
			min="1"
			max="500"
			placeholder={String(defaultPages)}
			aria-describedby="ssa-pages-desc"
			bind:value={pages}
		/>
		<span class="ssa-field-desc" id="ssa-pages-desc">Empty uses {defaultPages}</span>
	</div>

	<div class="ssa-panel-actions">
		{#if canCancel}
			<button type="button" class="ssa-btn" onclick={onCancel}>Cancel</button>
		{/if}
		<button type="submit" class="ssa-btn mod-cta" disabled={!normalized}>Start audit</button>
	</div>
</form>
