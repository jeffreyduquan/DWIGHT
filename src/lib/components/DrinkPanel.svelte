<!--
  @component DrinkPanel — drink consumption / cashout / force / pending confirmations UI.
  Reusable; embedded in /s/[id]/drinks (full page) and /s/[id]/round (collapsible section).

  Props:
   - session: { id, config }
   - me: { userId, role, moneyBalance }
   - players: { userId, username, role, moneyBalance }[]
   - drinks: array of drink DTOs (see drinks/+page.server.ts load())
   - actionPrefix: string — e.g. '' → '?/self', '?/force' etc.;
                            'drink' → '?/drinkSelf', '?/drinkForce' etc.
   - compact: boolean — if true, hides the History tab and uses tighter spacing.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, AlertCircle, Hourglass } from '@lucide/svelte';
	import {
		effectiveLockMode,
		effectiveLockTimerSeconds,
		timerSecondsRemaining
	} from '$lib/drinks/lock';

	type DrinkType = 'SCHLUCK' | 'KURZER' | 'BIER_EXEN';
	type DrinkDto = {
		id: string;
		targetUserId: string;
		targetName: string;
		attackerUserId: string | null;
		attackerName: string | null;
		drinkType: DrinkType;
		origin: 'SELF' | 'FORCE';
		status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
		priceSnapshot: number;
		rebuyAmount: number | null;
		createdAt: string | Date;
		confirmations: { userId: string; username: string; role: 'GM' | 'PEER' }[];
	};

	type Props = {
		session: {
			id: string;
			config: {
				confirmationMode: 'GM' | 'PEERS' | 'EITHER';
				peerConfirmationsRequired?: number;
				drinkPrices: Record<DrinkType, number>;
				rebuy: { enabled: boolean; drinkType: DrinkType; amount: number };
				forceDrinkTypesAllowed: readonly DrinkType[] | DrinkType[];
				lockMode?: 'TIMER_LOCK' | 'LOCK' | 'NONE';
				lockTimerSeconds?: number;
				autoLockOnDrink?: boolean;
			};
		};
		me: { userId: string; role: 'HOST' | 'PLAYER'; moneyBalance: number };
		players: { userId: string; username: string; role: 'HOST' | 'PLAYER'; moneyBalance: number }[];
		drinks: DrinkDto[];
		actionPrefix?: string;
		compact?: boolean;
	};

	let {
		session,
		me,
		players,
		drinks,
		actionPrefix = '',
		compact = false
	}: Props = $props();

	function aname(suffix: string): string {
		if (!actionPrefix) return `?/${suffix}`;
		return `?/${actionPrefix}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
	}

	type Tab = 'self' | 'force' | 'pending' | 'history';
	let tab = $state<Tab>('pending');

	const drinkTypes: DrinkType[] = ['SCHLUCK', 'KURZER', 'BIER_EXEN'];
	const drinkLabel: Record<DrinkType, string> = {
		SCHLUCK: 'Schluck',
		KURZER: 'Kurzer',
		BIER_EXEN: 'Bier exen'
	};

	const myPending = $derived(
		drinks.filter((d) => d.status === 'PENDING' && d.targetUserId === me.userId)
	);
	const allPending = $derived(drinks.filter((d) => d.status === 'PENDING'));
	const peersPending = $derived(
		drinks.filter((d) => d.status === 'PENDING' && d.targetUserId !== me.userId)
	);
	const history = $derived(drinks.filter((d) => d.status !== 'PENDING'));

	const canConfirmOthers = $derived(
		session.config.confirmationMode !== 'GM' || me.role === 'HOST'
	);
	const canConfirmSelf = $derived(
		session.config.confirmationMode === 'GM' && me.role === 'HOST'
	);
	const rebuyAvailable = $derived(session.config.rebuy.enabled && me.moneyBalance <= 0);
	const allowedForceTypes = $derived(session.config.forceDrinkTypesAllowed);

	// Confirmation progress descriptor for a drink.
	function confirmProgress(d: DrinkDto) {
		const gmCount = d.confirmations.filter((c) => c.role === 'GM').length;
		const peerCount = d.confirmations.filter((c) => c.role === 'PEER').length;
		const peerReq = session.config.peerConfirmationsRequired ?? 1;
		const mode = session.config.confirmationMode;
		let finished = false;
		let primary = '';
		let effective = peerCount + gmCount;
		if (mode === 'GM') {
			finished = gmCount >= 1;
			primary = `GM ${Math.min(gmCount, 1)}/1`;
		} else {
			// PEERS (and legacy EITHER): GM confirmations count as peer.
			finished = effective >= peerReq;
			primary = `Bestätigt ${Math.min(effective, peerReq)}/${peerReq}`;
		}
		return { gmCount, peerCount, effective, peerReq, mode, finished, primary };
	}

	// Lock-timer ticker for the player's own pending drinks.
	let nowMs = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (nowMs = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const myPendingCreatedAts = $derived(
		drinks.filter((d) => d.status === 'PENDING' && d.targetUserId === me.userId).map((d) => d.createdAt)
	);
	const myTimerSeconds = $derived(
		timerSecondsRemaining(session.config, myPendingCreatedAts, new Date(nowMs))
	);
	const myLockMode = $derived(effectiveLockMode(session.config));
	function fmtTimer(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${String(sec).padStart(2, '0')}`;
	}

	let force_target = $state(players.find((p) => p.userId !== me.userId)?.userId ?? '');
	let force_type = $state<DrinkType>('SCHLUCK');
	let self_type = $state<DrinkType>('SCHLUCK');
