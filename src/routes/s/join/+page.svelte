<!--
	@file s/join/+page.svelte — invite-code entry
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import { ArrowLeft, ArrowRight, AlertCircle, KeyRound } from '@lucide/svelte';

	let { data, form } = $props();
	let code = $state(form?.code ?? data?.prefill ?? '');
</script>

<header class="mb-8 flex items-center justify-between">
	<a href="/" class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition">
		<ArrowLeft size={16} /> zurück
	</a>
	<Logo size={32} />
</header>

<div class="mb-8 space-y-2">
	<IconBubble tone="accent" size="lg"><KeyRound size={22} /></IconBubble>
	<p class="eyebrow mt-3">Beitritt</p>
	<h1 class="display text-3xl">
		Mit <span class="text-gradient-primary">Code</span> beitreten
	</h1>
	<p class="text-base-content/60 text-sm">6-stelliger Invite-Code von deinem Host.</p>
</div>

{#if form?.error}
	<div class="alert alert-error mb-4 inline-flex items-center gap-2 text-sm">
		<AlertCircle size={16} /> {form.error}
	</div>
{/if}

<form method="POST" use:enhance class="space-y-6">
	<input
		type="text"
		name="code"
		bind:value={code}
		maxlength="6"
		minlength="6"
		autocomplete="off"
		autocapitalize="characters"
		spellcheck="false"
		placeholder="ABCDEF"
		class="input input-bordered glass-xl tabular-nums h-16 w-full rounded-xl text-center text-3xl uppercase tracking-[0.5em]"
		required
	/>
	<button type="submit" class="btn btn-primary glow-primary h-14 w-full gap-2 rounded-xl text-base">
		Beitreten <ArrowRight size={18} />
	</button>
</form>
