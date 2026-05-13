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
	<div class="grid grid-cols-4 gap-1 p-1.5">
		<a href={base} class="dock-item" class:dock-active={isActive(base)} aria-label="Lobby">
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
					class="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.6rem] font-bold tabular-nums"
					style="background: oklch(56% 0.10 28); color: oklch(98% 0.004 90);"
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
	.dock-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 0.55rem 0.25rem;
		border-radius: 9999px;
		color: oklch(50% 0.006 90);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		line-height: 1;
		transition:
			box-shadow 160ms ease,
			color 160ms ease,
			background-color 160ms ease;
		min-height: 52px;
	}
	.dock-item:hover {
		color: oklch(30% 0.006 90);
		background-color: oklch(94% 0.004 90);
	}
	.dock-item:active {
		box-shadow:
			inset 1px 1px 3px oklch(40% 0.01 80 / 0.13),
			inset -1px -1px 3px oklch(100% 0 0 / 0.78);
	}
	.dock-active {
		color: oklch(40% 0.05 148);
		background-color: oklch(93% 0.012 148);
		box-shadow:
			inset 1px 1px 3px oklch(40% 0.05 148 / 0.18),
			inset -1px -1px 3px oklch(100% 0 0 / 0.78);
	}
</style>
