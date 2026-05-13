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
		Save,
		Undo2,
		Crown,
		ChevronDown,
		Sparkles,
		Activity,
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

	const orderedMarkets = $derived(
		[...data.markets].sort((a, b) => {
			const order = { OPEN: 0, LOCKED: 1, SETTLED: 2, VOID: 3 } as const;
			return (
				(order[a.status as keyof typeof order] ?? 9) -
				(order[b.status as keyof typeof order] ?? 9)
			);
		})
	);

	// Stake selector state per market — null = "nichts gewählt".
	const stakeSelections = $state<Record<string, number | null>>({});

	const startingMoney = $derived(data.session.config.startingMoney ?? 1000);
	const minStake = $derived(data.session.config.minStake ?? 1);
	const showOdds = $derived(data.session.config.showOdds !== false);

	function stakeOptions(): number[] {
		const raw = [
			Math.max(minStake, Math.round(startingMoney * 0.02)),
			Math.max(minStake, Math.round(startingMoney * 0.05)),
			Math.max(minStake, Math.round(startingMoney * 0.25))
		];
		return [...new Set(raw)].sort((a, b) => a - b);
	}
	const stakes = $derived(stakeOptions());

	function pickStake(marketId: string, value: number) {
		stakeSelections[marketId] = value;
	}
	function resetStake(marketId: string) {
		stakeSelections[marketId] = null;
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
				{isHost
					? 'Definiere Wetten-Templates im Mode, damit sie automatisch entstehen.'
					: 'Der Host hat noch keine Wetten erstellt.'}
			</div>
		{/if}

		{#each orderedMarkets as m (m.id)}
			{@const myTotalOnMarket = m.outcomes.reduce((s, o) => s + o.myStake, 0)}
			{@const myTotalPayout = m.outcomes.reduce((s, o) => s + o.myPayout, 0)}
			{@const myProfit = myTotalPayout - myTotalOnMarket}
			{@const selectedStake = stakeSelections[m.id] ?? null}
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
					<div class="px-3 pb-2">
						<div class="stake-row">
							<span class="stake-label">Einsatz</span>
							{#each stakes as s (s)}
								<button
									type="button"
									class="stake-chip {selectedStake === s ? 'stake-chip-active' : ''}"
									disabled={s > data.me.moneyBalance}
									onclick={() => pickStake(m.id, s)}
								>
									{s}
								</button>
							{/each}
							<button
								type="button"
								class="stake-chip stake-reset"
								disabled={selectedStake === null}
								onclick={() => resetStake(m.id)}
								aria-label="Zurücksetzen"
							>
								<RotateCcw size={12} />
							</button>
						</div>
					</div>
				{/if}

				<ul class="space-y-1.5 px-3 pb-3">
					{#each m.outcomes as o (o.id)}
						{@const odds = o.stakeTotal > 0 && m.poolTotal > 0 ? m.poolTotal / o.stakeTotal : null}
						{@const refStake = selectedStake ?? minStake}
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
									use:enhance
									class="mt-2 flex items-center gap-2"
								>
									<input type="hidden" name="outcomeId" value={o.id} />
									<input type="hidden" name="stake" value={selectedStake ?? 0} />
									<button
										type="submit"
										class="btn btn-sm btn-primary flex-1 font-semibold"
										disabled={selectedStake === null || selectedStake > data.me.moneyBalance}
									>
										{selectedStake ? `Setzen · ${selectedStake}` : 'Einsatz wählen'}
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
				<form method="POST" action="?/settle" use:enhance>
					<input type="hidden" name="roundId" value={round.id} />
					<button class="btn btn-success h-12 w-full gap-2 text-base font-semibold">
						<CircleCheck size={16} /> Abrechnen
					</button>
				</form>
			{/if}

			{#if pendingEvents.length > 0 || isLive || isOpen}
				<details class="glass overflow-hidden rounded-2xl group">
					<summary class="flex cursor-pointer items-center gap-2 p-3 text-sm">
						<Crown size={14} class="text-primary" />
						<span class="font-medium">GM</span>
						{#if pendingEvents.length > 0}
							<span class="badge badge-warning badge-sm ml-auto">
								{pendingEvents.length} prüfen
							</span>
						{:else}
							<ChevronDown size={14} class="text-base-content/40 ml-auto transition-transform group-open:rotate-180" />
						{/if}
					</summary>
					<div class="border-base-content/10 space-y-3 border-t p-3">
						<form method="POST" action="?/cancel" use:enhance>
							<input type="hidden" name="roundId" value={round.id} />
							<button class="btn btn-xs btn-error btn-outline w-full">Abbrechen</button>
						</form>

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
					</div>
				</details>
			{/if}
		</section>
	{/if}
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
	.stake-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.stake-label {
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: oklch(50% 0.006 90);
		margin-right: 0.2rem;
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
	.stake-chip-active {
		background-color: oklch(93% 0.012 148);
		color: oklch(38% 0.05 148);
		box-shadow:
			inset 1.5px 1.5px 3px oklch(40% 0.05 148 / 0.18),
			inset -1.5px -1.5px 3px oklch(100% 0 0 / 0.78);
	}
	.stake-reset {
		color: oklch(48% 0.10 28);
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
