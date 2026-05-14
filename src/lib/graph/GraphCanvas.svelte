<!--
  @file graph/GraphCanvas.svelte -- Visual bet-graph editor (Phase 7.2 redesign).

  Design goals:
    - Compact, narrow node cards arranged in CENTERED ROWS by depth.
    - Inputs on TOP edge, Outputs on BOTTOM edge (vertical signal flow).
    - Pin-driven node creation: tap any unconnected pin to open a sheet listing
      only compatible nodes; selecting one auto-creates the node + the edge.
    - A single "+ Quelle" action exists for the empty state / extra sources.
    - Input pins (◀) and output pins (▶) are visually distinct.
    - Edges drawn as cubic curves with type-coloured stroke.
-->
<script lang="ts">
	import type { BetGraph, GraphNode, GraphEdge, GraphNodeKind } from '$lib/server/db/schema';
	import {
		NODE_CATALOG,
		FAMILY_LABELS,
		PIN_COLORS,
		type NodeFamily,
		type PinType,
		type NodeSpec
	} from '$lib/graph/catalog';
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

	// ----- UI state -----
	type PendingSlot =
		| { side: 'input'; nodeId: string; pin: string; type: PinType; multi: boolean }
		| { side: 'output'; nodeId: string; pin: string; type: PinType };
	let pendingSlot = $state<PendingSlot | null>(null);
	let sourcePickerOpen = $state(false);
	let expandedNode = $state<string | null>(null);
	let selectedEdgeIdx = $state<number | null>(null);

	let canvasEl: HTMLElement;
	let pinPositions = $state<Record<string, { x: number; y: number }>>({});

	// Drag-to-connect (from output pin -> input pin).
	type DragState = { fromNodeId: string; fromPin: string; type: PinType; x: number; y: number };
	let drag = $state<DragState | null>(null);

	const validation = $derived(validateGraph(graph));
	const preview = $derived(previewSentence(graph));

	const errorsByNode = $derived.by(() => {
		const map = new Map<string, string[]>();
		for (const err of validation.errors) {
			if (!err.nodeId) continue;
			const arr = map.get(err.nodeId) ?? [];
			arr.push(err.message);
			map.set(err.nodeId, arr);
		}
		return map;
	});

	function nodeExample(node: GraphNode, spec: NodeSpec): string | null {
		switch (node.kind) {
			case 'count': {
				const t = (node.props?.trackableId as string) || 'trackable';
				return `z. B. count(${t}) = 3`;
			}
			case 'sum':
				return 'z. B. sum_over(scope) = 12';
			case 'constant':
				return `Konstante ${node.props?.value ?? 0}`;
			case 'compare': {
				const op = (node.props?.op as string) ?? '>=';
				return `wenn a ${op} b`;
			}
			case 'and':
				return 'A ∧ B';
			case 'or':
				return 'A ∨ B';
			case 'not':
				return '¬ X';
			case 'now':
				return 'aktuelle Zeit in Sekunden';
			case 'first_occurrence':
				return 't_first(trackable, entity)';
			case 'rank':
				return `Top-${node.props?.topK ?? 'all'} sortiert ${node.props?.direction ?? 'desc'}`;
			default:
				return spec.description ?? null;
		}
	}

	const FAMILY_BG: Record<NodeFamily, string> = {
		source: 'oklch(94% 0.03 220)',
		compute: 'oklch(94% 0.04 80)',
		logic: 'oklch(94% 0.04 250)',
		outcome: 'oklch(94% 0.05 148)'
	};

	// ----- Layout: rows by depth -----
	type Row = { depth: number; nodes: GraphNode[] };

	function computeRows(g: BetGraph): Row[] {
		const depthOf = new Map<string, number>();
		function depth(id: string, seen: Set<string>): number {
			if (depthOf.has(id)) return depthOf.get(id)!;
			if (seen.has(id)) return 0;
			seen.add(id);
			const incoming = g.edges.filter((e) => e.to.nodeId === id);
			let d = 0;
			if (incoming.length > 0) {
				d = Math.max(...incoming.map((e) => depth(e.from.nodeId, seen))) + 1;
			}
			depthOf.set(id, d);
			return d;
		}
		for (const n of g.nodes) depth(n.id, new Set());
		const rows = new Map<number, GraphNode[]>();
		for (const n of g.nodes) {
			const d = depthOf.get(n.id) ?? 0;
			const arr = rows.get(d) ?? [];
			arr.push(n);
			rows.set(d, arr);
		}
		return Array.from(rows.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([depth, nodes]) => ({ depth, nodes }));
	}

	const rows = $derived(computeRows(graph));

	function newNodeId(kind: GraphNodeKind): string {
		let i = 1;
		while (graph.nodes.some((n) => n.id === `${kind}_${i}`)) i++;
		return `${kind}_${i}`;
	}

	function createNodeWithDefaults(kind: GraphNodeKind): GraphNode {
		const spec = NODE_CATALOG[kind];
		const props: Record<string, unknown> = {};
		for (const p of spec.props) if (p.defaultValue !== undefined) props[p.name] = p.defaultValue;
		return { id: newNodeId(kind), kind, props };
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
			nodes: graph.nodes.map((n) =>
				n.id === nodeId ? { ...n, props: { ...n.props, [key]: value } } : n
			)
		};
	}

	function pinIsConnected(nodeId: string, pin: string, side: 'in' | 'out'): boolean {
		if (side === 'in') return graph.edges.some((e) => e.to.nodeId === nodeId && e.to.pin === pin);
		return graph.edges.some((e) => e.from.nodeId === nodeId && e.from.pin === pin);
	}

	// ----- Compatible-node lookup -----
	type Suggestion = { spec: NodeSpec; pin: string };

	function suggestionsForInput(type: PinType): Suggestion[] {
		const out: Suggestion[] = [];
		for (const spec of Object.values(NODE_CATALOG)) {
			for (const p of spec.outputs) {
				if (p.type === type) out.push({ spec, pin: p.name });
			}
		}
		return out;
	}

	function suggestionsForOutput(type: PinType): Suggestion[] {
		const out: Suggestion[] = [];
		for (const spec of Object.values(NODE_CATALOG)) {
			for (const p of spec.inputs) {
				if (p.type === type) out.push({ spec, pin: p.name });
			}
		}
		return out;
	}

	function suggestionsForPending(): Suggestion[] {
		if (!pendingSlot) return [];
		return pendingSlot.side === 'input'
			? suggestionsForInput(pendingSlot.type)
			: suggestionsForOutput(pendingSlot.type);
	}

	function groupedSuggestions(): Array<{ family: NodeFamily; items: Suggestion[] }> {
		const all = suggestionsForPending();
		const groups = new Map<NodeFamily, Suggestion[]>();
		for (const s of all) {
			const arr = groups.get(s.spec.family) ?? [];
			arr.push(s);
			groups.set(s.spec.family, arr);
		}
		const order: NodeFamily[] = ['source', 'compute', 'logic', 'outcome'];
		return order
			.filter((f) => groups.has(f))
			.map((f) => ({ family: f, items: groups.get(f)! }));
	}

	function acceptSuggestion(sugg: Suggestion) {
		if (!pendingSlot) return;
		const newNode = createNodeWithDefaults(sugg.spec.kind);
		const edge: GraphEdge =
			pendingSlot.side === 'input'
				? {
						from: { nodeId: newNode.id, pin: sugg.pin },
						to: { nodeId: pendingSlot.nodeId, pin: pendingSlot.pin }
					}
				: {
						from: { nodeId: pendingSlot.nodeId, pin: pendingSlot.pin },
						to: { nodeId: newNode.id, pin: sugg.pin }
					};
		let newEdges = graph.edges;
		if (pendingSlot.side === 'input' && !pendingSlot.multi) {
			newEdges = newEdges.filter(
				(e) => !(e.to.nodeId === pendingSlot!.nodeId && e.to.pin === pendingSlot!.pin)
			);
		}
		graph = {
			...graph,
			nodes: [...graph.nodes, newNode],
			edges: [...newEdges, edge]
		};
		pendingSlot = null;
		expandedNode = newNode.id;
	}

	function addSource(kind: GraphNodeKind) {
		const newNode = createNodeWithDefaults(kind);
		graph = { ...graph, nodes: [...graph.nodes, newNode] };
		sourcePickerOpen = false;
		expandedNode = newNode.id;
	}

	function onPinTap(
		nodeId: string,
		pin: string,
		side: 'input' | 'output',
		type: PinType,
		multi = false
	) {
		if (pendingSlot && pendingSlot.nodeId === nodeId && pendingSlot.pin === pin) {
			pendingSlot = null;
			return;
		}
		if (side === 'input' && pinIsConnected(nodeId, pin, 'in') && !multi) {
			pendingSlot = null;
			return;
		}
		pendingSlot =
			side === 'input'
				? { side, nodeId, pin, type, multi }
				: { side, nodeId, pin, type };
	}

	function pinKey(nodeId: string, pin: string, side: 'in' | 'out') {
		return `${side}:${nodeId}:${pin}`;
	}

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
		void graph.nodes.length;
		void graph.edges.length;
		void expandedNode;
		void rows;
		requestAnimationFrame(recomputePinPositions);
	});

	$effect(() => {
		const ro = new ResizeObserver(() => recomputePinPositions());
		if (canvasEl) ro.observe(canvasEl);
		window.addEventListener('resize', recomputePinPositions);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', recomputePinPositions);
		};
	});

	function edgePath(e: GraphEdge): string {
		const a = pinPositions[pinKey(e.from.nodeId, e.from.pin, 'out')];
		const b = pinPositions[pinKey(e.to.nodeId, e.to.pin, 'in')];
		if (!a || !b) return '';
		const dy = Math.max(30, (b.y - a.y) * 0.5);
		return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
	}

	function edgeMid(e: GraphEdge): { x: number; y: number } | null {
		const a = pinPositions[pinKey(e.from.nodeId, e.from.pin, 'out')];
		const b = pinPositions[pinKey(e.to.nodeId, e.to.pin, 'in')];
		if (!a || !b) return null;
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function edgeColor(e: GraphEdge): string {
		const node = graph.nodes.find((n) => n.id === e.from.nodeId);
		if (!node) return 'oklch(70% 0.04 220)';
		const spec = NODE_CATALOG[node.kind];
		const pin = spec.outputs.find((p) => p.name === e.from.pin);
		return pin ? PIN_COLORS[pin.type] : 'oklch(70% 0.04 220)';
	}

	// ---- Drag-to-connect handlers (pointer events, fingers-friendly) ----
	function onOutputPinPointerDown(ev: PointerEvent, nodeId: string, pin: string, type: PinType) {
		if (ev.pointerType === 'mouse' && ev.button !== 0) return;
		(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
		const cr = canvasEl.getBoundingClientRect();
		drag = {
			fromNodeId: nodeId,
			fromPin: pin,
			type,
			x: ev.clientX - cr.left,
			y: ev.clientY - cr.top
		};
	}

	function onCanvasPointerMove(ev: PointerEvent) {
		if (!drag) return;
		const cr = canvasEl.getBoundingClientRect();
		drag = { ...drag, x: ev.clientX - cr.left, y: ev.clientY - cr.top };
	}

	function onCanvasPointerUp(ev: PointerEvent) {
		if (!drag) return;
		const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
		const pinEl = target?.closest<HTMLElement>('[data-pin-key]');
		if (pinEl) {
			const key = pinEl.dataset.pinKey!;
			const [side, nodeId, pin] = key.split(':') as ['in' | 'out', string, string];
			if (side === 'in' && nodeId !== drag.fromNodeId) {
				const spec = NODE_CATALOG[graph.nodes.find((n) => n.id === nodeId)!.kind];
				const pinDef = spec.inputs.find((p) => p.name === pin);
				if (pinDef && pinDef.type === drag.type) {
					let newEdges = graph.edges;
					if (!pinDef.multi) {
						newEdges = newEdges.filter((e) => !(e.to.nodeId === nodeId && e.to.pin === pin));
					}
					graph = {
						...graph,
						edges: [
							...newEdges,
							{
								from: { nodeId: drag.fromNodeId, pin: drag.fromPin },
								to: { nodeId, pin }
							}
						]
					};
				}
			}
		}
		drag = null;
	}

	function ghostPath(d: DragState): string {
		const a = pinPositions[pinKey(d.fromNodeId, d.fromPin, 'out')];
		if (!a) return '';
		const dy = Math.max(30, (d.y - a.y) * 0.5);
		return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${d.x} ${d.y - dy}, ${d.x} ${d.y}`;
	}

	const ENTITY_OPTIONS = $derived(mode.defaultEntities.map((e) => e.name));
	const TRACKABLE_OPTIONS = $derived(mode.trackables.map((t) => t.id));

	const SOURCE_NODES = Object.values(NODE_CATALOG).filter((s) => s.family === 'source');
</script>

<div class="wrap">
	<header class="banner">
		<span class="preview">{preview}</span>
		{#if validation.ok}
			<span class="badge ok">✓</span>
		{:else}
			<span class="badge warn">⚠ {validation.errors.length}</span>
		{/if}
	</header>

	<div
		class="canvas"
		bind:this={canvasEl}
		onpointermove={onCanvasPointerMove}
		onpointerup={onCanvasPointerUp}
		onpointercancel={() => (drag = null)}
	>
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
			{#if drag}
				<path
					d={ghostPath(drag)}
					stroke={PIN_COLORS[drag.type]}
					stroke-width="3"
					fill="none"
					stroke-linecap="round"
					stroke-dasharray="6 5"
					opacity="0.85"
				/>
			{/if}
			{#each graph.edges as e, i (i)}
				{@const m = edgeMid(e)}
				{#if m}
					<circle
						cx={m.x}
						cy={m.y}
						r="9"
						class="edge-hit"
						role="button"
						tabindex="0"
						aria-label="Edge {i + 1}"
						onclick={() => (selectedEdgeIdx = selectedEdgeIdx === i ? null : i)}
						onkeydown={(ev) => {
							if (ev.key === 'Enter' || ev.key === ' ') {
								ev.preventDefault();
								selectedEdgeIdx = selectedEdgeIdx === i ? null : i;
							}
						}}
					/>
					{#if selectedEdgeIdx === i}
						<foreignObject x={m.x - 30} y={m.y + 8} width="60" height="28">
							<button type="button" class="del-edge" onclick={() => deleteEdge(i)}>×</button>
						</foreignObject>
					{/if}
				{/if}
			{/each}
		</svg>

		{#each rows as row (row.depth)}
			<div class="row">
				{#each row.nodes as node (node.id)}
					{@const spec = NODE_CATALOG[node.kind]}
					{@const isExpanded = expandedNode === node.id}
					{@const nodeErrs = errorsByNode.get(node.id) ?? []}
					<article class="node" class:has-error={nodeErrs.length > 0} style:--family-bg={FAMILY_BG[spec.family]}>
						{#if spec.inputs.length > 0}
							<div class="pins-top">
								{#each spec.inputs as p (p.name)}
									{@const k = pinKey(node.id, p.name, 'in')}
									{@const connected = pinIsConnected(node.id, p.name, 'in')}
									{@const compat =
										(pendingSlot?.side === 'output' &&
											pendingSlot?.type === p.type &&
											pendingSlot?.nodeId !== node.id) ||
										(drag !== null && drag.type === p.type && drag.fromNodeId !== node.id)}
									<button
										type="button"
										class="pin pin-in"
										class:compat
										class:connected
										class:required={p.required}
										data-pin-key={k}
										title={p.name + ' (' + p.type + (p.required ? ', required' : '') + ')'}
										onclick={() => onPinTap(node.id, p.name, 'input', p.type, !!p.multi)}
										style:--pin-color={PIN_COLORS[p.type]}
										aria-label="Input {p.name}"
									>
										<span class="caret">◀</span>
										<span class="dot"></span>
										<span class="lbl">{p.name}</span>
									</button>
								{/each}
							</div>
						{/if}

						<button
							type="button"
							class="body"
							onclick={() => (expandedNode = isExpanded ? null : node.id)}
						>
							<span class="fam">{FAMILY_LABELS[spec.family]}</span>
							<strong>{spec.label}</strong>
							<div class="badges">
								{#if spec.macro}<span class="macro">M</span>{/if}
								{#if nodeErrs.length > 0}
									<span class="err-badge" title={nodeErrs.join('\n')}>⚠ {nodeErrs.length}</span>
								{/if}
							</div>
						</button>

						{#if !isExpanded && nodeExample(node, spec)}
							<small class="example">{nodeExample(node, spec)}</small>
						{/if}

						{#if isExpanded && nodeErrs.length > 0}
							<ul class="node-errs">
								{#each nodeErrs as msg (msg)}
									<li>{msg}</li>
								{/each}
							</ul>
						{/if}

						{#if isExpanded}
							<div class="props">
								{#each spec.props as p (p.name)}
									<label class="prop">
										<span class="prop-lbl">{p.label}</span>
										{#if p.kind === 'enum'}
											<select
												value={(node.props?.[p.name] as string | undefined) ?? p.defaultValue ?? ''}
												onchange={(ev) =>
													setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
											>
												{#each p.enumValues ?? [] as v (v)}
													<option value={v}>{v}</option>
												{/each}
											</select>
										{:else if p.kind === 'boolean'}
											<input
												type="checkbox"
												checked={!!(node.props?.[p.name] ?? p.defaultValue)}
												onchange={(ev) =>
													setProp(node.id, p.name, (ev.target as HTMLInputElement).checked)}
											/>
										{:else if p.kind === 'number'}
											<input
												type="number"
												value={(node.props?.[p.name] as number | undefined) ??
													(p.defaultValue as number | undefined) ??
													0}
												oninput={(ev) =>
													setProp(node.id, p.name, Number((ev.target as HTMLInputElement).value))}
											/>
										{:else if p.kind === 'modeRef' && p.modeRefKind === 'trackable'}
											<select
												value={(node.props?.[p.name] as string | undefined) ?? ''}
												onchange={(ev) =>
													setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
											>
												<option value="">--</option>
												{#each TRACKABLE_OPTIONS as t (t)}
													<option value={t}>{t}</option>
												{/each}
											</select>
										{:else if p.kind === 'modeRef' && p.modeRefKind === 'entity'}
											<select
												value={(node.props?.[p.name] as string | undefined) ?? ''}
												onchange={(ev) =>
													setProp(node.id, p.name, (ev.target as HTMLSelectElement).value)}
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
												oninput={(ev) =>
													setProp(node.id, p.name, (ev.target as HTMLInputElement).value)}
											/>
										{/if}
									</label>
								{/each}
								<button type="button" class="del-btn" onclick={() => deleteNode(node.id)}
									>Node löschen</button
								>
							</div>
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

						{#if spec.outputs.length > 0}
							<div class="pins-bottom">
								{#each spec.outputs as p (p.name)}
									{@const k = pinKey(node.id, p.name, 'out')}
									{@const active = pendingSlot?.nodeId === node.id && pendingSlot?.pin === p.name}
									{@const compat =
										pendingSlot?.side === 'input' &&
										pendingSlot?.type === p.type &&
										pendingSlot?.nodeId !== node.id}
									<button
										type="button"
										class="pin pin-out"
										class:active
										class:compat
										data-pin-key={k}
										title={p.name + ' (' + p.type + ')'}
										onclick={() => onPinTap(node.id, p.name, 'output', p.type)}
										onpointerdown={(ev) => onOutputPinPointerDown(ev, node.id, p.name, p.type)}
										style:--pin-color={PIN_COLORS[p.type]}
										aria-label="Output {p.name}"
									>
										<span class="lbl">{p.name}</span>
										<span class="dot"></span>
										<span class="caret">▶</span>
									</button>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/each}

		{#if graph.nodes.length === 0}
			<div class="empty">
				<p>Leerer Graph.</p>
				<button type="button" class="primary-action" onclick={() => (sourcePickerOpen = true)}>
					+ Quell-Node hinzufügen
				</button>
			</div>
		{/if}
	</div>

	<div class="toolbar">
		<button type="button" class="tool-btn" onclick={() => (sourcePickerOpen = true)}>+ Quelle</button>
		{#if !validation.ok}
			<details class="errs">
				<summary>{validation.errors.length} Fehler</summary>
				<ul>
					{#each validation.errors as err, i (i)}
						<li>{err.message}</li>
					{/each}
				</ul>
			</details>
		{/if}
	</div>

	{#if pendingSlot}
		<div
			class="sheet"
			role="dialog"
			aria-label="Kompatible Nodes"
			onclick={(ev) => {
				if (ev.target === ev.currentTarget) pendingSlot = null;
			}}
			onkeydown={(ev) => {
				if (ev.key === 'Escape') pendingSlot = null;
			}}
			tabindex="-1"
		>
			<div class="sheet-inner">
				<header class="sheet-head">
					<strong>
						{pendingSlot.side === 'input' ? 'Liefert' : 'Verbraucht'}:
						<span class="type-pill" style:--pin-color={PIN_COLORS[pendingSlot.type]}
							>{pendingSlot.type}</span
						>
					</strong>
					<button
						type="button"
						class="close"
						onclick={() => (pendingSlot = null)}
						aria-label="Schließen">×</button
					>
				</header>
				{#each groupedSuggestions() as g (g.family)}
					<section class="sg">
						<h4>{FAMILY_LABELS[g.family]}</h4>
						<div class="sg-grid">
							{#each g.items as s (s.spec.kind + ':' + s.pin)}
								<button
									type="button"
									class="sg-item"
									style:--family-bg={FAMILY_BG[s.spec.family]}
									onclick={() => acceptSuggestion(s)}
								>
									<strong>{s.spec.label}</strong>
									<small>{s.spec.description}</small>
									<em class="pin-hint">{s.pin}</em>
								</button>
							{/each}
						</div>
					</section>
				{/each}
				{#if groupedSuggestions().length === 0}
					<p class="muted">Keine kompatiblen Nodes verfügbar.</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if sourcePickerOpen}
		<div
			class="sheet"
			role="dialog"
			aria-label="Quellen"
			onclick={(ev) => {
				if (ev.target === ev.currentTarget) sourcePickerOpen = false;
			}}
			onkeydown={(ev) => {
				if (ev.key === 'Escape') sourcePickerOpen = false;
			}}
			tabindex="-1"
		>
			<div class="sheet-inner">
				<header class="sheet-head">
					<strong>Quell-Node wählen</strong>
					<button
						type="button"
						class="close"
						onclick={() => (sourcePickerOpen = false)}
						aria-label="Schließen">×</button
					>
				</header>
				<div class="sg-grid">
					{#each SOURCE_NODES as s (s.kind)}
						<button
							type="button"
							class="sg-item"
							style:--family-bg={FAMILY_BG.source}
							onclick={() => addSource(s.kind)}
						>
							<strong>{s.label}</strong>
							<small>{s.description}</small>
						</button>
					{/each}
				</div>
			</div>
		</div>
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
		padding: 0.4rem 0.7rem;
		background: white;
		border-radius: 8px;
		font-size: 0.8rem;
	}
	.banner .preview {
		font-style: italic;
		opacity: 0.85;
		flex: 1;
	}
	.banner .badge {
		font-weight: 600;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		font-size: 0.75rem;
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
		gap: 2.5rem;
		padding: 1.25rem 0;
		min-height: 220px;
		background-color: oklch(98.5% 0.005 100);
		background-image:
			radial-gradient(circle at 1px 1px, oklch(85% 0.01 100) 1px, transparent 1.5px);
		background-size: 20px 20px;
		border-radius: 12px;
		touch-action: none;
	}
	.edges {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
		overflow: visible;
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
		font-size: 0.9rem;
		padding: 0.1rem 0.45rem;
		border-radius: 6px;
		cursor: pointer;
		line-height: 1;
	}
	.row {
		display: flex;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		position: relative;
		z-index: 1;
	}
	.node {
		background: linear-gradient(180deg, var(--family-bg, white) 0%, white 100%);
		border-radius: 14px;
		padding: 0.3rem 0.35rem;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
		min-width: 140px;
		max-width: 180px;
		box-shadow:
			0 1px 2px oklch(20% 0.02 220 / 0.06),
			0 4px 12px oklch(20% 0.02 220 / 0.08);
		border: 1px solid oklch(90% 0.01 100);
		transition: box-shadow 0.15s, transform 0.15s;
	}
	.node:hover {
		box-shadow:
			0 2px 4px oklch(20% 0.02 220 / 0.08),
			0 8px 20px oklch(20% 0.02 220 / 0.12);
		transform: translateY(-1px);
	}
	.node.has-error {
		border-color: oklch(70% 0.12 25);
		box-shadow:
			0 0 0 1px oklch(70% 0.12 25 / 0.3),
			0 4px 12px oklch(70% 0.12 25 / 0.15);
	}
	.pins-top,
	.pins-bottom {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.2rem;
	}
	.pins-top {
		margin-top: -0.55rem;
	}
	.pins-bottom {
		margin-bottom: -0.55rem;
	}
	.body {
		background: transparent;
		border: none;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.25rem 0.4rem;
		cursor: pointer;
	}
	.fam {
		font-size: 0.58rem;
		opacity: 0.45;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}
	.body strong {
		font-size: 0.88rem;
		line-height: 1.2;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.badges {
		display: flex;
		gap: 0.2rem;
		margin-top: 0.15rem;
	}
	.macro {
		font-size: 0.6rem;
		background: oklch(40% 0.07 148);
		color: white;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}
	.err-badge {
		font-size: 0.6rem;
		background: oklch(60% 0.15 25);
		color: white;
		padding: 0.05rem 0.35rem;
		border-radius: 4px;
		font-weight: 600;
		cursor: help;
	}
	.example {
		font-size: 0.65rem;
		opacity: 0.55;
		font-style: italic;
		padding: 0 0.45rem 0.2rem;
		line-height: 1.25;
	}
	.node-errs {
		margin: 0 0.4rem 0.3rem;
		padding: 0.35rem 0.5rem;
		background: oklch(96% 0.03 25);
		border-left: 2.5px solid oklch(60% 0.15 25);
		border-radius: 4px;
		list-style: none;
		font-size: 0.65rem;
		color: oklch(40% 0.1 25);
	}
	.node-errs li {
		margin: 0.1rem 0;
	}
	.pin {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.2rem 0.5rem;
		font-size: 0.65rem;
		cursor: pointer;
		border: 1px solid oklch(85% 0.01 100);
		min-height: 22px;
		line-height: 1;
		background: white;
		box-shadow: 0 1px 2px oklch(20% 0.02 220 / 0.06);
		transition: transform 0.1s, box-shadow 0.1s;
	}
	.pin:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 4px oklch(20% 0.02 220 / 0.1);
	}
	.pin-in {
		border-radius: 2px 2px 14px 14px;
		border-top: none;
	}
	.pin-out {
		border-radius: 14px 14px 2px 2px;
		border-bottom: none;
	}
	.pin .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--pin-color, gray);
		flex-shrink: 0;
	}
	.pin .caret {
		font-size: 0.6rem;
		color: var(--pin-color, gray);
		font-weight: 700;
	}
	.pin .lbl {
		opacity: 0.75;
	}
	.pin.required .dot {
		box-shadow: 0 0 0 1.5px oklch(60% 0.15 25);
	}
	.pin.connected {
		background: var(--pin-color, white);
	}
	.pin.connected .lbl,
	.pin.connected .caret {
		color: oklch(20% 0.02 220);
	}
	.pin.compat {
		outline: 2px solid oklch(60% 0.12 148);
		animation: pulse 1.1s ease-in-out infinite;
		z-index: 5;
	}
	.pin.active {
		outline: 2px solid oklch(50% 0.15 80);
		z-index: 5;
	}
	@keyframes pulse {
		0%,
		100% {
			outline-offset: 0;
			box-shadow: 0 0 0 0 oklch(60% 0.12 148 / 0.4);
		}
		50% {
			outline-offset: 3px;
			box-shadow: 0 0 0 4px oklch(60% 0.12 148 / 0.1);
		}
	}
	.props {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0 0.35rem 0.3rem;
	}
	.prop {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-size: 0.75rem;
	}
	.prop-lbl {
		font-size: 0.65rem;
		opacity: 0.65;
	}
	.prop input,
	.prop select {
		padding: 0.2rem 0.3rem;
		border-radius: 4px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: white;
		font-size: 0.75rem;
	}
	.prop-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 0.4rem;
		opacity: 0.7;
		padding: 0 0.35rem 0.25rem;
	}
	.kv {
		font-size: 0.65rem;
	}
	.del-btn {
		margin-top: 0.2rem;
		background: oklch(60% 0.1 25);
		color: white;
		border: none;
		padding: 0.25rem;
		border-radius: 5px;
		cursor: pointer;
		font-size: 0.7rem;
	}
	.empty {
		text-align: center;
		opacity: 0.85;
		padding: 1.5rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		align-items: center;
	}
	.empty p {
		opacity: 0.55;
		margin: 0;
		font-style: italic;
	}
	.primary-action,
	.tool-btn {
		background: oklch(60% 0.055 148);
		color: white;
		border: none;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		font-size: 0.85rem;
		cursor: pointer;
		font-weight: 500;
	}
	.toolbar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		padding: 0.25rem 0;
	}
	.errs {
		background: white;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		font-size: 0.75rem;
		flex: 1;
		min-width: 12rem;
	}
	.errs ul {
		margin: 0.25rem 0 0 1rem;
		padding: 0;
	}
	.sheet {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 100;
	}
	.sheet-inner {
		background: white;
		width: 100%;
		max-width: 540px;
		max-height: 75vh;
		overflow-y: auto;
		padding: 0.85rem;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
	}
	.sheet-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		margin-bottom: 0.5rem;
	}
	.type-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.05rem 0.45rem;
		border-radius: 999px;
		background: var(--pin-color, gray);
		color: oklch(20% 0.02 220);
		font-size: 0.7rem;
		font-weight: 600;
	}
	.close {
		background: transparent;
		border: none;
		font-size: 1.4rem;
		cursor: pointer;
		opacity: 0.6;
		line-height: 1;
		padding: 0 0.4rem;
	}
	.sg {
		margin-bottom: 0.5rem;
	}
	.sg h4 {
		font-size: 0.75rem;
		margin: 0.4rem 0 0.3rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.sg-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.4rem;
	}
	.sg-item {
		background: var(--family-bg, #eee);
		border: none;
		padding: 0.5rem;
		border-radius: 8px;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		cursor: pointer;
		position: relative;
	}
	.sg-item strong {
		font-size: 0.85rem;
	}
	.sg-item small {
		font-size: 0.7rem;
		opacity: 0.7;
	}
	.sg-item .pin-hint {
		position: absolute;
		top: 0.3rem;
		right: 0.4rem;
		font-size: 0.6rem;
		opacity: 0.5;
		font-style: italic;
	}
	.muted {
		opacity: 0.6;
		text-align: center;
		font-style: italic;
		padding: 1rem;
	}
</style>
