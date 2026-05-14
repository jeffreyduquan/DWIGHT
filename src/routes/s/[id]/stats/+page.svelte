<!--
	@file /s/[id]/stats/+page.svelte
	@implements REQ-STAT-001..004
-->
<script lang="ts">
	import {
		Trophy,
		Medal,
		Award,
		TrendingUp,
		TrendingDown,
		Target,
		Coins,
		Beer,
		Swords,
		BarChart3,
		History
	} from '@lucide/svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';

	let { data } = $props();

	const podium = $derived(data.leaderboard.slice(0, 3));
	const rest = $derived(data.leaderboard.slice(3));
	const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
	const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(0)}%`);

	const medalIcon = [Trophy, Medal, Award];
	const medalTone = ['warning', 'neutral', 'accent'] as const;
	const medalRing = ['ring-warning/60', 'ring-base-content/30', 'ring-accent/50'];
</script>

<p class="eyebrow mb-4">Statistik · {data.session.name}</p>

{#if podium.length > 0}
	<section class="mb-6 space-y-3">
		<div class="flex items-center gap-2">
			<IconBubble tone="warning" size="sm"><Trophy size={16} /></IconBubble>
			<h2 class="eyebrow">Leaderboard</h2>
		</div>
		<div class="grid grid-cols-3 items-end gap-2">
			{#each podium as p, i (p.userId)}
				{@const Icon = medalIcon[i]}
				<div
					class="glass-xl flex flex-col items-center p-3 text-center ring-2 {medalRing[i]}"
					class:order-1={i === 1}
					class:order-2={i === 0}
					class:order-3={i === 2}
					class:pt-5={i === 0}
				>
					<IconBubble tone={medalTone[i]} size={i === 0 ? 'lg' : 'md'}>
						<Icon size={i === 0 ? 22 : 18} />
					</IconBubble>
					<p class="mt-2 truncate text-sm font-medium">{p.username}</p>
					<p class="tabular-nums text-base-content/50 text-[0.65rem] uppercase tracking-wider">
						Saldo {p.moneyBalance}
					</p>
					<p
						class="mt-1 inline-flex items-center gap-1 tabular-nums text-xs font-bold"
						class:text-success={p.pnl > 0}
						class:text-error={p.pnl < 0}
					>
						{#if p.pnl > 0}<TrendingUp size={12} />{:else if p.pnl < 0}<TrendingDown size={12} />{/if}
						{fmt(p.pnl)}
					</p>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rest.length > 0}
	<section class="mb-6">
		<ol class="space-y-1.5">
			{#each rest as p, i (p.userId)}
				<li class="glass flex items-center justify-between rounded-xl px-3 py-2 text-sm">
					<span class="inline-flex items-center gap-2">
						<span
							class="bg-base-content/10 text-base-content/60 inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.65rem] font-semibold tabular-nums"
							>{i + 4}</span
						>
						<span class="font-medium">{p.username}</span>
					</span>
					<span class="inline-flex items-center gap-3">
						<span class="tabular-nums text-base-content/60 text-xs">{p.moneyBalance}</span>
						<span
							class="inline-flex items-center gap-1 tabular-nums text-xs font-semibold"
							class:text-success={p.pnl > 0}
							class:text-error={p.pnl < 0}
						>
							{#if p.pnl > 0}<TrendingUp size={11} />{:else if p.pnl < 0}<TrendingDown size={11} />{/if}
							{fmt(p.pnl)}
						</span>
					</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

{#if data.myStats}
	<section class="mb-6 space-y-3">
		<div class="flex items-center gap-2">
			<IconBubble tone="primary" size="sm"><BarChart3 size={16} /></IconBubble>
			<h2 class="eyebrow">Meine Bilanz</h2>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone={data.myStats.pnl >= 0 ? 'primary' : 'error'} size="sm">
						{#if data.myStats.pnl >= 0}
							<TrendingUp size={14} />
						{:else}
							<TrendingDown size={14} />
						{/if}
					</IconBubble>
					<p class="eyebrow">P / L</p>
				</div>
				<p
					class="stat-hero mt-1 text-2xl"
					class:text-success={data.myStats.pnl > 0}
					class:text-error={data.myStats.pnl < 0}
				>
					{fmt(data.myStats.pnl)}
				</p>
			</div>

			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone="info" size="sm"><Target size={14} /></IconBubble>
					<p class="eyebrow">ROI</p>
				</div>
				<p class="stat-hero mt-1 text-2xl">{pct(data.myStats.roi)}</p>
			</div>

			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone="accent" size="sm"><Target size={14} /></IconBubble>
					<p class="eyebrow">Trefferquote</p>
				</div>
				<p class="stat-hero mt-1 text-2xl">{pct(data.myStats.hitRate)}</p>
				<p class="text-base-content/40 mt-0.5 text-[10px] tabular-nums">
					{data.myStats.betsWon} / {data.myStats.betsPlaced}
				</p>
			</div>

			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone="primary" size="sm"><Coins size={14} /></IconBubble>
					<p class="eyebrow">Eingesetzt</p>
				</div>
				<p class="stat-hero mt-1 text-2xl">{data.myStats.totalStaked}</p>
				<p class="text-base-content/40 mt-0.5 text-[10px] tabular-nums">
					Ausz: {data.myStats.totalPayout}
				</p>
			</div>

			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone="warning" size="sm"><Beer size={14} /></IconBubble>
					<p class="eyebrow">Eigene Drinks</p>
				</div>
				<div class="mt-1 grid grid-cols-3 gap-1.5 text-center">
					<div>
						<p class="stat-hero text-lg leading-tight">{data.myStats.drinksByType.SCHLUCK}</p>
						<p class="text-base-content/45 text-[10px] uppercase tracking-wider">Schlücke</p>
					</div>
					<div>
						<p class="stat-hero text-lg leading-tight">{data.myStats.drinksByType.KURZER}</p>
						<p class="text-base-content/45 text-[10px] uppercase tracking-wider">Shots</p>
					</div>
					<div>
						<p class="stat-hero text-lg leading-tight">{data.myStats.drinksByType.BIER_EXEN}</p>
						<p class="text-base-content/45 text-[10px] uppercase tracking-wider">Exen</p>
					</div>
				</div>
			</div>

			<div class="card-stat p-3">
				<div class="flex items-center gap-2">
					<IconBubble tone="accent" size="sm"><Swords size={14} /></IconBubble>
					<p class="eyebrow">Force ↓ / ↑</p>
				</div>
				<p class="stat-hero mt-1 text-2xl">
					{data.myStats.drinksReceivedForce} / {data.myStats.drinksDealtForce}
				</p>
			</div>
		</div>
	</section>
{/if}

{#if data.roundHistory.length > 0}
	<section class="mb-6 space-y-3">
		<div class="flex items-center gap-2">
			<IconBubble tone="neutral" size="sm"><History size={16} /></IconBubble>
			<h2 class="eyebrow">Runden ({data.roundHistory.length})</h2>
		</div>
		<ol class="space-y-1.5">
			{#each data.roundHistory as r (r.id)}
				<li class="glass flex items-center justify-between rounded-xl px-3 py-2 text-sm">
					<span class="inline-flex items-center gap-2">
						<span
							class="bg-base-content/10 text-base-content/60 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums"
							>#{r.roundNumber}</span
						>
						<span
							class="badge badge-sm"
							class:badge-success={r.status === 'SETTLED'}
							class:badge-ghost={r.status === 'CANCELLED'}
							class:badge-warning={r.status === 'LIVE' || r.status === 'BETTING_OPEN'}
							>{r.status}</span
						>
					</span>
					<span class="tabular-nums text-base-content/60 text-xs">
						{r.markets} Markets · Pool {r.totalPool}
					</span>
				</li>
			{/each}
		</ol>
	</section>
{:else}
	<p class="text-base-content/40 mb-6 text-center text-xs">Noch keine Runden.</p>
{/if}

<div class="h-12"></div>
