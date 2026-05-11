<!--
	@file ModeForm.svelte — full Mode definition form used by /modes/new and /modes/[id].
	D3: bet templates + multipliers replaced by a generic Trackables section.
	Bets are now built per-Session as predicates over these counters.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		BarChart3,
		Trophy,
		Ruler,
		Swords,
		Medal,
		Target,
		Users,
		ArrowLeftRight,
		X
	} from '@lucide/svelte';
	import type {
		MarketTemplate,
		ModeDefaultConfig,
		ModeDefaultEntity,
		ModeTerminology,
		Trackable
	} from '$lib/server/db/schema';
	import { describeTemplate } from '$lib/predicate-describe';

	const kindIcon: Record<string, typeof BarChart3> = {
		binary_count: BarChart3,
		compare_entities: Trophy,
		range_count: Ruler,
		head_to_head: Swords,
		top_k: Medal,
		count_matching: Target,
		team_total: Users,
		spread: ArrowLeftRight
	};
	const kindLabel: Record<string, string> = {
		binary_count: 'Menge',
		compare_entities: 'Vergleich',
		range_count: 'Bereich',
		head_to_head: 'Duell',
		top_k: 'Top-K',
		count_matching: 'Mind. K',
		team_total: 'Team-Total',
		spread: 'Spread'
	};

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

	type MarketTemplateRow = {
		kind:
			| 'binary_count'
			| 'compare_entities'
			| 'range_count'
			| 'head_to_head'
			| 'top_k'
			| 'count_matching'
			| 'team_total'
			| 'spread';
		title: string;
		trackableId: string;
		// binary_count
		entityScope: 'global' | 'each';
		cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
		n: number;
		// compare_entities / head_to_head
		tieBehavior: 'tie_outcome' | 'void';
		direction: 'max' | 'min';
		// range_count
		nMin: number;
		nMax: number;
		// head_to_head / spread
		entityNameA: string;
		entityNameB: string;
		// top_k / count_matching
		k: number;
		perEntityCmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
		perEntityN: number;
		// team_total
		teamNames: string;
	};

	let {
		initial,
		submitLabel = 'Speichern',
		error,
		action = ''
	}: {
		initial: {
			name: string;
			slug: string;
			description: string;
			terminology: ModeTerminology;
			defaultEntities: ModeDefaultEntity[];
			trackables: Trackable[];
			marketTemplates: MarketTemplate[];
			defaultConfig: ModeDefaultConfig;
		};
		submitLabel?: string;
		error?: string | null;
		action?: string;
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

	// Map trackable label → stable id (slugified). Mirrors server-side slugifyTrackableId.
	function trackableIdFor(label: string): string {
		return (label || '')
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	/**
	 * Required trackable scope for a given template row.
	 * Returns 'entity' if the template requires entity-scoped trackables,
	 * 'global' if it requires global-scoped trackables,
	 * or 'any' if both are acceptable.
	 *
	 * Matrix:
	 *  - binary_count, range_count: depends on entityScope ('each' → entity, 'global' → global)
	 *  - all others (compare_entities, head_to_head, top_k, count_matching, team_total, spread): entity only
	 */
	function requiredTrackableScope(t: MarketTemplateRow): 'global' | 'entity' | 'any' {
		if (t.kind === 'binary_count' || t.kind === 'range_count') {
			return t.entityScope === 'each' ? 'entity' : 'global';
		}
		return 'entity';
	}

	/** Filter trackables list to those allowed for a template row. */
	function allowedTrackablesFor(t: MarketTemplateRow): TrackableRow[] {
		const required = requiredTrackableScope(t);
		return trackables.filter((tr) => {
			if (!tr.label.trim()) return false;
			if (required === 'any') return true;
			return tr.scope === required;
		});
	}

	function defaultRow(kind: MarketTemplateRow['kind']): MarketTemplateRow {
		return {
			kind,
			title: '',
			trackableId: '',
			entityScope: kind === 'binary_count' || kind === 'range_count' ? 'global' : 'each',
			cmp: 'gte',
			n: 1,
			tieBehavior: 'tie_outcome',
			direction: 'max',
			nMin: kind === 'range_count' ? 1 : 0,
			nMax: kind === 'range_count' ? 3 : 0,
			entityNameA:
				kind === 'head_to_head' || kind === 'spread' ? entities[0]?.name ?? '' : '',
			entityNameB:
				kind === 'head_to_head' || kind === 'spread' ? entities[1]?.name ?? '' : '',
			k: kind === 'top_k' ? 3 : kind === 'count_matching' ? 2 : 0,
			perEntityCmp: 'gte',
			perEntityN: 1,
			teamNames:
				kind === 'team_total'
					? entities
							.slice(0, Math.max(1, Math.floor(entities.length / 2)))
							.map((e) => e.name)
							.filter(Boolean)
							.join(',')
					: ''
		};
	}

	let templates = $state<MarketTemplateRow[]>(
		initial.marketTemplates.map((m) => {
			const base = defaultRow(m.kind);
			if (m.kind === 'binary_count') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					entityScope: m.entityScope,
					cmp: m.cmp,
					n: m.n
				};
			}
			if (m.kind === 'compare_entities') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					tieBehavior: m.tieBehavior,
					direction: m.direction ?? 'max'
				};
			}
			if (m.kind === 'range_count') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					entityScope: m.entityScope,
					nMin: m.nMin,
					nMax: m.nMax
				};
			}
			if (m.kind === 'head_to_head') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					tieBehavior: m.tieBehavior,
					entityNameA: m.entityNameA,
					entityNameB: m.entityNameB
				};
			}
			if (m.kind === 'top_k') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					k: m.k,
					direction: m.direction
				};
			}
			if (m.kind === 'count_matching') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					k: m.k,
					cmp: m.cmp,
					perEntityCmp: m.perEntityCmp,
					perEntityN: m.perEntityN
				};
			}
			if (m.kind === 'team_total') {
				return {
					...base,
					title: m.title,
					trackableId: m.trackableId,
					cmp: m.cmp,
					n: m.n,
					teamNames: m.entityNames.join(',')
				};
			}
			// spread
			return {
				...base,
				title: m.title,
				trackableId: m.trackableId,
				cmp: m.cmp,
				n: m.n,
				entityNameA: m.entityNameA,
				entityNameB: m.entityNameB
			};
		})
	);

	function addBinaryTemplate() {
		templates = [...templates, defaultRow('binary_count')];
	}
	function addCompareTemplate() {
		templates = [...templates, defaultRow('compare_entities')];
	}
	function addRangeTemplate() {
		templates = [...templates, defaultRow('range_count')];
	}
	function addH2HTemplate() {
		templates = [...templates, defaultRow('head_to_head')];
	}
	function addTopKTemplate() {
		templates = [...templates, defaultRow('top_k')];
	}
	function addCountMatchingTemplate() {
		templates = [...templates, defaultRow('count_matching')];
	}
	function addTeamTotalTemplate() {
		templates = [...templates, defaultRow('team_total')];
	}
	function addSpreadTemplate() {
		templates = [...templates, defaultRow('spread')];
	}
	function removeTemplate(i: number) {
		templates = templates.filter((_, idx) => idx !== i);
	}
