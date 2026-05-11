<!--
	@file (auth)/+layout.svelte — clean layout for auth pages (no top bar)
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from '$lib/components/Logo.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="aurora noise relative min-h-svh flex flex-col items-center justify-center px-6 py-12">
	<a href="/" class="fade-up mb-8 flex items-center gap-2.5">
		<Logo size={36} showWordmark />
	</a>
	<div class="fade-up fade-up-delay-1 glass-xl w-full max-w-sm p-7">
		{@render children()}
	</div>
</div>
