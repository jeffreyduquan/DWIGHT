<!--
	@file Logo.svelte — DWIGHT wordmark + mark
	@implements REQ-BRAND-001, REQ-BRAND-007

	Mark concept: a glyph hexagon (iris violet outline) framing a photon-green
	plasma core with a plasma-pink spark — geometric, distinctive on dark surfaces,
	scales cleanly from 16px favicon to hero-size.
-->
<script lang="ts">
	type Props = {
		size?: number;
		showWordmark?: boolean;
	};
	let { size = 40, showWordmark = false }: Props = $props();
</script>

<div class="inline-flex items-center gap-2.5" style:height="{size}px">
	<svg
		viewBox="0 0 64 64"
		width={size}
		height={size}
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden={showWordmark ? 'true' : undefined}
		role={showWordmark ? 'presentation' : 'img'}
		aria-label={showWordmark ? undefined : 'DWIGHT'}
	>
		<defs>
			<linearGradient id="dwight-hex" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="oklch(0.86 0.22 165)" />
				<stop offset="100%" stop-color="oklch(0.71 0.16 290)" />
			</linearGradient>
			<radialGradient id="dwight-core" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="oklch(0.95 0.22 165)" />
				<stop offset="60%" stop-color="oklch(0.86 0.22 165)" />
				<stop offset="100%" stop-color="oklch(0.50 0.20 165 / 0)" />
			</radialGradient>
			<filter id="dwight-glow" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="2.5" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>

		<!-- Hex frame: pointy-top hexagon, iris-violet to photon-green stroke -->
		<polygon
			points="32,4 56,18 56,46 32,60 8,46 8,18"
			stroke="url(#dwight-hex)"
			stroke-width="2.5"
			stroke-linejoin="round"
			fill="none"
			opacity="0.95"
		/>

		<!-- Inner hex (subtler, structural depth) -->
		<polygon
			points="32,14 48,22 48,42 32,50 16,42 16,22"
			stroke="oklch(0.71 0.16 290 / 0.4)"
			stroke-width="1"
			stroke-linejoin="round"
			fill="none"
		/>

		<!-- Plasma core -->
		<g filter="url(#dwight-glow)">
			<circle cx="32" cy="32" r="10" fill="url(#dwight-core)" />
			<circle cx="32" cy="32" r="4" fill="oklch(0.95 0.22 165)" />
		</g>

		<!-- Plasma-pink spark at top-right vertex -->
		<circle cx="56" cy="18" r="2.5" fill="oklch(0.64 0.24 15)" filter="url(#dwight-glow)" />
	</svg>

	{#if showWordmark}
		<span class="wordmark text-2xl">
			<span class="text-gradient-primary">DWIGHT</span>
		</span>
	{/if}
</div>

