<!--
  @file modes/[id]/graphs/+page.svelte -- Bet-graph CRUD with visual editor (Phase 7).

  Inline visual editor (GraphCanvas) for the selected graph. JSON-textarea
  remains as <details> fallback for power-users.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import SlotGraphEditor from '$lib/graph/SlotGraphEditor.svelte';
	import type { BetGraph } from '$lib/server/db/schema';
	import { GRAPH_GRID_COLS, GRAPH_GRID_ROWS } from '$lib/graph/grid';

	let { data }: { data: PageData } = $props();

	let editingId = $state<string | null>(null);
	let draftName = $state('');
	let draftDesc = $state('');
	let draftGraph = $state<BetGraph>({
		version: 2,
		grid: { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS },
		nodes: [],
		edges: []
	});
	let showJson = $state(false);

	function startEdit(g: PageData['graphs'][number]) {
		editingId = g.id;
		draftName = g.name;
		draftDesc = g.description ?? '';
		draftGraph = structuredClone(g.graphJson);
		showJson = false;
	}

	// Phase 19b: open the editor directly when ?edit=<id> is present.
	$effect(() => {
		const want = page.url.searchParams.get('edit');
		if (!want || editingId === want) return;
		const g = data.graphs.find((x) => x.id === want);
		if (g) startEdit(g);
	});

	function cancelEdit() {
		editingId = null;
	}

	const draftJson = $derived(JSON.stringify(draftGraph, null, 2));

	function onJsonInput(ev: Event) {
		const raw = (ev.target as HTMLTextAreaElement).value;
		try {
			const parsed = JSON.parse(raw);
			if (parsed?.version === 2 && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
				if (!parsed.grid) parsed.grid = { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS };
				draftGraph = parsed;
			}
		} catch {
			// Ignore -- live-feedback only.
		}
	}
</script>

<svelte:head>
	<title>Bet-Graphs · {data.mode.name}</title>
</svelte:head>

<section class="page">
	<header class="head">
		<a class="back" href="/modes/{data.mode.id}">← {data.mode.name}</a>
		<h1>Bet-Graphs</h1>
		<p class="sub">Visueller Wett-Builder. Tippe „+ Node", dann ziehe (oder tippe) Output-Pins auf passende Input-Pins um sie zu verbinden.</p>
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
					<form
						method="POST"
						action="?/save"
						use:enhance={() => async ({ update }) => {
							await update();
							editingId = null;
						}}
						class="edit"
					>
						<input type="hidden" name="id" value={g.id} />
						<input type="hidden" name="graphJson" value={draftJson} />
						<label>
							Name
							<input name="name" type="text" bind:value={draftName} required maxlength="64" />
						</label>
						<label>
							Beschreibung
							<input name="description" type="text" bind:value={draftDesc} maxlength="200" />
						</label>

						<SlotGraphEditor
							bind:graph={draftGraph}
							mode={{
								entities: data.mode.defaultEntities,
								trackables: data.mode.trackables,
								defaultEntities: data.mode.defaultEntities
							}}
						/>

						<details bind:open={showJson} class="json-fallback">
							<summary>Advanced: JSON bearbeiten</summary>
							<textarea
								rows="10"
								spellcheck="false"
								class="json"
								value={draftJson}
								oninput={onJsonInput}
							></textarea>
							<small>Live-Parsed; ungültiges JSON wird verworfen.</small>
						</details>

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
							<small class="valid">✓ Valid · {g.graphJson.nodes.length} Nodes</small>
						{/if}
					</div>
					<div class="row-actions">
						<button type="button" class="btn-ghost" onclick={() => startEdit(g)}>Bearbeiten</button>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={g.id} />
							<button
								type="submit"
								class="btn-danger"
								onclick={(e) => {
									if (!confirm('Graph löschen?')) e.preventDefault();
								}}>Löschen</button
							>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
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
		background: linear-gradient(135deg, oklch(96% 0.01 100), oklch(94% 0.01 100));
		padding: 0.85rem;
		border-radius: 14px;
		box-shadow:
			0 1px 2px oklch(20% 0.02 220 / 0.04),
			inset 0 1px 0 white;
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
		background: white;
		border-radius: 14px;
		padding: 0.85rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		box-shadow:
			0 1px 2px oklch(20% 0.02 220 / 0.05),
			0 4px 12px oklch(20% 0.02 220 / 0.06);
		border: 1px solid oklch(94% 0.01 100);
		transition: box-shadow 0.15s, transform 0.15s;
	}
	.row:not(.editing):hover {
		transform: translateY(-1px);
		box-shadow:
			0 2px 4px oklch(20% 0.02 220 / 0.06),
			0 8px 20px oklch(20% 0.02 220 / 0.1);
	}
	.row.editing {
		flex-direction: column;
		align-items: stretch;
		background: linear-gradient(180deg, white 0%, oklch(98% 0.005 100) 100%);
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
		gap: 0.6rem;
	}
	.edit > label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.edit > label > input {
		padding: 0.4rem 0.55rem;
		border-radius: 6px;
		border: 1px solid var(--neutral-300, #ccc);
		background: white;
	}
	.json-fallback {
		background: white;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.json-fallback textarea.json {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		width: 100%;
		padding: 0.4rem 0.55rem;
		border-radius: 6px;
		border: 1px solid var(--neutral-300, #ccc);
		background: white;
		margin-top: 0.3rem;
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
</style>
