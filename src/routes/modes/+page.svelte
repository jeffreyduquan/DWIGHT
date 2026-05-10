<!--
	@file modes/+page.svelte — list user's modes.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';

	let { data } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>

	<div class="relative mx-auto max-w-md px-6 py-8">
		<header class="mb-8 flex items-center justify-between">
			<a href="/" class="text-base-content/60 hover:text-base-content text-sm">← zurück</a>
			<Logo size={32} />
		</header>

		<div class="mb-6 flex items-baseline justify-between">
			<h1 class="display text-3xl">
				<span class="text-gradient-primary">Modes</span>
			</h1>
			<a href="/modes/new" class="btn btn-primary btn-sm rounded-lg">+ Neu</a>
		</div>

		{#if data.modes.length === 0}
			<div class="glass rounded-2xl px-6 py-12 text-center">
				<p class="text-base-content/60 mb-4 text-sm">Du hast noch keine Modes.</p>
				<a href="/modes/new" class="btn btn-primary glow-primary rounded-xl">
					Ersten Mode erstellen
				</a>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each data.modes as m (m.id)}
					<li class="glass rounded-2xl p-4">
						<div class="mb-2 flex items-baseline justify-between">
							<a href="/modes/{m.id}" class="font-medium hover:underline">{m.name}</a>
							<span class="tabular text-base-content/40 text-xs">{m.slug}</span>
						</div>
						{#if m.description}
							<p class="text-base-content/60 mb-3 text-xs">{m.description}</p>
						{/if}
						<div class="flex items-center justify-between text-xs">
							<span class="text-base-content/40">
								{m.entityCount} {m.terminology.entity}n
							</span>
							<div class="flex gap-2">
								<a href="/modes/{m.id}" class="text-primary hover:underline">Bearbeiten</a>
								<form method="POST" action="?/duplicate" use:enhance class="inline">
									<input type="hidden" name="id" value={m.id} />
									<button type="submit" class="text-base-content/60 hover:text-base-content">
										Kopieren
									</button>
								</form>
								<form
									method="POST"
									action="?/delete"
									use:enhance
									class="inline"
									onsubmit={(e) => {
										if (!confirm(`Mode "${m.name}" löschen?`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={m.id} />
									<button type="submit" class="text-error hover:underline">Löschen</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
