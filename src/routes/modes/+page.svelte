<!--
	@file modes/+page.svelte — list user's modes (Aurora-glass redesign).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { ArrowLeft, Plus, Sparkles, Pencil, Copy, Trash2, Layers } from '@lucide/svelte';

	let { data } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>

	<div class="relative mx-auto max-w-md px-6 py-8">
		<header class="mb-8 flex items-center justify-between">
			<a
				href="/"
				class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1 text-sm"
				><ArrowLeft size={14} /> zurück</a
			>
			<Logo size={32} />
		</header>

		<div class="mb-6 flex items-baseline justify-between">
			<div>
				<p class="eyebrow">Templates</p>
				<h1 class="display text-3xl">
					<span class="text-gradient-primary">Modi</span>
				</h1>
			</div>
			<a href="/modes/new" class="btn btn-primary btn-sm gap-1 rounded-xl glow-primary">
				<Plus size={14} /> Neu
			</a>
		</div>

		{#if data.modes.length === 0}
			<div class="glass glass-xl px-6 py-12 text-center">
				<div class="mb-4 flex justify-center">
					<IconBubble tone="primary" size="lg"><Sparkles size={22} /></IconBubble>
				</div>
				<p class="text-base-content/60 mb-4 text-sm">Du hast noch keine Modes.</p>
				<a href="/modes/new" class="btn btn-primary glow-primary gap-1 rounded-xl">
					<Plus size={14} /> Ersten Mode erstellen
				</a>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each data.modes as m (m.id)}
					<li class="glass glass-xl p-4">
						<div class="mb-2 flex items-center gap-3">
							<IconBubble tone="primary" size="sm"><Layers size={16} /></IconBubble>
							<div class="flex-1 min-w-0">
								<a href="/modes/{m.id}" class="block font-medium hover:underline truncate"
									>{m.name}</a
								>
							</div>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="text-base-content/40">
								{m.entityCount} Spieler
							</span>
							<div class="flex items-center gap-3">
								<a
									href="/modes/{m.id}"
									class="text-primary hover:underline inline-flex items-center gap-1"
									><Pencil size={12} /> Bearbeiten</a
								>
								<form method="POST" action="?/duplicate" use:enhance class="inline">
									<input type="hidden" name="id" value={m.id} />
									<button
										type="submit"
										class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1"
									>
										<Copy size={12} /> Kopieren
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
									<button
										type="submit"
										class="text-error hover:underline inline-flex items-center gap-1"
										><Trash2 size={12} /> Löschen</button
									>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
