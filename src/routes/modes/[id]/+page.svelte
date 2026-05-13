<!--
	@file modes/[id]/+page.svelte
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import ModeForm from '$lib/components/ModeForm.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { ArrowLeft, Trash2, CheckCircle2 } from '@lucide/svelte';

	let { data, form } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>

	<div class="relative mx-auto max-w-md px-6 py-8">
		<header class="mb-6 flex items-center justify-between">
			<a
				href="/modes"
				class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1 text-sm"
				><ArrowLeft size={14} /> Modes</a
			>
			<Logo size={32} />
		</header>

		<p class="eyebrow">Template</p>
		<h1 class="display mb-1 text-3xl">
			Mode <span class="text-gradient-primary">bearbeiten</span>
		</h1>
		<p class="text-base-content/60 mb-6 text-sm">{data.mode.name}</p>

		{#if form && 'ok' in form && form.ok}
			<div class="alert alert-success mb-4 gap-2 text-sm">
				<CheckCircle2 size={16} /> Gespeichert.
			</div>
		{/if}

		<ModeForm
			initial={data.mode}
			modeId={data.mode.id}
			submitLabel="Speichern"
			action="?/save"
			error={form && 'error' in form ? form.error : null}
		/>

		<form
			method="POST"
			action="?/delete"
			use:enhance
			class="border-base-300 mt-8 border-t pt-4"
			onsubmit={(e) => {
				if (!confirm(`Mode "${data.mode.name}" wirklich löschen?`)) e.preventDefault();
			}}
		>
			<button type="submit" class="btn btn-ghost text-error w-full gap-2 rounded-xl text-sm">
				<Trash2 size={14} /> Mode löschen
			</button>
		</form>
	</div>
</main>
