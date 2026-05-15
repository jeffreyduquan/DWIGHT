<!--
	@file modes/[id]/+page.svelte
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import ModeForm from '$lib/components/ModeForm.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { TEMPLATES, templateRequiresEntityScope, type TemplateId } from '$lib/graph/templates';
	import {
		ArrowLeft,
		Trash2,
		CheckCircle2,
		Sparkles,
		Pencil,
		Wand2,
		Flag,
		Trophy,
		Skull,
		Target,
		Zap,
		Medal,
		Timer,
		X,
		AlertCircle
	} from '@lucide/svelte';

	let { data, form } = $props();

	const TPL_ICONS = { Flag, Trophy, Skull, Target, Zap, Medal, Timer } as const;
	const OUTCOME_ICONS = { Trophy, CheckCircle2, Medal, Sparkles } as const;

	let pickerOpen = $state(false);
	let selectedTplId = $state<string | null>(null);
	const selectedTpl = $derived(TEMPLATES.find((t) => t.id === selectedTplId) ?? null);

	/** Trackables compatible with the selected template (filter by scope). */
	const compatibleTrackables = $derived.by(() => {
		if (!selectedTpl) return data.mode.trackables;
		if (templateRequiresEntityScope(selectedTpl.id as TemplateId)) {
			return data.mode.trackables.filter((t) => t.scope === 'entity');
		}
		return data.mode.trackables;
	});

	/** Whether a template can be used given the current mode's trackable setup. */
	function templateAvailable(tplId: string): boolean {
		if (templateRequiresEntityScope(tplId as TemplateId)) {
			return data.mode.trackables.some((t) => t.scope === 'entity');
		}
		return data.mode.trackables.length > 0;
	}

	function openPicker() {
		selectedTplId = null;
		pickerOpen = true;
	}
	function closePicker() {
		pickerOpen = false;
		selectedTplId = null;
	}

	const tplError = $derived(form && 'error' in form ? (form.error as string) : null);
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

		<section class="mt-4 border-t border-base-300 pt-4 space-y-3">
			<div class="flex items-end justify-between">
				<div>
					<p class="eyebrow">Wetten</p>
					<h2 class="text-xl font-medium">
						<Sparkles size={18} class="inline-block align-text-bottom" /> Wetten dieses Modes
					</h2>
				</div>
				<span class="text-base-content/40 text-xs tabular">{data.graphs.length}</span>
			</div>

			{#if data.graphs.length === 0}
				<p class="text-base-content/50 text-sm">Noch keine Wetten angelegt.</p>
			{:else}
				<ul class="space-y-2">
					{#each data.graphs as g (g.id)}
						{@const Icon = OUTCOME_ICONS[g.icon]}
						<li class="glass flex items-start gap-3 rounded-xl p-3">
							<IconBubble tone="primary" size="sm"><Icon size={16} /></IconBubble>
							<a
								href="/modes/{data.mode.id}/graphs?edit={g.id}"
								class="flex-1 min-w-0 hover:opacity-80 transition"
								title="Wette bearbeiten"
							>
								<p class="font-medium text-sm truncate">{g.name}</p>
								{#if g.preview}
									<p class="text-base-content/50 mt-0.5 text-xs">{g.preview}</p>
								{/if}
							</a>
							<a
								href="/modes/{data.mode.id}/graphs?edit={g.id}"
								class="text-primary inline-flex items-center gap-1 text-xs hover:underline"
								title="Im Graph-Editor bearbeiten"
							>
								<Pencil size={12} />
							</a>
							<form
								method="POST"
								action="?/deleteGraph"
								use:enhance
								class="inline"
								onsubmit={(e) => {
									if (!confirm(`Wette "${g.name}" wirklich löschen?`)) e.preventDefault();
								}}
							>
								<input type="hidden" name="graphId" value={g.id} />
								<button
									type="submit"
									class="text-error/70 hover:text-error inline-flex items-center gap-1 text-xs"
									title="Wette löschen"
								>
									<Trash2 size={12} />
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="flex flex-col gap-2">
				<button
					type="button"
					onclick={openPicker}
					class="btn btn-primary w-full gap-2 rounded-xl"
				>
					<Wand2 size={14} /> Wette aus Vorlage
				</button>
				<a
					href={`/modes/${data.mode.id}/graphs`}
					class="btn btn-outline btn-sm w-full gap-2 rounded-xl"
				>
					<Pencil size={14} /> Eigene Wette bauen
				</a>
			</div>
		</section>

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

		{#if form && 'blockers' in form && Array.isArray(form.blockers) && form.blockers.length > 0}
			<div class="alert alert-warning mt-4 flex-col items-start gap-2 text-xs">
				<p class="font-semibold">Diese Sessions blockieren das Löschen:</p>
				<ul class="space-y-1">
					{#each form.blockers as b}
						<li class="flex items-center gap-2">
							<span class="badge badge-xs">{b.status}</span>
							<a href={`/s/${b.id}`} class="link link-hover">{b.name}</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	{#if pickerOpen}
		<!-- Template-Picker Modal (Phase 19a) -->
		<div
			class="bg-base-300/70 fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Wett-Vorlage wählen"
			onclick={(ev) => {
				if (ev.target === ev.currentTarget) closePicker();
			}}
			onkeydown={(ev) => {
				if (ev.key === 'Escape') closePicker();
			}}
			tabindex="-1"
		>
			<div
				class="glass glass-xl w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
			>
				<header class="mb-4 flex items-start justify-between">
					<div>
						<p class="eyebrow">Vorlage</p>
						<h2 class="text-lg font-medium">Neue Wette</h2>
					</div>
					<button
						type="button"
						class="btn btn-ghost btn-sm btn-circle"
						onclick={closePicker}
						aria-label="Schließen"><X size={16} /></button
					>
				</header>

				{#if tplError}
					<div class="alert alert-error mb-3 text-xs"><AlertCircle size={14} /> {tplError}</div>
				{/if}

				{#if !selectedTplId}
					<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{#each TEMPLATES as t (t.id)}
							{@const Icon = TPL_ICONS[t.icon]}
							{@const avail = templateAvailable(t.id)}
							{@const needsEntity = templateRequiresEntityScope(t.id as TemplateId)}
							<li>
								<button
									type="button"
									class="glass hover:ring-primary hover:ring-2 flex w-full items-start gap-2 rounded-xl p-3 text-left transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:ring-0"
									onclick={() => (selectedTplId = t.id)}
									disabled={!avail}
									title={!avail ? (needsEntity ? 'Kein einzel-Event vorhanden — diese Vorlage braucht ein pro-Entität gezähltes Event.' : 'Kein Event vorhanden.') : ''}
								>
									<IconBubble tone="primary" size="sm"><Icon size={16} /></IconBubble>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium flex items-center gap-1">
											{t.title}
											{#if needsEntity}
												<span class="badge badge-ghost badge-xs">einzel</span>
											{/if}
										</div>
										<p class="text-base-content/60 mt-0.5 text-[11px] leading-tight">
											{t.tagline}
										</p>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				{:else if selectedTpl}
					{@const Icon = TPL_ICONS[selectedTpl.icon]}
					<form
						method="POST"
						action="?/createGraphFromTemplate"
						use:enhance={() =>
							async ({ result, update }) => {
								await update();
								if (result.type === 'success') closePicker();
							}}
						class="space-y-3"
					>
						<input type="hidden" name="template" value={selectedTpl.id} />
						<header class="flex items-center gap-2">
							<IconBubble tone="primary" size="sm"><Icon size={16} /></IconBubble>
							<div>
								<div class="text-sm font-medium">{selectedTpl.title}</div>
								<p class="text-base-content/60 text-[11px]">{selectedTpl.tagline}</p>
							</div>
						</header>

						{#each selectedTpl.fields as f}
							<label class="block space-y-1">
								<span class="text-base-content/70 text-xs font-medium">{f.label}</span>
								{#if f.kind === 'trackable'}
									<select name="trackable" required class="select select-bordered select-sm w-full">
										<option value="">— Event wählen —</option>
										{#each compatibleTrackables as t (t.id)}
											<option value={t.id}>{t.emoji ?? ''} {t.label}</option>
										{/each}
									</select>
									{#if compatibleTrackables.length === 0}
										<p class="text-warning mt-1 text-[11px]">
											Keine passenden Events vorhanden. Diese Vorlage braucht ein „einzel"-Event
											(pro Entität gezählt).
										</p>
									{/if}
								{:else if f.kind === 'entity'}
									<select name="entity" required class="select select-bordered select-sm w-full">
										<option value="">— Entität wählen —</option>
										{#each data.mode.defaultEntities as e (e.name)}
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
										class="input input-bordered input-sm w-full"
									/>
								{:else if f.kind === 'enum'}
									<select name={f.name} required class="select select-bordered select-sm w-full">
										{#each f.options as o (o.value)}
											<option value={o.value} selected={o.value === f.defaultValue}
												>{o.label}</option
											>
										{/each}
									</select>
								{/if}
							</label>
						{/each}

						<div class="flex items-center justify-between pt-2">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => (selectedTplId = null)}
							>
								← andere Vorlage
							</button>
							<button type="submit" class="btn btn-primary btn-sm">Erstellen</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</main>
