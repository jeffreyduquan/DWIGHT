<!--
	@file +page.svelte — DWIGHT landing
	@implements REQ-UI-001, REQ-UI-003, REQ-BRAND-007, UI_UX §6.1 + §6.2
-->
<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { enhance } from '$app/forms';

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
						Das programmierbare Trinkspiel. Wetten, Modi, Regeln — du baust den Abend.
					</p>
				</div>

				<div class="fade-up flex w-full flex-col gap-3" style="animation-delay: 160ms">
					<a href="/register" class="btn btn-primary glow-primary h-14 rounded-xl text-base">
						Konto erstellen
					</a>
					<a href="/login" class="btn btn-ghost glass h-14 rounded-xl text-base">
						Einloggen
					</a>
				</div>
			</header>

			<footer class="text-base-content/40 tabular pt-12 text-center text-xs">
				DWIGHT · v0.2
			</footer>
		{:else}
			<!-- Logged-in lobby placeholder (full sessions wiring lands in D2) -->
			<header class="flex items-center justify-between">
				<Logo size={36} showWordmark />
				<form method="POST" action="/logout" use:enhance>
					<button type="submit" class="text-base-content/50 hover:text-base-content text-sm">
						Logout
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
				<h2 class="text-base-content/70 mb-4 text-sm font-medium uppercase tracking-wider">
					Deine Sessions
				</h2>

				{#if data.sessions.length === 0}
					<div class="glass rounded-2xl px-6 py-12 text-center">
						<div class="mx-auto mb-4 opacity-40">
							<Logo size={40} />
						</div>
						<p class="text-base-content/60 text-sm">Noch keine Sessions.</p>
					</div>
				{:else}
					<ul class="space-y-3">
						{#each data.sessions as s (s.id)}
							<li>
								<a href="/s/{s.id}" class="glass block rounded-xl p-4 transition hover:scale-[1.01]">
									<div class="flex items-baseline justify-between">
										<span class="font-medium">{s.name}</span>
										<span class="tabular text-base-content/50 text-xs">{s.inviteCode}</span>
									</div>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="fade-up mt-8 flex flex-col gap-3" style="animation-delay: 160ms">
				<a href="/s/create" class="btn btn-primary glow-primary h-14 rounded-xl text-base">
					Session erstellen
				</a>
				<a href="/s/join" class="btn btn-ghost glass h-14 rounded-xl text-base">
					Mit Code beitreten
				</a>
				<a
					href="/modes"
					class="text-base-content/50 hover:text-base-content pt-2 text-center text-sm"
				>
					Modes verwalten →
				</a>
			</section>

			<footer class="text-base-content/40 tabular pt-8 text-center text-xs">
				DWIGHT · v0.2
			</footer>
		{/if}
	</div>
</main>
