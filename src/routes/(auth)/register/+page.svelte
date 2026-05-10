<!--
	@file register/+page.svelte
	@implements REQ-AUTH-001 — registration UI
	@implements REQ-UI-008 — German UI
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<header class="mb-7 text-center">
	<h1 class="display text-3xl font-semibold">Komm zu <span class="text-gradient-primary">DWIGHT</span></h1>
	<p class="text-base-content/60 mt-2 text-sm">Username + Passwort. Kein Email-Quatsch.</p>
</header>

<form method="POST" use:enhance={() => {
	submitting = true;
	return async ({ update }) => {
		await update();
		submitting = false;
	};
}} class="flex flex-col gap-4">
	<label class="form-control">
		<span class="label-text mb-1.5 text-xs font-medium uppercase tracking-wider text-base-content/70">Username</span>
		<input
			type="text"
			name="username"
			autocomplete="username"
			required
			minlength="3"
			maxlength="24"
			pattern="[a-zA-Z0-9_-]+"
			value={form?.username ?? ''}
			class="input input-bordered bg-base-100/50 w-full focus:border-primary focus:bg-base-100"
			class:input-error={form?.usernameError}
		/>
		{#if form?.usernameError}
			<span class="text-error mt-1 text-xs">{form.usernameError}</span>
		{/if}
	</label>

	<label class="form-control">
		<span class="label-text mb-1.5 text-xs font-medium uppercase tracking-wider text-base-content/70">Passwort</span>
		<input
			type="password"
			name="password"
			autocomplete="new-password"
			required
			minlength="8"
			maxlength="128"
			class="input input-bordered bg-base-100/50 w-full focus:border-primary focus:bg-base-100"
			class:input-error={form?.passwordError}
		/>
		{#if form?.passwordError}
			<span class="text-error mt-1 text-xs">{form.passwordError}</span>
		{:else}
			<span class="text-base-content/50 mt-1 text-xs">Mindestens 8 Zeichen.</span>
		{/if}
	</label>

	<button
		type="submit"
		class="bg-primary text-primary-content glow-primary mt-2 inline-flex h-12 items-center justify-center rounded-xl font-semibold disabled:opacity-50"
		disabled={submitting}
	>
		{submitting ? 'Erstelle …' : 'Konto erstellen'}
	</button>
</form>

<p class="text-base-content/60 mt-6 text-center text-sm">
	Schon ein Konto?
	<a href="/login" class="text-primary font-semibold hover:underline">Einloggen</a>
</p>
