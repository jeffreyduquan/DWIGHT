<!--
	@component QrCode — renders a QR code as an inline SVG using `qrcode`.
	@prop value — the payload string (URL).
	@prop size — pixel size of the rendered square.
-->
<script lang="ts">
	import QRCode from 'qrcode';

	type Props = { value: string; size?: number };
	let { value, size = 200 }: Props = $props();

	let svg = $state<string>('');
	$effect(() => {
		QRCode.toString(value, {
			type: 'svg',
			margin: 1,
			errorCorrectionLevel: 'M',
			width: size,
			color: { dark: '#1e2a1a', light: '#ffffff00' }
		})
			.then((s) => (svg = s))
			.catch(() => (svg = ''));
	});
</script>

<div
	class="qr-wrap inline-flex items-center justify-center rounded-2xl bg-white p-3"
	style="width: {size + 24}px; height: {size + 24}px;"
	aria-label="QR-Code"
>
	{#if svg}
		{@html svg}
	{:else}
		<span class="text-base-content/40 text-xs">…</span>
	{/if}
</div>

<style>
	.qr-wrap :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
