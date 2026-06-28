<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Spinner } from "$lib/components/ui/spinner";
	import PlayIcon from "@lucide/svelte/icons/play";

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

<Card.Root class="mx-auto max-w-xl">
	<Card.Header>
		<Card.Title>Run a new audit</Card.Title>
		<Card.Description>Crawls the site and saves the report to “{folder}”.</Card.Description>
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
					onkeydown={(e) => e.key === "Enter" && submit()}
				/>
			</Field.Field>
			<Field.Field>
				<Field.FieldLabel for="ssa-pages">Pages</Field.FieldLabel>
				<Input
					id="ssa-pages"
					type="number"
					min="1"
					placeholder={String(defaultPages)}
					bind:value={pages}
					disabled={running}
				/>
				<Field.FieldDescription>
					Leave empty to crawl up to {defaultPages} pages. Multi-page crawls can take a minute.
				</Field.FieldDescription>
			</Field.Field>
		</Field.FieldGroup>
	</Card.Content>
	<Card.Footer>
		<Button onclick={submit} disabled={running}>
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
