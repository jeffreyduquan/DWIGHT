<!--
	@file modes/new/+page.svelte
-->
<script lang="ts">
	import ModeForm from '$lib/components/ModeForm.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { ArrowLeft } from '@lucide/svelte';

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

		<p class="eyebrow">Template anlegen</p>
		<h1 class="display mb-1 text-3xl">
			<span class="text-gradient-primary">Neuer</span> Mode
		</h1>
		<p class="text-base-content/60 mb-6 text-sm">
			Definiere Spielregeln, Entitäten, Wett-Templates und Drink-Mechanik.
		</p>

		<div class="border-primary/30 bg-primary/5 mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
			<span class="text-xl" aria-hidden="true">📐</span>
			<div>
				<strong>Bet-Graphs (visueller Wett-Builder)</strong> stehen nach dem Speichern
				bereit -- dann findest du oben auf der Edit-Seite den Button „Bet-Graphs öffnen".
			</div>
		</div>

		<ModeForm
			initial={data.initial}
			submitLabel="Mode erstellen"
			error={form && 'error' in form ? form.error : null}
		/>
	</div>
</main>
