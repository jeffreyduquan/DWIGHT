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

	const backHref = $derived(chrome.isEnded ? '/' : pathname === base ? '/' : base);
	const backLabel = $derived(
		chrome.isEnded ? 'Zurück' : pathname === base ? 'Sessions' : 'Lobby'
	);
</script>

<SessionTopBar
	balance={chrome.balance}
	betLocked={chrome.betLocked}
	isHost={chrome.isHost}
	isEnded={chrome.isEnded}
	{backHref}
	{backLabel}
/>

{@render children()}

{#if !chrome.isEnded}
	<BottomDock sessionId={chrome.sessionId} />
{/if}
