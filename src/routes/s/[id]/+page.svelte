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
	import QrCode from '$lib/components/QrCode.svelte';
	import {
		ArrowRight,
		Beer,
		Users,
		Volume2,
		VolumeX,
		Settings,
		Trash2,
		Lock,
		Unlock,
		QrCode as QrCodeIcon,
		RefreshCw,
		AlertCircle
	} from '@lucide/svelte';

	let { data, form } = $props();

	const isHost = $derived(data.me.role === 'HOST');
	const pendingDrinks = $derived(data.drinks.filter((d) => d.status === 'PENDING'));

	/** Can the host switch modes? Only when no active round. */
	const canSwitchMode = $derived(
		isHost &&
			(!data.currentRound ||
				data.currentRound.status === 'SETTLED' ||
				data.currentRound.status === 'CANCELLED')
	);

	/** Modes available for switching (exclude the current one). */
	const switchableModes = $derived(
		data.availableModes.filter((m) => m.id !== data.session.modeId)
	);

	let showModePicker = $state(false);
	let selectedSwitchModeId = $state<string | null>(null);

	type StateBadge = { label: string; tone: 'info' | 'warning' | 'success' | 'ghost'; emoji: string };
	const betState = $derived<StateBadge>(
		(() => {
			const r = data.currentRound;
			if (!r) return { label: 'Keine Runde', tone: 'ghost', emoji: '◌' };
			if (r.status === 'SETUP') return { label: 'Setup', tone: 'ghost', emoji: '⚙️' };
			if (r.status === 'BETTING_OPEN') return { label: 'Wetten offen', tone: 'success', emoji: '🟢' };
			if (r.status === 'LIVE') return { label: 'Wetten geschlossen', tone: 'warning', emoji: '🔒' };
			if (r.status === 'RESOLVING') return { label: 'Auflösung', tone: 'warning', emoji: '🧮' };
			if (r.status === 'SETTLED') return { label: 'Ergebnis', tone: 'info', emoji: '🏁' };
			if (r.status === 'CANCELLED') return { label: 'Abgebrochen', tone: 'ghost', emoji: '✕' };
			return { label: r.status, tone: 'ghost', emoji: '?' };
		})()
	);

	let soundOn = $state(isSoundEnabled());
	function toggleSound() {
		soundOn = !soundOn;
		setSoundEnabled(soundOn);
	}

	let showQr = $state(false);
	function toggleQr() {
		showQr = !showQr;
	}

	let showSettings = $state(false);
	function toggleSettings() {
		showSettings = !showSettings;
	}

	let es: EventSource | null = null;
	onMount(() => {
		es = new EventSource(`/s/${data.session.id}/stream`);
		const h = () => invalidateAll();
		const sound = (s: Parameters<typeof playSound>[0]) => () => {
			playSound(s);
			invalidateAll();
		};
		const onDrinkInitiated = (ev: MessageEvent) => {
			try {
				const msg = JSON.parse(ev.data) as { payload?: { targetUserId?: string } };
				if (msg.payload?.targetUserId === data.me.userId && 'vibrate' in navigator) {
					navigator.vibrate(2000);
				}
			} catch {
				/* ignore */
			}
			invalidateAll();
		};
		es.addEventListener('drink_initiated', onDrinkInitiated);
		es.addEventListener('drink_confirmed', sound('drink'));
		es.addEventListener('drink_cancelled', h);
		es.addEventListener('balance_updated', h);
		es.addEventListener('player_joined', h);
		es.addEventListener('round_opened', h);
		es.addEventListener('round_live', h);
		es.addEventListener('round_settled', h);
		es.addEventListener('round_cancelled', h);
		es.addEventListener('session_ended', h);
		es.addEventListener('mode_switched', h);
	});
	onDestroy(() => es?.close());
</script>

<!-- Invite code + QR (collapsed by default; toggled from footer bar — panel opens below the toggle row) -->

