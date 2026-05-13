<!--
	@component SessionTopBar — minimal session header (balance-focused).
	Shows: back link · prominent balance · subtle host/lock pills.
	No session name, no mode subtitle (REQ-UI-010).
-->
<script lang="ts">
	import { ArrowLeft, Coins } from '@lucide/svelte';

	let {
		balance,
		betLocked = false,
		isHost = false,
		isEnded = false,
		backHref = '/',
		backLabel = 'Zurück'
	}: {
		balance: number;
		betLocked?: boolean;
		isHost?: boolean;
		isEnded?: boolean;
		backHref?: string;
		backLabel?: string;
	} = $props();
</script>

<header class="mb-5 flex items-center justify-between gap-3">
	<div class="flex items-center gap-1.5">
		<a href={backHref} class="btn btn-ghost btn-xs gap-1 text-xs">
			<ArrowLeft size={13} />
			{backLabel}
		</a>
		{#if isHost && !isEnded}
			<span class="pill-host">Host</span>
		{/if}
		{#if betLocked && !isEnded}
			<span class="pill-lock">Gesperrt</span>
		{/if}
		{#if isEnded}
			<span class="pill-ended">Beendet</span>
		{/if}
	</div>

	<div class="balance-chip {betLocked ? 'balance-locked' : ''}">
		<Coins size={18} class="opacity-55" />
		<span class="tabular text-2xl font-bold leading-none">{balance}</span>
	</div>
</header>

<style>
	.balance-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem 1.1rem;
		border-radius: 9999px;
		background-color: oklch(95% 0.006 90);
		border: 1px solid oklch(88% 0.004 90 / 0.7);
		box-shadow:
			-3px -3px 7px oklch(100% 0 0 / 0.85),
			4px 4px 10px oklch(40% 0.01 80 / 0.16);
	}
	.balance-locked {
		background-color: oklch(94% 0.04 28);
		border-color: oklch(82% 0.04 28 / 0.55);
		color: oklch(46% 0.10 28);
	}
	.pill-host,
	.pill-lock,
	.pill-ended {
		display: inline-flex;
		align-items: center;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0.25rem 0.55rem;
		border-radius: 9999px;
		line-height: 1;
	}
	.pill-host {
		background-color: oklch(92% 0.004 90);
		color: oklch(45% 0.006 90);
	}
	.pill-lock {
		background-color: oklch(93% 0.04 28);
		color: oklch(48% 0.10 28);
	}
	.pill-ended {
		background-color: oklch(92% 0.004 90);
		color: oklch(40% 0.006 90);
	}
</style>
