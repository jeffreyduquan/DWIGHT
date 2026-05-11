<!--
	@file /s/[id]/drinks/+page.svelte — drinks dashboard (Aurora-glass redesign).
	@implements REQ-DRINK-***, REQ-UI-002
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { playSound } from '$lib/client/sounds.svelte';
	import DrinkPanel from '$lib/components/DrinkPanel.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { ArrowLeft, Beer, Coins, Crown, AlertCircle } from '@lucide/svelte';

	let { data, form } = $props();

	const pendingDrinks = $derived(data.drinks.filter((d) => d.status === 'PENDING'));

	let es: EventSource | null = null;
	onMount(() => {
		es = new EventSource(`/s/${data.session.id}/stream`);
		const handler = () => invalidateAll();
		es.addEventListener('drink_initiated', handler);
		es.addEventListener('drink_confirmed', () => {
			playSound('drink');
			invalidateAll();
		});
		es.addEventListener('drink_cancelled', handler);
		es.addEventListener('balance_updated', handler);
	});
	onDestroy(() => es?.close());
</script>

<header class="mb-5 space-y-2">
	<a
		href={`/s/${data.session.id}`}
		class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1 text-sm"
		><ArrowLeft size={14} /> Lobby</a
	>
	<div class="flex items-baseline justify-between gap-3">
		<h1 class="display text-3xl">
			<span class="text-gradient-primary">Drinks</span>
		</h1>
		{#if pendingDrinks.length > 0}
			<span class="badge badge-warning">{pendingDrinks.length} offen</span>
		{/if}
	</div>
</header>

<section class="card-stat fade-up mb-4 flex items-center justify-between gap-3 px-5 py-4">
	<div class="flex items-center gap-3">
		<IconBubble tone="primary" size="lg"><Coins size={22} /></IconBubble>
		<div>
			<p class="eyebrow">Saldo</p>
			<p class="stat-hero text-3xl">
				<span class="text-gradient-primary">{data.me.moneyBalance}</span>
			</p>
		</div>
	</div>
	<div class="flex flex-col items-end gap-1">
		{#if data.me.role === 'HOST'}
			<span class="badge badge-primary gap-1"><Crown size={12} /> Host (GM)</span>
		{/if}
	</div>
</section>

{#if form?.error}
	<div class="glass glass-xl border-error/60 mb-4 flex items-center gap-3 border-2 p-4">
		<IconBubble tone="error"><AlertCircle size={18} /></IconBubble>
		<p class="text-error text-sm">{form.error}</p>
	</div>
{/if}

<section class="glass glass-xl mb-4 p-4">
	<div class="mb-3 flex items-center gap-3">
		<IconBubble tone="accent" size="lg"><Beer size={20} /></IconBubble>
		<div>
			<p class="eyebrow">Drinks-Dashboard</p>
			<p class="text-base-content/60 text-xs">Selbst trinken · zwingen · bestätigen · Historie</p>
		</div>
	</div>
	<div class="divider-soft mb-3"></div>
	<DrinkPanel session={data.session} me={data.me} players={data.players} drinks={data.drinks} />
</section>

<div class="h-12"></div>
