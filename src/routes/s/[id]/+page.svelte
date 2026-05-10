<!--
	@file s/[id]/+page.svelte — lobby placeholder
	@implements REQ-UI-001, UI_UX §6.4 (lobby)
-->
<script lang="ts">
	let { data } = $props();
</script>

<!-- TopBar -->
<header class="mb-6 space-y-1">
	<a href="/" class="text-base-content/60 hover:text-base-content text-sm">← Sessions</a>
	<div class="flex items-baseline justify-between">
		<h1 class="display text-2xl">{data.session.name}</h1>
		<span class="tabular text-base-content/50 text-sm">{data.session.inviteCode}</span>
	</div>
	{#if data.mode}
		<p class="text-base-content/50 text-xs">{data.mode.name}</p>
	{/if}
</header>

<!-- Personal balance + lock -->
<section class="glass mb-6 flex items-center justify-between rounded-2xl px-4 py-3">
	<div>
		<p class="text-base-content/50 text-xs uppercase tracking-wider">Dein Saldo</p>
		<p class="tabular text-2xl font-bold">
			<span class="text-gradient-primary">{data.me.moneyBalance}</span>
		</p>
	</div>
	{#if data.me.betLocked}
		<span class="badge badge-error">Wett-Lock</span>
	{:else}
		<span class="badge badge-success">Aktiv</span>
	{/if}
</section>

<!-- Players -->
<section class="mb-6 space-y-2">
	<h2 class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
		Spieler ({data.players.length})
	</h2>
	<ul class="space-y-2">
		{#each data.players as p (p.userId)}
			<li class="glass flex items-center justify-between rounded-xl p-3">
				<span class="flex items-center gap-2">
					<span class="font-medium">{p.username}</span>
					{#if p.role === 'HOST'}
						<span class="badge badge-primary badge-sm">Host</span>
					{/if}
					{#if p.userId === data.me.userId}
						<span class="text-base-content/40 text-xs">(du)</span>
					{/if}
				</span>
				<span class="tabular text-sm font-medium">{p.moneyBalance}</span>
			</li>
		{/each}
	</ul>
</section>

<!-- Entities preview -->
{#if data.entities.length > 0}
	<section class="mb-6 space-y-2">
		<h2 class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
			{data.mode?.terminology.entity ?? 'Entitäten'}n
		</h2>
		<ul class="glass space-y-2 rounded-2xl p-3">
			{#each data.entities as e (e.id)}
				<li class="flex items-center gap-3">
					<span
						class="inline-block h-3 w-3 rounded-full"
						style="background: {(e.attributes as { color?: string })?.color ?? '#888'}"
					></span>
					<span class="text-sm">{e.name}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- BottomDock placeholder -->
<nav
	class="glass fixed inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl border-t border-white/10 px-6 py-4"
>
	<div class="grid grid-cols-3 gap-3 text-center text-xs">
		<button class="text-base-content/60 cursor-not-allowed opacity-60" disabled>Runde</button>
		<button class="text-base-content/60 cursor-not-allowed opacity-60" disabled>Drinks</button>
		<button class="text-base-content/60 cursor-not-allowed opacity-60" disabled>Stats</button>
	</div>
	<p class="text-base-content/40 mt-2 text-center text-[10px]">D3+ ↗</p>
</nav>

<div class="h-24"></div>
