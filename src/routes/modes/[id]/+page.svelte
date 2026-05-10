<!--
	@file modes/[id]/+page.svelte
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import ModeForm from '$lib/components/ModeForm.svelte';
	import Logo from '$lib/components/Logo.svelte';

	let { data, form } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>

	<div class="relative mx-auto max-w-md px-6 py-8">
		<header class="mb-6 flex items-center justify-between">
			<a href="/modes" class="text-base-content/60 hover:text-base-content text-sm">← Modes</a>
			<Logo size={32} />
		</header>

		<h1 class="display mb-1 text-3xl">
			Mode <span class="text-gradient-primary">bearbeiten</span>
		</h1>
		<p class="text-base-content/60 mb-6 text-sm">{data.mode.name}</p>

		{#if form && 'ok' in form && form.ok}
			<div class="alert alert-success mb-4 text-sm">Gespeichert.</div>
		{/if}

		<ModeForm
			initial={data.mode}
			submitLabel="Speichern"
			error={form && 'error' in form ? form.error : null}
		/>

		<form
			method="POST"
			action="?/delete"
			use:enhance
			class="mt-8 border-t border-white/5 pt-4"
			onsubmit={(e) => {
				if (!confirm(`Mode "${data.mode.name}" wirklich löschen?`)) e.preventDefault();
			}}
		>
			<button type="submit" class="btn btn-ghost text-error w-full rounded-xl text-sm">
				Mode löschen
			</button>
		</form>
	</div>
</main>
