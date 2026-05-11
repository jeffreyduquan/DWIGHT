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

	let force_target = $state(players.find((p) => p.userId !== me.userId)?.userId ?? '');
	let force_type = $state<DrinkType>('SCHLUCK');
	let self_type = $state<DrinkType>('SCHLUCK');
</script>

<nav class="glass {compact ? 'mb-2' : 'mb-4'} grid {compact ? 'grid-cols-3' : 'grid-cols-4'} gap-1 rounded-2xl p-1">
	<button class="btn btn-sm" class:btn-primary={tab === 'pending'} onclick={() => (tab = 'pending')}>
		Offen
		{#if allPending.length}<span class="badge badge-sm">{allPending.length}</span>{/if}
	</button>
	<button class="btn btn-sm" class:btn-primary={tab === 'self'} onclick={() => (tab = 'self')}>Cashout</button>
	<button class="btn btn-sm" class:btn-primary={tab === 'force'} onclick={() => (tab = 'force')}>Force</button>
	{#if !compact}
		<button class="btn btn-sm" class:btn-primary={tab === 'history'} onclick={() => (tab = 'history')}>Verlauf</button>
	{/if}
</nav>

{#if tab === 'self'}
	<section class="glass space-y-3 rounded-2xl p-3">
		<h3 class="text-base-content/70 text-xs font-medium uppercase tracking-wider">
			Selber trinken → Geld
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
			Andere trinken lassen
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
				Zwingen
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
					<p class="text-base-content/40 text-xs">
						{d.confirmations.length} Bestätigung(en) — warte auf {session.config.confirmationMode}
					</p>
					{#if canConfirmSelf}
						<div class="mt-2 flex gap-2">
							<form method="POST" action={aname('confirm')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-success gap-1"><CircleCheck size={12} /> Bestätigen (GM)</button>
							</form>
							<form method="POST" action={aname('cancel')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-error btn-outline">Cancel</button>
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
					<p class="text-base-content/40 text-xs">
						{d.confirmations.map((c) => `${c.username} (${c.role})`).join(', ') || 'noch keine'}
					</p>
					<div class="mt-2 flex gap-2">
						{#if canConfirmOthers}
							<form method="POST" action={aname('confirm')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-success gap-1"><CircleCheck size={12} /> Bestätigen</button>
							</form>
						{:else}
							<span class="text-base-content/40 text-[0.65rem]">Nur der Host bestätigt (Modus: GM)</span>
						{/if}
						{#if me.role === 'HOST'}
							<form method="POST" action={aname('cancel')} use:enhance>
								<input type="hidden" name="drinkId" value={d.id} />
								<button class="btn btn-xs btn-error btn-outline">Cancel (GM)</button>
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
