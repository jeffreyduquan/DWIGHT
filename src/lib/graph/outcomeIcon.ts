/**
 * @file graph/outcomeIcon.ts -- Map a BetGraph to a Lucide icon name based on
 * the outcome family it produces. Used by /modes/[id] cards (Phase 19b).
 */
import type { BetGraph } from '$lib/server/db/schema';

export type OutcomeIconName =
	| 'Trophy' // entity_outcome (single winner)
	| 'CheckCircle2' // boolean_outcome (yes/no)
	| 'Medal' // ranking_outcome (podium / top-K)
	| 'Sparkles'; // fallback

export function outcomeIconFor(graph: BetGraph | null | undefined): OutcomeIconName {
	if (!graph?.nodes?.length) return 'Sparkles';
	const outcome = graph.nodes.find(
		(n) =>
			n.kind === 'entity_outcome' || n.kind === 'boolean_outcome' || n.kind === 'ranking_outcome'
	);
	if (!outcome) return 'Sparkles';
	switch (outcome.kind) {
		case 'entity_outcome':
			return 'Trophy';
		case 'boolean_outcome':
			return 'CheckCircle2';
		case 'ranking_outcome':
			return 'Medal';
		default:
			return 'Sparkles';
	}
}
