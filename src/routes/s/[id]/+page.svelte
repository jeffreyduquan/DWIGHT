<!--
	@file s/[id]/+page.svelte — lobby (consolidated drinks + players hub)
	@implements REQ-UI-001, REQ-UI-010, REQ-UI-011, UI_UX §6.4 (lobby)
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
		Beer,
		Users,
		Volume2,
		VolumeX,
		Settings,
		Trash2,
		Lock,
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

<!-- Invite code chip -->
<section class="mb-4 flex items-center justify-end">
	<span class="badge badge-ghost tabular badge-sm">Code: {data.session.inviteCode}</span>
</section>

{#if data.me.betLocked}
	<section
		class="glass glass-xl mb-4 flex items-center gap-4 p-5 shadow-sm"
		style="border: 2px solid oklch(72% 0.10 28);"
		role="alert"
	>
		<IconBubble tone="error" size="lg"><Beer size={22} /></IconBubble>
		<div class="flex-1">
			<p class="text-lg font-bold uppercase tracking-wide" style="color: oklch(46% 0.10 28);">
				Wetten gesperrt
			</p>
			<p class="text-base-content/75 text-sm">
				Du musst trinken — bestätige deinen offenen Drink unten.
			</p>
		</div>
	</section>
{/if}

<!-- Drinks hub: the ONLY drinks UI -->
<section class="mb-5 space-y-2">
	<div class="flex items-center gap-3 px-1">
		<IconBubble tone="accent" size="sm"><Beer size={16} /></IconBubble>
		<div class="flex-1">
			<p class="eyebrow">Drinks</p>
			<p class="text-base-content/55 text-xs">
				{#if pendingDrinks.length > 0}{pendingDrinks.length} offen{:else}Buy-In · Verteilen · Verlauf{/if}
			</p>
		</div>
	</div>
	<DrinkPanel
		session={data.session}
		me={data.me}
		players={data.players}
		drinks={data.drinks}
		actionPrefix="drink"
	/>
</section>

<!-- Players -->
<section class="mb-5 space-y-2">
	<div class="flex items-center gap-3 px-1">
		<IconBubble tone="info" size="sm"><Users size={16} /></IconBubble>
		<div class="flex-1">
			<p class="eyebrow">Spieler</p>
			<p class="text-base-content/55 text-xs">{data.players.length} dabei</p>
		</div>
	</div>
	<ul class="space-y-2">
		{#each data.players as p (p.userId)}
			{@const isSelf = p.userId === data.me.userId}
			{@const isPHost = p.role === 'HOST'}
			<li
				class="player-row {p.betLocked ? 'player-locked' : isPHost ? 'player-host' : ''}"
			>
				<span class="flex min-w-0 items-center gap-2">
					{#if isSelf}
						<span class="self-marker">Du</span>
					{/if}
					<span class="truncate text-sm font-medium">{p.username}</span>
				</span>
				<div class="flex shrink-0 items-center gap-2">
					<span class="tabular text-sm font-semibold">{p.moneyBalance}</span>
					{#if isHost && !isSelf}
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

{#if isHost}
	<section class="mb-4 space-y-2">
		<div class="flex items-center gap-3 px-1">
			<IconBubble tone="warning" size="sm"><Settings size={16} /></IconBubble>
			<p class="eyebrow">Session verwalten</p>
		</div>
		<div class="glass glass-xl space-y-2 p-4">
			<form
				method="POST"
				action="?/deleteSession"
				use:enhance={({ cancel }) => {
					if (
						!confirm(
							'Session jetzt beenden und KOMPLETT löschen?\n\nAlle Runden, Wetten, Drinks und Events gehen unwiderruflich verloren.'
						)
					) {
						cancel();
					}
				}}
			>
				<button class="btn btn-sm btn-error btn-outline w-full gap-2">
					<Trash2 size={14} /> Session beenden &amp; löschen
				</button>
			</form>
			<p class="text-base-content/45 text-center text-[0.65rem]">
				Hard-Delete — keine Statistik bleibt erhalten.
			</p>
		</div>
	</section>
{/if}

<section class="flex justify-end">
	<button
		class="btn btn-xs btn-ghost gap-1"
		onclick={toggleSound}
		aria-label="Sound umschalten"
	>
		{#if soundOn}<Volume2 size={12} /> Sound an{:else}<VolumeX size={12} /> Sound aus{/if}
	</button>
</section>

<style>
	.player-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		border-radius: 1rem;
		background-color: oklch(96% 0.004 90);
		border: 1px solid oklch(89% 0.004 90 / 0.6);
		box-shadow:
			-2px -2px 5px oklch(100% 0 0 / 0.75),
			3px 3px 7px oklch(40% 0.01 80 / 0.10);
	}
	.player-host {
		background-color: oklch(94% 0.004 90);
		border-color: oklch(86% 0.004 90 / 0.7);
	}
	.player-locked {
		background-color: oklch(94% 0.045 28);
		border-color: oklch(80% 0.05 28 / 0.5);
		color: oklch(46% 0.10 28);
	}
	.self-marker {
		display: inline-flex;
		align-items: center;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 0.18rem 0.5rem;
		border-radius: 9999px;
		text-transform: uppercase;
		background-color: oklch(93% 0.012 148);
		color: oklch(40% 0.05 148);
	}
</style>
