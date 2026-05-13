<!--
	@file s/[id]/+page.svelte — lobby (Aurora-glass redesign + DrinkPanel embed)
	@implements REQ-UI-001, UI_UX §6.4 (lobby)
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { playSound, isSoundEnabled, setSoundEnabled } from '$lib/client/sounds.svelte';
	import DrinkPanel from '$lib/components/DrinkPanel.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import {
		ArrowRight,
		Crown,
		Lock,
		Beer,
		Users,
		Sparkles,
		Volume2,
		VolumeX,
		Settings,
		Trash2,
		StopCircle,
		Unlock
	} from '@lucide/svelte';

	let { data } = $props();

	const isHost = $derived(data.me.role === 'HOST');
	const pendingDrinks = $derived(data.drinks.filter((d) => d.status === 'PENDING'));

	let soundOn = $state(isSoundEnabled());
	function toggleSound() {
		soundOn = !soundOn;
		setSoundEnabled(soundOn);
	}

	let es: EventSource | null = null;
	onMount(() => {
		es = new EventSource(`/s/${data.session.id}/stream`);
		const h = () => invalidateAll();
		const sound = (s: Parameters<typeof playSound>[0]) => () => {
			playSound(s);
			invalidateAll();
		};
		es.addEventListener('drink_initiated', h);
		es.addEventListener('drink_confirmed', sound('drink'));
		es.addEventListener('drink_cancelled', h);
		es.addEventListener('balance_updated', h);
		es.addEventListener('player_joined', h);
		es.addEventListener('round_opened', h);
		es.addEventListener('session_ended', h);
	});
	onDestroy(() => es?.close());
</script>

