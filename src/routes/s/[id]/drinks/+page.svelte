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
	import { Beer, AlertCircle } from '@lucide/svelte';

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

{#if form?.error}
	<div class="alert alert-error mb-3 py-2 text-xs">
		<AlertCircle size={14} /> {form.error}
	</div>
{/if}

<section class="glass mb-4 rounded-2xl p-3">
	<div class="mb-2 flex items-center gap-2">
		<IconBubble tone="accent" size="sm"><Beer size={16} /></IconBubble>
		<p class="eyebrow flex-1">Drinks</p>
		{#if pendingDrinks.length > 0}
			<span class="badge badge-warning badge-sm">{pendingDrinks.length} offen</span>
		{/if}
	</div>
	<DrinkPanel session={data.session} me={data.me} players={data.players} drinks={data.drinks} />
</section>
