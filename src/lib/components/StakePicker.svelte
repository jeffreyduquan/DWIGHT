<!--
	@file StakePicker.svelte — cool quick-stake button pad for bet inputs.
	@implements REQ-UI-004

	Two rows:
	  Top — increment buttons (scaled by current multiplier): 10·m, 20·m, 50·m, 75·m
	  Bottom — utility buttons:  ÷10 · Min · Clear · Max · ×10
	Plus a large display of the current stake and a submit button.
-->
<script lang="ts">
	import { X, ArrowRight } from '@lucide/svelte';

	type Props = {
		min: number;
		max: number;
		name?: string;
		initial?: number;
		submitLabel?: string;
		potentialProfit?: number | null;
	};

	let {
		min,
		max,
		name = 'stake',
		initial,
		submitLabel = 'Wetten',
		potentialProfit = null
	}: Props = $props();

	let stake = $state(Math.max(min, initial ?? min));
	let mult = $state(1);

	const increments = [10, 20, 50, 75];

	function add(base: number) {
		const next = stake + base * mult;
		stake = Math.min(max, Math.max(min, next));
	}

	function setStake(v: number) {
		stake = Math.min(max, Math.max(min, v));
	}

	const canBet = $derived(stake >= min && stake <= max);
</script>

<div class="space-y-2">
	<!-- increment row -->
	<div class="grid grid-cols-4 gap-1">
		{#each increments as inc (inc)}
			{@const value = inc * mult}
			<button
				type="button"
				class="btn btn-xs btn-outline tabular font-semibold"
				disabled={stake + value > max}
				onclick={() => add(inc)}
			>
				+{value}
			</button>
		{/each}
	</div>

	<!-- utility row -->
	<div class="grid grid-cols-5 gap-1">
		<button
			type="button"
			class="btn btn-xs"
			class:btn-primary={mult < 1}
			class:btn-ghost={mult >= 1}
			disabled={mult <= 0.1}
			onclick={() => (mult = Math.max(0.1, mult / 10))}
			title="Schrittweite ÷10"
		>
			÷10
		</button>
		<button type="button" class="btn btn-xs btn-ghost" onclick={() => setStake(min)} title="Min">
			Min
		</button>
		<button
			type="button"
			class="btn btn-xs btn-ghost"
			onclick={() => setStake(min)}
			title="Reset"
			aria-label="Reset"
		>
			<X size={12} />
		</button>
		<button type="button" class="btn btn-xs btn-ghost font-semibold" onclick={() => setStake(max)} title="All-in">
			All-in
		</button>
		<button
			type="button"
			class="btn btn-xs"
			class:btn-primary={mult > 1}
			class:btn-ghost={mult <= 1}
			disabled={mult >= 1000}
			onclick={() => (mult = mult * 10)}
			title="Schrittweite ×10"
		>
			×10
		</button>
	</div>

	<!-- stake display + submit -->
	<div class="flex items-stretch gap-1 rounded-xl bg-base-content/5 p-1">
		<div class="flex flex-1 flex-col justify-center px-2">
			<p class="text-base-content/40 text-[0.6rem] uppercase tracking-wider leading-none">
				Einsatz {mult !== 1 ? `· Schritt ${mult}` : ''}
			</p>
			<p class="text-gradient-primary tabular text-xl font-bold leading-tight">{stake}</p>
			{#if potentialProfit != null && potentialProfit > 0}
				<p class="text-success text-[0.65rem] leading-none">+{potentialProfit} bei Sieg</p>
			{/if}
		</div>
		<button class="btn btn-sm btn-primary gap-1" disabled={!canBet}>
			{submitLabel} <ArrowRight size={14} />
		</button>
	</div>

	<input type="hidden" {name} value={stake} />
</div>
