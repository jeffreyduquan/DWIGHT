<!--
	@file s/join/+page.svelte — invite-code entry
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';

	let { form } = $props();
	let code = $state(form?.code ?? '');
</script>

<header class="mb-8 flex items-center justify-between">
	<a href="/" class="text-base-content/60 hover:text-base-content text-sm">← zurück</a>
	<Logo size={32} />
</header>

<h1 class="display mb-1 text-3xl">
	Mit <span class="text-gradient-primary">Code</span> beitreten
</h1>
<p class="text-base-content/60 mb-8 text-sm">6-stelliger Invite-Code von deinem Host.</p>

{#if form?.error}
	<div class="alert alert-error mb-4 text-sm">{form.error}</div>
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
		class="input input-bordered glass tabular h-16 w-full rounded-xl text-center text-3xl uppercase tracking-[0.5em]"
		required
	/>
	<button type="submit" class="btn btn-primary glow-primary h-14 w-full rounded-xl text-base">
		Beitreten
	</button>
</form>
