<!--
	@file ModeForm.svelte — full Mode definition form used by /modes/new and /modes/[id].
	D3: bet templates + multipliers replaced by a generic Trackables section.
	Bets are now built per-Session as predicates over these counters.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { X } from '@lucide/svelte';
	import type {
		ModeDefaultConfig,
		ModeDefaultEntity,
		ModeTerminology,
		Trackable
	} from '$lib/server/db/schema';

	type EntityRow = {
		name: string;
		kind: string;
		color: string;
		emoji: string;
	};

	type TrackableRow = {
		label: string;
		scope: 'global' | 'entity';
		emoji: string;
		color: string;
	};

	let {
		initial,
		submitLabel = 'Speichern',
		error,
		action = '',
		modeId
	}: {
		initial: {
			name: string;
			slug: string;
			description: string;
			terminology: ModeTerminology;
			defaultEntities: ModeDefaultEntity[];
			trackables: Trackable[];
			defaultConfig: ModeDefaultConfig;
		};
		submitLabel?: string;
		error?: string | null;
		action?: string;
		modeId?: string;
	} = $props();

	let confirmationMode = $state<'GM' | 'PEERS'>(
		initial.defaultConfig.confirmationMode === 'GM' ? 'GM' : 'PEERS'
	);

	let entities = $state<EntityRow[]>(
		(initial.defaultEntities.length > 0
			? initial.defaultEntities
			: [{ kind: 'entity', name: '', attributes: { color: '#A78BFA', emoji: '' } }]
		).map((e) => ({
			name: e.name,
			kind: e.kind,
			color: (e.attributes?.color as string) ?? '#A78BFA',
			emoji: (e.attributes?.emoji as string) ?? ''
		}))
	);

	let trackables = $state<TrackableRow[]>(
		initial.trackables.map((t) => ({
			label: t.label,
			scope: t.scope,
			emoji: t.emoji ?? '',
			color: t.color ?? '#7DD3FC'
		}))
	);

	function addEntity() {
		entities = [
			...entities,
			{ name: '', kind: entities[0]?.kind ?? 'entity', color: '#A78BFA', emoji: '' }
		];
	}
	function removeEntity(i: number) {
		entities = entities.filter((_, idx) => idx !== i);
		if (entities.length === 0) addEntity();
	}

	// Deterministic palette — picks a stable color per entity/trackable name.
	const PALETTE = [
		'#A78BFA',
		'#7DD3FC',
		'#FBBF24',
		'#FB7185',
		'#34D399',
		'#F472B6',
		'#60A5FA',
		'#FCD34D',
		'#C084FC',
		'#4ADE80'
	];
	function colorFor(label: string, idx: number, fallback?: string): string {
		if (fallback && fallback !== '#A78BFA' && fallback !== '#7DD3FC' && fallback !== '#7c7c7c') return fallback;
		if (!label) return PALETTE[idx % PALETTE.length];
		let h = 0;
		for (let k = 0; k < label.length; k++) h = (h * 31 + label.charCodeAt(k)) >>> 0;
		return PALETTE[h % PALETTE.length];
	}
	function initialFor(label: string, emoji: string): string {
		if (emoji && emoji.trim()) return emoji.trim();
		return (label || '?').trim().charAt(0).toUpperCase() || '?';
	}

	function addTrackable() {
		trackables = [...trackables, { label: '', scope: 'entity', emoji: '', color: '#7DD3FC' }];
	}
	function removeTrackable(i: number) {
		trackables = trackables.filter((_, idx) => idx !== i);
	}

	// Map trackable label → stable id (slugified). Mirrors server-side slugifyTrackableId.
	function trackableIdFor(label: string): string {
		return (label || '')
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}
</script>

