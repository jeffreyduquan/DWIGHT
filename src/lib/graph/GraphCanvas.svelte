<!--
  @file graph/GraphCanvas.svelte -- Visual bet-graph editor (Phase 7 MVP).

  Tap-to-connect node canvas. Vertical auto-layout. Mobile-first.

  Props:
    - graph: BetGraph (in/out)
    - mode: { trackables: {id,label}[], defaultEntities: {label}[] }
  Bindings:
    - bind:graph to receive edits

  UX:
    - Nodes render as cards stacked vertically (topological order).
    - Header coloured by family; props editable inline.
    - Pins are coloured buttons (left = inputs, right = outputs).
    - Tap an output pin -> compatible input pins glow; tap one to connect.
    - Tap an existing edge in the SVG overlay -> shows Delete pill.
    - "+ Node" FAB opens a bottom sheet grouped by family.
    - "JSON" toggle reveals raw JSON for power-users (read-only here; full edit
      stays in the parent page's <details> fallback).
-->
<script lang="ts">
	import type { BetGraph, GraphNode, GraphEdge, GraphNodeKind } from '$lib/server/db/schema';
	import { NODE_CATALOG, FAMILY_LABELS, PIN_COLORS, type NodeFamily, type PinType } from '$lib/graph/catalog';
	import { validateGraph } from '$lib/graph/validate';
	import { previewSentence } from '$lib/graph/preview';

	type ModeContext = {
		trackables: Array<{ id: string; label: string }>;
		defaultEntities: Array<{ name: string }>;
	};

	let {
		graph = $bindable(),
		mode
	}: {
		graph: BetGraph;
		mode: ModeContext;
	} = $props();

	// Pending output pin (waiting for input target tap).
	let pendingFrom = $state<{ nodeId: string; pin: string; type: PinType } | null>(null);
	let paletteOpen = $state(false);
	let selectedEdgeIdx = $state<number | null>(null);
	let expandedNode = $state<string | null>(null);
	// Drag-to-connect state: pointer position while dragging from an output pin.
	let dragPointer = $state<{ x: number; y: number } | null>(null);
	let didDrag = $state(false);

	// Pin DOM positions for SVG overlay.
	let canvasEl: HTMLElement;
	let pinPositions = $state<Record<string, { x: number; y: number }>>({});

	const validation = $derived(validateGraph(graph));
	const preview = $derived(previewSentence(graph));

	const FAMILY_ORDER: NodeFamily[] = ['source', 'compute', 'logic', 'outcome'];
	const FAMILY_BG: Record<NodeFamily, string> = {
		source: 'oklch(92% 0.03 220)',
		compute: 'oklch(92% 0.04 80)',
		logic: 'oklch(92% 0.04 250)',
		outcome: 'oklch(92% 0.05 148)'
	};

	/** Topological sort -- sources first, outcomes last. Cycles fall back to insertion order. */
	function sortedNodes(g: BetGraph): GraphNode[] {
		const byId = new Map(g.nodes.map((n) => [n.id, n]));
		const inDeg = new Map<string, number>();
		for (const n of g.nodes) inDeg.set(n.id, 0);
		for (const e of g.edges) inDeg.set(e.to.nodeId, (inDeg.get(e.to.nodeId) ?? 0) + 1);
		const out: GraphNode[] = [];
		const queue: string[] = [];
		for (const [id, d] of inDeg) if (d === 0) queue.push(id);
		while (queue.length) {
			const id = queue.shift()!;
			const node = byId.get(id);
			if (node) out.push(node);
			for (const e of g.edges) {
				if (e.from.nodeId === id) {
					const cur = inDeg.get(e.to.nodeId)!;
					inDeg.set(e.to.nodeId, cur - 1);
					if (cur - 1 === 0) queue.push(e.to.nodeId);
				}
			}
		}
		// Append any unsorted (cycle) at the end.
		for (const n of g.nodes) if (!out.includes(n)) out.push(n);
		return out;
	}

	const ordered = $derived(sortedNodes(graph));

	function newNodeId(kind: GraphNodeKind): string {
		const base = kind;
		let i = 1;
		while (graph.nodes.some((n) => n.id === `${base}_${i}`)) i++;
		return `${base}_${i}`;
	}

	function addNode(kind: GraphNodeKind) {
		const spec = NODE_CATALOG[kind];
		const props: Record<string, unknown> = {};
		for (const p of spec.props) if (p.defaultValue !== undefined) props[p.name] = p.defaultValue;
		const newNode: GraphNode = { id: newNodeId(kind), kind, props };
		graph = { ...graph, nodes: [...graph.nodes, newNode] };
		paletteOpen = false;
		expandedNode = newNode.id;
	}

	function deleteNode(id: string) {
		graph = {
			...graph,
			nodes: graph.nodes.filter((n) => n.id !== id),
			edges: graph.edges.filter((e) => e.from.nodeId !== id && e.to.nodeId !== id)
		};
		if (expandedNode === id) expandedNode = null;
	}

	function deleteEdge(idx: number) {
		graph = { ...graph, edges: graph.edges.filter((_, i) => i !== idx) };
		selectedEdgeIdx = null;
	}

	function setProp(nodeId: string, key: string, value: unknown) {
		graph = {
			...graph,
			nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, props: { ...n.props, [key]: value } } : n))
		};
	}

	function onOutputTap(nodeId: string, pin: string, type: PinType) {
		// If user actually dragged, the pointerup handler already resolved this; skip tap-toggle.
		if (didDrag) {
			didDrag = false;
			return;
		}
		if (pendingFrom && pendingFrom.nodeId === nodeId && pendingFrom.pin === pin) {
			pendingFrom = null;
			return;
		}
		pendingFrom = { nodeId, pin, type };
	}

	function onOutputPointerDown(ev: PointerEvent, nodeId: string, pin: string, type: PinType) {
		// Begin a drag-to-connect gesture. Tap-to-connect remains via onclick.
		pendingFrom = { nodeId, pin, type };
		didDrag = false;
		const cr = canvasEl?.getBoundingClientRect();
		if (cr) dragPointer = { x: ev.clientX - cr.left, y: ev.clientY - cr.top };
		(ev.target as Element).setPointerCapture?.(ev.pointerId);
	}

	function onWindowPointerMove(ev: PointerEvent) {
		if (!pendingFrom || !canvasEl) return;
		const cr = canvasEl.getBoundingClientRect();
		dragPointer = { x: ev.clientX - cr.left, y: ev.clientY - cr.top };
		didDrag = true;
	}

	function findInputPinAt(clientX: number, clientY: number): { nodeId: string; pin: string } | null {
		const els = document.elementsFromPoint(clientX, clientY);
		for (const el of els) {
			const key = (el as HTMLElement).dataset?.pinKey;
			if (key && key.startsWith('in:')) {
				const [, nodeId, pinName] = key.split(':');
				return { nodeId, pin: pinName };
			}
		}
		return null;
	}

	function onWindowPointerUp(ev: PointerEvent) {
		if (!pendingFrom) {
			dragPointer = null;
			return;
		}
		if (!didDrag) {
			// No drag happened -- let the onclick tap-toggle path handle it.
			dragPointer = null;
			return;
		}
		const hit = findInputPinAt(ev.clientX, ev.clientY);
		if (hit) {
			// Look up pin spec to know type + multi flag.
			const targetNode = graph.nodes.find((n) => n.id === hit.nodeId);
			if (targetNode) {
				const spec = NODE_CATALOG[targetNode.kind];
				const pinDef = spec.inputs.find((p) => p.name === hit.pin);
				if (pinDef) {
					onInputTap(hit.nodeId, hit.pin, pinDef.type, !!pinDef.multi);
					dragPointer = null;
					return;
				}
			}
		}
		// Drag released over nothing usable -> cancel pending.
		pendingFrom = null;
		dragPointer = null;
	}

	function onInputTap(nodeId: string, pin: string, type: PinType, multi: boolean) {
		if (!pendingFrom) return;
		if (pendingFrom.type !== type) {
			pendingFrom = null;
			return;
		}
		// Reject self-loop.
		if (pendingFrom.nodeId === nodeId) {
			pendingFrom = null;
			return;
		}
		// Reject duplicate.
		const exists = graph.edges.some(
			(e) =>
				e.from.nodeId === pendingFrom!.nodeId &&
				e.from.pin === pendingFrom!.pin &&
				e.to.nodeId === nodeId &&
				e.to.pin === pin
		);
		if (exists) {
			pendingFrom = null;
			return;
		}
		// Enforce single-edge on non-multi inputs by removing any prior.
		let newEdges = graph.edges;
		if (!multi) {
			newEdges = newEdges.filter((e) => !(e.to.nodeId === nodeId && e.to.pin === pin));
		}
		const newEdge: GraphEdge = {
			from: { nodeId: pendingFrom.nodeId, pin: pendingFrom.pin },
			to: { nodeId, pin }
		};
		graph = { ...graph, edges: [...newEdges, newEdge] };
		pendingFrom = null;
	}

	function pinKey(nodeId: string, pin: string, side: 'in' | 'out') {
		return `${side}:${nodeId}:${pin}`;
	}

	/** Recompute all pin coords relative to canvas. */
	function recomputePinPositions() {
		if (!canvasEl) return;
		const cr = canvasEl.getBoundingClientRect();
		const next: Record<string, { x: number; y: number }> = {};
		const els = canvasEl.querySelectorAll<HTMLElement>('[data-pin-key]');
		for (const el of els) {
			const key = el.dataset.pinKey!;
			const r = el.getBoundingClientRect();
			next[key] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
		}
		pinPositions = next;
	}

	$effect(() => {
		// Recompute when nodes/edges change.
		// (Reading these triggers the effect.)
		void graph.nodes.length;
		void graph.edges.length;
		void expandedNode;
		void paletteOpen;
		requestAnimationFrame(recomputePinPositions);
	});

	$effect(() => {
		const ro = new ResizeObserver(() => recomputePinPositions());
		if (canvasEl) ro.observe(canvasEl);
		window.addEventListener('resize', recomputePinPositions);
		window.addEventListener('pointermove', onWindowPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
		window.addEventListener('pointercancel', onWindowPointerUp);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', recomputePinPositions);
			window.removeEventListener('pointermove', onWindowPointerMove);
			window.removeEventListener('pointerup', onWindowPointerUp);
			window.removeEventListener('pointercancel', onWindowPointerUp);
		};
	});

	function edgePath(e: GraphEdge): string {
		const a = pinPositions[pinKey(e.from.nodeId, e.from.pin, 'out')];
		const b = pinPositions[pinKey(e.to.nodeId, e.to.pin, 'in')];
		if (!a || !b) return '';
		const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
		const dy = (b.y - a.y) * 0.3;
		return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y + dy}, ${b.x - dx} ${b.y - dy}, ${b.x} ${b.y}`;
	}

	function edgeMid(e: GraphEdge): { x: number; y: number } | null {
		const a = pinPositions[pinKey(e.from.nodeId, e.from.pin, 'out')];
		const b = pinPositions[pinKey(e.to.nodeId, e.to.pin, 'in')];
		if (!a || !b) return null;
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function edgeColor(e: GraphEdge): string {
		const spec = NODE_CATALOG[graph.nodes.find((n) => n.id === e.from.nodeId)?.kind ?? ('entity' as GraphNodeKind)];
		const pin = spec?.outputs.find((p) => p.name === e.from.pin);
		return pin ? PIN_COLORS[pin.type] : 'oklch(70% 0.04 220)';
	}

	const ENTITY_OPTIONS = $derived(mode.defaultEntities.map((e) => e.name));
	const TRACKABLE_OPTIONS = $derived(mode.trackables.map((t) => t.id));
</script>

<div class="wrap">
	<header class="banner">
		<span class="preview">{preview}</span>
		{#if validation.ok}
			<span class="badge ok">✓ Valid</span>
		{:else}
			<span class="badge warn">⚠ {validation.errors.length}</span>
		{/if}
	</header>

	<div class="canvas" bind:this={canvasEl}>
		<svg class="edges" aria-hidden="true">
			{#each graph.edges as e, i (i)}
				<path
					d={edgePath(e)}
					stroke={edgeColor(e)}
					stroke-width={selectedEdgeIdx === i ? 4 : 2.5}
					fill="none"
					stroke-linecap="round"
				/>
			{/each}
			{#each graph.edges as e, i (i)}
				{@const m = edgeMid(e)}
				{#if m}
					<circle
						cx={m.x}
						cy={m.y}
						r="9"
						class="edge-hit"
						onclick={() => (selectedEdgeIdx = selectedEdgeIdx === i ? null : i)}
					/>
					{#if selectedEdgeIdx === i}
						<foreignObject x={m.x - 30} y={m.y + 8} width="60" height="28">
							<button type="button" class="del-edge" onclick={() => deleteEdge(i)}>Edge ×</button>
						</foreignObject>
					{/if}
				{/if}
			{/each}

			{#if pendingFrom && dragPointer}
				{@const a = pinPositions[pinKey(pendingFrom.nodeId, pendingFrom.pin, 'out')]}
				{#if a}
					<path
						d={`M ${a.x} ${a.y} L ${dragPointer.x} ${dragPointer.y}`}
						stroke="oklch(60% 0.1 80)"
						stroke-width="2.5"
						stroke-dasharray="4 4"
						fill="none"
					/>
				{/if}
			{/if}
		</svg>

		{#each ordered as node (node.id)}
			{@const spec = NODE_CATALOG[node.kind]}
			<article class="node" style:--family-bg={FAMILY_BG[spec.family]}>
				<header class="node-head">
					<button type="button" class="node-title" onclick={() => (expandedNode = expandedNode === node.id ? null : node.id)}>
						<span class="fam">{FAMILY_LABELS[spec.family]}</span>
						<strong>{spec.label}</strong>
						{#if spec.macro}<span class="macro">M</span>{/if}
					</button>
					<button type="button" class="del" aria-label="Node löschen" onclick={() => deleteNode(node.id)}>×</button>
				</header>

				<div class="pins-row">
					<div class="pins inputs">
						{#each spec.inputs as p (p.name)}
							{@const k = pinKey(node.id, p.name, 'in')}
							{@const compat = pendingFrom && pendingFrom.type === p.type && pendingFrom.nodeId !== node.id}
							<button
								type="button"
								class="pin in"
								class:compat
								class:required={p.required}
								data-pin-key={k}
								title="{p.name} ({p.type}{p.required ? ', required' : ''}{p.multi ? ', multi' : ''})"
								onclick={() => onInputTap(node.id, p.name, p.type, !!p.multi)}
								style:--pin-color={PIN_COLORS[p.type]}
							>
								<span class="dot"></span>
								<span class="lbl">{p.name}</span>
							</button>
						{/each}
					</div>

					<div class="props">
						{#if expandedNode === node.id}
							{#each spec.props as p (p.name)}
								<label class="prop">
									<span class="prop-lbl">{p.label}</span>
									{#if p.kind === 'enum'}
										<select
											value={node.props?.[p.name] ?? p.defaultValue ?? ''}
											onchange={(ev) => setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
										>
											{#each p.enumValues ?? [] as v (v)}
												<option value={v}>{v}</option>
											{/each}
										</select>
									{:else if p.kind === 'boolean'}
										<input
											type="checkbox"
											checked={!!(node.props?.[p.name] ?? p.defaultValue)}
											onchange={(ev) => setProp(node.id, p.name, (ev.target as HTMLInputElement).checked)}
										/>
									{:else if p.kind === 'number'}
										<input
											type="number"
											value={(node.props?.[p.name] as number | undefined) ?? (p.defaultValue as number | undefined) ?? 0}
											oninput={(ev) => setProp(node.id, p.name, Number((ev.target as HTMLInputElement).value))}
										/>
									{:else if p.kind === 'modeRef' && p.modeRefKind === 'trackable'}
										<select
											value={(node.props?.[p.name] as string | undefined) ?? ''}
											onchange={(ev) => setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
										>
											<option value="">--</option>
											{#each TRACKABLE_OPTIONS as t (t)}
												<option value={t}>{t}</option>
											{/each}
										</select>
									{:else if p.kind === 'modeRef' && p.modeRefKind === 'entity'}
										<select
											value={(node.props?.[p.name] as string | undefined) ?? ''}
											onchange={(ev) => setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
										>
											<option value="">--</option>
											{#each ENTITY_OPTIONS as e (e)}
												<option value={e}>{e}</option>
											{/each}
										</select>
									{:else}
										<input
											type="text"
											value={(node.props?.[p.name] as string | undefined) ?? ''}
											oninput={(ev) => setProp(node.id, p.name, (ev.target as HTMLInputElement).value)}
										/>
									{/if}
								</label>
							{/each}
							{#if spec.props.length === 0}
								<small class="muted">Keine Properties.</small>
							{/if}
						{:else if spec.props.length > 0}
							<small class="prop-summary">
								{#each spec.props as p (p.name)}
									{@const v = node.props?.[p.name]}
									{#if v !== undefined && v !== ''}
										<span class="kv">{p.label}: <strong>{String(v)}</strong></span>
									{/if}
								{/each}
							</small>
						{/if}
					</div>

					<div class="pins outputs">
						{#each spec.outputs as p (p.name)}
							{@const k = pinKey(node.id, p.name, 'out')}
							{@const active = pendingFrom?.nodeId === node.id && pendingFrom?.pin === p.name}
							<button
								type="button"
								class="pin out"
								class:active
								data-pin-key={k}
								title="{p.name} ({p.type})"
								onclick={() => onOutputTap(node.id, p.name, p.type)}
								onpointerdown={(ev) => onOutputPointerDown(ev, node.id, p.name, p.type)}
								style:--pin-color={PIN_COLORS[p.type]}
							>
								<span class="lbl">{p.name}</span>
								<span class="dot"></span>
							</button>
						{/each}
					</div>
				</div>
			</article>
		{/each}

		{#if graph.nodes.length === 0}
			<div class="empty-state">
				<p class="empty">Leerer Graph. Wähle einen Start-Knoten.</p>
				<button type="button" class="empty-add" onclick={() => (paletteOpen = true)}>+ Node hinzufügen</button>
			</div>
		{/if}
	</div>

	<button type="button" class="fab" onclick={() => (paletteOpen = !paletteOpen)} aria-label="Node hinzufügen">
		<span class="fab-icon">{paletteOpen ? '✕' : '+'}</span>
		<span class="fab-label">{paletteOpen ? 'Schließen' : 'Node'}</span>
	</button>

	{#if paletteOpen}
		<div class="palette" role="dialog" aria-label="Node-Palette">
			{#each FAMILY_ORDER as fam (fam)}
				{@const items = Object.values(NODE_CATALOG).filter((s) => s.family === fam)}
				{#if items.length > 0}
					<section class="pal-section">
						<h3>{FAMILY_LABELS[fam]}</h3>
						<div class="pal-grid">
							{#each items as spec (spec.kind)}
								<button
									type="button"
									class="pal-item"
									style:--family-bg={FAMILY_BG[spec.family]}
									onclick={() => addNode(spec.kind)}
								>
									<strong>{spec.label}</strong>
									<small>{spec.description}</small>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			{/each}
		</div>
	{/if}

	{#if pendingFrom}
		<p class="hint">Tippe einen passenden Input-Pin ({pendingFrom.type}) oder den Output erneut um abzubrechen.</p>
	{/if}

	{#if !validation.ok}
		<details class="errs">
			<summary>{validation.errors.length} Validierungsfehler</summary>
			<ul>
				{#each validation.errors as err (err.message)}
					<li>{err.message}</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		position: relative;
	}
	.banner {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		background: white;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.banner .preview {
		font-style: italic;
		opacity: 0.85;
	}
	.banner .badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}
	.banner .badge.ok {
		color: oklch(40% 0.07 148);
		background: oklch(94% 0.04 148);
	}
	.banner .badge.warn {
		color: oklch(40% 0.1 25);
		background: oklch(94% 0.06 25);
	}
	.canvas {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem 0 5rem;
	}
	.edges {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}
	.edge-hit {
		fill: rgba(0, 0, 0, 0);
		pointer-events: auto;
		cursor: pointer;
	}
	.del-edge {
		background: oklch(60% 0.1 25);
		color: white;
		border: none;
		font-size: 0.7rem;
		padding: 0.2rem 0.4rem;
		border-radius: 6px;
		cursor: pointer;
	}
	.node {
		background: var(--family-bg, white);
		border-radius: 12px;
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		position: relative;
		z-index: 1;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}
	.node-head {
		display: flex;
		justify-content: space-between;
		gap: 0.4rem;
	}
	.node-title {
		background: transparent;
		border: none;
		text-align: left;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		cursor: pointer;
		padding: 0;
	}
	.fam {
		font-size: 0.7rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.macro {
		font-size: 0.65rem;
		background: oklch(40% 0.07 148);
		color: white;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		margin-left: 0.3rem;
	}
	.del {
		background: transparent;
		border: none;
		font-size: 1.2rem;
		opacity: 0.5;
		cursor: pointer;
		padding: 0 0.4rem;
	}
	.del:hover {
		opacity: 1;
	}
	.pins-row {
		display: grid;
		grid-template-columns: minmax(0, auto) 1fr minmax(0, auto);
		gap: 0.5rem;
		align-items: stretch;
	}
	.pins {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 60px;
	}
	.pins.inputs {
		align-items: flex-start;
	}
	.pins.outputs {
		align-items: flex-end;
	}
	.pin {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: white;
		border: 1px solid rgba(0, 0, 0, 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: 20px;
		cursor: pointer;
		font-size: 0.75rem;
		min-height: 32px;
	}
	.pin .dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--pin-color, gray);
		flex-shrink: 0;
	}
	.pin.required .dot {
		box-shadow: 0 0 0 2px oklch(60% 0.15 25);
	}
	.pin.compat {
		outline: 2px solid oklch(60% 0.1 148);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.pin.active {
		outline: 2px solid oklch(50% 0.15 80);
	}
	@keyframes pulse {
		0%,
		100% {
			outline-offset: 0;
		}
		50% {
			outline-offset: 3px;
		}
	}
	.props {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
	}
	.prop {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.prop-lbl {
		font-size: 0.7rem;
		opacity: 0.65;
	}
	.prop input,
	.prop select {
		padding: 0.25rem 0.4rem;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: white;
	}
	.prop-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		opacity: 0.75;
	}
	.muted {
		opacity: 0.5;
	}
	.kv {
		font-size: 0.7rem;
	}
	.empty {
		text-align: center;
		opacity: 0.6;
		font-style: italic;
		padding: 2rem;
	}
	.fab {
		position: sticky;
		bottom: 1rem;
		align-self: center;
		background: oklch(60% 0.055 148);
		color: white;
		border: none;
		min-height: 56px;
		padding: 0 1.25rem;
		border-radius: 28px;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}
	.fab-icon {
		font-size: 1.4rem;
		line-height: 1;
	}
	.fab-label {
		font-size: 0.95rem;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 1rem;
	}
	.empty-add {
		background: oklch(60% 0.055 148);
		color: white;
		border: none;
		padding: 0.6rem 1rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
	}
	.palette {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 70vh;
		overflow-y: auto;
		background: white;
		padding: 0.75rem;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
		z-index: 20;
	}
	.pal-section h3 {
		font-size: 0.85rem;
		margin: 0.5rem 0 0.3rem;
		opacity: 0.7;
	}
	.pal-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.4rem;
	}
	.pal-item {
		background: var(--family-bg, #eee);
		border: none;
		padding: 0.5rem;
		border-radius: 8px;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		cursor: pointer;
	}
	.pal-item small {
		font-size: 0.7rem;
		opacity: 0.7;
	}
	.hint {
		position: sticky;
		bottom: 5rem;
		background: oklch(50% 0.1 80);
		color: white;
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		font-size: 0.8rem;
		text-align: center;
	}
	.errs {
		background: white;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		font-size: 0.8rem;
	}
	.errs ul {
		margin: 0.3rem 0 0 1rem;
		padding: 0;
	}
</style>
