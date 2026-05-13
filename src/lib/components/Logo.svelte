<!--
	@file Logo.svelte — DWIGHT minimal mark + wordmark
	@implements REQ-BRAND-001, REQ-BRAND-005

	Mark: a single sage rounded square containing a clean dot — calm, geometric,
	scales from 16px to hero. Wordmark uses Inter semibold, near-zero tracking.
-->
<script lang="ts">
	type Props = {
		size?: number;
		showWordmark?: boolean;
	};
	let { size = 32, showWordmark = false }: Props = $props();
</script>

<div class="inline-flex items-center gap-2" style:height="{size}px">
	<svg
		viewBox="0 0 32 32"
		width={size}
		height={size}
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		role="img"
		aria-label="DWIGHT"
	>
		<rect x="2" y="2" width="28" height="28" rx="8" fill="oklch(60% 0.055 148)" />
		<circle cx="16" cy="16" r="5" fill="oklch(97% 0.014 92)" />
	</svg>

	{#if showWordmark}
		<span class="wordmark text-base-content text-xl">DWIGHT</span>
	{/if}
</div>
