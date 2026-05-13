<!--
	@file s/[id]/round/+page.svelte — round flow (events + markets + bets).
	@implements REQ-UI-004, REQ-ROUND, REQ-EVENT, REQ-MARKET, REQ-BET

	Player-first redesign:
	  - SessionTopBar + BottomDock come from /s/[id]/+layout.svelte
	  - Body focus: status, markets (primary), events (collapsible per trackable)
	  - Host controls live in a single "GM" disclosure block
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { playSound } from '$lib/client/sounds.svelte';
	import {
		ArrowRight,
		Lock,
		Trophy,
		CircleCheck,
		X,
		Save,
		Undo2,
		BarChart3,
		Crown,
		Plus,
		ChevronDown,
		Sparkles,
		Activity
	} from '@lucide/svelte';
	import { describePredicate as describePredicateLib } from '$lib/predicate-describe';

	let { data, form } = $props();

	const isHost = $derived(data.me.role === 'HOST');
	const isBetLocked = $derived(data.me.betLocked);
	const round = $derived(data.round);
	const status = $derived(round?.status ?? null);
	const isOpen = $derived(status === 'BETTING_OPEN');
	const isLive = $derived(status === 'LIVE');
	const isResolving = $derived(status === 'RESOLVING');
	const isTerminal = $derived(status === 'SETTLED' || status === 'CANCELLED');

	const pendingEvents = $derived(data.events.filter((e) => e.status === 'PENDING'));
	const myPendingEvents = $derived(
		pendingEvents.filter((e) => e.proposedByUserId === data.me.userId)
	);

	type PendingEvent = (typeof pendingEvents)[number];
	const pendingByProposer = $derived(
		(() => {
			const m = new Map<string, { userId: string; name: string; events: PendingEvent[] }>();
			for (const ev of pendingEvents) {
				const key = ev.proposedByUserId;
				if (!m.has(key))
					m.set(key, { userId: ev.proposedByUserId, name: ev.proposedBy, events: [] });
				m.get(key)!.events.push(ev);
			}
			return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
		})()
	);

	const trackableById = $derived(new Map(data.session.trackables.map((t) => [t.id, t])));
	const entityById = $derived(new Map(data.entities.map((e) => [e.id, e])));

	function counterValue(trackableId: string, entityId: string | null): number {
		const key = entityId == null ? trackableId : `${trackableId}:${entityId}`;
		return data.counters[key] ?? 0;
	}

	function describePredicate(p: unknown): string {
		return describePredicateLib(p as never, {
			trackableLabel: (id) => trackableById.get(id)?.label ?? id,
			entityLabel: (id) => (id ? (entityById.get(id)?.name ?? '?') : '∑')
		});
	}

	// Group markets by status for visual ordering: OPEN first, then LOCKED, then SETTLED, VOID
	const orderedMarkets = $derived(
		[...data.markets].sort((a, b) => {
			const order = { OPEN: 0, LOCKED: 1, SETTLED: 2, VOID: 3 } as const;
			return (
				(order[a.status as keyof typeof order] ?? 9) -
				(order[b.status as keyof typeof order] ?? 9)
			);
		})
	);

	const statusLabel: Record<string, string> = {
		SETUP: 'Vorbereitung',
		BETTING_OPEN: 'Wetten offen',
		LIVE: 'läuft',
		RESOLVING: 'rechnet ab',
		SETTLED: 'beendet',
		CANCELLED: 'abgebrochen'
	};
	const statusTone: Record<string, string> = {
		SETUP: 'badge-ghost',
		BETTING_OPEN: 'badge-primary',
		LIVE: 'badge-accent',
		RESOLVING: 'badge-warning',
		SETTLED: 'badge-success',
		CANCELLED: 'badge-ghost'
	};

	let es: EventSource | null = null;
	onMount(() => {
		es = new EventSource(`/s/${data.session.id}/stream`);
		const h = () => invalidateAll();
		const sound = (s: Parameters<typeof playSound>[0]) => () => {
			playSound(s);
			invalidateAll();
		};
		es.addEventListener('round_live', sound('live'));
		es.addEventListener('bet_placed', sound('bet'));
		es.addEventListener('drink_confirmed', sound('drink'));
		es.addEventListener('round_settled', sound('win'));
		[
			'round_opened',
			'round_cancelled',
			'round_event_proposed',
			'round_event_confirmed',
			'round_event_cancelled',
			'round_event_undone',
			'round_event_edited',
			'market_created',
			'market_locked',
			'market_settled',
			'market_metrics_updated',
			'balance_updated',
			'drink_initiated',
			'drink_cancelled'
		].forEach((e) => es!.addEventListener(e, h));
	});
	onDestroy(() => es?.close());
