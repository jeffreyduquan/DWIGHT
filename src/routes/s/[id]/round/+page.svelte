<!--
	@file s/[id]/round/+page.svelte — Wetten (player-first betting view).
	@implements REQ-UI-004, REQ-UI-010, REQ-UI-012, REQ-ROUND, REQ-MARKET, REQ-BET

	Layout:
	  - SessionTopBar + BottomDock from /s/[id]/+layout.svelte (balance prominent there)
	  - No round number, no session name, no status text
	  - Markets as primary tiles with bold title + outcome rows
	  - Shared stake selector per market: 2% / 5% / 25% of startingMoney + Reset
	  - Each outcome has a "Setzen" button submitting the selected stake
	  - Host: single "Starten" button when SETUP/BETTING_OPEN, "Abrechnen" when LIVE
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { playSound } from '$lib/client/sounds.svelte';
	import {
		Lock,
		CircleCheck,
		X,
		Undo2,
		ChevronDown,
		Sparkles,
		Play,
		RotateCcw
	} from '@lucide/svelte';

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

	const trackableById = $derived(new Map(data.session.trackables.map((t) => [t.id, t])));
	const entityById = $derived(new Map(data.entities.map((e) => [e.id, e])));

	function counterValue(trackableId: string, entityId: string | null): number {
		const key = entityId == null ? trackableId : `${trackableId}:${entityId}`;
		return data.counters[key] ?? 0;
	}

	/**
	 * Phase 11 ghost-counter: per (trackable, entity) bucket, count
	 * pending proposals grouped by proposer, then surface
	 *   - myCount: how many *I* have proposed in this bucket
	 *   - othersAvg: rounded average across the other distinct proposers
	 * so the player sees their own progress vs. the crowd at a glance.
	 */
	const proposalStats = $derived(
		(() => {
			const buckets = new Map<string, Map<string, number>>(); // bucket → proposerId → count
			for (const ev of pendingEvents) {
				const key = `${ev.trackableId}:${ev.entityId ?? 'null'}`;
				let inner = buckets.get(key);
				if (!inner) {
					inner = new Map();
					buckets.set(key, inner);
				}
				inner.set(ev.proposedByUserId, (inner.get(ev.proposedByUserId) ?? 0) + 1);
			}
			const out = new Map<string, { mine: number; othersAvg: number; othersCount: number }>();
			for (const [key, inner] of buckets) {
				const mine = inner.get(data.me.userId) ?? 0;
				const others = Array.from(inner.entries())
					.filter(([uid]) => uid !== data.me.userId)
					.map(([, n]) => n);
				const othersAvg =
					others.length === 0 ? 0 : Math.round(others.reduce((a, b) => a + b, 0) / others.length);
				out.set(key, { mine, othersAvg, othersCount: others.length });
			}
			return out;
		})()
	);

	function proposalKey(trackableId: string, entityId: string | null): string {
		return `${trackableId}:${entityId ?? 'null'}`;
	}

	const orderedMarkets = $derived(
		[...data.markets].sort((a, b) => {
			const order = { OPEN: 0, LOCKED: 1, SETTLED: 2, VOID: 3 } as const;
			return (
				(order[a.status as keyof typeof order] ?? 9) -
				(order[b.status as keyof typeof order] ?? 9)
			);
		})
	);

	// Stake accumulator per market — each chip tap adds its value to a running
	// total. "Setzen" submits the accumulated amount. Reset zeros it.
	const stakeTotals = $state<Record<string, number>>({});

	// Phase 12 ghost-workflow settle modal.
	let showSettleModal = $state(false);
	const settleChoices = $state<Record<string, 'mine' | 'others'>>({});

	type SettleBucket = {
		key: string;
		trackableLabel: string;
		entityName: string | null;
		mineCount: number;
		othersCount: number;
		othersAvg: number;
		auto: 'mine' | 'others' | null;
	};

	const settleBuckets = $derived(
		(() => {
			const buckets = new Map<string, { trackableId: string; entityId: string | null; mine: number; others: Map<string, number> }>();
			for (const ev of pendingEvents) {
				const key = `${ev.trackableId}__${ev.entityId ?? 'null'}`;
				let b = buckets.get(key);
				if (!b) {
					b = { trackableId: ev.trackableId, entityId: ev.entityId, mine: 0, others: new Map() };
					buckets.set(key, b);
				}
				if (ev.proposedByUserId === data.me.userId) b.mine += 1;
				else b.others.set(ev.proposedByUserId, (b.others.get(ev.proposedByUserId) ?? 0) + 1);
			}
			const out: SettleBucket[] = [];
			for (const [key, b] of buckets) {
				const othersTotal = Array.from(b.others.values()).reduce((s, n) => s + n, 0);
				const othersAvg = b.others.size === 0 ? 0 : Math.round(othersTotal / b.others.size);
				let auto: 'mine' | 'others' | null = null;
				if (b.mine > 0 && b.others.size === 0) auto = 'mine';
				else if (b.others.size > 0 && b.mine === 0) auto = 'others';
				out.push({
					key,
					trackableLabel: trackableById.get(b.trackableId)?.label ?? b.trackableId,
					entityName: b.entityId ? (entityById.get(b.entityId)?.name ?? null) : null,
					mineCount: b.mine,
					othersCount: b.others.size,
					othersAvg,
					auto
				});
			}
			return out.sort((a, b) => a.trackableLabel.localeCompare(b.trackableLabel));
		})()
	);

	const ambiguousBuckets = $derived(settleBuckets.filter((b) => b.auto === null));
	const allChoicesMade = $derived(
		ambiguousBuckets.every((b) => settleChoices[b.key] === 'mine' || settleChoices[b.key] === 'others')
	);

	function openSettle() {
		showSettleModal = true;
	}
	function closeSettle() {
		showSettleModal = false;
	}

	const startingMoney = $derived(data.session.config.startingMoney ?? 2000);
	const minStake = $derived(data.session.config.minStake ?? 1);
	const showOdds = $derived(data.session.config.showOdds !== false);
	const maxStakePct = $derived(data.session.config.maxStakePctOfStart ?? 100);
	const maxStakeAbs = $derived(Math.floor((startingMoney * maxStakePct) / 100));
	const maxStakeAllowed = $derived(Math.min(maxStakeAbs, data.me.moneyBalance));

	function setStake(marketId: string, value: number) {
		const v = Math.max(0, Math.min(maxStakeAllowed, Math.floor(value)));
		stakeTotals[marketId] = v;
	}
	function resetStake(marketId: string) {
		stakeTotals[marketId] = 0;
	}

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
			'drink_cancelled'
		].forEach((e) => es!.addEventListener(e, h));
	});
	onDestroy(() => es?.close());
