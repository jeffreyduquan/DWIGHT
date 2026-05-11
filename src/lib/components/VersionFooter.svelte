<!--
  @component VersionFooter — clickable version label with 9-click admin easter-egg.

  Logged-out: just shows the version.
  Logged-in: 9 rapid clicks open an admin prompt asking for the secret.
  Admins: shows "ADMIN" badge and offers a "Demote" action.
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Shield, AlertCircle, KeyRound, LogOut } from '@lucide/svelte';

	let { isLoggedIn = false, isAdmin = false }: { isLoggedIn?: boolean; isAdmin?: boolean } =
		$props();

	const VERSION = 'v0.2';
	const REQUIRED_CLICKS = 9;
	const RESET_MS = 1500;

	let clickCount = $state(0);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	let showModal = $state(false);
	let secretInput = $state('');
	let errorMsg = $state<string | null>(null);
	let busy = $state(false);

	function onVersionClick() {
		if (!isLoggedIn || isAdmin) return;
		clickCount += 1;
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (clickCount = 0), RESET_MS);
		if (clickCount >= REQUIRED_CLICKS) {
			clickCount = 0;
			if (resetTimer) clearTimeout(resetTimer);
			showModal = true;
		}
	}

	async function submitPromote(e: Event) {
		e.preventDefault();
		errorMsg = null;
		busy = true;
		try {
			const res = await fetch('/api/admin/promote', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ secret: secretInput })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				errorMsg = body.message ?? 'Falsches Geheimnis';
				return;
			}
			showModal = false;
			secretInput = '';
			await invalidateAll();
		} catch {
			errorMsg = 'Netzwerkfehler';
		} finally {
			busy = false;
		}
	}

	async function demote() {
		busy = true;
		try {
			await fetch('/api/admin/demote', { method: 'POST' });
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	function cancel() {
		showModal = false;
		secretInput = '';
		errorMsg = null;
	}
</script>

<footer class="text-base-content/40 tabular-nums pt-8 text-center text-xs">
	<button
		type="button"
		onclick={onVersionClick}
		class="cursor-default select-none bg-transparent p-1"
		aria-label="Version"
	>
		DWIGHT · {VERSION}
	</button>
	{#if isAdmin}
		<span class="badge badge-xs badge-warning ml-2 inline-flex items-center gap-1 align-middle">
			<Shield size={10} /> ADMIN
		</span>
		<button
			type="button"
			onclick={demote}
			disabled={busy}
			class="text-base-content/40 hover:text-base-content/70 ml-2 inline-flex items-center gap-1 underline"
		>
			<LogOut size={10} /> Admin verlassen
		</button>
	{/if}
</footer>

{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
	>
		<div class="glass glass-xl glow-primary w-full max-w-sm space-y-4 p-6">
			<div class="flex items-center gap-3">
				<div class="icon-bubble icon-bubble-warning h-11 w-11">
					<Shield size={20} />
				</div>
				<div>
					<p class="eyebrow">Authentifizierung</p>
					<h3 class="display text-lg leading-none">Admin-Modus</h3>
				</div>
			</div>
			<form onsubmit={submitPromote} class="space-y-3">
				<label class="block space-y-1">
					<span class="text-base-content/60 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider">
						<KeyRound size={11} /> Admin-Geheimnis
					</span>
					<input
						type="password"
						bind:value={secretInput}
						class="input input-bordered w-full"
						placeholder="••••••••"
						autocomplete="off"
						required
					/>
				</label>
				{#if errorMsg}
					<div class="alert alert-error inline-flex items-center gap-2 py-2 text-sm">
						<AlertCircle size={14} /> {errorMsg}
					</div>
				{/if}
				<div class="flex gap-2 pt-2">
					<button type="button" onclick={cancel} class="btn btn-ghost flex-1">Abbrechen</button>
					<button type="submit" disabled={busy} class="btn btn-primary flex-1">
						{busy ? '…' : 'Freischalten'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
