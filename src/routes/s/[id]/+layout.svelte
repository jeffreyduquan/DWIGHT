<!--
	@file s/[id]/+layout.svelte — chrome wrapper for every session route.
	Renders SessionTopBar above the page and a global BottomDock below.
	Page bodies only render their domain content.
-->
<script lang="ts">
	import { page } from '$app/state';
	import SessionTopBar from '$lib/components/SessionTopBar.svelte';
	import BottomDock from '$lib/components/BottomDock.svelte';

	let { data, children } = $props();
	const chrome = $derived(data.chrome);
	const pathname = $derived(page.url.pathname);
	const base = $derived(`/s/${chrome.sessionId}`);

	const subPath = $derived(
		pathname === base ? '' : pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? ''
	);

	const backHref = $derived(subPath === '' ? '/' : base);
	const backLabel = $derived(subPath === '' ? 'Sessions' : 'Lobby');

	const pageTitle = $derived(
		subPath === 'round'
			? 'Runde'
			: subPath === 'drinks'
				? 'Drinks'
				: subPath === 'stats'
					? 'Statistik'
					: undefined
	);
</script>

<SessionTopBar
	sessionName={chrome.sessionName}
	balance={chrome.balance}
	betLocked={chrome.betLocked}
	isHost={chrome.isHost}
	{backHref}
	{backLabel}
	subtitle={pageTitle ?? chrome.modeName ?? undefined}
/>

{@render children()}

<BottomDock sessionId={chrome.sessionId} pendingDrinks={chrome.pendingDrinks} />