</script>

{#if isBetLocked}
	<div class="alert alert-error mb-3 py-2 text-sm">
		<Lock size={14} />
		<span>Wetten gesperrt — bestätige deinen offenen Drink.</span>
	</div>
{/if}

{#if form?.error}
	<div class="alert alert-error mb-3 py-2 text-xs">{form.error}</div>
{/if}

{#if !round}
	<div class="glass rounded-2xl p-6 text-center">
		<p class="text-base-content/65 mb-4 text-sm">Keine offene Wette.</p>
		{#if isHost}
			<form method="POST" action="?/createRound" use:enhance>
				<button class="btn btn-primary h-12 w-full gap-2 text-base font-semibold">
					<Play size={16} /> Starten
				</button>
			</form>
		{:else}
			<p class="text-base-content/45 text-xs">Warte, bis der Host startet.</p>
		{/if}
	</div>
{:else}
	{#if isTerminal}
		<section class="glass mb-4 rounded-2xl p-4">
			<div class="flex items-center justify-between gap-3">
				<p class="text-base-content/65 text-sm">
					{status === 'SETTLED' ? 'Wette abgerechnet.' : 'Wette abgebrochen.'}
				</p>
				{#if isHost}
					<form method="POST" action="?/createRound" use:enhance>
						<button class="btn btn-primary btn-sm gap-1">
							<Play size={14} /> Starten
						</button>
					</form>
				{/if}
			</div>
		</section>
	{/if}

	<section class="space-y-3 {isBetLocked ? 'opacity-60' : ''}">
		{#if data.markets.length === 0}
			<div class="border-base-content/10 rounded-2xl border border-dashed p-5 text-center text-sm opacity-70">
				{#if isHost}
					{#if data.session.hasBetGraphsSnapshot}
						<p>Bet-Graphs sind eingefroren, aber für diese Runde wurde noch nichts gespawnt.</p>
						<form method="POST" action="?/syncBetGraphs" use:enhance class="mt-3">
							<button type="submit" class="btn btn-sm btn-primary rounded-full">Bet-Graphs neu laden + spawnen</button>
						</form>
					{:else}
						<p>Diese Session hat noch keine Bet-Graphs.</p>
						<a href="/modes/{data.session.modeId}/graphs" class="link link-primary mt-2 inline-block">→ Bet-Graphs anlegen</a>
						<form method="POST" action="?/syncBetGraphs" use:enhance class="mt-3">
							<button type="submit" class="btn btn-sm btn-ghost rounded-full">Danach hier: Snapshot aktualisieren</button>
						</form>
					{/if}
				{:else}
					Der Host hat noch keine Wetten erstellt.
				{/if}
			</div>
		{/if}

		{#each orderedMarkets as m (m.id)}
			{@const myTotalOnMarket = m.outcomes.reduce((s, o) => s + o.myStake, 0)}
			{@const myTotalPayout = m.outcomes.reduce((s, o) => s + o.myPayout, 0)}
			{@const myProfit = myTotalPayout - myTotalOnMarket}
			{@const stakeTotal = stakeTotals[m.id] ?? 0}
			{@const canBet = m.status === 'OPEN' && !isTerminal && !isBetLocked}
			<article class="market-card">
				<header class="px-4 pt-3.5 pb-2">
					<h3 class="market-title">{m.title}</h3>
				</header>

				<div class="flex items-end justify-between gap-3 px-4 pb-2 text-xs">
					<div>
						<p class="text-base-content/40 text-[0.6rem] uppercase tracking-wider">Pool</p>
						<p class="tabular text-2xl font-bold leading-none" style="color: oklch(45% 0.05 148);">
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

				{#if canBet}
					<div class="space-y-2 px-3 pb-2">
						<div class="flex items-center gap-2">
							<input
								type="number"
								class="input input-bordered input-sm tabular stake-number w-24 text-center"
								min="0"
								max={maxStakeAllowed}
								value={stakeTotal}
								oninput={(e) => setStake(m.id, Number((e.target as HTMLInputElement).value))}
							/>
							<input
								type="range"
								class="range range-xs range-primary flex-1"
								min="0"
								max={maxStakeAllowed}
								step={Math.max(1, Math.round(startingMoney / 100))}
								value={stakeTotal}
								oninput={(e) => setStake(m.id, Number((e.target as HTMLInputElement).value))}
							/>
							<button
								type="button"
								class="stake-chip stake-reset"
								disabled={stakeTotal === 0}
								onclick={() => resetStake(m.id)}
								aria-label="Zurücksetzen"
							>
								<RotateCcw size={12} />
							</button>
						</div>
						<p class="text-base-content/40 text-[0.6rem] tracking-wide">
							Max {maxStakeAllowed} ({maxStakePct}% vom Startgeld, max. Guthaben)
						</p>
					</div>
				{/if}

				<ul class="space-y-1.5 px-3 pb-3">
					{#each m.outcomes as o (o.id)}
						{@const odds = o.stakeTotal > 0 && m.poolTotal > 0 ? m.poolTotal / o.stakeTotal : null}
						{@const refStake = stakeTotal > 0 ? stakeTotal : minStake}
						{@const projectedOdds =
							m.status === 'OPEN'
								? (m.poolTotal + refStake) / (o.stakeTotal + refStake)
								: odds}
						{@const pct = m.poolTotal > 0 ? Math.round((o.stakeTotal / m.poolTotal) * 100) : 0}
						<li
							class="outcome-row {o.isWinner
								? 'outcome-winner'
								: m.status === 'SETTLED'
									? 'outcome-faded'
									: o.myStake > 0
										? 'outcome-mine'
										: ''}"
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<strong class="outcome-label">{o.label}</strong>
										{#if m.status === 'SETTLED' && o.isWinner}
											<span class="badge badge-xs badge-success">Gewinner</span>
										{/if}
									</div>
								</div>
								<div class="shrink-0 text-right">
									{#if showOdds && projectedOdds != null}
										<p class="tabular text-base font-bold leading-none" style="color: oklch(48% 0.05 148);">
											{projectedOdds.toFixed(2)}<span class="text-[0.65rem]">×</span>
										</p>
										<p class="text-base-content/40 text-[0.6rem]">{pct}%</p>
									{/if}
								</div>
							</div>

							{#if canBet}
								<form
									method="POST"
									action="?/placeBet"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											stakeTotals[m.id] = 0;
										};
									}}
									class="mt-2 flex items-center gap-2"
								>
									<input type="hidden" name="outcomeId" value={o.id} />
									<input type="hidden" name="stake" value={stakeTotal} />
									<button
										type="submit"
										class="btn btn-sm btn-primary flex-1 font-semibold"
										disabled={stakeTotal < minStake || stakeTotal > maxStakeAllowed}
									>
										{stakeTotal > 0 ? `Setzen · ${stakeTotal}` : 'Einsatz wählen'}
									</button>
									{#if o.myStake > 0}
										<span class="tabular text-[0.7rem] font-semibold text-primary">
											+{o.myStake}
										</span>
									{/if}
								</form>
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
							{@const ps = proposalStats.get(proposalKey(t.id, null))}
							<form method="POST" action="?/proposeEvent" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<input type="hidden" name="trackableId" value={t.id} />
								<input type="hidden" name="entityId" value="null" />
								<button class="btn btn-sm btn-outline w-full justify-between gap-1">
									<span class="flex items-center gap-1">
										<Sparkles size={14} /> +1
										<span class="text-base-content/40">({counterValue(t.id, null)})</span>
									</span>
									{#if ps && (ps.mine > 0 || ps.othersCount > 0)}
										<span class="flex items-center gap-1 text-[0.65rem] tabular">
											<span class="text-primary font-semibold">{ps.mine}</span>
											{#if ps.othersCount > 0}
												<span class="text-base-content/30">·</span>
												<span class="text-base-content/35" title="Ø der anderen Spieler"
													>Ø{ps.othersAvg}</span
												>
											{/if}
										</span>
									{/if}
								</button>
							</form>
						{:else}
							<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
								{#each data.entities as e (e.id)}
									{@const ps = proposalStats.get(proposalKey(t.id, e.id))}
									<form method="POST" action="?/proposeEvent" use:enhance>
										<input type="hidden" name="roundId" value={round.id} />
										<input type="hidden" name="trackableId" value={t.id} />
										<input type="hidden" name="entityId" value={e.id} />
										<button
											class="btn btn-sm btn-outline w-full justify-between gap-1 px-2"
											style="border-color: {(e.attributes as { color?: string })?.color ?? undefined}"
										>
											<span class="truncate">{e.name}</span>
											<span class="flex items-center gap-1 tabular text-[0.65rem]">
												<span class="text-base-content/40">+1 ({counterValue(t.id, e.id)})</span>
												{#if ps && (ps.mine > 0 || ps.othersCount > 0)}
													<span class="text-primary font-semibold">{ps.mine}</span>
													{#if ps.othersCount > 0}
														<span class="text-base-content/35" title="Ø der anderen Spieler"
															>Ø{ps.othersAvg}</span
														>
													{/if}
												{/if}
											</span>
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

	{#if isHost && !isTerminal}
		<section class="mt-5 space-y-2">
			{#if isOpen}
				<form method="POST" action="?/goLive" use:enhance>
					<input type="hidden" name="roundId" value={round.id} />
					<button class="btn btn-primary h-12 w-full gap-2 text-base font-semibold">
						<Play size={16} /> Starten
					</button>
				</form>
			{:else if isLive || isResolving}
				<button
					type="button"
					class="btn btn-success h-12 w-full gap-2 text-base font-semibold"
					onclick={openSettle}
				>
					<CircleCheck size={16} /> Ergebnisse anzeigen
				</button>
			{/if}

			<form method="POST" action="?/cancel" use:enhance>
				<input type="hidden" name="roundId" value={round.id} />
				<button class="btn btn-sm btn-error btn-outline w-full gap-1">
					<X size={12} /> Runde abbrechen
				</button>
			</form>
		</section>
	{/if}
{/if}

{#if isHost && showSettleModal && round}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center"
		role="dialog"
		aria-modal="true"
	>
		<div class="glass glass-xl w-full max-w-md space-y-4 rounded-2xl p-5">
			<header class="flex items-center justify-between">
				<div>
					<p class="eyebrow">Ergebnisse bestätigen</p>
					<h2 class="display text-xl">Werte wählen</h2>
				</div>
				<button type="button" class="btn btn-ghost btn-sm" onclick={closeSettle} aria-label="Schließen">
					<X size={16} />
				</button>
			</header>

			{#if settleBuckets.length === 0}
				<p class="text-base-content/55 text-sm">
					Keine Spieler-Meldungen vorhanden — direkt abrechnen?
				</p>
			{:else}
				<div class="space-y-3">
					{#each settleBuckets as b (b.key)}
						<div class="glass rounded-xl p-3">
							<div class="mb-2 text-sm font-medium">
								{b.trackableLabel}
								{#if b.entityName}
									<span class="text-base-content/50">→ {b.entityName}</span>
								{/if}
							</div>
							{#if b.auto === 'mine'}
								<p class="text-base-content/60 text-xs">
									Nur GM-Werte ({b.mineCount}) — wird übernommen.
								</p>
							{:else if b.auto === 'others'}
								<p class="text-base-content/60 text-xs">
									Nur Ghost-Werte (Ø {b.othersAvg}, {b.othersCount} Spieler) — wird übernommen.
								</p>
							{:else}
								<div class="grid grid-cols-2 gap-2">
									<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs"
										class:ring-2={settleChoices[b.key] === 'mine'}>
										<input
											type="radio"
											name="choice_{b.key}"
											value="mine"
											bind:group={settleChoices[b.key]}
											class="radio radio-xs radio-primary"
										/>
										<span class="flex-1">
											<span class="block font-medium">GM: {b.mineCount}</span>
											<span class="text-base-content/50 block">eigene Werte</span>
										</span>
									</label>
									<label class="glass flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs"
										class:ring-2={settleChoices[b.key] === 'others'}>
										<input
											type="radio"
											name="choice_{b.key}"
											value="others"
											bind:group={settleChoices[b.key]}
											class="radio radio-xs radio-primary"
										/>
										<span class="flex-1">
											<span class="block font-medium">Ghost: Ø {b.othersAvg}</span>
											<span class="text-base-content/50 block">{b.othersCount} Spieler</span>
										</span>
									</label>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<form
				method="POST"
				action="?/decideAndSettle"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showSettleModal = false;
					};
				}}
				class="space-y-2"
			>
				<input type="hidden" name="roundId" value={round.id} />
				{#each ambiguousBuckets as b (b.key)}
					{#if settleChoices[b.key]}
						<input type="hidden" name="choice__{b.key}" value={settleChoices[b.key]} />
					{/if}
				{/each}
				<button
					type="submit"
					class="btn btn-success h-12 w-full gap-2 text-sm font-semibold"
					disabled={!allChoicesMade}
				>
					<CircleCheck size={16} /> Abrechnen
				</button>
				<button type="button" class="btn btn-ghost h-10 w-full text-xs" onclick={closeSettle}>
					Abbrechen
				</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.market-card {
		background-color: oklch(96% 0.006 90);
		border: 1px solid oklch(89% 0.004 90 / 0.6);
		border-radius: 1.25rem;
		box-shadow:
			-3px -3px 7px oklch(100% 0 0 / 0.78),
			4px 4px 10px oklch(40% 0.01 80 / 0.13);
		overflow: hidden;
	}
	.market-title {
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.2;
		color: oklch(22% 0 0);
		letter-spacing: -0.01em;
	}
	.stake-chip {
		min-width: 2.6rem;
		height: 1.9rem;
		padding: 0 0.65rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		background-color: oklch(96% 0.006 90);
		color: oklch(30% 0.006 90);
		border: 1px solid oklch(88% 0.004 90 / 0.55);
		box-shadow:
			-1.5px -1.5px 3.5px oklch(100% 0 0 / 0.72),
			2px 2px 5px oklch(40% 0.01 80 / 0.10);
		transition: all 140ms ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}
	.stake-chip:disabled {
		opacity: 0.38;
		box-shadow: none;
	}
	.stake-chip:not(:disabled):active {
		background-color: oklch(93% 0.012 148);
		color: oklch(38% 0.05 148);
		box-shadow:
			inset 1.5px 1.5px 3px oklch(40% 0.05 148 / 0.18),
			inset -1.5px -1.5px 3px oklch(100% 0 0 / 0.78);
	}
	.stake-reset {
		color: oklch(48% 0.10 28);
	}
	.stake-number {
		text-align: center;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.stake-number::-webkit-inner-spin-button,
	.stake-number::-webkit-outer-spin-button {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
	}
	.outcome-row {
		padding: 0.65rem 0.75rem;
		border-radius: 0.9rem;
		background-color: oklch(97% 0.004 90);
		border: 1px solid oklch(90% 0.004 90 / 0.5);
	}
	.outcome-mine {
		background-color: oklch(94% 0.012 148);
		border-color: oklch(80% 0.04 148 / 0.55);
	}
	.outcome-winner {
		background-color: oklch(93% 0.05 148);
		border-color: oklch(70% 0.08 148 / 0.7);
	}
	.outcome-faded {
		opacity: 0.6;
	}
	.outcome-label {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.005em;
		color: oklch(22% 0 0);
	}
</style>