<!-- Invite code mini-chip + mode -->
<section class="mb-4 flex items-center justify-between gap-2">
	<div class="min-w-0">
		{#if data.mode}
			<p class="text-base-content/50 truncate text-[0.7rem] uppercase tracking-wider">
				{data.mode.name}
			</p>
		{/if}
	</div>
	<span class="badge badge-ghost tabular badge-sm">{data.session.inviteCode}</span>
</section>

{#if data.me.betLocked}
	<section
		class="glass glass-xl border-error/60 mb-4 flex items-center gap-4 border-2 p-5 shadow-lg"
		role="alert"
	>
		<IconBubble tone="error" size="lg"><Beer size={22} /></IconBubble>
		<div class="flex-1">
			<p class="text-error text-lg font-bold uppercase tracking-wide">Wetten gesperrt</p>
			<p class="text-base-content/80 mb-2 text-sm">
				Du musst trinken — keine Wetten möglich, bis dein Drink bestätigt ist.
			</p>
			<a href="/s/{data.session.id}/drinks" class="btn btn-error btn-sm gap-1">
				<Beer size={14} /> Drink bestätigen lassen <ArrowRight size={12} />
			</a>
		</div>
	</section>
{/if}

<!-- Drinks panel embed -->
<details class="glass glass-xl mb-4 p-4" open={pendingDrinks.length > 0}>
	<summary class="flex cursor-pointer items-center gap-3 text-sm font-medium">
		<IconBubble tone="accent"><Beer size={18} /></IconBubble>
		<span class="flex-1">
			<span class="eyebrow block">Drinks</span>
			<span class="text-base-content/80 text-base">
				{#if pendingDrinks.length > 0}{pendingDrinks.length} offen{:else}Verteilen &amp; abgleichen{/if}
			</span>
		</span>
		{#if pendingDrinks.length > 0}
			<span class="badge badge-warning">{pendingDrinks.length}</span>
		{/if}
		<a
			href={`/s/${data.session.id}/drinks`}
			class="text-base-content/40 hover:text-base-content inline-flex items-center gap-1 text-xs"
			onclick={(e) => e.stopPropagation()}
		>
			Vollansicht <ArrowRight size={12} />
		</a>
	</summary>
	<div class="divider-soft my-3"></div>
	<div>
		<DrinkPanel
			session={data.session}
			me={data.me}
			players={data.players}
			drinks={data.drinks}
			actionPrefix="drink"
			compact
		/>
	</div>
</details>

<!-- Players -->
<section class="mb-4 space-y-2">
	<div class="flex items-center gap-3 px-1">
		<IconBubble tone="info" size="sm"><Users size={16} /></IconBubble>
		<div class="flex-1">
			<p class="eyebrow">Spieler</p>
			<p class="text-base-content/60 text-xs">{data.players.length} dabei</p>
		</div>
	</div>
	<ul class="glass glass-xl space-y-1.5 p-3">
		{#each data.players as p (p.userId)}
			<li
				class="hover:bg-base-content/5 flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition"
			>
				<span class="flex min-w-0 items-center gap-2">
					<span class="truncate font-medium">{p.username}</span>
					{#if p.role === 'HOST'}
						<span class="badge badge-primary badge-sm gap-1"><Crown size={10} /> Host</span>
					{/if}
					{#if p.userId === data.me.userId}
						<span class="text-base-content/40 text-xs">(du)</span>
					{/if}
					{#if p.betLocked}
						<span class="badge badge-warning badge-sm gap-1" title="Trink-Sperre"
							><Beer size={10} /></span
						>
					{/if}
				</span>
				<div class="flex shrink-0 items-center gap-2">
					<span class="tabular text-sm font-semibold">{p.moneyBalance}</span>
					{#if isHost && p.userId !== data.me.userId}
						<form method="POST" action="?/toggleBetLock" use:enhance>
							<input type="hidden" name="userId" value={p.userId} />
							<button
								class="btn btn-xs {p.betLocked ? 'btn-warning' : 'btn-ghost'}"
								title={p.betLocked ? 'Sperre aufheben' : 'Wett-Sperre setzen'}
							>
								{#if p.betLocked}<Unlock size={12} />{:else}<Lock size={12} />{/if}
							</button>
						</form>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</section>

<!-- Entities preview -->
{#if data.entities.length > 0}
	<section class="mb-4 space-y-2">
		<div class="flex items-center gap-3 px-1">
			<IconBubble tone="accent" size="sm"><Sparkles size={16} /></IconBubble>
			<div class="flex-1">
				<p class="eyebrow">{data.mode?.terminology.entity ?? 'Entitäten'}</p>
				<p class="text-base-content/60 text-xs">{data.entities.length} definiert</p>
			</div>
		</div>
		<ul class="glass glass-xl space-y-1.5 p-4">
			{#each data.entities as e (e.id)}
				<li class="flex items-center gap-3">
					<span
						class="inline-block h-3 w-3 rounded-full ring-2 ring-white/10"
						style="background: {(e.attributes as { color?: string })?.color ?? '#888'}"
					></span>
					<span class="text-sm">{e.name}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if isHost}
	<section class="mb-4 space-y-2">
		<div class="flex items-center gap-3 px-1">
			<IconBubble tone="warning" size="sm"><Settings size={16} /></IconBubble>
			<p class="eyebrow">Session verwalten</p>
		</div>
		<div class="glass glass-xl space-y-2 p-4">
			{#if data.session.status !== 'ENDED'}
				<form method="POST" action="?/endSession" use:enhance>
					<button class="btn btn-sm btn-warning btn-outline w-full gap-2">
						<StopCircle size={14} /> Session beenden
					</button>
				</form>
				<p class="text-base-content/40 text-[10px]">
					Markiert die Session als ENDED. Daten bleiben erhalten, kein Beitritt mehr.
				</p>
			{:else}
				<p class="alert alert-warning text-xs">
					Session bereits beendet (Status: {data.session.status}).
				</p>
			{/if}
			<form
				method="POST"
				action="?/deleteSession"
				use:enhance={({ cancel }) => {
					if (
						!confirm(
							'Wirklich KOMPLETT löschen? Alle Runden, Wetten, Drinks, Events gehen unwiderruflich verloren.'
						)
					) {
						cancel();
					}
				}}
			>
				<button class="btn btn-sm btn-error btn-outline w-full gap-2">
					<Trash2 size={14} /> Session komplett löschen
				</button>
			</form>
			<p class="text-base-content/40 text-[10px]">
				Permanent. Cascade-Löschung aller verbundenen Daten.
			</p>
		</div>
	</section>
{/if}

<!-- Sound toggle -->
<section class="flex justify-end">
	<button
		class="btn btn-xs btn-ghost gap-1"
		onclick={toggleSound}
		aria-label="Sound umschalten"
	>
		{#if soundOn}<Volume2 size={12} /> Sound an{:else}<VolumeX size={12} /> Sound aus{/if}
	</button>
</section>
