<script lang="ts">
	/**
	 * Icon.svelte — Lucide icon dispatcher.
	 *
	 * Maps a string `name` (e.g. "Trophy") to the Lucide component.
	 * Used by the graph catalog/editor where icons are referenced by name.
	 */
	import {
		Users,
		User,
		Sparkle,
		Sparkles,
		Hash,
		Clock,
		Calculator,
		ListOrdered,
		Scale,
		GitBranch,
		Merge,
		Trophy,
		CheckCircle2,
		Medal,
		Flag,
		Minus,
		ArrowLeftRight,
		TimerReset,
		ListChecks,
		Trash2,
		AlertTriangle,
		HelpCircle,
		X,
		Menu,
		Settings2
	} from '@lucide/svelte';

	const MAP: Record<string, typeof Users> = {
		Users,
		User,
		Sparkle,
		Sparkles,
		Hash,
		Clock,
		Calculator,
		ListOrdered,
		Scale,
		GitBranch,
		Merge,
		Trophy,
		CheckCircle2,
		Medal,
		Flag,
		Minus,
		ArrowLeftRight,
		TimerReset,
		ListChecks,
		Trash2,
		AlertTriangle,
		HelpCircle,
		X,
		Menu,
		Settings2
	};

	let { name, size = 16 }: { name: string; size?: number } = $props();

	const Cmp = $derived(MAP[name] ?? HelpCircle);
</script>

<Cmp {size} />
