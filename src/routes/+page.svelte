<!--
	@file +page.svelte — DWIGHT landing
	@implements REQ-UI-001, REQ-UI-003, REQ-BRAND-007, UI_UX §6.1 + §6.2
-->
<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import VersionFooter from '$lib/components/VersionFooter.svelte';
	import { enhance } from '$app/forms';
	import { LogOut, Plus, KeyRound, Layers, Shield, ArrowRight, Sparkles } from '@lucide/svelte';
	import IconBubble from '$lib/components/IconBubble.svelte';

	let { data } = $props();
</script>

<main class="relative min-h-svh overflow-hidden">
	<!-- Aurora background -->
	<div class="aurora" aria-hidden="true"></div>
	<div class="noise" aria-hidden="true"></div>

	<div class="relative mx-auto flex min-h-svh max-w-md flex-col px-6 py-12">
		{#if !data.user}
			<!-- Guest landing -->
			<header class="flex flex-1 flex-col items-center justify-center gap-10 text-center">
				<div class="fade-up">
					<Logo size={72} />
				</div>

				<div class="fade-up space-y-3" style="animation-delay: 80ms">
					<h1 class="display text-5xl leading-tight">
						<span class="text-gradient-primary">Wetten.</span><br />
						Trinken.<br />
						Gewinnen.
					</h1>
					<p class="text-base-content/70 mx-auto max-w-xs text-base">
						Saufen
					</p>
				</div>

				<div class="fade-up flex w-full flex-col gap-3" style="animation-delay: 160ms">
					<a href="/register" class="btn btn-primary glow-primary h-14 gap-2 rounded-xl text-base">
						Konto erstellen <ArrowRight size={16} />
					</a>
					<a href="/login" class="btn btn-ghost glass h-14 gap-2 rounded-xl text-base">
						Einloggen <ArrowRight size={16} />
					</a>
				</div>
			</header>

			<VersionFooter />
		{:else}
			<!-- Logged-in lobby placeholder (full sessions wiring lands in D2) -->
			<header class="flex items-center justify-between">
				<Logo size={36} showWordmark />
				<form method="POST" action="/logout" use:enhance>
					<button type="submit" class="text-base-content/50 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition">
						<LogOut size={14} /> Logout
					</button>
				</form>
			</header>

			<section class="fade-up mt-10 space-y-2">
				<p class="text-base-content/60 text-sm">Hallo,</p>
				<h1 class="display text-3xl">
					<span class="text-gradient-primary">{data.user.username}</span>
				</h1>
			</section>

			<section class="fade-up mt-10 flex-1" style="animation-delay: 80ms">
				<div class="mb-4 flex items-center gap-2">
					<IconBubble tone="primary" size="sm"><Layers size={14} /></IconBubble>
					<h2 class="eyebrow">Deine Sessions</h2>
				</div>

				{#if data.sessions.length === 0}
					<a
						href="/s/create"
						class="glass-interactive group flex flex-col items-center justify-center gap-4 rounded-3xl px-6 py-14 text-center"
						aria-label="Erste Session erstellen"
					>
						<div class="create-bubble">
							<Plus size={40} strokeWidth={2.5} />
						</div>
						<div class="space-y-1">
							<p class="text-base-content/85 font-semibold">Erste Session erstellen</p>
							<p class="text-base-content/45 text-xs">Du wirst automatisch GM.</p>
						</div>
					</a>
				{:else}
					{@const activeSessions = data.sessions.filter((x) => x.status !== 'ENDED')}
					{@const endedSessions = data.sessions.filter((x) => x.status === 'ENDED')}
					{#if activeSessions.length > 0}
						<ul class="space-y-2">
							{#each activeSessions as s (s.id)}
								<li>
									<a href="/s/{s.id}" class="glass-interactive group flex items-center gap-3 rounded-xl p-3">
										<IconBubble tone="primary" size="sm"><Layers size={14} /></IconBubble>
										<div class="flex flex-1 flex-col">
											<span class="font-medium leading-tight">{s.name}</span>
											<span class="tabular-nums text-base-content/50 text-[0.65rem] uppercase tracking-wider">{s.inviteCode}</span>
										</div>
										<ArrowRight size={16} class="text-base-content/40 group-hover:text-primary transition" />
									</a>
								</li>
							{/each}
						</ul>
					{/if}
					{#if endedSessions.length > 0}
						<details class="mt-6">
							<summary class="text-base-content/45 mb-2 flex cursor-pointer items-center gap-2 text-[0.65rem] uppercase tracking-wider">
								<span>Beendet ({endedSessions.length})</span>
							</summary>
							<ul class="space-y-2">
								{#each endedSessions as s (s.id)}
									<li>
										<a href="/s/{s.id}/stats" class="glass-interactive group flex items-center gap-3 rounded-xl p-3 opacity-75 hover:opacity-100">
											<IconBubble tone="neutral" size="sm"><Layers size={14} /></IconBubble>
											<div class="flex flex-1 flex-col">
												<span class="font-medium leading-tight">{s.name}</span>
												<span class="text-base-content/45 text-[0.65rem] uppercase tracking-wider">Statistik anzeigen</span>
											</div>
											<ArrowRight size={16} class="text-base-content/40 group-hover:text-primary transition" />
										</a>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				{/if}
			</section>

			<section class="fade-up mt-8 flex flex-col gap-3" style="animation-delay: 160ms">
				{#if data.sessions.length > 0}
					<a href="/s/create" class="btn btn-primary glow-primary h-14 gap-2 rounded-xl text-base">
						<Plus size={18} /> Session erstellen
					</a>
				{/if}
				<a href="/s/join" class="btn btn-ghost glass h-14 gap-2 rounded-xl text-base">
					<KeyRound size={18} /> Mit Code beitreten
				</a>
				{#if data.isAdmin}
					<a
						href="/modes"
						class="text-base-content/50 hover:text-base-content inline-flex items-center justify-center gap-1.5 pt-2 text-center text-sm transition"
					>
						<Layers size={14} /> Modes verwalten <ArrowRight size={12} />
					</a>
					<a
						href="/admin"
						class="text-base-content/50 hover:text-base-content inline-flex items-center justify-center gap-1.5 text-center text-sm transition"
					>
						<Shield size={14} /> Admin-Panel <ArrowRight size={12} />
					</a>
				{/if}
			</section>

			<VersionFooter isLoggedIn isAdmin={data.isAdmin} />
		{/if}
	</div>
</main>

<style>
	.create-bubble {
		width: 6rem;
		height: 6rem;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: oklch(98% 0.02 148);
		background: linear-gradient(135deg, oklch(60% 0.055 148), oklch(50% 0.075 148));
		box-shadow:
			0 12px 28px -10px oklch(60% 0.055 148 / 0.55),
			inset 0 1px 0 oklch(100% 0 0 / 0.3);
		transition: transform 180ms ease;
	}
	.create-bubble:hover {
		transform: scale(1.04);
	}
</style>
