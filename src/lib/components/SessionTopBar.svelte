<!--
	@component SessionTopBar — compact, mobile-first session header.
	Shows: back link · session name · balance · lock indicator · host badge.
-->
<script lang="ts">
	import { ArrowLeft, Coins, Lock, Crown } from '@lucide/svelte';

	let {
		sessionName,
		balance,
		betLocked = false,
		isHost = false,
		backHref = '/',
		backLabel = 'Zurück',
		subtitle
	}: {
		sessionName: string;
		balance: number;
		betLocked?: boolean;
		isHost?: boolean;
		backHref?: string;
		backLabel?: string;
		subtitle?: string;
	} = $props();
</script>

<header class="mb-4 space-y-2">
	<div class="flex items-center justify-between gap-2">
		<a
			href={backHref}
			class="text-base-content/55 hover:text-base-content inline-flex items-center gap-1 text-xs"
		>
			<ArrowLeft size={13} />
			{backLabel}
		</a>
		<div class="flex items-center gap-1.5">
			{#if isHost}
				<span class="badge badge-xs badge-primary gap-1">
					<Crown size={10} /> Host
				</span>
			{/if}
			{#if betLocked}
				<span class="badge badge-xs badge-error gap-1">
					<Lock size={10} /> Sperre
				</span>
			{/if}
		</div>
	</div>

	<div class="flex items-baseline justify-between gap-3">
		<h1 class="display text-2xl leading-tight">
			<span class="text-gradient-primary">{sessionName}</span>
		</h1>
		<div class="text-right">
			<p class="eyebrow">Saldo</p>
			<p class="tabular text-xl font-bold leading-none">
				<Coins size={14} class="inline opacity-50" />
				<span class={betLocked ? 'text-error' : ''}>{balance}</span>
			</p>
		</div>
	</div>
	{#if subtitle}
		<p class="text-base-content/45 text-[0.7rem] uppercase tracking-wider">{subtitle}</p>
	{/if}
</header>
