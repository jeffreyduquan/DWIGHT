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
	import { CircleCheck } from '@lucide/svelte';

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

	// Confirmation progress descriptor for a drink. Returns the readable
	// x/y label, the chips to render, whether the host is still required,
	// and a finished flag.
	function confirmProgress(d: DrinkDto) {
		const gmCount = d.confirmations.filter((c) => c.role === 'GM').length;
		const peerCount = d.confirmations.filter((c) => c.role === 'PEER').length;
		const peerReq = session.config.peerConfirmationsRequired ?? 1;
		const mode = session.config.confirmationMode;
		let finished = false;
		let hostNeeded = false;
		let primary = '';
		if (mode === 'GM') {
			finished = gmCount >= 1;
			hostNeeded = !finished;
			primary = `Host ${Math.min(gmCount, 1)}/1`;
		} else if (mode === 'PEERS') {
			finished = peerCount >= peerReq;
			primary = `Spieler ${Math.min(peerCount, peerReq)}/${peerReq}`;
		} else {
			finished = gmCount >= 1 || peerCount >= peerReq;
			hostNeeded = !finished && gmCount < 1 && peerCount < peerReq;
			primary = `Host ${Math.min(gmCount, 1)}/1  ·  Spieler ${Math.min(peerCount, peerReq)}/${peerReq}`;
		}
		return { gmCount, peerCount, peerReq, mode, finished, hostNeeded, primary };
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
	<button class="btn btn-xs sm:btn-sm px-1 sm:px-3" class:btn-primary={tab === 'self'} onclick={() => (tab = 'self')}>Buy-In</button>
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
	<section class="space-y-2">
		{#if myPending.length}
			<h4 class="text-base-content/70 text-xs font-medium uppercase tracking-wider">
				Du musst trinken ({myPending.length})
			</h4>
			{#each myPending as d (d.id)}
				{@const p = confirmProgress(d)}
				<div class="glass rounded-xl p-3">
					<div class="flex items-baseline justify-between">
						<span class="text-sm">
							<strong>{drinkLabel[d.drinkType]}</strong>
							{#if d.origin === 'FORCE'}
								<span class="badge badge-warning badge-sm">FORCE von {d.attackerName}</span>
							{:else}
								<span class="badge badge-info badge-sm">Eigen</span>
							{/if}
						</span>
						<span class="tabular text-xs">{d.priceSnapshot}</span>
					</div>
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
						<span class="confirm-chip {p.gmCount >= 1 ? 'confirm-chip-done' : ''}">
							Host {Math.min(p.gmCount, 1)}/1
						</span>
						{#if p.mode !== 'GM'}
							<span class="confirm-chip {p.peerCount >= p.peerReq ? 'confirm-chip-done' : ''}">
								Spieler {Math.min(p.peerCount, p.peerReq)}/{p.peerReq}
							</span>
						{/if}
						{#if p.hostNeeded}
							<span class="confirm-host-required">Host muss bestätigen</span>
						{/if}
					</div>
					{#if canConfirmSelf}
						<div class="mt-2 flex gap-2">
							<form method="POST" action={aname('confirm')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-success gap-1"><CircleCheck size={12} /> Bestätigen (Host)</button>
							</form>
							<form method="POST" action={aname('cancel')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-error btn-outline">Abbrechen</button>
							</form>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
		{#if peersPending.length}
			<h4 class="text-base-content/70 mt-4 text-xs font-medium uppercase tracking-wider">
				Andere → bestätigen ({peersPending.length})
			</h4>
			{#each peersPending as d (d.id)}
				{@const p = confirmProgress(d)}
				<div class="glass rounded-xl p-3">
					<div class="flex items-baseline justify-between">
						<span class="text-sm">
							<strong>{d.targetName}</strong> → {drinkLabel[d.drinkType]}
							{#if d.origin === 'FORCE'}
								<span class="badge badge-warning badge-sm">FORCE von {d.attackerName}</span>
							{:else}
								<span class="badge badge-info badge-sm">Eigen</span>
							{/if}
						</span>
						<span class="tabular text-xs">{d.priceSnapshot}</span>
					</div>
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
						<span class="confirm-chip {p.gmCount >= 1 ? 'confirm-chip-done' : ''}">
							Host {Math.min(p.gmCount, 1)}/1
						</span>
						{#if p.mode !== 'GM'}
							<span class="confirm-chip {p.peerCount >= p.peerReq ? 'confirm-chip-done' : ''}">
								Spieler {Math.min(p.peerCount, p.peerReq)}/{p.peerReq}
							</span>
						{/if}
						{#if p.hostNeeded}
							<span class="confirm-host-required">Host muss bestätigen</span>
						{/if}
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
								<button class="btn btn-xs btn-error btn-outline">Abbrechen (Host)</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
		{#if allPending.length === 0}
			<p class="text-base-content/40 text-center text-xs">Nichts offen.</p>
		{/if}
	</section>
{:else}
	<section class="space-y-2">
		{#each history as d (d.id)}
			<div class="border-base-content/10 rounded-lg border p-2 text-sm">
				<div class="flex items-baseline justify-between">
					<span>
						<strong>{d.targetName}</strong> · {drinkLabel[d.drinkType]}
						{#if d.origin === 'FORCE'}<span class="text-base-content/40 text-xs">FORCE von {d.attackerName}</span>{/if}
					</span>
					<span class="badge badge-sm" class:badge-success={d.status === 'CONFIRMED'} class:badge-ghost={d.status === 'CANCELLED'}>{d.status}</span>
				</div>
			</div>
		{/each}
		{#if history.length === 0}
			<p class="text-base-content/40 text-center text-xs">Noch nichts.</p>
		{/if}
	</section>
{/if}

<style>
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
	.confirm-host-required {
		display: inline-flex;
		align-items: center;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.22rem 0.55rem;
		border-radius: 9999px;
		background-color: oklch(94% 0.05 70);
		color: oklch(45% 0.10 70);
		border: 1px solid oklch(80% 0.06 70 / 0.6);
	}
</style>