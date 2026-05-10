<!--
	@file s/+layout.svelte — shell for session-related pages
-->
<script lang="ts">
	let { children } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>
	<div class="relative mx-auto max-w-md px-6 py-8">
		{@render children()}
	</div>
</main>
