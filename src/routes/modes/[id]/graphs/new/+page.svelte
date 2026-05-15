<!--
	@file modes/[id]/graphs/new/+page.svelte -- Wett-Vorlagen-Picker UI.
	Phase 18b: lets the user create a bet-graph from a small form instead of the
	free-form node editor.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { TEMPLATES } from '$lib/graph/templates';
	import {
		ArrowLeft,
		AlertCircle,
		Flag,
		Trophy,
		Skull,
		Target,
		Zap,
		Medal,
		Timer,
		Sparkles
	} from '@lucide/svelte';

	let { data, form } = $props();

	const ICONS = { Flag, Trophy, Skull, Target, Zap, Medal, Timer } as const;

	let selectedId = $state<string | null>(null);
	const selected = $derived(TEMPLATES.find((t) => t.id === selectedId) ?? null);

	const formError = $derived(form && 'error' in form ? (form.error as string) : null);
</script>

<header class="mb-6 flex items-center justify-between">
	<a
		href="/modes/{data.modeId}"
		class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition"
	>
		<ArrowLeft size={16} /> zurück
	</a>
	<Logo size={32} />
</header>

<div class="mb-6 space-y-2">
	<IconBubble tone="primary" size="lg"><Sparkles size={22} /></IconBubble>
	<h1 class="text-2xl font-medium">Neue Wette</h1>
	<p class="text-base-content/60 text-sm">Wähle eine Vorlage für „{data.modeName}".</p>
</div>

{#if formError}
	<div class="alert alert-error mb-4">
		<AlertCircle size={16} /> {formError}
	</div>
{/if}

{#if !selectedId}
	<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each TEMPLATES as t (t.id)}
			{@const Icon = ICONS[t.icon]}
			<li>
				<button
					type="button"
					class="glass glass-xl hover:ring-primary hover:ring-2 flex w-full items-start gap-3 rounded-2xl p-4 text-left transition"
					onclick={() => (selectedId = t.id)}
				>
					<IconBubble tone="primary" size="md"><Icon size={20} /></IconBubble>
					<div class="flex-1">
						<div class="font-medium">{t.title}</div>
						<p class="text-base-content/60 mt-0.5 text-xs">{t.tagline}</p>
					</div>
				</button>
			</li>
		{/each}
	</ul>
	<div class="mt-6 text-center">
		<a
			href="/modes/{data.modeId}/graphs"
			class="text-primary inline-flex items-center gap-1 text-sm hover:underline"
		>
			Lieber frei zeichnen (Erweitert)…
		</a>
	</div>
{:else if selected}
	{@const Icon = ICONS[selected.icon]}
	<form method="POST" use:enhance class="glass glass-xl space-y-4 rounded-2xl p-5">
		<input type="hidden" name="template" value={selected.id} />
		<header class="flex items-center gap-3">
			<IconBubble tone="primary" size="md"><Icon size={20} /></IconBubble>
			<div>
				<div class="font-medium">{selected.title}</div>
				<p class="text-base-content/60 text-xs">{selected.tagline}</p>
			</div>
		</header>

		{#each selected.fields as f}
			<label class="block space-y-1">
				<span class="text-base-content/70 text-xs font-medium">{f.label}</span>
				{#if f.kind === 'trackable'}
					<select name="trackable" required class="select select-bordered w-full">
						<option value="">— Event wählen —</option>
						{#each data.trackables as t (t.id)}
							<option value={t.id}>{t.emoji ?? ''} {t.label}</option>
						{/each}
					</select>
				{:else if f.kind === 'entity'}
					<select name="entity" required class="select select-bordered w-full">
						<option value="">— Entität wählen —</option>
						{#each data.entities as e (e.name)}
							<option value={e.name}>{e.name}</option>
						{/each}
					</select>
				{:else if f.kind === 'number'}
					<input
						type="number"
						name={f.name}
						value={f.defaultValue}
						min={f.min ?? 0}
						max={f.max}
						required
						class="input input-bordered w-full"
					/>
				{:else if f.kind === 'enum'}
					<select name={f.name} required class="select select-bordered w-full">
						{#each f.options as o (o.value)}
							<option value={o.value} selected={o.value === f.defaultValue}>{o.label}</option>
						{/each}
					</select>
				{/if}
			</label>
		{/each}

		<div class="flex items-center justify-between">
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (selectedId = null)}>
				← andere Vorlage
			</button>
			<button type="submit" class="btn btn-primary">Wette erstellen</button>
		</div>
	</form>
{/if}
