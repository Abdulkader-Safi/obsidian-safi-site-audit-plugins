import { setIcon } from "obsidian";

// Svelte action: render an Obsidian (lucide) icon into the node.
// Replaces @lucide/svelte — Obsidian already bundles the lucide set.
export function icon(node: HTMLElement, name: string) {
	setIcon(node, name);
	return {
		update(next: string) {
			node.empty();
			setIcon(node, next);
		},
	};
}
