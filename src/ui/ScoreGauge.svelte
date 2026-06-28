<script lang="ts">
	let { value, size = 96 }: { value: number; size?: number } = $props();

	const stroke = 8;
	const r = $derived((size - stroke) / 2);
	const c = $derived(2 * Math.PI * r);
	const offset = $derived(c * (1 - Math.max(0, Math.min(100, value)) / 100));
	const color = $derived(value >= 80 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444");
</script>

<div class="relative shrink-0" style="width:{size}px;height:{size}px">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="currentColor" stroke-width={stroke} class="text-muted opacity-40" />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={color}
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray={c}
			stroke-dashoffset={offset}
			style="transition: stroke-dashoffset 600ms ease"
		/>
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center">
		<span class="text-2xl font-bold leading-none">{Math.round(value)}</span>
		<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Score</span>
	</div>
</div>
