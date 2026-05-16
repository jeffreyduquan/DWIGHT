<!--
	@file s/create/+page.svelte — session creation
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import {
		ArrowLeft,
		ArrowRight,
		AlertCircle,
		Sparkles,
		Play,
		Coins,
		Beer,
		CircleCheck,
		RefreshCcw,
		Lock,
		Layers,
		Plus
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Phase 17: Mode no longer carries session defaults. All numeric prefills come
	// from a single in-file constant block so the create form is the canonical
	// default source for new sessions.
	const SESSION_DEFAULTS = {
		startingMoney: 2000,
		minStake: 10,
		showOdds: true,
		maxStakePctOfStart: 50,
		drinkPrices: { SCHLUCK: 50, KURZER: 150, BIER_EXEN: 500 },
		confirmationMode: 'PEERS' as 'GM' | 'PEERS',
		peerConfirmationsRequired: 1,
		lockMode: 'TIMER_LOCK' as 'TIMER_LOCK' | 'LOCK' | 'NONE',
		lockTimerSeconds: 600,
		rebuy: { enabled: true, drinkType: 'BIER_EXEN' as const, amount: 1500 }
	};

	let selectedModeId = $state<string>(data.modes[0]?.id ?? '');
	const selectedMode = $derived(data.modes.find((m) => m.id === selectedModeId) ?? null);

	let rebuyEnabled = $state(SESSION_DEFAULTS.rebuy.enabled);
	let confirmationMode = $state<'GM' | 'PEERS'>(SESSION_DEFAULTS.confirmationMode);

	const formError = $derived(form && 'error' in form ? (form.error as string) : null);
</script>

<header class="mb-6 flex items-center justify-between">
	<a href="/" class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition">
		<ArrowLeft size={16} /> zurück
	</a>
	<Logo size={32} />
</header>

<div class="mb-6 space-y-2">
	<IconBubble tone="primary" size="lg"><Sparkles size={22} /></IconBubble>
	<p class="eyebrow mt-3">Neue Session</p>
	<h1 class="display text-3xl">
		<span class="text-gradient-primary">Session</span> erstellen
	</h1>
	<p class="text-base-content/60 text-sm">Wähle einen Mode und starte den Abend.</p>
</div>

{#if formError}
	<div class="alert alert-error mb-4 inline-flex items-center gap-2 text-sm">
		<AlertCircle size={16} /> {formError}
	</div>
{/if}

{#if data.modes.length === 0}
	<!-- Empty state: user has no Modes yet -->
	<div class="glass-xl px-6 py-10 text-center">
		<div class="mx-auto mb-3 flex justify-center">
			<IconBubble tone="warning" size="lg"><Sparkles size={22} /></IconBubble>
		</div>
		<p class="text-base-content/70 mb-2 text-sm">Du hast noch keinen Mode.</p>
		<p class="text-base-content/50 mb-6 text-xs">
			Ein Mode definiert Spielregeln, Entitäten, Drink-Preise und Wett-Templates.
		</p>
		<a href="/modes/new?next=/s/create" class="btn btn-primary glow-primary inline-flex items-center gap-2 rounded-xl">
			<Plus size={16} /> Ersten Mode erstellen
		</a>
	</div>
{:else}
	<form method="POST" use:enhance class="space-y-6">
		<!-- Mode picker (custom radio cards) -->
		<fieldset class="space-y-2">
			<legend class="eyebrow mb-2 inline-flex items-center gap-1.5">
				<Layers size={12} /> Mode
			</legend>
			<div class="space-y-2">
				{#each data.modes as m (m.id)}
					<label
						class="glass flex cursor-pointer flex-col gap-1 rounded-xl p-4 transition {selectedModeId ===
						m.id
							? 'ring-primary ring-2'
							: 'opacity-70 hover:opacity-100'}"
					>
						<input
							type="radio"
							name="modeId"
							value={m.id}
							bind:group={selectedModeId}
							class="sr-only"
						/>
						<div class="flex items-baseline justify-between">
							<span class="font-medium">{m.name}</span>
							<span class="tabular text-base-content/40 text-xs">
								{m.defaultEntities.length} Spieler
							</span>
						</div>
						{#if m.betGraphCount === 0}
							<span class="text-warning text-[0.65rem]">⚠ Keine Bet-Graphs — <a href="/modes/{m.id}/graphs" class="underline">erst anlegen</a></span>
						{:else}
							<span class="text-base-content/40 text-[0.65rem]">{m.betGraphCount} Wett-Vorlage{m.betGraphCount === 1 ? '' : 'n'}</span>
						{/if}
					</label>
				{/each}
			</div>
			<a href="/modes" class="text-primary inline-flex items-center gap-1 text-xs hover:underline">
				Modes verwalten <ArrowRight size={11} />
			</a>
		</fieldset>

		<!-- Name -->
		<label class="block space-y-1">
			<span class="text-base-content/70 text-sm font-medium uppercase tracking-wider">Name</span>
			<input
				type="text"
				name="name"
				placeholder="Freitag-Abend"
				class="input input-bordered glass h-12 w-full rounded-xl"
				required
				minlength="2"
				maxlength="64"
			/>
		</label>

		{#if selectedMode}
			<!-- Money -->
			<div class="grid grid-cols-2 gap-2">
				<label class="block space-y-1">
					<span class="eyebrow inline-flex items-center gap-1.5">
						<Coins size={12} /> Startgeld
					</span>
					<input
						type="number"
						name="startingMoney"
						value={SESSION_DEFAULTS.startingMoney}
						min="100"
						step="50"
						class="input input-bordered glass tabular h-12 w-full rounded-xl"
						required
					/>
				</label>
				<label class="block space-y-1">
					<span class="eyebrow inline-flex items-center gap-1.5">
						<Coins size={12} /> Mindesteinsatz
					</span>
					<input
						type="number"
						name="minStake"
						value={SESSION_DEFAULTS.minStake}
						min="1"
						class="input input-bordered glass tabular h-12 w-full rounded-xl"
						required
					/>
				</label>
			</div>

			<label class="glass flex items-center justify-between rounded-xl p-3">
				<span class="space-y-1">
					<span class="block text-sm font-medium">Quoten anzeigen</span>
					<span class="text-base-content/40 block text-xs">
						Multiplikator + Prozent neben jedem Outcome.
					</span>
				</span>
				<input
					type="checkbox"
					name="showOdds"
					class="toggle toggle-primary"
					checked={SESSION_DEFAULTS.showOdds}
				/>
			</label>

			<label class="glass flex items-center justify-between rounded-xl p-3 text-xs">
				<span class="space-y-0.5">
					<span class="block text-sm font-medium text-base-content">Max % vom Startgeld pro Wette</span>
					<span class="text-base-content/40 block">Bremst Einzelwetten relativ zum Startguthaben.</span>
				</span>
				<input
					type="number"
					name="maxStakePctOfStart"
					value={SESSION_DEFAULTS.maxStakePctOfStart}
					min="1"
					max="100"
					class="tabular w-16 bg-transparent text-right outline-none"
				/>
			</label>

			<!-- Drink prices -->
			<fieldset class="space-y-2">
				<legend class="eyebrow inline-flex items-center gap-1.5">
					<Beer size={12} /> Drink-Preise
				</legend>
				<div class="grid grid-cols-3 gap-2">
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Schluck</span>
						<input
							type="number"
							name="priceSchluck"
							value={SESSION_DEFAULTS.drinkPrices.SCHLUCK}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Kurzer</span>
						<input
							type="number"
							name="priceKurzer"
							value={SESSION_DEFAULTS.drinkPrices.KURZER}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Bier exen</span>
						<input
							type="number"
							name="priceBier"
							value={SESSION_DEFAULTS.drinkPrices.BIER_EXEN}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
				</div>
			</fieldset>

			<!-- Confirmation mode -->
			<label class="block space-y-1">
				<span class="eyebrow inline-flex items-center gap-1.5">
					<CircleCheck size={12} /> Bestätigungs-Modus
				</span>
				<select
					name="confirmationMode"
					bind:value={confirmationMode}
					class="select select-bordered glass h-12 w-full rounded-xl"
				>
					<option value="GM">Nur GM bestätigt</option>
					<option value="PEERS">Peers — GM zählt mit</option>
				</select>
				<p class="text-base-content/40 mt-1 text-xs">
					Wer bestätigt, dass ein Drink wirklich gekippt wurde. GM-Bestätigungen zählen immer als Peer.
				</p>
			</label>
			{#if confirmationMode === 'PEERS'}
				<label class="glass block space-y-1 rounded-xl p-3">
					<span class="text-base-content/50 text-xs">Peer-Anzahl</span>
					<input
						type="number"
						name="peerConfirmationsRequired"
						value={SESSION_DEFAULTS.peerConfirmationsRequired}
						min="1"
						max="10"
						class="tabular w-full bg-transparent text-base outline-none"
					/>
				</label>
			{/if}

			<!-- Rebuy -->
			<fieldset class="space-y-3">
				<legend class="eyebrow inline-flex items-center gap-1.5">
					<RefreshCcw size={12} /> Rebuy
				</legend>
				<label class="glass flex items-center justify-between rounded-xl p-3">
					<span class="space-y-1">
						<span class="block text-sm font-medium">Rebuy aktiv</span>
						<span class="text-base-content/40 block text-xs">
							Pleite-Spieler kippen einen Drink und bekommen Geld zurück.
						</span>
					</span>
					<input
						type="checkbox"
						name="rebuyEnabled"
						bind:checked={rebuyEnabled}
						class="toggle toggle-primary"
					/>
				</label>
				<div class="grid grid-cols-2 gap-2" class:opacity-40={!rebuyEnabled}>
					<label class="space-y-1">
						<span class="text-base-content/50 text-xs">Rebuy-Drink</span>
						<select
							name="rebuyDrinkType"
							value={SESSION_DEFAULTS.rebuy.drinkType}
							disabled={!rebuyEnabled}
							class="select select-bordered select-sm w-full"
						>
							<option value="SCHLUCK">Schluck</option>
							<option value="KURZER">Kurzer</option>
							<option value="BIER_EXEN">Bier exen</option>
						</select>
					</label>
					<label class="glass space-y-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Betrag pro Rebuy</span>
						<input
							type="number"
							name="rebuyAmount"
							value={SESSION_DEFAULTS.rebuy.amount}
							min="1"
							disabled={!rebuyEnabled}
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
				</div>
				<label class="glass block space-y-2 rounded-xl p-3">
					<span class="eyebrow inline-flex items-center gap-1.5">
						<Lock size={12} /> Sperre bei offenem Drink
					</span>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
							<input
								type="radio"
								name="lockMode"
								value="TIMER_LOCK"
								checked={SESSION_DEFAULTS.lockMode === 'TIMER_LOCK'}
								class="radio radio-xs radio-primary"
							/>
							<span>Timer + Sperre</span>
						</label>
						<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
							<input
								type="radio"
								name="lockMode"
								value="LOCK"
								checked={SESSION_DEFAULTS.lockMode === 'LOCK'}
								class="radio radio-xs radio-primary"
							/>
							<span>Nur Sperre</span>
						</label>
						<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
							<input
								type="radio"
								name="lockMode"
								value="NONE"
								checked={SESSION_DEFAULTS.lockMode === 'NONE'}
								class="radio radio-xs radio-primary"
							/>
							<span>Keine Sperre</span>
						</label>
					</div>
					<label class="mt-1 flex items-center justify-between text-xs">
						<span class="text-base-content/50">Timer-Dauer (Sekunden)</span>
						<input
							type="number"
							name="lockTimerSeconds"
							value={SESSION_DEFAULTS.lockTimerSeconds}
							min="30"
							class="tabular w-20 bg-transparent text-right outline-none"
						/>
					</label>
					<p class="text-base-content/40 mt-1 text-xs">
						Beim Timer können Spieler bis zum Ablauf weiter wetten. Danach werden sie gesperrt.
					</p>
				</label>
			</fieldset>

			<!-- Entity preview + rename -->
			{#if selectedMode.defaultEntities.length > 0}
				<section class="space-y-2">
					<span class="eyebrow inline-flex items-center gap-1.5">
						<Sparkles size={12} /> Spieler (umbenennen optional)
					</span>
					<ul class="glass space-y-2 rounded-xl p-3 text-sm">
						{#each selectedMode.defaultEntities as e (e.name)}
							<li class="flex items-center gap-3">
								<input
									type="text"
									name={`entityOverride__${e.name}`}
									placeholder={e.name}
									maxlength="32"
									class="flex-1 bg-transparent outline-none placeholder:text-base-content/30"
								/>
							</li>
						{/each}
					</ul>
					<p class="text-base-content/45 text-xs">
						Leer lassen = Originalname verwenden ({selectedMode.defaultEntities.map((e) => e.name).join(', ')}).
					</p>
				</section>
			{:else}
				<div class="text-base-content/50 border-base-300 rounded-xl border border-dashed p-3 text-xs">
					Dieser Mode hat keine voreingestellten Spieler.
				</div>
			{/if}
		{/if}

		<button type="submit" class="btn btn-primary glow-primary h-14 w-full gap-2 rounded-xl text-base">
			<Play size={18} /> Session starten
		</button>
	</form>
{/if}
