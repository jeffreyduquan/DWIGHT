<!--
	@file s/[id]/round/+page.svelte — round flow (events + markets + bets).
	@implements REQ-UI-004, REQ-ROUND, REQ-EVENT, REQ-MARKET, REQ-BET
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { playSound } from '$lib/client/sounds.svelte';
	import StakePicker from '$lib/components/StakePicker.svelte';
	import DrinkPanel from '$lib/components/DrinkPanel.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { ArrowLeft, ArrowRight, Coins, Crown, Lock, Beer, Trophy, BellRing, Play, CircleCheck, X, RotateCcw, Save, Undo2, BarChart3, Activity, History, Users, Sparkles } from '@lucide/svelte';
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

	const pendingDrinks = $derived(data.drinks.filter((d) => d.status === 'PENDING'));
	const pendingEvents = $derived(data.events.filter((e) => e.status === 'PENDING'));
	const confirmedEvents = $derived(data.events.filter((e) => e.status === 'CONFIRMED'));
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

	function describePredicate(p: any): string {
		return describePredicateLib(p, {
			trackableLabel: (id) => trackableById.get(id)?.label ?? id,
			entityLabel: (id) => (id ? entityById.get(id)?.name ?? '?' : '∑')
		});
	}

	function cmpSymbol(c: string): string {
		return c === 'gte' ? '≥' : c === 'lte' ? '≤' : c === 'gt' ? '>' : c === 'lt' ? '<' : '=';
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

<header class="mb-5 space-y-2">
	<a
		href={`/s/${data.session.id}`}
		class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1 text-sm"
		><ArrowLeft size={14} /> Lobby</a
	>
	<div class="flex items-baseline justify-between gap-3">
		<h1 class="display text-3xl">
			Runde <span class="text-gradient-primary">{round?.roundNumber ?? '—'}</span>
		</h1>
		{#if status}
			<span class="badge badge-sm tracking-wider">{status}</span>
		{/if}
	</div>
</header>

<section
	class="card-stat fade-up mb-4 flex items-center justify-between gap-3 px-5 py-4 {isBetLocked
		? 'border-error/60 ring-error/30 ring-2'
		: ''}"
>
	<div class="flex items-center gap-3">
		<IconBubble tone={isBetLocked ? 'error' : 'primary'} size="lg">
			{#if isBetLocked}<Lock size={22} />{:else}<Coins size={22} />{/if}
		</IconBubble>
		<div>
			<p class="eyebrow">Saldo</p>
			<p class="stat-hero text-3xl">
				<span class="text-gradient-primary">{data.me.moneyBalance}</span>
			</p>
		</div>
	</div>
	<div class="flex flex-col items-end gap-1">
		{#if isBetLocked}
			<span class="badge badge-error gap-1"><Lock size={12} /> GESPERRT</span>
		{/if}
		{#if data.me.role === 'HOST'}
			<span class="badge badge-primary gap-1"><Crown size={12} /> Host</span>
		{/if}
	</div>
</section>

{#if isBetLocked}
	<section
		class="glass glass-xl border-error/60 mb-4 flex items-center gap-4 border-2 p-5 shadow-lg"
		role="alert"
	>
		<IconBubble tone="error" size="lg"><Beer size={22} /></IconBubble>
		<div class="flex-1">
			<p class="text-error text-lg font-bold uppercase tracking-wide">Wetten gesperrt</p>
			<p class="text-base-content/80 text-sm">
				Du musst trinken — in dieser Runde sind keine Wetten möglich. Der Host hebt die Sperre
				auf, sobald dein Drink bestätigt ist.
			</p>
		</div>
	</section>
{/if}

{#if form?.error}
	<div class="alert alert-error mb-4">{form.error}</div>
{/if}

<!-- No round yet -->
{#if !round}
	<div class="glass rounded-2xl p-4 text-center">
		<p class="text-base-content/60 mb-3 text-sm">Noch keine Runde gestartet.</p>
		{#if isHost}
			<form method="POST" action="?/createRound" use:enhance>
				<button class="btn btn-primary">Neue Runde starten</button>
			</form>
		{:else}
			<p class="text-base-content/40 text-xs">Warte bis der Host startet.</p>
		{/if}
	</div>
{:else}
	<!-- Terminal: round just settled / cancelled -->
	{#if isTerminal}
		<section class="glass mb-4 space-y-3 rounded-2xl p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-base-content/50 text-xs uppercase tracking-wider">
						Runde {round.roundNumber} {status === 'SETTLED' ? 'beendet' : 'abgebrochen'}
					</p>
					<p class="text-base-content/70 text-xs">
						{#if status === 'SETTLED' && data.markets.length > 0}
							{data.markets.filter((m) => m.status === 'SETTLED').length} Märkte abgerechnet
						{/if}
					</p>
				</div>
				{#if isHost}
					<form method="POST" action="?/createRound" use:enhance>
						<button class="btn btn-primary glow-primary gap-1">Neue Runde starten <ArrowRight size={16} /></button>
					</form>
				{/if}
			</div>
			{#if !isHost}
				<p class="text-base-content/40 text-center text-xs">Warte bis der Host eine neue Runde startet.</p>
			{/if}
		</section>
	{/if}

	<!-- Host controls -->
	{#if isHost && !isTerminal}
		<section class="glass mb-4 space-y-2 rounded-2xl p-3">
			<h2 class="text-base-content/70 text-xs font-medium uppercase tracking-wider">Host-Aktionen</h2>
			<div class="flex flex-wrap gap-2">
				{#if isOpen}
					<form method="POST" action="?/goLive" use:enhance>
						<input type="hidden" name="roundId" value={round.id} />
						<button class="btn btn-primary glow-primary gap-1">1 · Spiel starten (Wetten zu) <ArrowRight size={16} /></button>
					</form>
				{:else if isLive || isResolving}
					<form method="POST" action="?/settle" use:enhance>
						<input type="hidden" name="roundId" value={round.id} />
						<button class="btn btn-success glow-primary gap-1">2 · Runde abrechnen <CircleCheck size={16} /></button>
					</form>
				{/if}
				<form method="POST" action="?/cancel" use:enhance>
					<input type="hidden" name="roundId" value={round.id} />
					<button class="btn btn-sm btn-error btn-outline">Abbrechen (Refund)</button>
				</form>
			</div>
			<p class="text-base-content/40 text-xs">
				{#if isOpen}Spieler setzen jetzt. Wenn das Spiel/Trinken/Rennen losgeht: „Spiel starten" — danach keine neuen Einsätze.
				{:else if isLive}Wetten gelockt. Trag Ereignisse ein (+1 Buttons) und schließ die Runde mit „Runde abrechnen" ab.
				{:else if isResolving}Abrechnung läuft…{/if}
			</p>
		</section>
	{/if}

	<!-- Drinks panel: verteilen / trinken / abgleichen direkt in der Runde -->
	{#if !isTerminal}
		<details class="glass glass-xl mb-4 p-4" open={isLive || pendingDrinks.length > 0}>
			<summary class="flex cursor-pointer items-center gap-3 text-sm font-medium">
				<IconBubble tone="accent"><Beer size={18} /></IconBubble>
				<span class="flex-1">
					<span class="eyebrow block">Drinks</span>
					<span class="text-base-content/80 text-base">
						{#if pendingDrinks.length > 0}{pendingDrinks.length} offen{:else}Verteilen &amp; abgleichen{/if}
					</span>
				</span>
				{#if pendingDrinks.length > 0}
					<span class="badge badge-warning">{pendingDrinks.length}</span>
				{/if}
				<a
					href={`/s/${data.session.id}/drinks`}
					class="text-base-content/40 hover:text-base-content inline-flex items-center gap-1 text-xs"
					onclick={(e) => e.stopPropagation()}
				>
					Vollansicht <ArrowRight size={12} />
				</a>
			</summary>
			<div class="divider-soft my-3"></div>
			<div>
				<DrinkPanel
					session={data.session}
					me={data.me}
					players={data.players}
					drinks={data.drinks}
					actionPrefix="drink"
					compact
				/>
			</div>
		</details>
	{/if}

	<!-- Event buttons (only during LIVE — bets are locked) -->
	{#if isLive && data.session.trackables.length > 0}
		<section class="glass glass-xl mb-4 space-y-4 p-4">
			<div class="flex items-center gap-3">
				<IconBubble tone="warning"><BellRing size={18} /></IconBubble>
				<div>
					<p class="eyebrow">Ereignis melden</p>
					<p class="text-base-content/60 text-xs">+1 drücken — Host bestätigt</p>
				</div>
			</div>
			<div class="divider-soft"></div>
			{#each data.session.trackables as t (t.id)}
				<div class="space-y-2">
					<p class="text-sm font-medium flex items-center gap-2">
						{#if t.emoji}<span>{t.emoji}</span>{/if}
						<span>{t.label}</span>
						<span class="text-base-content/40 text-xs">({t.scope})</span>
					</p>
					{#if t.scope === 'global'}
						<form method="POST" action="?/proposeEvent" use:enhance class="inline-block">
							<input type="hidden" name="roundId" value={round.id} />
							<input type="hidden" name="trackableId" value={t.id} />
							<input type="hidden" name="entityId" value="null" />
							<button class="btn btn-sm btn-outline gap-1">
								<Sparkles size={14} /> +1
								<span class="text-base-content/40">({counterValue(t.id, null)})</span>
							</button>
						</form>
					{:else}
						<div class="flex flex-wrap gap-1.5">
							{#each data.entities as e (e.id)}
								<form method="POST" action="?/proposeEvent" use:enhance class="inline-block">
									<input type="hidden" name="roundId" value={round.id} />
									<input type="hidden" name="trackableId" value={t.id} />
									<input type="hidden" name="entityId" value={e.id} />
									<button
										class="btn btn-xs btn-outline gap-1"
										style="border-color: {(e.attributes as any)?.color ?? undefined}"
									>
										{e.name} +1
										<span class="opacity-50">({counterValue(t.id, e.id)})</span>
									</button>
								</form>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	<!-- Pending event queue (host) -->
	{#if isHost && pendingEvents.length > 0}
		<section class="glass glass-xl mb-4 space-y-3 p-4">
			<div class="flex items-center gap-3">
				<IconBubble tone="warning"><Users size={18} /></IconBubble>
				<div class="flex-1">
					<p class="eyebrow">Buffer prüfen</p>
					<p class="text-base-content/80 text-base font-semibold">{pendingEvents.length} offen</p>
				</div>
				<span class="badge badge-warning">{pendingEvents.length}</span>
			</div>
			<p class="text-base-content/50 text-xs">
				Pro Reporter gruppiert. Settle ist gesperrt, solange offene Meldungen existieren.
			</p>
			{#each pendingByProposer as group (group.userId)}
				<details class="bg-base-100/40 rounded-xl">
					<summary class="flex cursor-pointer items-center justify-between gap-2 p-2 text-sm">
						<span class="flex items-center gap-2">
							<span class="badge badge-sm badge-neutral">{group.events.length}</span>
							<span class="font-medium">{group.name}</span>
						</span>
						<span class="flex items-center gap-1" onclick={(e) => e.stopPropagation()} role="group">
							<form method="POST" action="?/bulkDecideByProposer" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<input type="hidden" name="proposerUserId" value={group.userId} />
								<input type="hidden" name="decision" value="CONFIRMED" />
								<button class="btn btn-xs btn-success gap-1" title="Alle akzeptieren"
									><CircleCheck size={12} /> Alle</button
								>
							</form>
							<form method="POST" action="?/bulkDecideByProposer" use:enhance>
								<input type="hidden" name="roundId" value={round.id} />
								<input type="hidden" name="proposerUserId" value={group.userId} />
								<input type="hidden" name="decision" value="CANCELLED" />
								<button class="btn btn-xs btn-error btn-outline gap-1" title="Alle ablehnen">
									<X size={12} /> Alle
								</button>
							</form>
						</span>
					</summary>
					<div class="divider-soft"></div>
					<div class="space-y-2 p-2">
						{#each group.events as ev (ev.id)}
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-sm">
									<span class="font-medium">
										{trackableById.get(ev.trackableId)?.label ?? ev.trackableId}
									</span>
									{#if ev.entityId}
										→ {entityById.get(ev.entityId)?.name}
									{/if}
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
											class="input input-xs w-16"
											title="Wert anpassen"
										/>
										<button class="btn btn-xs btn-ghost" type="submit" title="Wert speichern">
											<Save size={12} />
										</button>
									</form>
									<form method="POST" action="?/confirmEvent" use:enhance>
										<input type="hidden" name="eventId" value={ev.id} />
										<button class="btn btn-xs btn-success" title="Akzeptieren"
											><CircleCheck size={12} /></button
										>
									</form>
									<form method="POST" action="?/cancelEvent" use:enhance>
										<input type="hidden" name="eventId" value={ev.id} />
										<button class="btn btn-xs btn-error btn-outline" title="Ablehnen"
											><X size={12} /></button
										>
									</form>
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/each}
		</section>
	{/if}

	<!-- Own pending events (non-host player view) -->
	{#if !isHost && myPendingEvents.length > 0}
		<section class="glass glass-xl mb-4 space-y-3 p-4">
			<div class="flex items-center gap-3">
				<IconBubble tone="info"><Activity size={18} /></IconBubble>
				<div>
					<p class="eyebrow">Deine Meldungen</p>
					<p class="text-base-content/60 text-xs">Warten auf GM-Freigabe</p>
				</div>
				<span class="badge badge-info ml-auto">{myPendingEvents.length}</span>
			</div>
			<div class="divider-soft"></div>
			{#each myPendingEvents as ev (ev.id)}
				<div class="flex items-center justify-between gap-2">
					<span class="text-sm">
						<span class="font-medium">
							{trackableById.get(ev.trackableId)?.label ?? ev.trackableId}
						</span>
						{#if ev.entityId}
							→ {entityById.get(ev.entityId)?.name}
						{/if}
						<span class="text-base-content/40 text-xs">±{ev.delta}</span>
					</span>
					<form method="POST" action="?/undoOwnEvent" use:enhance>
						<input type="hidden" name="eventId" value={ev.id} />
						<button class="btn btn-xs btn-warning btn-outline gap-1" title="Rückgängig">
							<Undo2 size={12} /> Rückgängig
						</button>
					</form>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Markets list -->
	<section class="space-y-3 {isBetLocked ? 'opacity-60 grayscale' : ''}">
		<div class="flex items-center gap-3 px-1">
			<IconBubble tone="primary" size="sm"><BarChart3 size={16} /></IconBubble>
			<div class="flex-1">
				<p class="eyebrow">Märkte</p>
				<p class="text-base-content/80 text-sm">{data.markets.length} aktiv</p>
			</div>
		</div>
		{#if data.markets.length === 0}
			<div class="glass glass-xl p-5 text-center text-sm opacity-70">
				Noch keine Märkte. {isHost
					? 'Definiere Wetten-Templates im Mode, damit sie bei Rundenstart automatisch entstehen.'
					: 'Der GM hat noch keine Märkte für diese Runde.'}
			</div>
		{/if}
		{#each data.markets as m (m.id)}
			{@const myTotalOnMarket = m.outcomes.reduce((s, o) => s + o.myStake, 0)}
			{@const myTotalPayout = m.outcomes.reduce((s, o) => s + o.myPayout, 0)}
			{@const myProfit = myTotalPayout - myTotalOnMarket}
			<article class="glass glass-xl overflow-hidden">
				<!-- Header -->
				<header class="border-base-content/5 flex items-start justify-between gap-2 border-b px-4 pt-3 pb-2">
					<div>
						<p class="text-base-content/40 text-[0.6rem] uppercase tracking-widest">Wette</p>
						<h3 class="text-base font-semibold leading-tight">{m.title}</h3>
						{#if m.description}
							<p class="text-base-content/50 mt-0.5 text-xs">{m.description}</p>
						{/if}
					</div>
					<span
						class="badge badge-sm shrink-0 {m.status === 'OPEN'
							? 'badge-primary'
							: m.status === 'LOCKED'
								? 'badge-warning'
								: m.status === 'SETTLED'
									? 'badge-success'
									: 'badge-ghost'}">{m.status}</span>
				</header>

				<!-- Pool hero -->
				<div class="flex items-end justify-between gap-3 px-4 py-3">
					<div>
						<p class="text-base-content/40 text-[0.6rem] uppercase tracking-widest">Pool</p>
						<p class="text-gradient-primary tabular text-3xl font-extrabold leading-none">
							{m.poolTotal}
						</p>
					</div>
					{#if myTotalOnMarket > 0}
						<div class="text-right">
							<p class="text-base-content/40 text-[0.6rem] uppercase tracking-widest">Dein Einsatz</p>
							<p class="tabular text-xl font-bold leading-none">{myTotalOnMarket}</p>
						</div>
					{/if}
					{#if m.status === 'SETTLED' && myTotalOnMarket > 0}
						<div class="text-right">
							<p class="text-base-content/40 text-[0.6rem] uppercase tracking-widest">Ergebnis</p>
							<p
								class="tabular text-xl font-extrabold leading-none {myProfit > 0
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

				<!-- Outcomes -->
				<ul class="space-y-2 px-3 pb-3">
					{#each m.outcomes as o (o.id)}
						{@const potentialPayout =
							m.status === 'OPEN' && o.myStake > 0 && o.stakeTotal > 0
								? Math.floor((o.myStake * m.poolTotal) / o.stakeTotal)
								: 0}
						{@const odds = o.stakeTotal > 0 && m.poolTotal > 0 ? m.poolTotal / o.stakeTotal : null}
						{@const refStake = data.session.config.minStake}
						{@const projectedOdds =
							m.status === 'OPEN'
								? (m.poolTotal + refStake) / (o.stakeTotal + refStake)
								: odds}
						{@const pct = m.poolTotal > 0 ? Math.round((o.stakeTotal / m.poolTotal) * 100) : 0}
						<li
							class="rounded-xl border-2 p-3 transition {o.isWinner
								? 'border-success bg-success/10'
								: m.status === 'SETTLED'
									? 'border-base-content/10 opacity-60'
									: o.myStake > 0
										? 'border-primary/60 bg-primary/5'
										: 'border-base-content/10 hover:border-base-content/20'}"
						>
							<!-- Outcome top row -->
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<strong class="text-base">{o.label}</strong>
										{#if m.status === 'OPEN' && o.currentTruth}
											<span class="badge badge-xs badge-success gap-1"><CircleCheck size={10} /> aktuell</span>
										{:else if m.status === 'SETTLED' && o.isWinner}
											<span class="badge badge-xs badge-success">Gewinner</span>
										{/if}
									</div>
									<p class="text-base-content/50 mt-0.5 text-xs leading-snug">
										<span class="text-base-content/40">Ziel:</span>
										{describePredicate(o.predicate)}
									</p>
								</div>

								<!-- Quote prominent -->
								<div class="shrink-0 text-right">
									{#if projectedOdds != null && m.status === 'OPEN'}
										<p class="text-gradient-primary tabular text-2xl font-bold leading-none">
											{projectedOdds.toFixed(2)}<span class="text-sm">x</span>
										</p>
										<p class="text-base-content/40 text-[0.65rem] leading-tight">
											{#if o.stakeTotal === 0}neue Wette · {refStake} → {Math.floor(refStake * projectedOdds)}
											{:else}Quote · Pool {o.stakeTotal} ({pct}%){/if}
										</p>
									{:else if odds != null}
										<p class="text-gradient-primary tabular text-2xl font-bold leading-none">
											{odds.toFixed(2)}<span class="text-sm">x</span>
										</p>
										<p class="text-base-content/40 text-[0.65rem] leading-tight">
											final · Pool {o.stakeTotal} ({pct}%)
										</p>
									{:else}
										<p class="text-base-content/40 text-xs italic">—</p>
									{/if}
								</div>
							</div>

							<!-- Action / status row -->
							{#if m.status === 'OPEN' && !isTerminal}
								{#if o.myStake > 0}
									<div class="border-primary/20 bg-primary/5 text-primary mt-3 flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs">
										<span>Du: <strong class="tabular">{o.myStake}</strong></span>
										{#if potentialPayout > 0}
											{@const profit = potentialPayout - o.myStake}
											<span class="text-success font-semibold">
												{profit > 0 ? `+${profit}` : '±0'} bei Sieg
											</span>
										{/if}
									</div>
								{/if}
								{#if isBetLocked}
									<div class="bg-error/15 border-error/40 text-error mt-2 flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center text-xs font-semibold">
									<Lock size={12} /> gesperrt
									</div>
								{:else}
									<details class="mt-2 group">
									<summary
										class="btn btn-sm btn-primary w-full list-none {o.myStake > 0 ? 'btn-outline' : ''}"
									>
										<span class="group-open:hidden">{o.myStake > 0 ? 'Mehr setzen' : 'Auf ' + o.label + ' wetten'} ▾</span>
										<span class="hidden group-open:inline">Zuklappen ▴</span>
									</summary>
									<form method="POST" action="?/placeBet" use:enhance class="mt-2">
										<input type="hidden" name="outcomeId" value={o.id} />
										<StakePicker
											min={data.session.config.minStake}
											max={data.me.moneyBalance}
											potentialProfit={projectedOdds
												? Math.floor(data.session.config.minStake * projectedOdds) -
													data.session.config.minStake
												: null}
										/>
									</form>
								</details>
								{/if}
							{:else if m.status === 'SETTLED'}
								{#if o.myStake > 0}
									{@const profit = o.myPayout - o.myStake}
									<div
										class="mt-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs {profit >
										0
											? 'bg-success/10 text-success'
											: profit < 0
												? 'bg-error/10 text-error'
												: 'bg-base-content/5 text-base-content/60'}"
									>
										<span>Dein Einsatz: <strong class="tabular">{o.myStake}</strong></span>
										<span class="font-bold">
											{#if profit > 0}+{profit} Gewinn
											{:else if profit === 0 && o.myPayout > 0}Einsatz zurück
											{:else}-{o.myStake} verloren{/if}
										</span>
									</div>
								{/if}
							{:else if m.status === 'VOID'}
								<div class="text-warning mt-2 rounded-lg bg-warning/10 px-2 py-1.5 text-xs">
									VOID — Refund {#if o.myStake > 0}({o.myStake} zurück){/if}
								</div>
							{:else if m.status === 'LOCKED' && o.myStake > 0}
								<div class="text-base-content/60 bg-base-content/5 mt-2 rounded-lg px-2 py-1.5 text-xs">
									Wetten gelockt · Du: <strong class="tabular">{o.myStake}</strong>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</article>
		{/each}
		{#if data.markets.length === 0}
			<p class="text-base-content/40 text-center text-xs">Noch keine Märkte.</p>
		{/if}
	</section>

	<!-- Confirmed events recap -->
	{#if confirmedEvents.length > 0}
		<section class="mt-6 space-y-2">
			<div class="flex items-center gap-3 px-1">
				<IconBubble tone="info" size="sm"><Activity size={16} /></IconBubble>
				<p class="eyebrow">Counter</p>
			</div>
			<ul class="glass glass-xl space-y-1.5 p-4 text-sm">
				{#each Object.entries(data.counters) as [key, v] (key)}
					{@const parts = key.split(':')}
					{@const tId = parts[0]}
					{@const eId = parts[1] ?? null}
					<li class="flex justify-between">
						<span>
							{trackableById.get(tId)?.label ?? tId}
							{#if eId}
								→ {entityById.get(eId)?.name}
							{/if}
						</span>
						<span class="tabular font-semibold">{v}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	<!-- Round history -->
	{#if data.roundHistory.length > 0}
		<section class="mt-6 space-y-2">
			<div class="flex items-center gap-3 px-1">
				<IconBubble tone="neutral" size="sm"><History size={16} /></IconBubble>
				<div class="flex-1">
					<p class="eyebrow">Runden-Historie</p>
					<p class="text-base-content/60 text-xs">{data.roundHistory.length} Runden</p>
				</div>
			</div>
			<ul class="glass glass-xl space-y-1.5 p-4 text-sm">
				{#each [...data.roundHistory].reverse() as h (h.id)}
					<li
						class="flex items-center justify-between gap-2 {h.id === round?.id
							? 'text-primary font-medium'
							: 'text-base-content/70'}"
					>
						<span class="flex items-center gap-2">
							<span class="tabular text-xs">#{h.roundNumber}</span>
							<span class="badge badge-xs badge-ghost">{h.status}</span>
						</span>
						<span class="text-base-content/40 tabular text-xs">
							{h.markets} M · Pool {h.totalPool}
						</span>
					</li>
				{/each}
			</ul>
			<a
				href={`/s/${data.session.id}/stats`}
				class="text-primary inline-flex items-center justify-center gap-1 text-center text-xs hover:underline w-full"
			>
				Detaillierte Stats <ArrowRight size={12} />
			</a>
		</section>
	{/if}
{/if}

<div class="h-12"></div>