</script>

{#if error}
	<div class="alert alert-error mb-4 text-sm">{error}</div>
{/if}

<form method="POST" {action} use:enhance class="space-y-8">
	<!-- Basics -->
	<section class="glass glass-xl space-y-3 p-5">
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
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">Terminologie</h2>
		<div class="grid grid-cols-3 gap-2">
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
	</section>

	<!-- Entities -->
	<section class="glass glass-xl space-y-3 p-5">
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
						class="input input-bordered input-sm w-full"
					/>
					<input
						type="text"
						name="entityKind"
						bind:value={e.kind}
						placeholder="kind"
						class="input input-bordered input-sm tabular w-full"
					/>
					<input
						type="color"
						name="entityColor"
						bind:value={e.color}
						class="h-9 w-full cursor-pointer rounded-md border-0 bg-transparent"
					/>
					<input
						type="text"
						name="entityEmoji"
						bind:value={e.emoji}
						maxlength="2"
						placeholder="A"
						aria-label="Initial / Symbol"
						style="background-color: {e.color}33; border-color: {e.color}99;"
						class="input input-bordered input-sm h-10 w-10 rounded-full text-center text-base font-bold uppercase"
					/>
					<button
						type="button"
						onclick={() => removeEntity(i)}
						class="text-base-content/40 hover:text-error col-span-4 inline-flex items-center gap-1 self-end justify-self-end text-xs"
						aria-label="Entfernen"
					>
						<X size={11} /> entfernen
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Trackables -->
	<section class="glass glass-xl space-y-3 p-5">
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
						class="input input-bordered input-sm w-full"
					/>
					<select
						name="trackableScope"
						bind:value={t.scope}
						class="select select-bordered select-sm w-full"
					>
						<option value="global">global</option>
						<option value="entity">pro Entität</option>
					</select>
					<input
						type="color"
						name="trackableColor"
						bind:value={t.color}
						class="h-9 w-full cursor-pointer rounded-md border-0 bg-transparent"
					/>
					<input
						type="text"
						name="trackableEmoji"
						bind:value={t.emoji}
						maxlength="2"
						placeholder="X"
						aria-label="Initial / Symbol"
						style="background-color: {t.color}33; border-color: {t.color}99;"
						class="input input-bordered input-sm h-10 w-10 rounded-full text-center text-base font-bold uppercase"
					/>
					<button
						type="button"
						onclick={() => removeTrackable(i)}
						class="text-base-content/40 hover:text-error col-span-4 inline-flex items-center gap-1 self-end justify-self-end text-xs"
						aria-label="Entfernen"
					>
						<X size={11} /> entfernen
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Market Templates -->
	<section class="glass glass-xl space-y-3 p-5">
		<div class="flex items-center justify-between">
			<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
				Wetten-Templates
			</h2>
			<div class="flex flex-wrap gap-1">
				<button type="button" onclick={addBinaryTemplate} class="btn btn-ghost btn-xs"
					>+ Menge</button
				>
				<button type="button" onclick={addCompareTemplate} class="btn btn-ghost btn-xs"
					>+ Vergleich</button
				>
				<button type="button" onclick={addRangeTemplate} class="btn btn-ghost btn-xs"
					>+ Bereich</button
				>
				<button type="button" onclick={addH2HTemplate} class="btn btn-ghost btn-xs"
					>+ Duell</button
				>
				<button type="button" onclick={addTopKTemplate} class="btn btn-ghost btn-xs"
					>+ Top-K</button
				>
				<button type="button" onclick={addCountMatchingTemplate} class="btn btn-ghost btn-xs"
					>+ Mind. K</button
				>
				<button type="button" onclick={addTeamTotalTemplate} class="btn btn-ghost btn-xs"
					>+ Team-Total</button
				>
				<button type="button" onclick={addSpreadTemplate} class="btn btn-ghost btn-xs"
					>+ Spread</button
				>
			</div>
		</div>
		<p class="text-base-content/40 -mt-1 text-xs">
			Wetten werden im Mode definiert (nicht pro Runde). Beim Öffnen der Wettphase werden sie
			automatisch instanziiert.
		</p>
		<ul class="text-base-content/60 -mt-1 space-y-1 pl-0 text-[0.7rem]">
			<li class="flex items-start gap-2">
				<BarChart3 size={14} class="text-primary mt-[0.1rem] shrink-0" />
				<span><strong>Menge:</strong> Erreicht ein Counter eine Schwelle? (z.B. „Mehr als 5 Fouls?“)</span>
			</li>
			<li class="flex items-start gap-2">
				<Trophy size={14} class="text-warning mt-[0.1rem] shrink-0" />
				<span><strong>Vergleich:</strong> Wer hat am meisten/wenigsten? (z.B. „Wer macht die meisten Tore?“)</span>
			</li>
			<li class="flex items-start gap-2">
				<Ruler size={14} class="text-accent mt-[0.1rem] shrink-0" />
				<span><strong>Bereich:</strong> Liegt der Counter zwischen min und max? (z.B. „2–4 Tore?“)</span>
			</li>
			<li class="flex items-start gap-2">
				<Swords size={14} class="text-warning mt-[0.1rem] shrink-0" />
				<span><strong>Duell:</strong> Wer von zwei festen Entities hat mehr? (z.B. „A vs B")</span>
			</li>
			<li class="flex items-start gap-2">
				<Medal size={14} class="text-success mt-[0.1rem] shrink-0" />
				<span><strong>Top-K:</strong> Wer landet bei den Top-K? (z.B. „Wer ist im Podest, Top 3?")</span>
			</li>
			<li class="flex items-start gap-2">
				<Target size={14} class="text-info mt-[0.1rem] shrink-0" />
				<span><strong>Mind. K:</strong> Ja/Nein: erfüllen mindestens K Entities die Bedingung? (z.B. „Trinken mind. 3 Spieler?")</span>
			</li>
			<li class="flex items-start gap-2">
				<Users size={14} class="text-base-content/60 mt-[0.1rem] shrink-0" />
				<span><strong>Team-Total:</strong> Summe eines Counters über mehrere Entities (z.B. „Team Rot zusammen ≥10 Tore?")</span>
			</li>
			<li class="flex items-start gap-2">
				<ArrowLeftRight size={14} class="text-error mt-[0.1rem] shrink-0" />
				<span><strong>Spread:</strong> Differenz zwischen zwei Entities (z.B. „A hat ≥3 mehr Tore als B?")</span>
			</li>
		</ul>
		{#if templates.length === 0}
			<div class="border-base-content/10 rounded-xl border border-dashed p-4 text-center">
				<p class="text-base-content/40 text-sm">
					Keine Wetten-Templates. Pro Runde gibt es dann keine automatischen Märkte.
				</p>
			</div>
		{/if}
		<ul class="space-y-3">
			{#each templates as t, i (i)}
				{@const allowed = allowedTrackablesFor(t)}
				{@const reqScope = requiredTrackableScope(t)}
				{@const KindIcon = kindIcon[t.kind] ?? BarChart3}
				<li class="glass space-y-3 rounded-xl p-4">
					<!-- Hidden field: kind -->
					<input type="hidden" name="mtKind" value={t.kind} />
					<div class="flex items-center justify-between gap-2">
						<span
							class="badge badge-sm inline-flex items-center gap-1 {t.kind === 'binary_count'
								? 'badge-primary'
								: t.kind === 'compare_entities'
									? 'badge-secondary'
									: t.kind === 'range_count'
										? 'badge-accent'
										: t.kind === 'head_to_head'
											? 'badge-warning'
											: t.kind === 'top_k'
												? 'badge-success'
												: t.kind === 'count_matching'
													? 'badge-info'
													: t.kind === 'team_total'
														? 'badge-neutral'
														: 'badge-error'}"
						>
							<KindIcon size={11} />
							{kindLabel[t.kind] ?? t.kind}
						</span>
						<button
							type="button"
							onclick={() => removeTemplate(i)}
							class="text-base-content/40 hover:text-error inline-flex items-center gap-1 text-xs"
							aria-label="Entfernen"><X size={11} /> entfernen</button
						>
					</div>

					<label class="block space-y-1">
						<span class="text-base-content/50 text-xs uppercase tracking-wider">Titel</span>
						<input
							type="text"
							name="mtTitle"
							bind:value={t.title}
							placeholder={t.kind === 'compare_entities'
								? 'z.B. Wer macht die meisten Tore?'
								: t.kind === 'range_count'
									? 'z.B. Tore zwischen {min} und {max}'
									: t.kind === 'head_to_head'
										? 'z.B. Duell: ' +
											(t.entityNameA || 'A') +
											' vs ' +
											(t.entityNameB || 'B')
										: t.entityScope === 'each'
											? 'z.B. {entity} trifft mindestens {n}×'
											: 'z.B. Mehr als 5 Fouls insgesamt'}
							class="input input-bordered input-sm w-full"
						/>
						{#if t.kind === 'binary_count' && t.entityScope === 'each'}
							<span class="text-base-content/40 block text-[0.65rem]">
								{'{entity}'} wird automatisch durch den Entitäts-Namen ersetzt.
							</span>
						{:else if t.kind === 'range_count'}
							<span class="text-base-content/40 block text-[0.65rem]">
								{'{min}'}, {'{max}'} und ({t.entityScope === 'each' ? '{entity}, ' : ''}) werden im Titel ersetzt.
							</span>
						{/if}
					</label>

					<label class="block space-y-1">
						<span class="text-base-content/50 text-xs uppercase tracking-wider">
							Trackable
							<span class="text-base-content/40 normal-case">
								{#if reqScope === 'entity'}
									(nur pro-Entität-Trackables)
								{:else if reqScope === 'global'}
									(nur globale Trackables)
								{/if}
							</span>
						</span>
						<select
							name="mtTrackable"
							bind:value={t.trackableId}
							class="select select-bordered select-sm w-full"
						>
							<option value="">— Trackable wählen —</option>
							{#each allowed as tr (tr.label)}
								<option value={trackableIdFor(tr.label)}>
									{tr.label} ({tr.scope === 'global' ? 'global' : 'pro Entität'})
								</option>
							{/each}
						</select>
						{#if allowed.length === 0}
							<span class="text-warning block text-[0.65rem]">
								Keine passenden Trackables. Lege oben ein
								{reqScope === 'entity' ? '"pro Entität"' : '"global"'}-Trackable an.
							</span>
						{:else if t.trackableId && !allowed.some((tr) => trackableIdFor(tr.label) === t.trackableId)}
							<span class="text-warning block text-[0.65rem]">
								Das aktuell gewählte Trackable passt nicht zum Template-Scope. Bitte neu wählen.
							</span>
						{/if}
					</label>

					{#if t.kind === 'binary_count'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Scope</span>
								<select
									name="mtScope"
									bind:value={t.entityScope}
									class="select select-bordered select-sm w-full"
								>
									<option value="global">global (1 Markt)</option>
									<option value="each">pro Entität (N Märkte)</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Vergleich</span>
								<select
									name="mtCmp"
									bind:value={t.cmp}
									class="select select-bordered select-sm w-full"
								>
									<option value="gte">≥ mindestens</option>
									<option value="gt">&gt; mehr als</option>
									<option value="eq">= genau</option>
									<option value="lt">&lt; weniger als</option>
									<option value="lte">≤ höchstens</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Anzahl (n)</span>
								<input
									type="number"
									name="mtN"
									bind:value={t.n}
									min="0"
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
						</div>
						<!-- Hidden defaults to keep parallel arrays aligned -->
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
					<input type="hidden" name="mtK" value="0" />
					<input type="hidden" name="mtPerEntityCmp" value="gte" />
					<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'compare_entities'}
						<label class="block space-y-1">
							<span class="text-base-content/50 text-xs uppercase tracking-wider">Richtung</span>
							<select
								name="mtDirection"
								bind:value={t.direction}
								class="select select-bordered select-sm w-full"
							>
								<option value="max">Wer hat am meisten? (1. Platz)</option>
								<option value="min">Wer hat am wenigsten? (letzter Platz)</option>
							</select>
						</label>
						<label class="block space-y-1">
							<span class="text-base-content/50 text-xs uppercase tracking-wider"
								>Bei Gleichstand</span
							>
							<select
								name="mtTieBehavior"
								bind:value={t.tieBehavior}
								class="select select-bordered select-sm w-full"
							>
								<option value="tie_outcome">Gleichstand als eigene Wettoption</option>
								<option value="void">Gleichstand → Einsätze zurück</option>
							</select>
						</label>
						<!-- Hidden defaults to keep parallel arrays aligned -->
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtCmp" value="gte" />
						<input type="hidden" name="mtN" value="1" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
					<input type="hidden" name="mtK" value="0" />
					<input type="hidden" name="mtPerEntityCmp" value="gte" />
					<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'range_count'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Scope</span>
								<select
									name="mtScope"
									bind:value={t.entityScope}
									class="select select-bordered select-sm w-full"
								>
									<option value="global">global (1 Markt)</option>
									<option value="each">pro Entität (N Märkte)</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Min (≥)</span>
								<input
									type="number"
									name="mtNMin"
									bind:value={t.nMin}
									min="0"
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Max (≤)</span>
								<input
									type="number"
									name="mtNMax"
									bind:value={t.nMax}
									min="0"
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
						</div>
						<input type="hidden" name="mtCmp" value="gte" />
						<input type="hidden" name="mtN" value="1" />
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
					<input type="hidden" name="mtK" value="0" />
					<input type="hidden" name="mtPerEntityCmp" value="gte" />
					<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'head_to_head'}
						<!-- head_to_head -->
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Entität A</span
								>
								<select
									name="mtEntityA"
									bind:value={t.entityNameA}
									class="select select-bordered select-sm w-full"
								>
									<option value="">— wählen —</option>
									{#each entities.filter((e) => e.name.trim()) as e (e.name)}
										<option value={e.name}>{e.emoji} {e.name}</option>
									{/each}
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Entität B</span
								>
								<select
									name="mtEntityB"
									bind:value={t.entityNameB}
									class="select select-bordered select-sm w-full"
								>
									<option value="">— wählen —</option>
									{#each entities.filter((e) => e.name.trim()) as e (e.name)}
										<option value={e.name}>{e.emoji} {e.name}</option>
									{/each}
								</select>
							</label>
						</div>
						<label class="block space-y-1">
							<span class="text-base-content/50 text-xs uppercase tracking-wider"
								>Bei Gleichstand</span
							>
							<select
								name="mtTieBehavior"
								bind:value={t.tieBehavior}
								class="select select-bordered select-sm w-full"
							>
								<option value="tie_outcome">Gleichstand als eigene Wettoption</option>
								<option value="void">Gleichstand → Einsätze zurück</option>
							</select>
						</label>
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtCmp" value="gte" />
						<input type="hidden" name="mtN" value="1" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtK" value="0" />
						<input type="hidden" name="mtPerEntityCmp" value="gte" />
						<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'top_k'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Richtung</span>
								<select
									name="mtDirection"
									bind:value={t.direction}
									class="select select-bordered select-sm w-full"
								>
									<option value="max">Top-K (höchste Werte)</option>
									<option value="min">Bottom-K (niedrigste Werte)</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">K (Plätze)</span>
								<input
									type="number"
									name="mtK"
									bind:value={t.k}
									min="1"
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
						</div>
						<p class="text-base-content/40 text-[0.65rem]">
							Es gewinnen die K Outcomes mit den höchsten (bzw. niedrigsten) Counter-Werten.
							Der Pot wird parimutuel auf alle Gewinner verteilt.
						</p>
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtCmp" value="gte" />
						<input type="hidden" name="mtN" value="1" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
						<input type="hidden" name="mtPerEntityCmp" value="gte" />
						<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'count_matching'}
						<div class="bg-base-content/5 space-y-2 rounded-lg p-2">
							<div class="text-base-content/50 text-[0.65rem] uppercase tracking-wider">
								Bedingung pro Entity
							</div>
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<label class="block space-y-1">
									<span class="text-base-content/50 text-xs uppercase tracking-wider"
										>Vergleich</span
									>
									<select
										name="mtPerEntityCmp"
										bind:value={t.perEntityCmp}
										class="select select-bordered select-sm w-full"
									>
										<option value="gte">≥ mindestens</option>
										<option value="gt">&gt; mehr als</option>
										<option value="eq">= genau</option>
										<option value="lt">&lt; weniger als</option>
										<option value="lte">≤ höchstens</option>
									</select>
								</label>
								<label class="block space-y-1">
									<span class="text-base-content/50 text-xs uppercase tracking-wider"
										>Anzahl (n)</span
									>
									<input
										type="number"
										name="mtPerEntityN"
										bind:value={t.perEntityN}
										min="0"
										class="input input-bordered input-sm tabular w-full text-center"
									/>
								</label>
							</div>
						</div>
						<div class="bg-base-content/5 space-y-2 rounded-lg p-2">
							<div class="text-base-content/50 text-[0.65rem] uppercase tracking-wider">
								Aggregat (wie viele erfüllen?)
							</div>
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<label class="block space-y-1">
									<span class="text-base-content/50 text-xs uppercase tracking-wider"
										>Vergleich</span
									>
									<select
										name="mtCmp"
										bind:value={t.cmp}
										class="select select-bordered select-sm w-full"
									>
										<option value="gte">≥ mindestens</option>
										<option value="gt">&gt; mehr als</option>
										<option value="eq">= genau</option>
										<option value="lt">&lt; weniger als</option>
										<option value="lte">≤ höchstens</option>
									</select>
								</label>
								<label class="block space-y-1">
									<span class="text-base-content/50 text-xs uppercase tracking-wider"
										>K (Entities)</span
									>
									<input
										type="number"
										name="mtK"
										bind:value={t.k}
										min="0"
										class="input input-bordered input-sm tabular w-full text-center"
									/>
								</label>
							</div>
						</div>
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtN" value="1" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
						<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'team_total'}
						<label class="block space-y-1">
							<span class="text-base-content/50 text-xs uppercase tracking-wider"
								>Team-Mitglieder (Namen kommagetrennt)</span
							>
							<input
								type="text"
								name="mtTeamNames"
								bind:value={t.teamNames}
								placeholder={entities.slice(0, 2).map((e) => e.name).filter(Boolean).join(', ') || 'z.B. Alex, Marco'}
								class="input input-bordered input-sm w-full"
							/>
						</label>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Vergleich</span
								>
								<select
									name="mtCmp"
									bind:value={t.cmp}
									class="select select-bordered select-sm w-full"
								>
									<option value="gte">≥ mindestens</option>
									<option value="gt">&gt; mehr als</option>
									<option value="eq">= genau</option>
									<option value="lt">&lt; weniger als</option>
									<option value="lte">≤ höchstens</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Schwelle n</span
								>
								<input
									type="number"
									name="mtN"
									bind:value={t.n}
									min="0"
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
						</div>
						<p class="text-base-content/40 text-[0.65rem]">
							Summe des Counters über alle Team-Mitglieder wird verglichen.
						</p>
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtEntityA" value="" />
						<input type="hidden" name="mtEntityB" value="" />
						<input type="hidden" name="mtK" value="0" />
						<input type="hidden" name="mtPerEntityCmp" value="gte" />
						<input type="hidden" name="mtPerEntityN" value="1" />
					<input type="hidden" name="mtTeamNames" value="" />
					{:else if t.kind === 'spread'}
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Entity A</span>
								<select
									name="mtEntityA"
									bind:value={t.entityNameA}
									class="select select-bordered select-sm w-full"
								>
									{#each entities as e}
										<option value={e.name}>{e.name || '(unbenannt)'}</option>
									{/each}
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider">Entity B</span>
								<select
									name="mtEntityB"
									bind:value={t.entityNameB}
									class="select select-bordered select-sm w-full"
								>
									{#each entities as e}
										<option value={e.name}>{e.name || '(unbenannt)'}</option>
									{/each}
								</select>
							</label>
						</div>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Vergleich (A−B)</span
								>
								<select
									name="mtCmp"
									bind:value={t.cmp}
									class="select select-bordered select-sm w-full"
								>
									<option value="gte">≥ mindestens</option>
									<option value="gt">&gt; mehr als</option>
									<option value="eq">= genau</option>
									<option value="lt">&lt; weniger als</option>
									<option value="lte">≤ höchstens</option>
								</select>
							</label>
							<label class="block space-y-1">
								<span class="text-base-content/50 text-xs uppercase tracking-wider"
									>Differenz n</span
								>
								<input
									type="number"
									name="mtN"
									bind:value={t.n}
									class="input input-bordered input-sm tabular w-full text-center"
								/>
							</label>
						</div>
						<p class="text-base-content/40 text-[0.65rem]">
							Frage: Ist (A.counter − B.counter) <code>{t.cmp === 'gte' ? '≥' : t.cmp === 'lte' ? '≤' : t.cmp === 'gt' ? '>' : t.cmp === 'lt' ? '<' : '='}</code> {t.n}?
						</p>
						<input type="hidden" name="mtScope" value="each" />
						<input type="hidden" name="mtNMin" value="0" />
						<input type="hidden" name="mtNMax" value="0" />
						<input type="hidden" name="mtDirection" value="max" />
						<input type="hidden" name="mtTieBehavior" value="tie_outcome" />
						<input type="hidden" name="mtK" value="0" />
						<input type="hidden" name="mtPerEntityCmp" value="gte" />
						<input type="hidden" name="mtPerEntityN" value="1" />
						<input type="hidden" name="mtTeamNames" value="" />
					{/if}

					<!-- Live preview -->
					{#if t.trackableId}
						{@const previewLines = describeTemplate(
							{
								kind: t.kind,
								trackableId: t.trackableId,
								entityScope: t.entityScope,
								cmp: t.cmp,
								n: t.n,
								tieBehavior: t.tieBehavior,
								direction: t.direction,
								nMin: t.nMin,
								nMax: t.nMax,
								entityNameA: t.entityNameA,
								entityNameB: t.entityNameB
							} as any,
							{
								trackables: trackables
									.filter((tr) => tr.label.trim())
									.map((tr) => ({ id: trackableIdFor(tr.label), label: tr.label })),
								entityNames: entities.map((e) => e.name).filter((n) => n.trim())
							}
						)}
						<div class="bg-base-content/5 border-base-content/10 rounded-lg border p-2">
							<div class="text-base-content/40 mb-1 text-[0.65rem] uppercase tracking-wider">
								Vorschau
							</div>
							<ul class="text-base-content/80 space-y-0.5 text-xs">
								{#each previewLines as line (line)}
									<li>· {line}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<!-- Economy -->
	<section class="glass glass-xl space-y-3 p-5">
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
	<section class="glass glass-xl space-y-3 p-5">
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
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Drink-Bestätigung
		</h2>
		<div class="grid grid-cols-2 gap-2">
			<label class="glass space-y-1 rounded-lg p-2">
				<span class="text-base-content/50 text-xs">Modus</span>
				<select
					name="confirmationMode"
					value={initial.defaultConfig.confirmationMode}
					class="select select-bordered select-sm w-full"
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
	<section class="glass glass-xl space-y-3 p-5">
		<h2 class="text-base-content/60 text-xs font-medium uppercase tracking-widest">
			Rebuy (Pleite → Trinken → Geld)
		</h2>
		<label class="glass flex items-center justify-between rounded-xl p-3">
			<span class="space-y-1">
				<span class="block text-sm font-medium">Auto-Sperre bei Drink</span>
				<span class="text-base-content/40 block text-xs">
					Sperrt einen Spieler automatisch vom Wetten, solange er einen offenen Drink hat.
					Host kann jederzeit manuell sperren / entsperren.
				</span>
			</span>
			<input
				type="checkbox"
				name="autoLockOnDrink"
				class="toggle toggle-primary"
				checked={initial.defaultConfig.autoLockOnDrink !== false}
			/>
		</label>
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

	<div class="flex gap-2">
		<a href="/modes" class="btn btn-ghost h-14 flex-1 rounded-xl text-base">
			Abbrechen
		</a>
		<button type="submit" class="btn btn-primary glow-primary h-14 flex-1 rounded-xl text-base">
			{submitLabel}
		</button>
	</div>
</form>