<!-- Bet-state badge -->
<section class="mb-4">
	<a
		href={data.currentRound ? `/s/${data.session.id}/round` : `/s/${data.session.id}/round`}
		class="glass glass-xl flex items-center justify-between gap-3 rounded-2xl p-3 text-sm hover:opacity-90"
	>
		<span class="inline-flex items-center gap-2">
			<span class="text-lg">{betState.emoji}</span>
			<span class="flex flex-col">
				<span class="eyebrow">Wett-Status</span>
				<span class="font-semibold {betState.tone === 'success' ? 'text-success' : betState.tone === 'warning' ? 'text-warning' : betState.tone === 'info' ? 'text-info' : 'text-base-content/70'}">
					{betState.label}{#if data.currentRound} · Runde #{data.currentRound.roundNo}{/if}
				</span>
			</span>
		</span>
		<ArrowRight size={16} class="opacity-50" />
	</a>
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
	<section class="mb-4 space-y-2" class:hidden={!showSettings}>
		<div class="flex items-center gap-3 px-1">
			<IconBubble tone="warning" size="sm"><Settings size={16} /></IconBubble>
			<p class="eyebrow">Session verwalten</p>
		</div>
		<div class="glass glass-xl space-y-2 p-4">
			<a href="/s/{data.session.id}/settings" class="btn btn-sm btn-primary glow-primary w-full gap-2">
				<Settings size={14} /> Einstellungen öffnen
			</a>

			{#if canSwitchMode && switchableModes.length > 0}
				<button
					type="button"
					class="btn btn-sm btn-outline w-full gap-2"
					onclick={() => { showModePicker = true; selectedSwitchModeId = null; }}
				>
					<RefreshCw size={14} /> Mode wechseln
				</button>
			{:else if isHost && !canSwitchMode}
				<div class="flex items-center gap-2 text-base-content/50 text-[0.65rem] px-1">
					<AlertCircle size={12} />
					<span>Mode wechseln erst möglich, wenn keine Runde läuft.</span>
				</div>
			{/if}

			{#if form && 'switched' in form && form.switched}
				<div class="alert alert-success text-xs gap-1">Mode gewechselt!</div>
			{/if}
			{#if form && 'error' in form && form.error && !('switched' in form)}
				<div class="alert alert-error text-xs gap-1">{form.error}</div>
			{/if}

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

<section class="flex justify-end gap-1">
	{#if isHost}
		<button
			class="btn btn-xs btn-ghost gap-1"
			class:btn-active={showSettings}
			onclick={toggleSettings}
			aria-label="Session-Einstellungen umschalten"
		>
			<Settings size={12} /> Settings
		</button>
	{/if}
	<button
		class="btn btn-xs btn-ghost gap-1"
		class:btn-active={showQr}
		onclick={toggleQr}
		aria-label="QR-Code anzeigen"
	>
		<QrCodeIcon size={12} /> QR
	</button>
	<button
		class="btn btn-xs btn-ghost gap-1"
		onclick={toggleSound}
		aria-label="Sound umschalten"
	>
		{#if soundOn}<Volume2 size={12} /> Sound an{:else}<VolumeX size={12} /> Sound aus{/if}
	</button>
</section>

{#if showQr}
	<section class="mt-3">
		<div class="glass glass-xl flex flex-col items-center gap-3 p-4">
			<div class="flex w-full items-center justify-between">
				<span class="eyebrow inline-flex items-center gap-1.5">
					<QrCodeIcon size={14} /> Mit Code beitreten
				</span>
				<button class="btn btn-xs btn-ghost" onclick={toggleQr} aria-label="QR schließen">Schließen</button>
			</div>
			<QrCode value={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/join?code=${data.session.inviteCode}`} size={180} />
			<span class="badge badge-ghost tabular text-base font-bold">{data.session.inviteCode}</span>
		</div>
	</section>
{/if}

{#if showModePicker}
	<div
		class="bg-base-300/70 fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Mode wechseln"
		onclick={(ev) => { if (ev.target === ev.currentTarget) { showModePicker = false; } }}
		onkeydown={(ev) => { if (ev.key === 'Escape') { showModePicker = false; } }}
		tabindex="-1"
	>
		<div class="glass glass-xl w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
			<header class="mb-4 flex items-start justify-between">
				<div>
					<p class="eyebrow">Mode wechseln</p>
					<h2 class="text-lg font-medium">Neuen Mode wählen</h2>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-circle"
					onclick={() => { showModePicker = false; }}
					aria-label="Schließen"
				>✕</button>
			</header>

			<p class="text-base-content/60 mb-3 text-xs">
				Spieler und Guthaben bleiben erhalten. Entitäten und Wett-Vorlagen werden durch den neuen Mode ersetzt.
			</p>

			{#if data.mode}
				<p class="text-base-content/50 mb-3 text-xs">Aktueller Mode: <strong>{data.mode.name}</strong></p>
			{/if}

			<ul class="space-y-2 mb-4">
				{#each switchableModes as m (m.id)}
					<li>
						<button
							type="button"
							class="glass hover:ring-primary hover:ring-2 flex w-full items-start gap-2 rounded-xl p-3 text-left transition {selectedSwitchModeId === m.id ? 'ring-primary ring-2' : ''}"
							onclick={() => { selectedSwitchModeId = m.id; }}
						>
							<span class="text-sm font-medium">{m.name}</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if switchableModes.length === 0}
				<p class="text-base-content/50 text-sm mb-4">Keine anderen Modes verfügbar. Erstelle zuerst einen neuen Mode.</p>
			{/if}

			<form
				method="POST"
				action="?/switchMode"
				use:enhance={({ cancel }) => {
					if (!selectedSwitchModeId) { cancel(); return; }
					if (!confirm('Mode wirklich wechseln? Entitäten und Wett-Vorlagen werden ersetzt. Spieler und Guthaben bleiben.')) {
						cancel();
						return;
					}
					return async ({ update }) => {
						await update();
						showModePicker = false;
					};
				}}
			>
				<input type="hidden" name="modeId" value={selectedSwitchModeId ?? ''} />
				<button
					type="submit"
					class="btn btn-primary w-full gap-2"
					disabled={!selectedSwitchModeId}
				>
					<RefreshCw size={14} /> Mode wechseln
				</button>
			</form>
		</div>
	</div>
{/if}

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
