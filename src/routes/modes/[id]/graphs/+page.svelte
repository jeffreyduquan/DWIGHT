<!--
  @file modes/[id]/graphs/+page.svelte -- Bet-graph CRUD MVP (Phase 6).
  Raw JSON textarea editor with live validation + preview sentence.
  Visual Blueprints-style editor lands in a follow-up phase.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data }: { data: PageData } = $props();

	let editingId = $state<string | null>(null);
	let draftName = $state('');
	let draftDesc = $state('');
	let draftJson = $state('');

	function startEdit(g: PageData['graphs'][number]) {
		editingId = g.id;
		draftName = g.name;
		draftDesc = g.description ?? '';
		draftJson = JSON.stringify(g.graphJson, null, 2);
	}

	function cancelEdit() {
		editingId = null;
	}
</script>

<svelte:head>
	<title>Bet-Graphs · {data.mode.name}</title>
</svelte:head>

<section class="page">
	<header class="head">
		<a class="back" href="/modes/{data.mode.id}">← {data.mode.name}</a>
		<h1>Bet-Graphs</h1>
		<p class="sub">Visueller Wett-Builder (MVP -- JSON-Editor). Visueller Editor folgt.</p>
	</header>

	<form method="POST" action="?/create" use:enhance class="add">
		<input name="name" type="text" placeholder="Neuer Graph -- Name" required maxlength="64" />
		<input name="description" type="text" placeholder="Beschreibung (optional)" maxlength="200" />
		<button type="submit" class="btn-primary">+ Graph anlegen</button>
	</form>

	{#if data.graphs.length === 0}
		<p class="empty">Noch keine Graphs in diesem Mode.</p>
	{/if}

	<ul class="list">
		{#each data.graphs as g (g.id)}
			<li class="row" class:editing={editingId === g.id}>
				{#if editingId === g.id}
					<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { await update(); editingId = null; }} class="edit">
						<input type="hidden" name="id" value={g.id} />
						<label>
							Name
							<input name="name" type="text" bind:value={draftName} required maxlength="64" />
						</label>
						<label>
							Beschreibung
							<input name="description" type="text" bind:value={draftDesc} maxlength="200" />
						</label>
						<label>
							Graph (JSON)
							<textarea name="graphJson" bind:value={draftJson} rows="12" spellcheck="false" class="json"></textarea>
						</label>
						<div class="actions">
							<button type="submit" class="btn-primary">Speichern</button>
							<button type="button" class="btn-ghost" onclick={cancelEdit}>Abbrechen</button>
						</div>
					</form>
				{:else}
					<div class="info">
						<strong>{g.name}</strong>
						{#if g.description}<span class="desc">{g.description}</span>{/if}
						<small class="preview">{g.preview}</small>
						{#if !g.validation.ok}
							<small class="invalid">⚠ {g.validation.errors.length} Validierungsfehler</small>
						{:else}
							<small class="valid">✓ Valid</small>
						{/if}
					</div>
					<div class="row-actions">
						<button type="button" class="btn-ghost" onclick={() => startEdit(g)}>Bearbeiten</button>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={g.id} />
							<button type="submit" class="btn-danger" onclick={(e) => { if (!confirm('Graph löschen?')) e.preventDefault(); }}>Löschen</button>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<section class="help">
		<details>
			<summary>Hilfe -- Graph-JSON-Format</summary>
			<p>Minimaler valider Graph: <code>{`{ "version": 1, "nodes": [...], "edges": [...] }`}</code></p>
			<p>Beispiel <em>Top-Scorer</em> (arg_max -> entity_outcome):</p>
			<pre>{JSON.stringify(
				{
					version: 1,
					nodes: [
						{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
						{ id: 'a', kind: 'all_entities' },
						{ id: 'am', kind: 'arg_max' },
						{ id: 'o', kind: 'entity_outcome', props: { marketTitle: 'Top-Scorer' } }
					],
					edges: [
						{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'am', pin: 'trackable' } },
						{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 'am', pin: 'scope' } },
						{ from: { nodeId: 'am', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
					]
				},
				null,
				2
			)}</pre>
		</details>
	</section>
</section>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.head .back {
		color: var(--neutral-700, #555);
		text-decoration: none;
		font-size: 0.85rem;
	}
	.head h1 {
		font-size: 1.4rem;
		margin: 0.25rem 0 0.1rem;
	}
	.head .sub {
		margin: 0;
		color: var(--neutral-600, #777);
		font-size: 0.85rem;
	}
	.add {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		background: var(--surface-soft, #ece9e3);
		padding: 0.75rem;
		border-radius: 12px;
	}
	.add input {
		flex: 1;
		min-width: 12ch;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		border: 1px solid var(--neutral-300, #ccc);
		background: white;
	}
	.empty {
		opacity: 0.7;
		font-style: italic;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		background: var(--surface-soft, #ece9e3);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.row.editing {
		flex-direction: column;
		align-items: stretch;
	}
	.row .info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.row .desc {
		font-size: 0.85rem;
		opacity: 0.75;
	}
	.row .preview {
		font-style: italic;
		opacity: 0.7;
	}
	.row .valid {
		color: oklch(45% 0.07 148);
	}
	.row .invalid {
		color: oklch(45% 0.1 25);
	}
	.row-actions {
		display: flex;
		gap: 0.4rem;
		align-items: flex-start;
	}
	.edit {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.edit label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.edit input,
	.edit textarea {
		padding: 0.4rem 0.55rem;
		border-radius: 6px;
		border: 1px solid var(--neutral-300, #ccc);
		background: white;
	}
	.edit textarea.json {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.btn-primary {
		background: oklch(60% 0.055 148);
		color: white;
		border: none;
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.btn-ghost {
		background: transparent;
		border: 1px solid var(--neutral-300, #ccc);
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.btn-danger {
		background: oklch(60% 0.1 25);
		color: white;
		border: none;
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.help pre {
		background: white;
		padding: 0.75rem;
		border-radius: 6px;
		overflow-x: auto;
		font-size: 0.75rem;
	}
</style>
