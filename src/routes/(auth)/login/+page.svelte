<!--
	@file login/+page.svelte
	@implements REQ-AUTH-003 — login UI
	@implements REQ-UI-008 — German UI
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { LogIn, User, Lock, AlertCircle, ArrowRight } from '@lucide/svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let submitting = $state(false);
</script>

<header class="mb-7 flex flex-col items-center text-center">
	<IconBubble tone="primary" size="lg"><LogIn size={22} /></IconBubble>
	<p class="eyebrow mt-3">Anmelden</p>
	<h1 class="display text-3xl font-semibold mt-1">
		Willkommen <span class="text-gradient-primary">zurück</span>
	</h1>
	<p class="text-base-content/60 mt-2 text-sm">Melde dich bei DWIGHT an.</p>
</header>

<form method="POST" use:enhance={() => {
	submitting = true;
	return async ({ update }) => {
		await update();
		submitting = false;
	};
}} class="flex flex-col gap-4">
	<input type="hidden" name="next" value={data.next} />

	<label class="form-control">
		<span class="label-text mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-base-content/70">
			<User size={12} /> Username
		</span>
		<input
			type="text"
			name="username"
			autocomplete="username"
			required
			value={form?.username ?? ''}
			class="input input-bordered bg-base-100/50 w-full focus:border-primary focus:bg-base-100"
		/>
	</label>

	<label class="form-control">
		<span class="label-text mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-base-content/70">
			<Lock size={12} /> Passwort
		</span>
		<input
			type="password"
			name="password"
			autocomplete="current-password"
			required
			class="input input-bordered bg-base-100/50 w-full focus:border-primary focus:bg-base-100"
		/>
	</label>

	{#if form?.error}
		<div class="inline-flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-error text-sm">
			<AlertCircle size={14} /> {form.error}
		</div>
	{/if}

	<button
		type="submit"
		class="bg-primary text-primary-content glow-primary mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50"
		disabled={submitting}
	>
		{submitting ? 'Anmelden …' : 'Einloggen'}
		{#if !submitting}<ArrowRight size={16} />{/if}
	</button>
</form>

<p class="text-base-content/60 mt-6 text-center text-sm">
	Noch kein Konto?
	<a href="/register" class="text-primary font-semibold hover:underline">Registrieren</a>
</p>
