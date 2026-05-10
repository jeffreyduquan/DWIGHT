<!--
	@file ModeForm.svelte — full Mode definition form used by /modes/new and /modes/[id].
	D3: bet templates + multipliers replaced by a generic Trackables section.
	Bets are now built per-Session as predicates over these counters.
-->
<script lang="ts">
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
		error
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
	} = $props();

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

	function addTrackable() {
		trackables = [...trackables, { label: '', scope: 'entity', emoji: '', color: '#7DD3FC' }];
	}
	function removeTrackable(i: number) {
		trackables = trackables.filter((_, idx) => idx !== i);
	}
</script>

{#if error}
	<div class="alert alert-error mb-4 text-sm">{error}</div>
{/if}

<form method="POST" class="space-y-8">
	<!-- Basics -->
	<section class="space-y-3">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Basics</h2>

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

	<!-- Terminology -->
	<section class="space-y-3">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Terminologie</h2>
		<div class="grid grid-cols-3 gap-2">
			<label class="space-y-1">
				<span class="text-base-content/50 text-xs">Runde heißt</span>
				<input
					name="term_round"
					value={initial.terminology.round}
					class="input input-bordered glass h-12 w-full rounded-xl text-sm"
				/>
			</label>
			<label class="space-y-1">
				<span class="text-base-content/50 text-xs">Entität heißt</span>
				<input
					name="term_entity"
					value={initial.terminology.entity}
					class="input input-bordered glass h-12 w-full rounded-xl text-sm"
				/>
			</label>
			<label class="space-y-1">
				<span class="text-base-content/50 text-xs">Start-Verb</span>
				<input
					name="term_startedVerb"
					value={initial.terminology.startedVerb}
					class="input input-bordered glass h-12 w-full rounded-xl text-sm"
				/>
			</label>
		</div>
	</section>

	<!-- Entities -->
	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Entitäten</h2>
			<button type="button" onclick={addEntity} class="btn btn-ghost btn-xs">+ Hinzufügen</button>
		</div>
		<ul class="space-y-2">
			{#each entities as e, i (i)}
				<li class="glass grid grid-cols-[1fr_5rem_3rem_2.5rem] items-center gap-2 rounded-xl p-2">
					<input
						type="text"
						name="entityName"
						bind:value={e.name}
						placeholder="Name"
						class="input input-ghost h-10 rounded-lg bg-transparent text-sm"
					/>
					<input
						type="text"
						name="entityKind"
						bind:value={e.kind}
						placeholder="kind"
						class="input input-ghost tabular h-10 rounded-lg bg-transparent text-xs"
					/>
					<input
						type="color"
						name="entityColor"
						bind:value={e.color}
						class="h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent"
					/>
					<input
						type="text"
						name="entityEmoji"
						bind:value={e.emoji}
						maxlength="2"
						placeholder="🎯"
						class="input input-ghost h-10 rounded-lg bg-transparent text-center text-lg"
					/>
					<button
						type="button"
						onclick={() => removeEntity(i)}
						class="text-base-content/40 hover:text-error col-span-4 self-end text-right text-xs"
						aria-label="Entfernen"
					>
						entfernen
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Trackables -->
	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
				Trackables (zählbare Events)
			</h2>
			<button type="button" onclick={addTrackable} class="btn btn-ghost btn-xs"
				>+ Hinzufügen</button
			>
		</div>
		<p class="text-base-content/40 -mt-1 text-xs">
			Zählbare Events während einer Runde (z.B. „Foul", „Überholen", „Crash"). Wetten werden
			später als logische Bedingungen über diese Counter gebaut.
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
				<li
					class="glass grid grid-cols-[1fr_7rem_5rem_2.5rem] items-center gap-2 rounded-xl p-2"
				>
					<input
						type="text"
						name="trackableLabel"
						bind:value={t.label}
						placeholder="z.B. Foul"
						class="input input-ghost h-10 rounded-lg bg-transparent text-sm"
					/>
					<select
						name="trackableScope"
						bind:value={t.scope}
						class="select select-ghost h-10 rounded-lg bg-transparent text-xs"
					>
						<option value="global">global</option>
						<option value="entity">pro Entität</option>
					</select>
					<input
						type="color"
						name="trackableColor"
						bind:value={t.color}
						class="h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent"
					/>
					<input
						type="text"
						name="trackableEmoji"
						bind:value={t.emoji}
						maxlength="2"
						placeholder="🟨"
						class="input input-ghost h-10 rounded-lg bg-transparent text-center text-lg"
					/>
					<button
						type="button"
						onclick={() => removeTrackable(i)}
						class="text-base-content/40 hover:text-error col-span-4 self-end text-right text-xs"
						aria-label="Entfernen"
					>
						entfernen
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Economy -->
	<section class="space-y-3">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Ökonomie</h2>
		<div class="grid grid-cols-2 gap-2">
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
	</section>

	<!-- Drinks -->
	<section class="space-y-3">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Drink-Preise</h2>
		<div class="grid grid-cols-3 gap-2">
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
	<section class="space-y-3">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Drink-Bestätigung
		</h2>
		<div class="grid grid-cols-2 gap-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Modus</span>
				<select
					name="confirmationMode"
					value={initial.defaultConfig.confirmationMode}
					class="w-full bg-transparent text-sm outline-none"
				>
					<option value="GM">Nur GM</option>
					<option value="PEERS">Nur Peers</option>
					<option value="EITHER">GM oder Peers</option>
				</select>
			</label>
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
		</div>
		<p class="text-base-content/40 text-xs">
			GM bestätigt allein, oder N Peers bestätigen. „GM oder Peers" akzeptiert beides.
		</p>
	</section>

	<!-- Rebuy -->
	<section class="space-y-3">
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
		<div class="grid grid-cols-2 gap-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Rebuy-Drink</span>
				<select
					name="rebuyDrinkType"
					value={initial.defaultConfig.rebuy.drinkType}
					class="w-full bg-transparent text-sm outline-none"
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

	<button type="submit" class="btn btn-primary glow-primary h-14 w-full rounded-xl text-base">
		{submitLabel}
	</button>
</form>
