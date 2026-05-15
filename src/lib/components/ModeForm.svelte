<!--
	@file ModeForm.svelte — minimal Mode definition form (Phase 17 simplified).
	Phase 17: Slug/Beschreibung/Terminologie + alle Session-Settings entfernt.
	Modes definieren nur noch: Name, Spieler (Entitäten), Trackables, Bet-Graphs.
	Session-Settings werden ausschließlich in `/s/[id]/settings` (oder beim Erstellen)
	gesetzt; Mode liefert nur noch generische Defaults via `freshModeDefaultConfig()`.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { X } from '@lucide/svelte';
	import type { ModeDefaultEntity, Trackable } from '$lib/server/db/schema';

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
			defaultEntities: ModeDefaultEntity[];
			trackables: Trackable[];
		};
		submitLabel?: string;
		error?: string | null;
		action?: string;
		modeId?: string;
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

	const PALETTE = [
		'#A78BFA', '#7DD3FC', '#FBBF24', '#FB7185', '#34D399',
		'#F472B6', '#60A5FA', '#FCD34D', '#C084FC', '#4ADE80'
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
</script>

{#if error}
	<div class="alert alert-error mb-4 text-sm">{error}</div>
{/if}

<form method="POST" {action} use:enhance class="space-y-5 pb-24">
	<!-- 1 — Name -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-primary/15 text-primary inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">1</span>
			<h2 class="text-base font-semibold">Name</h2>
		</header>
		<label class="block space-y-1">
			<input
				type="text"
				name="name"
				value={initial.name}
				required
				minlength="2"
				maxlength="64"
				class="input input-bordered glass h-12 w-full rounded-xl"
				placeholder="z.B. Murmelrennen"
			/>
		</label>
	</section>

	<!-- 2 — Entitäten -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-secondary/15 text-secondary inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">2</span>
			<h2 class="flex-1 text-base font-semibold">Entitäten</h2>
			<button type="button" onclick={addEntity} class="btn btn-ghost btn-xs">+ Hinzufügen</button>
		</header>
		<p class="text-base-content/45 -mt-1 text-[0.7rem]">
			Wer tritt an? Spieler*innen, Murmeln, Teams — alles worauf gewettet wird.
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
						placeholder="Name"
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
					<input type="hidden" name="entityName" value={e.name} />
					<input type="hidden" name="entityKind" value="entity" />
					<input type="hidden" name="entityColor" value={eColor} />
					<input type="hidden" name="entityEmoji" value={e.emoji} />
				</li>
			{/each}
		</ul>
	</section>

	<!-- 3 — Events -->
	<section class="glass glass-xl space-y-3 p-5">
		<header class="flex items-baseline gap-2">
			<span class="bg-accent/15 text-accent inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">3</span>
			<h2 class="flex-1 text-base font-semibold">Events</h2>
			<button type="button" onclick={addTrackable} class="btn btn-ghost btn-xs">+ Hinzufügen</button>
		</header>
		<p class="text-base-content/45 -mt-1 text-[0.7rem]">
			Zählbare Events während einer Runde (z.B. „Foul“, „Tor“, „Crash“).
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
							title="Zähler einzeln pro Entität (z.B. jeder Spieler eigene Tore)"
						>
							einzel
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
					<input type="hidden" name="trackableLabel" value={t.label} />
					<input type="hidden" name="trackableScope" value={t.scope} />
					<input type="hidden" name="trackableColor" value={tColor} />
					<input type="hidden" name="trackableEmoji" value={t.emoji} />
				</li>
			{/each}
		</ul>
	</section>

	<!-- Phase 20a: Bet-Graphs-Section komplett entfernt; einzige Wetten-CTA lebt in /modes/[id]/+page.svelte (Template-Modal). -->

	<div class="glass border-base-300 fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md gap-2 rounded-2xl border p-2 shadow-xl">
		<a href="/modes" class="btn btn-ghost h-12 flex-1 rounded-xl text-sm">Abbrechen</a>
		<button type="submit" class="btn btn-primary glow-primary h-12 flex-1 rounded-xl text-sm">
			{submitLabel}
		</button>
	</div>
</form>
