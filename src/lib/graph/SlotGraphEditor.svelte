<script lang="ts">
	/**
	 * SlotGraphEditor.svelte — Graph 2.0 grid-based bet-graph editor.
	 *
	 * Phase 21d. Replaces GraphCanvas.svelte.
	 *
	 * Layout:
	 *   ┌────────────┬──────────────────────────────┬───────────────┐
	 *   │ Catalog    │  20×10 Slot-Grid (scroll xy) │  Inspector    │
	 *   │ (sidebar)  │  + Bezier-Wire SVG-Layer     │  (props)      │
	 *   ├────────────┴──────────────────────────────┴───────────────┤
	 *   │ StatusBar — preview + errors + save                       │
	 *   └────────────────────────────────────────────────────────────┘
	 *
	 * State: `graph` is $bindable, mutations are direct (.push, .splice). Svelte 5
	 * rune reactivity propagates from parent.
	 */
	import {
		NODE_CATALOG,
		CORE_KINDS,
		ADVANCED_KINDS,
		FAMILY_LABELS,
		FAMILY_COLORS,
		PIN_COLORS,
		enumLabel,
		type NodeFamily,
		type PinDef,
		type PinType
	} from './catalog';
	import { validateGraph } from './validate';
	import { previewSentence } from './preview';
	import type {
		BetGraph,
		GraphEdge,
		GraphNode,
		GraphNodeKind,
		GraphNodePos
	} from '$lib/server/db/schema';
	import { GRAPH_GRID_COLS, GRAPH_GRID_ROWS } from '$lib/graph/grid';
	import Icon from '$lib/components/Icon.svelte';

	type ModeContext = {
		entities: Array<{ name: string }>;
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

	// ---------- layout constants ----------
	const SLOT_W = 180;
	const SLOT_H = 110;
	const TILE_W = 160;
	const TILE_H = 90;
	const COLS = GRAPH_GRID_COLS;
	const ROWS = GRAPH_GRID_ROWS;

	// ---------- UI state ----------
	let selectedNodeId = $state<string | null>(null);
	let showAdvanced = $state(false);
	let searchQuery = $state('');
	let canvasEl = $state<HTMLDivElement | undefined>();

	/** Wire-drag (from output pin → drop on input pin). */
	type WireDrag = {
		fromNodeId: string;
		fromPin: string;
		fromType: PinType;
		x: number;
		y: number;
	};
	let wireDrag = $state<WireDrag | null>(null);

	/** Sidebar drag (kind being placed). */
	let sidebarDragKind = $state<GraphNodeKind | null>(null);
	/** Existing-node drag (re-snap to new slot). */
	let nodeDragId = $state<string | null>(null);
	let nodeDragOffset = $state<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

	/** Hover slot during drag (for preview). */
	let hoverSlot = $state<GraphNodePos | null>(null);

	/** Mobile drawer toggles (hidden on desktop via CSS). */
	let mobileCatalogOpen = $state(false);
	let mobileInspectorOpen = $state(false);

	const validation = $derived(validateGraph(graph));
	const preview = $derived(previewSentence(graph));

	const selectedNode = $derived(
		selectedNodeId ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null) : null
	);

	// Auto-fit visible grid to occupied content (+ buffer), bounded by full grid.
	const visibleCols = $derived(
		Math.min(
			COLS,
			Math.max(6, graph.nodes.reduce((m, n) => Math.max(m, n.pos.col), 0) + 3)
		)
	);
	const visibleRows = $derived(
		Math.min(
			ROWS,
			Math.max(4, graph.nodes.reduce((m, n) => Math.max(m, n.pos.row), 0) + 2)
		)
	);

	// ---------- catalog filtered ----------
	const catalogKinds = $derived(
		[...CORE_KINDS, ...(showAdvanced ? ADVANCED_KINDS : [])].filter((k) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.trim().toLowerCase();
			const spec = NODE_CATALOG[k];
			return spec.label.toLowerCase().includes(q) || spec.description.toLowerCase().includes(q);
		})
	);

	const catalogByFamily = $derived.by(() => {
		const groups: Record<NodeFamily, GraphNodeKind[]> = {
			source: [],
			compute: [],
			logic: [],
			outcome: []
		};
		for (const k of catalogKinds) {
			groups[NODE_CATALOG[k].family].push(k);
		}
		return groups;
	});

	// ---------- slot occupancy ----------
	const slotOccupant = $derived.by(() => {
		const m = new Map<string, GraphNode>();
		for (const n of graph.nodes) {
			m.set(`${n.pos.col},${n.pos.row}`, n);
		}
		return m;
	});

	function getOccupant(col: number, row: number): GraphNode | undefined {
		return slotOccupant.get(`${col},${row}`);
	}

	// ---------- pin position math ----------
	function pinY(pinIndex: number, totalPins: number): number {
		if (totalPins === 0) return TILE_H / 2;
		// distribute pins evenly along left/right edge
		const margin = 16;
		const avail = TILE_H - 2 * margin;
		if (totalPins === 1) return TILE_H / 2;
		return margin + (avail * pinIndex) / (totalPins - 1);
	}

	function nodeOrigin(n: GraphNode): { x: number; y: number } {
		return {
			x: n.pos.col * SLOT_W + (SLOT_W - TILE_W) / 2,
			y: n.pos.row * SLOT_H + (SLOT_H - TILE_H) / 2
		};
	}

	function inputPinPos(n: GraphNode, pinName: string): { x: number; y: number } {
		const spec = NODE_CATALOG[n.kind];
		const idx = spec.inputs.findIndex((p) => p.name === pinName);
		const o = nodeOrigin(n);
		return { x: o.x, y: o.y + pinY(idx < 0 ? 0 : idx, spec.inputs.length) };
	}

	function outputPinPos(n: GraphNode, pinName: string): { x: number; y: number } {
		const spec = NODE_CATALOG[n.kind];
		const idx = spec.outputs.findIndex((p) => p.name === pinName);
		const o = nodeOrigin(n);
		return { x: o.x + TILE_W, y: o.y + pinY(idx < 0 ? 0 : idx, spec.outputs.length) };
	}

	// ---------- node operations ----------
	function genNodeId(kind: GraphNodeKind): string {
		const base = `${kind}_${Math.random().toString(36).slice(2, 7)}`;
		return base;
	}

	function defaultPropsFor(kind: GraphNodeKind): Record<string, unknown> {
		const props: Record<string, unknown> = {};
		for (const p of NODE_CATALOG[kind].props) {
			if (p.defaultValue !== undefined) props[p.name] = p.defaultValue;
		}
		return props;
	}

	function findFreeSlotNear(col: number, row: number): GraphNodePos {
		if (!getOccupant(col, row)) return { col, row };
		// spiral search outward
		for (let r = 1; r < Math.max(COLS, ROWS); r++) {
			for (let dr = -r; dr <= r; dr++) {
				for (let dc = -r; dc <= r; dc++) {
					if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
					const c = col + dc;
					const rr = row + dr;
					if (c < 0 || c >= COLS || rr < 0 || rr >= ROWS) continue;
					if (!getOccupant(c, rr)) return { col: c, row: rr };
				}
			}
		}
		return { col: 0, row: 0 };
	}

	function addNodeAt(kind: GraphNodeKind, pos: GraphNodePos) {
		const slot = getOccupant(pos.col, pos.row) ? findFreeSlotNear(pos.col, pos.row) : pos;
		const newNode: GraphNode = {
			id: genNodeId(kind),
			kind,
			pos: slot,
			props: defaultPropsFor(kind)
		};
		graph.nodes.push(newNode);
		selectedNodeId = newNode.id;
	}

	/** Spawn from sidebar click (mobile-friendly fallback to DnD). */
	function spawnFromCatalog(kind: GraphNodeKind) {
		// First free slot scanning row-major.
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				if (!getOccupant(c, r)) {
					addNodeAt(kind, { col: c, row: r });
					mobileCatalogOpen = false;
					return;
				}
			}
		}
	}

	function moveNode(id: string, pos: GraphNodePos) {
		const n = graph.nodes.find((x) => x.id === id);
		if (!n) return;
		if (getOccupant(pos.col, pos.row) && getOccupant(pos.col, pos.row)?.id !== id) return;
		n.pos = pos;
	}

	function deleteNode(id: string) {
		const idx = graph.nodes.findIndex((n) => n.id === id);
		if (idx < 0) return;
		graph.nodes.splice(idx, 1);
		// remove all edges touching this node
		graph.edges = graph.edges.filter(
			(e) => e.from.nodeId !== id && e.to.nodeId !== id
		);
		if (selectedNodeId === id) selectedNodeId = null;
	}

	function addEdge(
		fromId: string,
		fromPin: string,
		toId: string,
		toPin: string,
		multi: boolean
	) {
		if (fromId === toId) return;
		// remove existing edge into this input (unless multi)
		if (!multi) {
			graph.edges = graph.edges.filter(
				(e) => !(e.to.nodeId === toId && e.to.pin === toPin)
			);
		}
		graph.edges.push({
			from: { nodeId: fromId, pin: fromPin },
			to: { nodeId: toId, pin: toPin }
		});
	}

	function deleteEdge(idx: number) {
		graph.edges.splice(idx, 1);
	}

	// ---------- drag from sidebar ----------
	function onSidebarDragStart(ev: DragEvent, kind: GraphNodeKind) {
		sidebarDragKind = kind;
		ev.dataTransfer?.setData('text/plain', `kind:${kind}`);
		if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
	}

	function slotFromMouse(ev: { clientX: number; clientY: number }): GraphNodePos | null {
		if (!canvasEl) return null;
		const rect = canvasEl.getBoundingClientRect();
		const x = ev.clientX - rect.left + canvasEl.scrollLeft;
		const y = ev.clientY - rect.top + canvasEl.scrollTop;
		const col = Math.floor(x / SLOT_W);
		const row = Math.floor(y / SLOT_H);
		if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
		return { col, row };
	}

	function onCanvasDragOver(ev: DragEvent) {
		if (!sidebarDragKind && !nodeDragId) return;
		ev.preventDefault();
		if (ev.dataTransfer) ev.dataTransfer.dropEffect = sidebarDragKind ? 'copy' : 'move';
		hoverSlot = slotFromMouse(ev);
	}

	function onCanvasDrop(ev: DragEvent) {
		ev.preventDefault();
		const slot = slotFromMouse(ev);
		if (!slot) {
			sidebarDragKind = null;
			nodeDragId = null;
			hoverSlot = null;
			return;
		}
		if (sidebarDragKind) {
			addNodeAt(sidebarDragKind, slot);
		} else if (nodeDragId) {
			moveNode(nodeDragId, slot);
		}
		sidebarDragKind = null;
		nodeDragId = null;
		hoverSlot = null;
	}

	function onNodeDragStart(ev: DragEvent, n: GraphNode) {
		nodeDragId = n.id;
		ev.dataTransfer?.setData('text/plain', `node:${n.id}`);
		if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
	}

	// ---------- pin wire-drag ----------
	function onOutputPinPointerDown(ev: PointerEvent, n: GraphNode, pin: PinDef) {
		ev.stopPropagation();
		const pos = outputPinPos(n, pin.name);
		wireDrag = {
			fromNodeId: n.id,
			fromPin: pin.name,
			fromType: pin.type,
			x: pos.x,
			y: pos.y
		};
		window.addEventListener('pointermove', onWindowPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
	}

	function onWindowPointerMove(ev: PointerEvent) {
		if (!wireDrag || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		wireDrag.x = ev.clientX - rect.left + canvasEl.scrollLeft;
		wireDrag.y = ev.clientY - rect.top + canvasEl.scrollTop;
	}

	function onWindowPointerUp() {
		wireDrag = null;
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
	}

	function canConnect(fromType: PinType, toType: PinType): boolean {
		if (fromType === toType) return true;
		// Mirror coercions in validate.ts
		if (fromType === 'Number' && toType === 'Timestamp') return true;
		if (fromType === 'EntityList' && toType === 'Entity') return true;
		if (fromType === 'Entity' && toType === 'EntityList') return true;
		return false;
	}

	function onInputPinPointerUp(ev: PointerEvent, n: GraphNode, pin: PinDef) {
		if (!wireDrag) return;
		ev.stopPropagation();
		if (canConnect(wireDrag.fromType, pin.type)) {
			addEdge(wireDrag.fromNodeId, wireDrag.fromPin, n.id, pin.name, pin.multi === true);
		}
		wireDrag = null;
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
	}

	// ---------- bezier path ----------
	function bezierPath(
		x1: number,
		y1: number,
		x2: number,
		y2: number
	): string {
		const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
		return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
	}

	// ---------- keyboard ----------
	function onKeyDown(ev: KeyboardEvent) {
		if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
			return;
		}
		if (ev.key === 'Delete' || ev.key === 'Backspace') {
			if (selectedNodeId) {
				ev.preventDefault();
				deleteNode(selectedNodeId);
			}
		}
		if ((ev.ctrlKey || ev.metaKey) && ev.key === 'd') {
			if (selectedNodeId) {
				ev.preventDefault();
				const src = graph.nodes.find((n) => n.id === selectedNodeId);
				if (src) {
					const slot = findFreeSlotNear(src.pos.col + 1, src.pos.row);
					const clone: GraphNode = {
						id: genNodeId(src.kind),
						kind: src.kind,
						pos: slot,
						props: structuredClone(src.props ?? {})
					};
					graph.nodes.push(clone);
					selectedNodeId = clone.id;
				}
			}
		}
	}

	// ---------- inspector mutations ----------
	function setProp(key: string, value: unknown) {
		if (!selectedNode) return;
		const props = { ...(selectedNode.props ?? {}) };
		props[key] = value;
		selectedNode.props = props;
	}

	// pin colour
	function pinColor(type: PinType): string {
		return PIN_COLORS[type];
	}

	function familyColor(family: NodeFamily): string {
		return FAMILY_COLORS[family];
	}
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="editor-root">
	<!-- ============ CATALOG SIDEBAR (left) ============ -->
	<aside class="catalog" class:mobile-open={mobileCatalogOpen}>
		<header class="catalog-header">
			<div class="mobile-drawer-head">
				<span class="text-xs font-semibold uppercase opacity-70">Bausteine</span>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle"
					aria-label="Schließen"
					onclick={() => (mobileCatalogOpen = false)}
				>
					<Icon name="X" size={14} />
				</button>
			</div>
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Suche…"
				bind:value={searchQuery}
			/>
			<label class="label cursor-pointer mt-2 flex items-center gap-2 py-0">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showAdvanced} />
				<span class="text-xs">Erweitert</span>
			</label>
		</header>
		<div class="catalog-body">
			{#each ['source', 'compute', 'logic', 'outcome'] as family (family)}
				{#if catalogByFamily[family as NodeFamily].length > 0}
					<details open class="catalog-group">
						<summary
							style:--fam={familyColor(family as NodeFamily)}
							class="catalog-group-title"
						>
							{FAMILY_LABELS[family as NodeFamily]}
						</summary>
						<div class="catalog-list">
							{#each catalogByFamily[family as NodeFamily] as kind (kind)}
								{@const spec = NODE_CATALOG[kind]}
								<button
									type="button"
									class="catalog-item"
									style:--fam={familyColor(spec.family)}
									draggable="true"
									ondragstart={(ev) => onSidebarDragStart(ev, kind)}
									onclick={() => spawnFromCatalog(kind)}
									title="{spec.description} — Klick um zu spawnen, oder ziehen"
								>
									{#if spec.icon}
										<Icon name={spec.icon} size={14} />
									{/if}
									<span>{spec.label}</span>
								</button>
							{/each}
						</div>
					</details>
				{/if}
			{/each}
		</div>
	</aside>

	<!-- ============ CANVAS (center) ============ -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
	<div
		class="canvas-scroll"
		bind:this={canvasEl}
		role="region"
		aria-label="Bet-Graph Canvas"
		ondragover={onCanvasDragOver}
		ondrop={onCanvasDrop}
		onclick={(e) => {
			if (e.target === e.currentTarget) selectedNodeId = null;
		}}
	>
		<div
			class="canvas-visibleCols * SLOT_W}px"
			style:height="{visibleRows * SLOT_H}px"
		>
			<!-- background grid dots -->
			<svg class="grid-dots" width={visibleCols * SLOT_W} height={visibleRows * SLOT_H}>
				{#each Array(visibleCols) as _, c}
					{#each Array(visibleRowsSLOT_W + SLOT_W / 2} cy={r * SLOT_H + SLOT_H / 2} r="1.5" />
					{/each}
				{/each}
			</svg>

			<!-- hover-slot ghost -->
			{#if hoverSlot}
				<div
					class="slot-ghost"
					style:left="{hoverSlot.col * SLOT_W + (SLOT_W - TILE_W) / 2}px"
					style:top="{hoverSlot.row * SLOT_H + (SLOT_H - TILE_H) / 2}px"
					style:width="{TILE_W}px"
					style:height="{TILE_H}px"
				></div>
			{/if}

			<!-- wires -->
			<svg
				class="wires"
				width={visibleCols * SLOT_W}
				height={visibleRows * SLOT_H}
				pointer-events="none"
			>
				{#each graph.edges as e, i (i + e.from.nodeId + e.to.nodeId)}
					{@const fromNode = graph.nodes.find((n) => n.id === e.from.nodeId)}
					{@const toNode = graph.nodes.find((n) => n.id === e.to.nodeId)}
					{#if fromNode && toNode}
						{@const fp = outputPinPos(fromNode, e.from.pin)}
						{@const tp = inputPinPos(toNode, e.to.pin)}
						{@const spec = NODE_CATALOG[fromNode.kind]}
						{@const pin = spec.outputs.find((p) => p.name === e.from.pin)}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<path
							role="button"
							aria-label="Verbindung löschen"
							d={bezierPath(fp.x, fp.y, tp.x, tp.y)}
							stroke={pin ? pinColor(pin.type) : '#888'}
							stroke-width="2.5"
							fill="none"
							style:pointer-events="stroke"
							onclick={(ev) => {
								ev.stopPropagation();
								deleteEdge(i);
							}}
							class="wire"
						/>
					{/if}
				{/each}
				{#if wireDrag}
					{@const wd = wireDrag}
					{@const fromNode = graph.nodes.find((n) => n.id === wd.fromNodeId)}
					{#if fromNode}
						{@const fp = outputPinPos(fromNode, wd.fromPin)}
						<path
							d={bezierPath(fp.x, fp.y, wd.x, wd.y)}
							stroke={pinColor(wd.fromType)}
							stroke-width="2.5"
							fill="none"
							stroke-dasharray="6 4"
						/>
					{/if}
				{/if}
			</svg>

			<!-- node tiles -->
			{#each graph.nodes as n (n.id)}
				{@const spec = NODE_CATALOG[n.kind]}
				{@const o = nodeOrigin(n)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="tile"
					class:selected={selectedNodeId === n.id}
					style:left="{o.x}px"
					style:top="{o.y}px"
					style:width="{TILE_W}px"
					style:height="{TILE_H}px"
					style:--fam={familyColor(spec.family)}
					draggable="true"
					ondragstart={(ev) => onNodeDragStart(ev, n)}
					onclick={(e) => {
						e.stopPropagation();
						selectedNodeId = n.id;
						mobileInspectorOpen = true;
					}}
					role="button"
					tabindex="0"
				>
					<div class="tile-header">
						{#if spec.icon}
							<Icon name={spec.icon} size={12} />
						{/if}
						<span class="tile-label">{spec.label}</span>
					</div>
					<div class="tile-body">
						{#if n.kind === 'event'}
							{(mode.trackables.find((t) => t.id === (n.props as any)?.trackableId)?.label) ?? '—'}
						{:else if n.kind === 'entity'}
							{(n.props as any)?.entityName ?? '—'}
						{:else if n.kind === 'number'}
							{(n.props as any)?.value ?? 0}
						{:else if n.kind === 'compare'}
							{enumLabel('op', String((n.props as any)?.op ?? 'gte'))}
						{:else if n.kind === 'combine'}
							{enumLabel('combine', String((n.props as any)?.combine ?? 'and'))}
						{:else if n.kind === 'aggregate'}
							{enumLabel('agg', String((n.props as any)?.agg ?? 'count'))}
						{:else if n.kind === 'rank'}
							{enumLabel('direction', String((n.props as any)?.direction ?? 'desc'))}
							{#if Number((n.props as any)?.threshold ?? 0) > 0}
								· ≥ {(n.props as any)?.threshold}
							{/if}
						{/if}
					</div>

					<!-- input pins (left edge) -->
					{#each spec.inputs as p, idx (p.name)}
						<button
							type="button"
							class="pin pin-in"
							style:top="{pinY(idx, spec.inputs.length) - 6}px"
							style:background={pinColor(p.type)}
							title="{p.name} ({p.type}){p.required ? ' *' : ''}"
							onpointerup={(ev) => onInputPinPointerUp(ev, n, p)}
						></button>
					{/each}
					<!-- output pins (right edge) -->
					{#each spec.outputs as p, idx (p.name)}
						<button
							type="button"
							class="pin pin-out"
							style:top="{pinY(idx, spec.outputs.length) - 6}px"
							style:background={pinColor(p.type)}
							title="{p.name} ({p.type})"
							onpointerdown={(ev) => onOutputPinPointerDown(ev, n, p)}
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- ============ INSPECTOR (right) ============ -->
	<aside class="inspector" class:visible={selectedNode !== null} class:mobile-open={mobileInspectorOpen}>
		<div class="mobile-drawer-head">
			<span class="text-xs font-semibold uppercase opacity-70">Eigenschaften</span>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-circle"
				aria-label="Schließen"
				onclick={() => (mobileInspectorOpen = false)}
			>
				<Icon name="X" size={14} />
			</button>
		</div>
		{#if selectedNode}
			{@const spec = NODE_CATALOG[selectedNode.kind]}
			<header class="inspector-header" style:--fam={familyColor(spec.family)}>
				{#if spec.icon}
					<Icon name={spec.icon} size={16} />
				{/if}
				<h3 class="text-sm font-semibold flex-1">{spec.label}</h3>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => deleteNode(selectedNode.id)}
					title="Knoten löschen (Entf)"
				>
					<Icon name="Trash2" size={14} />
				</button>
			</header>
			<p class="inspector-desc">{spec.description}</p>
			<div class="inspector-props">
				{#each spec.props as p (p.name)}
					<label class="inspector-prop">
						<span class="text-xs font-medium">{p.label}</span>
						{#if p.kind === 'string'}
							<input
								type="text"
								class="input input-bordered input-sm w-full"
								value={String((selectedNode.props as any)?.[p.name] ?? p.defaultValue ?? '')}
								oninput={(ev) => setProp(p.name, (ev.target as HTMLInputElement).value)}
							/>
						{:else if p.kind === 'number'}
							<input
								type="number"
								class="input input-bordered input-sm w-full"
								value={Number((selectedNode.props as any)?.[p.name] ?? p.defaultValue ?? 0)}
								oninput={(ev) =>
									setProp(p.name, Number((ev.target as HTMLInputElement).value))}
							/>
						{:else if p.kind === 'boolean'}
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={Boolean(
									(selectedNode.props as any)?.[p.name] ?? p.defaultValue ?? false
								)}
								onchange={(ev) =>
									setProp(p.name, (ev.target as HTMLInputElement).checked)}
							/>
						{:else if p.kind === 'enum'}
							<select
								class="select select-bordered select-sm w-full"
								value={String((selectedNode.props as any)?.[p.name] ?? p.defaultValue ?? '')}
								onchange={(ev) =>
									setProp(p.name, (ev.target as HTMLSelectElement).value)}
							>
								{#each p.enumValues ?? [] as v (v)}
									<option value={v}>{enumLabel(p.name, v)}</option>
								{/each}
							</select>
						{:else if p.kind === 'modeRef' && p.modeRefKind === 'trackable'}
							<select
								class="select select-bordered select-sm w-full"
								value={String((selectedNode.props as any)?.[p.name] ?? '')}
								onchange={(ev) =>
									setProp(p.name, (ev.target as HTMLSelectElement).value)}
							>
								<option value="">— wählen —</option>
								{#each mode.trackables as t (t.id)}
									<option value={t.id}>{t.label}</option>
								{/each}
							</select>
						{:else if p.kind === 'modeRef' && p.modeRefKind === 'entity'}
							<select
								class="select select-bordered select-sm w-full"
								value={String((selectedNode.props as any)?.[p.name] ?? '')}
								onchange={(ev) =>
									setProp(p.name, (ev.target as HTMLSelectElement).value)}
							>
								<option value="">— wählen —</option>
								{#each mode.entities as e (e.name)}
									<option value={e.name}>{e.name}</option>
								{/each}
							</select>
						{/if}
					</label>
				{/each}
			</div>
		{:else}
			<div class="inspector-empty">
				<p class="text-xs opacity-70">Klick einen Knoten an, um Eigenschaften zu bearbeiten.</p>
			</div>
		{/if}
	</aside>

	<!-- ============ STATUS BAR (bottom) ============ -->
	<footer class="statusbar">
		<button
			type="button"
			class="btn btn-ghost btn-xs gap-1 mobile-only"
			onclick={() => (mobileCatalogOpen = true)}
			aria-label="Bausteine öffnen"
		>
			<Icon name="Menu" size={14} />
		</button>
		<div class="status-preview" title={preview}>
			<Icon name="Sparkles" size={14} />
			<span>{preview || '(noch keine vollständige Wette)'}</span>
		</div>
		<div class="status-errors">
			{#if validation.errors.length === 0}
				<span class="text-success">
					<Icon name="CheckCircle2" size={14} />
					<span class="status-stats">{graph.nodes.length} Knoten · {graph.edges.length} Verbindungen</span>
				</span>
			{:else}
				<span class="text-warning">
					<Icon name="AlertTriangle" size={14} />
					<span class="status-stats">{validation.errors.length} Problem{validation.errors.length === 1 ? '' : 'e'}</span>
				</span>
			{/if}
		</div>
		<button
			type="button"
			class="btn btn-ghost btn-xs gap-1 mobile-only"
			onclick={() => (mobileInspectorOpen = true)}
			aria-label="Eigenschaften öffnen"
		>
			<Icon name="Settings2" size={14} />
		</button>
	</footer>
</div>

<style>
	.editor-root {
		display: grid;
		grid-template-columns: 260px 1fr 300px;
		grid-template-rows: 1fr auto;
		grid-template-areas:
			'catalog canvas inspector'
			'status status status';
		gap: 0;
		height: 100%;
		min-height: 540px;
		background: var(--color-base-100);
		color: var(--color-base-content);
		border-radius: 0.75rem;
		overflow: hidden;
		border: 1px solid var(--color-base-300);
		position: relative;
	}

	.mobile-drawer-head {
		display: none;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.4rem;
		margin-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-base-300);
	}
	.mobile-only {
		display: none;
	}

	/* ---------- Catalog sidebar ---------- */
	.catalog {
		grid-area: catalog;
		border-right: 1px solid var(--color-base-300);
		background: var(--color-base-200);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.catalog-header {
		padding: 0.625rem;
		border-bottom: 1px solid var(--color-base-300);
		position: sticky;
		top: 0;
		background: var(--color-base-200);
		z-index: 2;
	}
	.catalog-body {
		flex: 1;
		padding: 0.5rem;
	}
	.catalog-group {
		margin-bottom: 0.5rem;
	}
	.catalog-group-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.375rem 0.5rem;
		cursor: pointer;
		color: var(--fam);
		list-style: none;
	}
	.catalog-group-title::-webkit-details-marker {
		display: none;
	}
	.catalog-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-left: 0.25rem;
	}
	.catalog-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.55rem;
		font-size: 0.78rem;
		border: 1px solid var(--color-base-300);
		border-left: 3px solid var(--fam);
		background: var(--color-base-100);
		color: var(--color-base-content);
		border-radius: 0.4rem;
		cursor: grab;
		text-align: left;
		transition: background 0.12s ease, transform 0.08s ease;
	}
	.catalog-item:hover {
		background: var(--color-base-300);
		transform: translateX(2px);
	}
	.catalog-item:active {
		cursor: grabbing;
	}

	/* ---------- Canvas ---------- */
	.canvas-scroll {
		grid-area: canvas;
		overflow: auto;
		background: var(--color-base-100);
		position: relative;
	}
	.canvas-grid {
		position: relative;
	}
	.grid-dots {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		opacity: 0.4;
	}
	.grid-dots :global(circle) {
		fill: var(--color-base-300);
	}
	.wires {
		position: absolute;
		top: 0;
		left: 0;
	}
	.wires .wire {
		cursor: pointer;
	}
	.wires .wire:hover {
		stroke-width: 4;
	}
	.slot-ghost {
		position: absolute;
		border: 2px dashed var(--color-primary);
		border-radius: 0.4rem;
		background: color-mix(in oklab, var(--color-primary) 12%, transparent);
		pointer-events: none;
	}

	/* ---------- Node tile ---------- */
	.tile {
		position: absolute;
		background: var(--fam);
		color: var(--color-base-100);
		border-radius: 0.5rem;
		box-shadow: 0 2px 6px color-mix(in oklab, black 25%, transparent);
		cursor: grab;
		display: flex;
		flex-direction: column;
		font-size: 0.72rem;
		user-select: none;
		transition: box-shadow 0.12s ease, transform 0.08s ease;
	}
	.tile:hover {
		box-shadow: 0 6px 14px color-mix(in oklab, black 35%, transparent);
		transform: translateY(-1px);
	}
	.tile:active {
		cursor: grabbing;
	}
	.tile.selected {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.tile-header {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.45rem;
		font-weight: 600;
		font-size: 0.7rem;
		border-bottom: 1px solid color-mix(in oklab, black 18%, transparent);
	}
	.tile-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tile-body {
		flex: 1;
		padding: 0.3rem 0.45rem;
		font-size: 0.7rem;
		display: flex;
		align-items: center;
		opacity: 0.95;
	}

	.pin {
		position: absolute;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--color-base-100);
		box-shadow: 0 1px 3px color-mix(in oklab, black 40%, transparent);
		cursor: crosshair;
		padding: 0;
		z-index: 2;
	}
	.pin-in {
		left: -7px;
	}
	.pin-out {
		right: -7px;
	}
	.pin:hover {
		transform: scale(1.4);
	}

	/* ---------- Inspector ---------- */
	.inspector {
		grid-area: inspector;
		border-left: 1px solid var(--color-base-300);
		background: var(--color-base-200);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.inspector-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--color-base-300);
		border-left: 3px solid var(--fam);
	}
	.inspector-desc {
		padding: 0.5rem 0.75rem;
		font-size: 0.72rem;
		opacity: 0.75;
		border-bottom: 1px solid var(--color-base-300);
	}
	.inspector-props {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.inspector-prop {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.inspector-empty {
		padding: 0.75rem;
	}

	/* ---------- StatusBar ---------- */
	.statusbar {
		grid-area: status;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		background: var(--color-base-200);
		border-top: 1px solid var(--color-base-300);
		font-size: 0.75rem;
		min-height: 40px;
	}
	.status-preview {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status-preview span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status-errors {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}
	.status-errors :global(span) {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* ---------- Mobile (< 768px): drawers instead of fixed sidebars ---------- */
	@media (max-width: 767px) {
		.editor-root {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
			grid-template-areas:
				'canvas'
				'status';
			min-height: 70vh;
		}
		.mobile-only {
			display: inline-flex;
		}
		.mobile-drawer-head {
			display: flex;
		}
		.catalog,
		.inspector {
			position: absolute;
			top: 0;
			bottom: 40px;
			width: min(85vw, 320px);
			z-index: 30;
			transition: transform 0.18s ease;
			box-shadow: 0 4px 24px color-mix(in oklab, black 35%, transparent);
		}
		.catalog {
			left: 0;
			transform: translateX(-100%);
			border-right: 1px solid var(--color-base-300);
		}
		.catalog.mobile-open {
			transform: translateX(0);
		}
		.inspector {
			right: 0;
			transform: translateX(100%);
			border-left: 1px solid var(--color-base-300);
		}
		.inspector.mobile-open {
			transform: translateX(0);
		}
		.status-stats {
			display: none;
		}
		.status-preview {
			font-size: 0.7rem;
		}
	}
</style>
