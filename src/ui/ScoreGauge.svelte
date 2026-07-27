<script lang="ts">
	import { grade, scoreTone } from "./helpers";

	let { value, size = 92 }: { value: number; size?: number } = $props();

	const stroke = 6;
	const clamped = $derived(Math.max(0, Math.min(100, value)));
	const r = $derived((size - stroke) / 2);
	const c = $derived(2 * Math.PI * r);
	const offset = $derived(c * (1 - clamped / 100));
	const tone = $derived(scoreTone(clamped));
</script>

<div
	class="ssa-gauge"
	style="width:{size}px;height:{size}px"
	role="img"
	aria-label="Health score {Math.round(clamped)} out of 100, grade {grade(clamped)}"
>
	<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke-width={stroke} class="ssa-gauge-track" />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray={c}
			stroke-dashoffset={offset}
			class="ssa-gauge-arc {tone}"
		/>
	</svg>
	<div class="ssa-gauge-center">
		<span class="ssa-gauge-value">{Math.round(clamped)}</span>
		<span class="ssa-gauge-grade">Grade {grade(clamped)}</span>
	</div>
</div>
