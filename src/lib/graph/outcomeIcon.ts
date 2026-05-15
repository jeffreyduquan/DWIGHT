/**
 * @file graph/outcomeIcon.ts -- Map a BetGraph (Graph 2.0) to a Lucide icon
 * name based on its outcome family. Used by /modes/[id] cards.
 */
import type { BetGraph } from '$lib/server/db/schema';

export type OutcomeIconName =
	| 'Trophy' // winner (single entity)
	| 'CheckCircle2' // truth (boolean)
	| 'Medal' // podium (top-K)
	| 'Sparkles'; // fallback

export function outcomeIconFor(graph: BetGraph | null | undefined): OutcomeIconName {
	if (!graph?.nodes?.length) return 'Sparkles';
	const outcome = graph.nodes.find(
		(n) => n.kind === 'winner' || n.kind === 'truth' || n.kind === 'podium'
	);
	if (!outcome) return 'Sparkles';
	switch (outcome.kind) {
		case 'winner':
			return 'Trophy';
		case 'truth':
			return 'CheckCircle2';
		case 'podium':
			return 'Medal';
		default:
			return 'Sparkles';
	}
}
