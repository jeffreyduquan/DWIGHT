<!--
	@component BottomDock — floating session navigation (Runde / Drinks / Stats / Lobby).
	Used on all /s/[id]/* routes. Mobile-first; auto-highlights current route.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { Play, Beer, BarChart3, Users } from '@lucide/svelte';

	let {
		sessionId,
		pendingDrinks = 0
	}: {
		sessionId: string;
		pendingDrinks?: number;
	} = $props();

	const pathname = $derived(page.url.pathname);
	const base = $derived(`/s/${sessionId}`);

	function isActive(href: string): boolean {
		if (href === base) return pathname === base;
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<!-- Spacer so content above is never hidden behind the dock -->
<div class="h-24" aria-hidden="true"></div>

<nav
	class="dock-float fixed inset-x-0 bottom-3 z-30 mx-auto max-w-md px-3"
	style="padding-bottom: env(safe-area-inset-bottom, 0);"
	aria-label="Session-Navigation"
>
	<div class="dock-inner grid grid-cols-4 gap-1 rounded-2xl p-1.5">
		<a
			href={base}
			class="dock-item"
			class:dock-active={isActive(base)}
			aria-label="Lobby"
		>
			<Users size={18} />
			<span>Lobby</span>
		</a>
		<a
			href={`${base}/round`}
			class="dock-item"
			class:dock-active={isActive(`${base}/round`)}
			aria-label="Runde"
		>
			<Play size={18} />
			<span>Runde</span>
		</a>
		<a
			href={`${base}/drinks`}
			class="dock-item relative"
			class:dock-active={isActive(`${base}/drinks`)}
			aria-label="Drinks"
		>
			<Beer size={18} />
			<span>Drinks</span>
			{#if pendingDrinks > 0}
				<span
					class="bg-warning text-warning-content absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.6rem] font-bold tabular-nums"
				>
					{pendingDrinks > 9 ? '9+' : pendingDrinks}
				</span>
			{/if}
		</a>
		<a
			href={`${base}/stats`}
			class="dock-item"
			class:dock-active={isActive(`${base}/stats`)}
			aria-label="Stats"
		>
			<BarChart3 size={18} />
			<span>Stats</span>
		</a>
	</div>
</nav>

<style>
	.dock-inner {
		background: oklch(10% 0.02 280 / 0.85);
		backdrop-filter: blur(20px) saturate(160%);
		-webkit-backdrop-filter: blur(20px) saturate(160%);
		border: 1px solid oklch(40% 0.04 280 / 0.5);
		box-shadow:
			0 10px 28px -10px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 0 oklch(90% 0.04 280 / 0.08);
	}
	.dock-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		padding: 0.5rem 0.25rem;
		border-radius: 0.875rem;
		color: oklch(75% 0.02 280);
		font-size: 0.7rem;
		font-weight: 500;
		line-height: 1;
		transition:
			background-color 180ms ease,
			color 180ms ease,
			transform 120ms ease;
		min-height: 48px; /* a11y touch target */
	}
	.dock-item:hover {
		color: oklch(96% 0.005 280);
		background: oklch(30% 0.04 280 / 0.4);
	}
	.dock-item:active {
		transform: scale(0.96);
	}
	.dock-active {
		color: oklch(96% 0.005 280);
		background: linear-gradient(
			180deg,
			oklch(86% 0.22 165 / 0.18),
			oklch(71% 0.16 290 / 0.14)
		);
		box-shadow:
			inset 0 0 0 1px oklch(86% 0.22 165 / 0.4),
			0 2px 12px -4px oklch(86% 0.22 165 / 0.35);
	}
</style>