</script>

<!-- Round status strip -->
<section class="mb-4 flex items-center justify-between gap-2">
	<div class="flex items-baseline gap-2">
		<h2 class="display text-xl leading-none">
			Runde <span class="text-gradient-primary">#{round?.roundNumber ?? '—'}</span>
		</h2>
		{#if status}
			<span class="badge badge-sm {statusTone[status] ?? 'badge-ghost'}"
				>{statusLabel[status] ?? status}</span
			>
		{/if}
	</div>
</section>

{#if isBetLocked}
	<div class="alert alert-error mb-3 py-2 text-sm">
		<Lock size={14} />
		<span>Wetten gesperrt — bestätige deinen offenen Drink.</span>
	</div>
{/if}

{#if form?.error}
	<div class="alert alert-error mb-3 py-2 text-xs">{form.error}</div>
{/if}

<!-- No round yet -->
{#if !round}
	<div class="glass rounded-2xl p-6 text-center">
		<p class="text-base-content/65 mb-4 text-sm">Noch keine Runde gestartet.</p>
		{#if isHost}
			<form method="POST" action="?/createRound" use:enhance>
				<button class="btn btn-primary glow-primary h-12 w-full gap-2">
					<Plus size={16} /> Neue Runde starten
				</button>
			</form>
		{:else}
			<p class="text-base-content/40 text-xs">Warte, bis der Host startet.</p>
		{/if}
	</div>
{:else}
	<!-- Terminal banner -->
	{#if isTerminal}
		<section class="glass mb-4 rounded-2xl p-4">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-base-content/50 text-[0.65rem] uppercase tracking-wider">
						Runde {round.roundNumber} {status === 'SETTLED' ? 'beendet' : 'abgebrochen'}
					</p>
					{#if status === 'SETTLED'}
						<p class="text-base-content/70 text-xs">
							{data.markets.filter((m) => m.status === 'SETTLED').length} Märkte abgerechnet
						</p>
					{/if}
				</div>
				{#if isHost}
					<form method="POST" action="?/createRound" use:enhance>
						<button class="btn btn-primary btn-sm glow-primary gap-1">
							Neue Runde <ArrowRight size={14} />
						</button>
					</form>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Markets — primary content -->
	<section class="space-y-3 {isBetLocked ? 'opacity-60' : ''}">
		<div class="flex items-center justify-between px-1">
			<p class="eyebrow">Wetten</p>
			<p class="text-base-content/45 text-[0.7rem]">{data.markets.length} aktiv</p>
		</div>

		{#if data.markets.length === 0}
			<div class="border-base-content/10 rounded-2xl border border-dashed p-5 text-center text-sm opacity-70">
				{isHost
					? 'Definiere Wetten-Templates im Mode, damit sie automatisch entstehen.'
					: 'Der Host hat noch keine Märkte erstellt.'}
			</div>
		{/if}

		{#each orderedMarkets as m (m.id)}
			{@const myTotalOnMarket = m.outcomes.reduce((s, o) => s + o.myStake, 0)}
			{@const myTotalPayout = m.outcomes.reduce((s, o) => s + o.myPayout, 0)}
			{@const myProfit = myTotalPayout - myTotalOnMarket}
			<article class="glass overflow-hidden rounded-2xl">
				<header class="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
					<h3 class="text-sm font-semibold leading-tight">{m.title}</h3>
					<span
						class="badge badge-xs shrink-0 {m.status === 'OPEN'
							? 'badge-primary'
							: m.status === 'LOCKED'
								? 'badge-warning'
								: m.status === 'SETTLED'
									? 'badge-success'
									: 'badge-ghost'}">{m.status}</span
					>
				</header>

				<div class="flex items-end justify-between gap-3 px-4 pb-2 text-xs">
					<div>
						<p class="text-base-content/40 text-[0.6rem] uppercase tracking-wider">Pool</p>
						<p class="text-gradient-primary tabular text-2xl font-bold leading-none">
							{m.poolTotal}
						</p>
					</div>
					{#if myTotalOnMarket > 0}
						<div class="text-right">
							<p class="text-base-content/40 text-[0.6rem] uppercase tracking-wider">Du</p>
							<p class="tabular text-base font-semibold leading-none">{myTotalOnMarket}</p>
						</div>
					{/if}
					{#if m.status === 'SETTLED' && myTotalOnMarket > 0}
						<div class="text-right">
							<p class="text-base-content/40 text-[0.6rem] uppercase tracking-wider">Ergebnis</p>
							<p
								class="tabular text-base font-bold leading-none {myProfit > 0
									? 'text-success'
									: myProfit < 0
										? 'text-error'
										: 'text-base-content/60'}"
							>
								{myProfit >= 0 ? '+' : ''}{myProfit}
							</p>
						</div>
					{/if}
				</div>

				<ul class="space-y-1.5 px-3 pb-3">
					{#each m.outcomes as o (o.id)}
						{@const odds = o.stakeTotal > 0 && m.poolTotal > 0 ? m.poolTotal / o.stakeTotal : null}
						{@const refStake = data.session.config.minStake}
						{@const projectedOdds =
							m.status === 'OPEN'
								? (m.poolTotal + refStake) / (o.stakeTotal + refStake)
								: odds}
						{@const pct = m.poolTotal > 0 ? Math.round((o.stakeTotal / m.poolTotal) * 100) : 0}
						{@const showOdds = data.session.config.showOdds !== false}
						<li
							class="rounded-xl border p-2.5 transition {o.isWinner
								? 'border-success bg-success/10'
								: m.status === 'SETTLED'
									? 'border-base-content/10 opacity-60'
									: o.myStake > 0
										? 'border-primary/60 bg-primary/5'
										: 'border-base-content/10'}"
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<strong class="text-sm">{o.label}</strong>
										{#if m.status === 'OPEN' && o.currentTruth}
											<span class="badge badge-xs badge-success">aktuell</span>
										{:else if m.status === 'SETTLED' && o.isWinner}
											<span class="badge badge-xs badge-success">Gewinner</span>
										{/if}
									</div>
									<p class="text-base-content/50 mt-0.5 text-[0.7rem] leading-snug">
										{describePredicate(o.predicate)}
									</p>
								</div>
								<div class="shrink-0 text-right">
									{#if showOdds && projectedOdds != null}
										<p class="text-gradient-primary tabular text-lg font-bold leading-none">
											{projectedOdds.toFixed(2)}<span class="text-xs">×</span>
										</p>
										<p class="text-base-content/40 text-[0.6rem]">{pct}%</p>
									{:else if showOdds}
										<p class="text-base-content/40 text-xs italic">—</p>
									{/if}
								</div>
							</div>

							{#if m.status === 'OPEN' && !isTerminal}
								{#if o.myStake > 0}
									<p class="text-primary mt-2 text-[0.7rem]">
										Du: <strong class="tabular">{o.myStake}</strong>
									</p>
								{/if}
								{#if !isBetLocked}
									{@const minS = data.session.config.minStake}
									{@const bal = data.me.moneyBalance}
									{@const roundDown = (v: number) => Math.max(minS, Math.floor(v / minS) * minS)}
									{@const chips = bal >= minS
										? [...new Set([minS, roundDown(bal * 0.25), roundDown(bal * 0.5), bal])]
												.filter((v) => v >= minS && v <= bal)
												.sort((a, b) => a - b)
										: []}
									{#if chips.length === 0}
										<p class="text-warning mt-2 text-[0.7rem]">Zu wenig Geld für Mindesteinsatz.</p>
									{:else}
										<form
											method="POST"
											action="?/placeBet"
											use:enhance
											class="mt-2 flex gap-1"
										>
											<input type="hidden" name="outcomeId" value={o.id} />
											{#each chips as s (s)}
												<button
													type="submit"
													name="stake"
													value={s}
													class="btn btn-sm btn-primary tabular flex-1 px-1 font-semibold"
												>
													{s === bal ? 'All-in' : `+${s}`}
												</button>
											{/each}
										</form>
									{/if}
								{/if}
							{:else if m.status === 'SETTLED' && o.myStake > 0}
								{@const profit = o.myPayout - o.myStake}
								<p
									class="mt-1.5 text-[0.7rem] {profit > 0
										? 'text-success'
										: profit < 0
											? 'text-error'
											: 'text-base-content/60'}"
								>
									{profit > 0 ? `+${profit}` : profit === 0 ? '±0' : profit}
								</p>
							{:else if m.status === 'LOCKED' && o.myStake > 0}
								<p class="text-base-content/55 mt-1.5 text-[0.7rem]">
									gelockt · Du: <strong class="tabular">{o.myStake}</strong>
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			</article>
		{/each}
	</section>

	<!-- Events: only during LIVE — collapsed per trackable -->
	{#if isLive && data.session.trackables.length > 0}
		<section class="mt-5 space-y-2">
			<div class="flex items-center justify-between px-1">
				<p class="eyebrow">Ereignisse melden</p>
				<p class="text-base-content/45 text-[0.7rem]">+1 = Host bestätigt</p>
			</div>
			{#each data.session.trackables as t (t.id)}
				<details class="glass rounded-2xl">
					<summary class="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm">
						{#if t.emoji}<span>{t.emoji}</span>{/if}
						<span class="flex-1 font-medium">{t.label}</span>
						<span class="text-base-content/40 text-[0.65rem] uppercase tracking-wider"
							>{t.scope === 'global' ? 'global' : 'pro Entität'}</span
						>
						<ChevronDown size={14} class="text-base-content/40 transition-transform group-open:rotate-180" />
					</summary>
					<div class="border-base-content/10 border-t p-3">
						{#if t.scope === 'global'}
							<form method="POST" action="?/proposeEvent" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<input type="hidden" name="trackableId" value={t.id} />
								<input type="hidden" name="entityId" value="null" />
								<button class="btn btn-sm btn-outline w-full gap-1">
									<Sparkles size={14} /> +1
									<span class="text-base-content/40">({counterValue(t.id, null)})</span>
								</button>
							</form>
						{:else}
							<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
								{#each data.entities as e (e.id)}
									<form method="POST" action="?/proposeEvent" use:enhance>
										<input type="hidden" name="roundId" value={round.id} />
										<input type="hidden" name="trackableId" value={t.id} />
										<input type="hidden" name="entityId" value={e.id} />
										<button
											class="btn btn-sm btn-outline w-full justify-between gap-1 px-2"
											style="border-color: {(e.attributes as { color?: string })?.color ?? undefined}"
										>
											<span class="truncate">{e.name}</span>
											<span class="text-base-content/40 tabular text-[0.65rem]"
												>+1 ({counterValue(t.id, e.id)})</span
											>
										</button>
									</form>
								{/each}
							</div>
						{/if}
					</div>
				</details>
			{/each}
		</section>
	{/if}

	<!-- Own pending events feedback (non-host) -->
	{#if !isHost && myPendingEvents.length > 0}
		<section class="glass mt-4 space-y-2 rounded-2xl p-3">
			<div class="flex items-center justify-between">
				<p class="eyebrow">Deine Meldungen</p>
				<span class="badge badge-info badge-sm">{myPendingEvents.length}</span>
			</div>
			{#each myPendingEvents as ev (ev.id)}
				<div class="flex items-center justify-between gap-2 text-xs">
					<span>
						{trackableById.get(ev.trackableId)?.label ?? ev.trackableId}
						{#if ev.entityId}→ {entityById.get(ev.entityId)?.name}{/if}
						<span class="text-base-content/40">±{ev.delta}</span>
					</span>
					<form method="POST" action="?/undoOwnEvent" use:enhance>
						<input type="hidden" name="eventId" value={ev.id} />
						<button class="btn btn-xs btn-ghost gap-1">
							<Undo2 size={11} /> Rückgängig
						</button>
					</form>
				</div>
			{/each}
		</section>
	{/if}

	<!-- HOST: GM disclosure (status step + pending queue + cancel) -->
	{#if isHost && !isTerminal}
		<section class="glass mt-5 overflow-hidden rounded-2xl">
			<details open class="group">
				<summary class="flex cursor-pointer items-center gap-2 p-3 text-sm">
					<Crown size={16} class="text-primary" />
					<span class="font-semibold">GM-Werkzeuge</span>
					{#if pendingEvents.length > 0}
						<span class="badge badge-warning badge-sm ml-auto">
							{pendingEvents.length} offen
						</span>
					{:else}
						<ChevronDown size={14} class="text-base-content/40 ml-auto transition-transform group-open:rotate-180" />
					{/if}
				</summary>

				<div class="border-base-content/10 space-y-3 border-t p-3">
					<!-- Lifecycle step -->
					<div class="flex flex-wrap items-center gap-2">
						{#if isOpen}
							<form method="POST" action="?/goLive" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<button class="btn btn-sm btn-primary glow-primary gap-1">
									Spiel starten <ArrowRight size={14} />
								</button>
							</form>
						{:else if isLive || isResolving}
							<form method="POST" action="?/settle" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<button class="btn btn-sm btn-success glow-primary gap-1">
									Abrechnen <CircleCheck size={14} />
								</button>
							</form>
						{/if}
						<form method="POST" action="?/cancel" use:enhance>
							<input type="hidden" name="roundId" value={round.id} />
							<button class="btn btn-xs btn-error btn-outline">Abbrechen</button>
						</form>
					</div>
					<p class="text-base-content/50 text-[0.7rem]">
						{#if isOpen}Spieler setzen. Nach „Spiel starten" sind keine neuen Wetten mehr möglich.
						{:else if isLive}Wetten gelockt. Buffer prüfen, dann „Abrechnen".
						{:else if isResolving}Abrechnung läuft …{/if}
					</p>

					<!-- Pending event queue -->
					{#if pendingEvents.length > 0}
						<div class="border-base-content/10 space-y-2 border-t pt-3">
							<p class="eyebrow flex items-center gap-2">
								<Activity size={12} /> Buffer prüfen ({pendingEvents.length})
							</p>
							{#each pendingByProposer as group (group.userId)}
								<details class="bg-base-100/40 rounded-xl">
									<summary
										class="flex cursor-pointer items-center justify-between gap-2 p-2 text-xs"
									>
										<span class="flex items-center gap-2">
											<span class="badge badge-xs badge-neutral">{group.events.length}</span>
											<span class="font-medium">{group.name}</span>
										</span>
										<span
											class="flex items-center gap-1"
											onclick={(e) => e.stopPropagation()}
											role="group"
										>
											<form method="POST" action="?/bulkDecideByProposer" use:enhance>
												<input type="hidden" name="roundId" value={round.id} />
												<input type="hidden" name="proposerUserId" value={group.userId} />
												<input type="hidden" name="decision" value="CONFIRMED" />
												<button class="btn btn-xs btn-success" title="Alle akzeptieren">
													<CircleCheck size={11} />
												</button>
											</form>
											<form method="POST" action="?/bulkDecideByProposer" use:enhance>
												<input type="hidden" name="roundId" value={round.id} />
												<input type="hidden" name="proposerUserId" value={group.userId} />
												<input type="hidden" name="decision" value="CANCELLED" />
												<button class="btn btn-xs btn-error btn-outline" title="Alle ablehnen">
													<X size={11} />
												</button>
											</form>
										</span>
									</summary>
									<div class="border-base-content/10 space-y-1.5 border-t p-2">
										{#each group.events as ev (ev.id)}
											<div class="flex flex-wrap items-center justify-between gap-2">
												<span class="text-xs">
													<span class="font-medium">
														{trackableById.get(ev.trackableId)?.label ?? ev.trackableId}
													</span>
													{#if ev.entityId}→ {entityById.get(ev.entityId)?.name}{/if}
												</span>
												<div class="flex items-center gap-1">
													<form
														method="POST"
														action="?/editEventDelta"
														use:enhance
														class="flex items-center gap-1"
													>
														<input type="hidden" name="eventId" value={ev.id} />
														<input
															type="number"
															name="delta"
															value={ev.delta}
															step="1"
															class="input input-xs w-14"
															title="Wert"
														/>
														<button
															class="btn btn-xs btn-ghost"
															type="submit"
															title="Speichern"
														>
															<Save size={11} />
														</button>
													</form>
													<form method="POST" action="?/confirmEvent" use:enhance>
														<input type="hidden" name="eventId" value={ev.id} />
														<button class="btn btn-xs btn-success" title="OK">
															<CircleCheck size={11} />
														</button>
													</form>
													<form method="POST" action="?/cancelEvent" use:enhance>
														<input type="hidden" name="eventId" value={ev.id} />
														<button class="btn btn-xs btn-error btn-outline" title="Nein">
															<X size={11} />
														</button>
													</form>
												</div>
											</div>
										{/each}
									</div>
								</details>
							{/each}
						</div>
					{/if}

					<!-- Counter recap (host quick-view) -->
					{#if Object.keys(data.counters).length > 0}
						<div class="border-base-content/10 space-y-1 border-t pt-3">
							<p class="eyebrow flex items-center gap-2">
								<BarChart3 size={12} /> Counter
							</p>
							<ul class="space-y-0.5 text-[0.7rem]">
								{#each Object.entries(data.counters) as [key, v] (key)}
									{@const parts = key.split(':')}
									{@const tId = parts[0]}
									{@const eId = parts[1] ?? null}
									<li class="flex justify-between">
										<span>
											{trackableById.get(tId)?.label ?? tId}
											{#if eId}→ {entityById.get(eId)?.name}{/if}
										</span>
										<span class="tabular font-semibold">{v}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</details>
		</section>
	{/if}
{/if}
