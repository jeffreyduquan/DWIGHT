<!--
	@file s/[id]/info/+page.svelte — Wettinfos: entities + trackables.
	@implements REQ-UI-011
	Read-only reference panel so players see what's countable and who/what
	competes. No betting actions here.
-->
<script lang="ts">
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { Sparkles, Activity } from '@lucide/svelte';

	let { data } = $props();

	const entityLabel = $derived('Spieler');
</script>

<section class="mb-4">
	<h2 class="display text-xl leading-none">Wettinfos</h2>
	<p class="text-base-content/55 mt-1 text-xs">Übersicht aller Entitäten und zählbaren Ereignisse.</p>
</section>

<section class="mb-5 space-y-2">
	<div class="flex items-center gap-3 px-1">
		<IconBubble tone="accent" size="sm"><Sparkles size={16} /></IconBubble>
		<div class="flex-1">
			<p class="eyebrow">{entityLabel}</p>
			<p class="text-base-content/55 text-xs">{data.entities.length} definiert</p>
		</div>
	</div>
	{#if data.entities.length === 0}
		<div class="border-base-content/10 rounded-2xl border border-dashed p-4 text-center text-sm opacity-70">
			Keine {entityLabel} definiert.
		</div>
	{:else}
		<ul class="space-y-2">
			{#each data.entities as e (e.id)}
				{@const attrs = (e.attributes as { color?: string; emoji?: string; kind?: string }) ?? {}}
				<li class="glass flex items-center gap-3 rounded-2xl px-4 py-3">
					<span
						class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-base-300"
						style="background: {attrs.color ?? 'oklch(92% 0.004 90)'}; color: oklch(20% 0 0);"
					>
						{attrs.emoji ?? e.name.charAt(0).toUpperCase()}
					</span>
					<span class="min-w-0 flex-1">
						<p class="text-sm font-semibold">{e.name}</p>
						{#if attrs.kind && attrs.kind !== 'generic'}
							<p class="text-base-content/45 text-[0.65rem] uppercase tracking-wider">{attrs.kind}</p>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="space-y-2">
	<div class="flex items-center gap-3 px-1">
		<IconBubble tone="info" size="sm"><Activity size={16} /></IconBubble>
		<div class="flex-1">
			<p class="eyebrow">Zählbare Ereignisse</p>
			<p class="text-base-content/55 text-xs">{data.trackables.length} definiert</p>
		</div>
	</div>
	{#if data.trackables.length === 0}
		<div class="border-base-content/10 rounded-2xl border border-dashed p-4 text-center text-sm opacity-70">
			Keine Trackables definiert.
		</div>
	{:else}
		<ul class="space-y-2">
			{#each data.trackables as t (t.id)}
				<li class="glass rounded-2xl px-4 py-3">
					<div class="flex items-center gap-3">
						<span
							class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ring-1 ring-base-300"
							style="background: {t.color ?? 'oklch(92% 0.004 90)'};"
						>
							{t.emoji ?? '·'}
						</span>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold">{t.label}</p>
							<p class="text-base-content/45 text-[0.65rem] uppercase tracking-wider">
								{t.scope === 'global' ? 'global' : `pro ${entityLabel.replace(/n$/, '')}`}
							</p>
						</div>
					</div>
					{#if t.description}
						<p class="text-base-content/65 mt-2 pl-11 text-xs leading-snug">{t.description}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
