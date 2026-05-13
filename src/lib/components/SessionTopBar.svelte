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

<header class="mb-5 space-y-3">
	<div class="flex items-center justify-between gap-2">
		<a
			href={backHref}
			class="btn btn-ghost btn-xs gap-1 text-xs"
		>
			<ArrowLeft size={13} />
			{backLabel}
		</a>
		<div class="flex items-center gap-1.5">
			{#if isHost}
				<span class="eyebrow inline-flex items-center gap-1 px-2 py-1 rounded-full"
					style="background-color: oklch(93% 0.012 148); color: oklch(40% 0.05 148);">
					<Crown size={10} /> Host
				</span>
			{/if}
			{#if betLocked}
				<span class="eyebrow inline-flex items-center gap-1 px-2 py-1 rounded-full"
					style="background-color: oklch(93% 0.04 28); color: oklch(48% 0.10 28);">
					<Lock size={10} /> Sperre
				</span>
			{/if}
		</div>
	</div>

	<div class="flex items-end justify-between gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="display text-[1.6rem] leading-tight truncate">{sessionName}</h1>
			{#if subtitle}
				<p class="eyebrow mt-1">{subtitle}</p>
			{/if}
		</div>
		<div class="balance-chip shrink-0">
			<Coins size={14} class="opacity-50" />
			<span class="tabular text-lg font-bold {betLocked ? 'text-error' : ''}">{balance}</span>
		</div>
	</div>
</header>

<style>
	.balance-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		border-radius: 9999px;
		background-color: oklch(94% 0.004 90);
		border: 1px solid oklch(88% 0.004 90 / 0.7);
		box-shadow:
			-2px -2px 5px oklch(100% 0 0 / 0.78),
			3px 3px 8px oklch(40% 0.01 80 / 0.13);
	}
</style>