</script>

<nav class="glass {compact ? 'mb-2' : 'mb-4'} grid grid-cols-4 gap-1 rounded-2xl p-1">
	<button class="btn btn-xs sm:btn-sm gap-1 px-1 sm:px-3" class:btn-primary={tab === 'pending'} onclick={() => (tab = 'pending')}>
		<span class="truncate">Offen</span>
		{#if allPending.length}<span class="badge badge-xs">{allPending.length}</span>{/if}
	</button>
	<button class="btn btn-xs sm:btn-sm px-1 sm:px-3" class:btn-primary={tab === 'self'} onclick={() => (tab = 'self')}>Trinken</button>
	<button class="btn btn-xs sm:btn-sm px-1 sm:px-3" class:btn-primary={tab === 'force'} onclick={() => (tab = 'force')}>Verteilen</button>
	<button class="btn btn-xs sm:btn-sm px-1 sm:px-3" class:btn-primary={tab === 'history'} onclick={() => (tab = 'history')}>Verlauf</button>
</nav>

{#if tab === 'self'}
	<section class="glass space-y-3 rounded-2xl p-3">
		<h3 class="text-base-content/70 text-xs font-medium uppercase tracking-wider">
			Buy-In: selber trinken → Geld bekommen
		</h3>
		<form method="POST" action={aname('self')} use:enhance class="space-y-2">
			<select bind:value={self_type} name="drinkType" class="select select-bordered select-sm w-full">
				{#each drinkTypes as t}
					<option value={t}>{drinkLabel[t]} (+{session.config.drinkPrices[t]})</option>
				{/each}
			</select>
			{#if rebuyAvailable && session.config.rebuy.drinkType === self_type}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" name="rebuy" value="1" class="checkbox checkbox-sm" checked />
					Rebuy (+{session.config.rebuy.amount} extra)
				</label>
			{/if}
			<button class="btn btn-sm btn-primary w-full">Trinke {drinkLabel[self_type]}</button>
			<p class="text-base-content/40 text-xs">Wird PENDING; Gutschrift bei Bestätigung.</p>
		</form>
	</section>
{:else if tab === 'force'}
	<section class="glass space-y-3 rounded-2xl p-3">
		<h3 class="text-base-content/70 text-xs font-medium uppercase tracking-wider">
			Verteilen: andere trinken lassen
		</h3>
		<form method="POST" action={aname('force')} use:enhance class="space-y-2">
			<select bind:value={force_target} name="targetUserId" class="select select-bordered select-sm w-full" required>
				{#each players.filter((p) => p.userId !== me.userId) as p (p.userId)}
					<option value={p.userId}>{p.username}</option>
				{/each}
			</select>
			<select bind:value={force_type} name="drinkType" class="select select-bordered select-sm w-full">
				{#each allowedForceTypes as t}
					<option value={t}>
						{drinkLabel[t as DrinkType]} (kostet {session.config.drinkPrices[t as DrinkType]})
					</option>
				{/each}
			</select>
			<button class="btn btn-sm btn-warning w-full" disabled={me.moneyBalance < (session.config.drinkPrices[force_type] ?? 0)}>
				Verteilen
			</button>
			<p class="text-base-content/40 text-xs">Geld wird sofort abgezogen; bei Cancel zurückerstattet.</p>
		</form>
	</section>
{:else if tab === 'pending'}
	<section class="space-y-3">
		{#if myPending.length}
			<div class="drink-mine rounded-2xl p-3">
				<header class="mb-2 flex items-center justify-between">
					<h4 class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warning">
						<AlertCircle size={14} /> Du musst trinken ({myPending.length})
					</h4>
					{#if myTimerSeconds != null && myTimerSeconds > 0}
						<span class="badge badge-warning gap-1 text-[10px] font-bold">
							<Hourglass size={10} /> {fmtTimer(myTimerSeconds)}
						</span>
					{:else if myTimerSeconds === 0 && myLockMode === 'TIMER_LOCK'}
						<span class="badge badge-error text-[10px] font-bold">Wett-Sperre aktiv</span>
					{/if}
				</header>
				<ul class="max-h-80 space-y-2 overflow-y-auto pr-1">
					{#each myPending as d (d.id)}
						{@const p = confirmProgress(d)}
						<li class="glass rounded-xl p-3">
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-sm">
									<strong>{drinkLabel[d.drinkType]}</strong>
									{#if d.origin === 'FORCE'}
										<span class="badge badge-warning badge-sm ml-1">Erzwungen von {d.attackerName}</span>
									{:else}
										<span class="badge badge-info badge-sm ml-1">Eigen</span>
									{/if}
								</span>
								<span class="tabular text-xs">{d.priceSnapshot}</span>
							</div>
							<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
								<span class="confirm-chip {p.finished ? 'confirm-chip-done' : ''}">
									{p.primary}
								</span>
							</div>
							{#if canConfirmSelf}
								<div class="mt-2 flex gap-2">
									<form method="POST" action={aname('confirm')} use:enhance>
										<input type="hidden" name="drinkId" value={d.id} />
										<button class="btn btn-xs btn-success gap-1"><CircleCheck size={12} /> Bestätigen (GM)</button>
									</form>
									<form method="POST" action={aname('cancel')} use:enhance>
										<input type="hidden" name="drinkId" value={d.id} />
										<button class="btn btn-xs btn-error btn-outline">Abbrechen</button>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if peersPending.length}
			<div>
				<h4 class="text-base-content/70 mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
					Andere → bestätigen ({peersPending.length})
				</h4>
				<ul class="max-h-80 space-y-2 overflow-y-auto pr-1">
					{#each peersPending as d (d.id)}
						{@const p = confirmProgress(d)}
						<li class="glass rounded-xl p-3">
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-sm">
									<strong>{d.targetName}</strong> → {drinkLabel[d.drinkType]}
									{#if d.origin === 'FORCE'}
										<span class="badge badge-warning badge-sm ml-1">Erzwungen von {d.attackerName}</span>
									{:else}
										<span class="badge badge-info badge-sm ml-1">Eigen</span>
									{/if}
								</span>
								<span class="tabular text-xs">{d.priceSnapshot}</span>
							</div>
							<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
								<span class="confirm-chip {p.finished ? 'confirm-chip-done' : ''}">
									{p.primary}
								</span>
							</div>
							<div class="mt-2 flex gap-2">
								{#if canConfirmOthers}
									<form method="POST" action={aname('confirm')} use:enhance>
										<input type="hidden" name="drinkId" value={d.id} />
										<button class="btn btn-xs btn-success gap-1"><CircleCheck size={12} /> Bestätigen</button>
									</form>
								{/if}
								{#if me.role === 'HOST'}
									<form method="POST" action={aname('cancel')} use:enhance>
										<input type="hidden" name="drinkId" value={d.id} />
										<button class="btn btn-xs btn-error btn-outline">Abbrechen (GM)</button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if allPending.length === 0}
			<p class="text-base-content/40 text-center text-xs">Nichts offen.</p>
		{/if}
	</section>
{:else}
	<section>
		<ul class="max-h-96 space-y-1.5 overflow-y-auto pr-1">
			{#each history as d (d.id)}
				<li class="glass flex items-center justify-between rounded-lg p-2 text-sm">
					<span class="min-w-0 truncate">
						<strong>{d.targetName}</strong> · {drinkLabel[d.drinkType]}
						{#if d.origin === 'FORCE'}
							<span class="text-base-content/40 text-xs">· Erzwungen von {d.attackerName}</span>
						{/if}
					</span>
					<span
						class="badge badge-sm shrink-0"
						class:badge-success={d.status === 'CONFIRMED'}
						class:badge-ghost={d.status === 'CANCELLED'}
					>
						{d.status === 'CONFIRMED' ? 'OK' : 'Abgebrochen'}
					</span>
				</li>
			{/each}
		</ul>
		{#if history.length === 0}
			<p class="text-base-content/40 text-center text-xs">Noch nichts.</p>
		{/if}
	</section>
{/if}

<style>
	.drink-mine {
		background: linear-gradient(135deg, oklch(96% 0.06 70 / 0.7), oklch(92% 0.08 50 / 0.6));
		border: 1px solid oklch(80% 0.10 70 / 0.5);
		box-shadow: 0 4px 16px -8px oklch(70% 0.12 60 / 0.4);
	}
	.confirm-chip {
		display: inline-flex;
		align-items: center;
		font-size: 0.65rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		background-color: oklch(95% 0.006 90);
		color: oklch(40% 0.006 90);
		border: 1px solid oklch(88% 0.004 90 / 0.6);
	}
	.confirm-chip-done {
		background-color: oklch(93% 0.05 148);
		color: oklch(36% 0.05 148);
		border-color: oklch(75% 0.05 148 / 0.6);
	}
</style>