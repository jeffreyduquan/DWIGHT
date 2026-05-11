<!--
  @component IconBubble — circular tinted container for an icon (Aurora-glass style).
  Inspired by smart-home dashboards: ~48px circle, subtle gradient bg, soft inner glow.
  
  Usage:
    <IconBubble tone="primary"><Coins size={20} /></IconBubble>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'primary' | 'accent' | 'warning' | 'info' | 'neutral' | 'success' | 'error';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		tone?: Tone;
		size?: Size;
		children: Snippet;
		class?: string;
	};

	let { tone = 'neutral', size = 'md', children, class: cls = '' }: Props = $props();

	const sizeClass = $derived(
		size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
	);
	const toneClass = $derived(
		{
			primary: 'icon-bubble-primary',
			accent: 'icon-bubble-accent',
			warning: 'icon-bubble-warning',
			info: 'icon-bubble-info',
			success: 'icon-bubble-primary',
			error: 'icon-bubble-accent',
			neutral: 'icon-bubble-neutral'
		}[tone]
	);
</script>

<span
	class="icon-bubble {sizeClass} {toneClass} {cls} inline-flex flex-shrink-0 items-center justify-center rounded-full"
>
	{@render children()}
</span>