{#if error}
	<div class="alert alert-error mb-4 text-sm">{error}</div>
{/if}

<form method="POST" {action} use:enhance class="space-y-5 pb-24">
	<!-- Basics -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-primary/15 text-primary inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">1</span>
			<h2 class="text-base font-semibold">Name deinen Mode</h2>
		</header>

		<label class="block space-y-1">
			<span class="text-sm">Name</span>
			<input
				type="text"
				name="name"
				value={initial.name}
				required
				minlength="2"
				maxlength="64"
				class="input input-bordered glass h-12 w-full rounded-xl"
				placeholder="z.B. Murmelrennen — Standard"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-sm">Slug <span class="text-base-content/40">(leer = aus Name)</span></span>
			<input
				type="text"
				name="slug"
				value={initial.slug}
				class="input input-bordered glass tabular h-12 w-full rounded-xl lowercase"
				placeholder="murmelrennen-standard"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-sm">Beschreibung</span>
			<textarea
				name="description"
				rows="2"
				maxlength="500"
				class="textarea textarea-bordered glass w-full rounded-xl"
				placeholder="Ein Satz, der den Mode beschreibt.">{initial.description}</textarea>
		</label>
	</section>

	<!-- Terminology (optional) -->
	<details class="glass glass-xl rounded-2xl">
		<summary class="flex cursor-pointer items-center gap-2 p-4 text-xs">
			<span class="text-base-content/55 flex-1 font-medium uppercase tracking-widest">Terminologie <span class="text-base-content/35 normal-case tracking-normal">(optional)</span></span>
			<span class="text-base-content/40">▾</span>
		</summary>
		<div class="space-y-3 p-4 pt-0">
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Runde heißt</span>
				<input
					name="term_round"
					value={initial.terminology.round}
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Entität heißt</span>
				<input
					name="term_entity"
					value={initial.terminology.entity}
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Start-Verb</span>
				<input
					name="term_startedVerb"
					value={initial.terminology.startedVerb}
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
		</div>
		</div>
	</details>

	<!-- Entities -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-secondary/15 text-secondary inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">2</span>
			<h2 class="flex-1 text-base font-semibold">Wer / Was tritt an?</h2>
			<button type="button" onclick={addEntity} class="btn btn-ghost btn-xs">+ Hinzufügen</button>
		</header>
		<p class="text-base-content/45 -mt-1 text-[0.7rem]">
			Entitäten sind die Mitspieler*innen, Murmeln, Teams o.ä. — alles, worauf gewettet wird.
		</p>
		<ul class="space-y-2">
			{#each entities as e, i (i)}
				{@const eColor = colorFor(e.name, i, e.color)}
				<li class="glass flex items-center gap-2 rounded-xl p-2">
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold uppercase"
						style="background-color: {eColor}33; border-color: {eColor}99; color: {eColor};"
					>
						{initialFor(e.name, e.emoji)}
					</span>
					<input
						type="text"
						bind:value={e.name}
						placeholder="Name (z.B. Anna)"
						class="input input-bordered input-sm flex-1"
					/>
					<button
						type="button"
						onclick={() => removeEntity(i)}
						class="text-base-content/40 hover:text-error inline-flex h-9 w-9 items-center justify-center rounded-lg"
						aria-label="Entfernen"
					>
						<X size={14} />
					</button>
					<!-- Hidden form fields preserve parseForm contract -->
					<input type="hidden" name="entityName" value={e.name} />
					<input type="hidden" name="entityKind" value="entity" />
					<input type="hidden" name="entityColor" value={eColor} />
					<input type="hidden" name="entityEmoji" value={e.emoji} />
				</li>
			{/each}
		</ul>
	</section>

	<!-- Trackables -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-accent/15 text-accent inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">3</span>
			<h2 class="flex-1 text-base font-semibold">Was zählen wir mit?</h2>
			<button type="button" onclick={addTrackable} class="btn btn-ghost btn-xs">+ Hinzufügen</button>
		</header>
		<p class="text-base-content/45 -mt-1 text-[0.7rem]">
			Zählbare Events während einer Runde (z.B. „Foul“, „Überholen“, „Crash“).
			Wetten werden später als logische Bedingungen über diese Counter gebaut.
		</p>
		{#if trackables.length === 0}
			<div class="border-base-content/10 rounded-xl border border-dashed p-4 text-center">
				<p class="text-base-content/40 text-sm">
					Noch keine Trackables. Ohne sie können keine Wetten erstellt werden.
				</p>
			</div>
		{/if}
		<ul class="space-y-2">
			{#each trackables as t, i (i)}
				{@const tColor = colorFor(t.label, i, t.color)}
				<li class="glass flex items-center gap-2 rounded-xl p-2">
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold uppercase"
						style="background-color: {tColor}33; border-color: {tColor}99; color: {tColor};"
					>
						{initialFor(t.label, t.emoji)}
					</span>
					<input
						type="text"
						bind:value={t.label}
						placeholder="z.B. Foul, Tor, Schluck"
						class="input input-bordered input-sm flex-1"
					/>
					<div class="join">
						<button
							type="button"
							class="btn btn-xs join-item {t.scope === 'entity' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (t.scope = 'entity')}
							title="Zähler pro Entität (z.B. jeder Spieler eigene Tore)"
						>
							pro
						</button>
						<button
							type="button"
							class="btn btn-xs join-item {t.scope === 'global' ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (t.scope = 'global')}
							title="Ein Zähler insgesamt"
						>
							global
						</button>
					</div>
					<button
						type="button"
						onclick={() => removeTrackable(i)}
						class="text-base-content/40 hover:text-error inline-flex h-9 w-9 items-center justify-center rounded-lg"
						aria-label="Entfernen"
					>
						<X size={14} />
					</button>
					<!-- Hidden form fields preserve parseForm contract -->
					<input type="hidden" name="trackableLabel" value={t.label} />
					<input type="hidden" name="trackableScope" value={t.scope} />
					<input type="hidden" name="trackableColor" value={tColor} />
					<input type="hidden" name="trackableEmoji" value={t.emoji} />
				</li>
			{/each}
		</ul>
	</section>

	<!-- Bet-Graphs (replaces legacy Market-Templates UI) -->
	<section class="glass glass-xl space-y-3 p-4 sm:p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-warning/15 text-warning inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">4</span>
			<h2 class="flex-1 text-base font-semibold">Wetten (Bet-Graphs)</h2>
		</header>
		<p class="text-base-content/55 text-xs">
			Wetten werden als visueller <strong>Bet-Graph</strong> definiert &mdash; Knoten
			ablegen und Pins per Drag-to-Connect verbinden.
		</p>
		{#if modeId}
			<a
				href={'/modes/' + modeId + '/graphs'}
				class="from-primary/20 to-success/20 border-primary/40 flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-gradient-to-r p-4 transition hover:shadow-lg"
			>
				<div class="flex items-center gap-3">
					<span class="text-2xl" aria-hidden="true">📐</span>
					<div class="flex flex-col text-left">
						<strong class="text-base">Bet-Graphs öffnen</strong>
						<small class="text-base-content/70">Visueller Wett-Builder (Drag-to-Connect)</small>
					</div>
				</div>
				<span class="text-xl">→</span>
			</a>
		{:else}
			<div class="border-base-content/15 bg-base-200/30 rounded-xl border border-dashed p-4 text-center text-sm">
				<span class="text-base-content/60 block">Bet-Graphs verfügbar nach dem ersten Speichern.</span>
			</div>
		{/if}
	</section>

	<!-- Advanced settings (Terminology + Economy + Drinks + Confirmation + Rebuy) -->
	<details class="glass glass-xl rounded-2xl">
		<summary class="flex cursor-pointer items-center gap-2 p-4 text-sm font-medium">
			<span class="bg-base-content/10 inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">5</span>
			<span class="flex-1">Standard Session-Einstellungen <span class="text-base-content/45 text-[0.7rem]">— Geld, Quoten, Drinks, Bestätigung, Rebuy</span></span>
			<span class="text-base-content/40 text-xs">▾</span>
		</summary>
		<div class="space-y-4 p-4 pt-0">

	<!-- Economy -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Ökonomie</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Startgeld</span>
				<input
					type="number"
					name="startingMoney"
					value={initial.defaultConfig.startingMoney}
					min="100"
					step="50"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Mindesteinsatz</span>
				<input
					type="number"
					name="minStake"
					value={initial.defaultConfig.minStake}
					min="1"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
		</div>
		<label class="glass flex items-center justify-between rounded-xl p-3">
			<span class="space-y-1">
				<span class="block text-sm font-medium">Quoten anzeigen</span>
				<span class="text-base-content/40 block text-xs">
					Multiplikator (1.82×) + Prozent neben jedem Outcome. Aus = nur Outcome &amp; eigener Einsatz.
				</span>
			</span>
			<input
				type="checkbox"
				name="showOdds"
				class="toggle toggle-primary"
				checked={initial.defaultConfig.showOdds !== false}
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
				value={initial.defaultConfig.maxStakePctOfStart ?? 50}
				min="1"
				max="100"
				class="tabular w-16 bg-transparent text-right outline-none"
			/>
		</label>
	</section>

	<!-- Drinks -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Drink-Preise</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Schluck</span>
				<input
					type="number"
					name="priceSchluck"
					value={initial.defaultConfig.drinkPrices.SCHLUCK}
					min="0"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Kurzer</span>
				<input
					type="number"
					name="priceKurzer"
					value={initial.defaultConfig.drinkPrices.KURZER}
					min="0"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Bier exen</span>
				<input
					type="number"
					name="priceBier"
					value={initial.defaultConfig.drinkPrices.BIER_EXEN}
					min="0"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
		</div>
	</section>

	<!-- Confirmation -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Drink-Bestätigung
		</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Modus</span>
				<select
					name="confirmationMode"
					bind:value={confirmationMode}
					class="select select-bordered select-sm w-full"
				>
					<option value="GM">Nur GM</option>
					<option value="PEERS">Peers (GM zählt mit)</option>
				</select>
			</label>
			{#if confirmationMode === 'PEERS'}
				<label class="glass space-y-1 rounded-lg p-2">
					<span class="text-base-content/50 text-xs">Peer-Anzahl</span>
					<input
						type="number"
						name="peerConfirmationsRequired"
						value={initial.defaultConfig.peerConfirmationsRequired}
						min="1"
						max="10"
						class="tabular w-full bg-transparent text-sm outline-none"
					/>
				</label>
			{/if}
		</div>
		<p class="text-base-content/40 text-xs">
			GM bestätigt allein, oder N Peers bestätigen. GM-Bestätigungen zählen immer als Peer.
		</p>
	</section>

	<!-- Lock policy -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Sperre bei offenem Drink
		</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input
					type="radio"
					name="lockMode"
					value="TIMER_LOCK"
					checked={(initial.defaultConfig.lockMode ?? 'TIMER_LOCK') === 'TIMER_LOCK'}
					class="radio radio-xs radio-primary"
				/>
				<span>Timer + Sperre</span>
			</label>
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input
					type="radio"
					name="lockMode"
					value="LOCK"
					checked={initial.defaultConfig.lockMode === 'LOCK'}
					class="radio radio-xs radio-primary"
				/>
				<span>Nur Sperre</span>
			</label>
			<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs">
				<input
					type="radio"
					name="lockMode"
					value="NONE"
					checked={initial.defaultConfig.lockMode === 'NONE'}
					class="radio radio-xs radio-primary"
				/>
				<span>Keine Sperre</span>
			</label>
		</div>
		<label class="glass flex items-center justify-between rounded-xl p-3 text-xs">
			<span class="text-base-content/50">Timer-Dauer (Sekunden)</span>
			<input
				type="number"
				name="lockTimerSeconds"
				value={initial.defaultConfig.lockTimerSeconds ?? 600}
				min="30"
				class="tabular w-24 bg-transparent text-right outline-none"
			/>
		</label>
		<p class="text-base-content/40 text-xs">
			Standard: Timer + Sperre, 10 Minuten. Spieler können während des Timers weiter wetten und den Drink bestätigen lassen.
		</p>
	</section>

	<!-- Rebuy -->
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Rebuy (Pleite → Trinken → Geld)
		</h2>
		<label class="glass flex items-center justify-between rounded-xl p-3">
			<span class="space-y-1">
				<span class="block text-sm font-medium">Rebuy erlauben</span>
				<span class="text-base-content/40 block text-xs">
					Pleite-Spieler können einen Drink kippen, um wieder Geld zu bekommen.
				</span>
			</span>
			<input
				type="checkbox"
				name="rebuyEnabled"
				class="toggle toggle-primary"
				checked={initial.defaultConfig.rebuy.enabled}
			/>
		</label>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Rebuy-Drink</span>
				<select
					name="rebuyDrinkType"
					value={initial.defaultConfig.rebuy.drinkType}
					class="select select-bordered select-sm w-full"
				>
					<option value="SCHLUCK">Schluck</option>
					<option value="KURZER">Kurzer</option>
					<option value="BIER_EXEN">Bier exen</option>
				</select>
			</label>
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Rebuy-Betrag</span>
				<input
					type="number"
					name="rebuyAmount"
					value={initial.defaultConfig.rebuy.amount}
					min="1"
					class="tabular w-full bg-transparent text-sm outline-none"
				/>
			</label>
		</div>
	</section>
		</div>
	</details>

	<div class="glass border-base-300 fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md gap-2 rounded-2xl border p-2 shadow-xl">
		<a href="/modes" class="btn btn-ghost h-12 flex-1 rounded-xl text-sm">Abbrechen</a>
		<button type="submit" class="btn btn-primary glow-primary h-12 flex-1 rounded-xl text-sm">
			{submitLabel}
		</button>
	</div>
</form>
