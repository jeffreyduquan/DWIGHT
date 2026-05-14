<!--
	@file s/[id]/settings/+page.svelte — GM-only session settings editor
	@implements REQ-SESS-CONFIG-001, REQ-UI-013
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Save, Settings, Lock, CircleCheck, RefreshCcw, Tag, Coins } from '@lucide/svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';

	let { data, form } = $props();
	const cfg = data.session.config;

	let confirmationMode = $state(cfg.confirmationMode === 'GM' ? 'GM' : 'PEERS');
	let lockMode = $state(cfg.lockMode ?? 'TIMER_LOCK');
	let rebuyEnabled = $state(cfg.rebuy.enabled);

	const formError = $derived(form && 'error' in form ? (form.error as string) : null);
</script>

<header class="mb-6 flex items-center justify-between">
	<a
		href="/s/{data.session.id}"
		class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition"
	>
		<ArrowLeft size={16} /> zurück zur Session
	</a>
	<IconBubble tone="warning" size="md"><Settings size={18} /></IconBubble>
</header>

<div class="mb-6 space-y-1">
	<p class="eyebrow">Einstellungen</p>
	<h1 class="display text-3xl"><span class="text-gradient-primary">{data.session.name}</span></h1>
	<p class="text-base-content/55 text-sm">Nur du als GM siehst diese Seite.</p>
</div>

{#if formError}
	<div class="alert alert-error mb-4 text-sm">{formError}</div>
{/if}

<form method="POST" use:enhance class="space-y-5">
	<!-- Economy -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
			<Coins size={12} /> Ökonomie
		</h2>
		<div class="grid grid-cols-2 gap-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Startgeld</span>
				<input type="number" name="startingMoney" value={cfg.startingMoney} min="100" step="50" class="tabular w-full bg-transparent outline-none" />
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Mindesteinsatz</span>
				<input type="number" name="minStake" value={cfg.minStake} min="1" class="tabular w-full bg-transparent outline-none" />
			</label>
		</div>
		<label class="glass flex items-center justify-between rounded-xl p-3">
			<span class="space-y-1">
				<span class="block text-sm font-medium">Quoten anzeigen</span>
				<span class="text-base-content/40 block text-xs">Multiplikator + Prozent neben jedem Outcome.</span>
			</span>
			<input type="checkbox" name="showOdds" class="toggle toggle-primary" checked={cfg.showOdds !== false} />
		</label>
	</section>

	<!-- Drink prices -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
			<Tag size={12} /> Drink-Preise
		</h2>
		<div class="grid grid-cols-3 gap-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Schluck</span>
				<input type="number" name="priceSchluck" value={cfg.drinkPrices.SCHLUCK} min="0" class="tabular w-full bg-transparent outline-none" />
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Kurzer</span>
				<input type="number" name="priceKurzer" value={cfg.drinkPrices.KURZER} min="0" class="tabular w-full bg-transparent outline-none" />
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Bier</span>
				<input type="number" name="priceBier" value={cfg.drinkPrices.BIER_EXEN} min="0" class="tabular w-full bg-transparent outline-none" />
			</label>
		</div>
	</section>

	<!-- Confirmation mode -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
			<CircleCheck size={12} /> Bestätigung
		</h2>
		<div class="grid grid-cols-2 gap-2">
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input type="radio" name="confirmationMode" value="GM" bind:group={confirmationMode} class="radio radio-xs radio-primary" />
				<span>Nur GM</span>
			</label>
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input type="radio" name="confirmationMode" value="PEERS" bind:group={confirmationMode} class="radio radio-xs radio-primary" />
				<span>Peers (GM zählt mit)</span>
			</label>
		</div>
		{#if confirmationMode === 'PEERS'}
			<label class="glass flex items-center justify-between rounded-xl p-3 text-xs">
				<span class="text-base-content/50">Peer-Anzahl</span>
				<input type="number" name="peerConfirmationsRequired" value={cfg.peerConfirmationsRequired} min="1" max="10" class="tabular w-16 bg-transparent text-right outline-none" />
			</label>
		{/if}
	</section>

	<!-- Lock mode -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
			<Lock size={12} /> Sperre bei offenem Drink
		</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input type="radio" name="lockMode" value="TIMER_LOCK" bind:group={lockMode} class="radio radio-xs radio-primary" />
				<span>Timer + Sperre</span>
			</label>
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input type="radio" name="lockMode" value="LOCK" bind:group={lockMode} class="radio radio-xs radio-primary" />
				<span>Nur Sperre</span>
			</label>
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input type="radio" name="lockMode" value="NONE" bind:group={lockMode} class="radio radio-xs radio-primary" />
				<span>Keine Sperre</span>
			</label>
		</div>
		<label class="glass flex items-center justify-between rounded-xl p-3 text-xs">
			<span class="text-base-content/50">Timer-Dauer (Sekunden)</span>
			<input type="number" name="lockTimerSeconds" value={cfg.lockTimerSeconds ?? 600} min="30" class="tabular w-24 bg-transparent text-right outline-none" />
		</label>
	</section>

	<!-- Rebuy -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
			<RefreshCcw size={12} /> Rebuy
		</h2>
		<label class="glass flex items-center justify-between rounded-xl p-3 text-xs">
			<span class="font-medium">Rebuy aktiv</span>
			<input type="checkbox" name="rebuyEnabled" bind:checked={rebuyEnabled} class="toggle toggle-primary toggle-sm" />
		</label>
		<div class="grid grid-cols-2 gap-2" class:opacity-40={!rebuyEnabled}>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Drink</span>
				<select name="rebuyDrinkType" value={cfg.rebuy.drinkType} disabled={!rebuyEnabled} class="select select-bordered select-sm w-full">
					<option value="SCHLUCK">Schluck</option>
					<option value="KURZER">Kurzer</option>
					<option value="BIER_EXEN">Bier exen</option>
				</select>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Betrag</span>
				<input type="number" name="rebuyAmount" value={cfg.rebuy.amount} min="0" disabled={!rebuyEnabled} class="tabular w-full bg-transparent outline-none" />
			</label>
		</div>
	</section>

	<!-- Entity overrides -->
	{#if data.entities.length > 0}
		<section class="glass glass-xl space-y-3 p-5">
			<h2 class="text-base-content/60 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
				<Tag size={12} /> Entitäten umbenennen
			</h2>
			<p class="text-base-content/40 text-xs">Leer lassen = Original-Namen behalten.</p>
			<ul class="space-y-2">
				{#each data.entities as e (e.id)}
					<li class="glass flex items-center gap-3 rounded-xl p-3">
						<span class="text-base-content/50 w-1/3 text-xs">{e.name}</span>
						<input
							type="text"
							name="override__{e.name}"
							value={cfg.entityOverrides?.[e.name] ?? ''}
							placeholder={e.name}
							class="flex-1 bg-transparent text-sm outline-none"
							maxlength="40"
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<button class="btn btn-primary glow-primary w-full gap-2 rounded-xl">
		<Save size={16} /> Speichern
	</button>
</form>
