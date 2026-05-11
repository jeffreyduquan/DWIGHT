<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	// Self-hosted fonts (REQ-INFRA: PWA-offline)
	import '@fontsource/space-grotesk/500.css';
	import '@fontsource/space-grotesk/600.css';
	import '@fontsource/space-grotesk/700.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/inter/700.css';
	import '@fontsource/geist-mono/500.css';
	import '@fontsource/geist-mono/600.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
