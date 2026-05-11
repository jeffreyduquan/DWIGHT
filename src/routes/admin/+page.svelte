<!--
  @file /admin/+page.svelte — admin panel.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import IconBubble from '$lib/components/IconBubble.svelte';
	import {
		ArrowLeft,
		ArrowRight,
		Shield,
		Users,
		Layers,
		Trash2,
		ExternalLink
	} from '@lucide/svelte';

	let { data } = $props();

	function confirmDelete(message: string) {
		return ({ cancel }: { cancel: () => void }) => {
			if (!confirm(message)) cancel();
		};
	}
</script>

<main class="mx-auto max-w-3xl space-y-6 p-6">
	<header class="flex items-end justify-between gap-3">
		<div class="space-y-2">
			<a
				href="/"
				class="text-base-content/60 hover:text-base-content inline-flex items-center gap-1.5 text-sm transition"
			>
				<ArrowLeft size={16} /> Home
			</a>
			<div class="flex items-center gap-3">
				<IconBubble tone="accent" size="lg"><Shield size={22} /></IconBubble>
				<div>
					<p class="eyebrow">Admin</p>
					<h1 class="display text-gradient-primary text-2xl leading-none">Admin-Panel</h1>
				</div>
			</div>
		</div>
		<a href="/modes" class="btn btn-sm btn-primary gap-1.5">
			<Layers size={14} /> Modes <ArrowRight size={12} />
		</a>
	</header>

	<section class="space-y-3">
		<div class="flex items-center gap-2">
			<IconBubble tone="info" size="sm"><Users size={14} /></IconBubble>
			<h2 class="eyebrow">User ({data.users.length})</h2>
		</div>
		<ul class="glass-xl space-y-2 p-4">
			{#each data.users as u (u.id)}
				<li
					class="border-base-content/5 flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
				>
					<span class="font-medium">{u.username}</span>
					<span class="tabular-nums text-base-content/40 flex-1 text-right text-xs">
						{new Date(u.createdAt).toLocaleString('de-DE')}
					</span>
					<form
						method="POST"
						action="?/deleteUser"
						use:enhance={confirmDelete(
							`User "${u.username}" wirklich löschen? Sessions, in denen er Host ist, werden mit-gelöscht.`
						)}
					>
						<input type="hidden" name="userId" value={u.id} />
						<button class="btn btn-xs btn-error btn-outline gap-1">
							<Trash2 size={11} /> Löschen
						</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3">
		<div class="flex items-center gap-2">
			<IconBubble tone="primary" size="sm"><Layers size={14} /></IconBubble>
			<h2 class="eyebrow">Sessions ({data.sessions.length})</h2>
		</div>
		<ul class="space-y-2">
			{#each data.sessions as s (s.id)}
				<li class="glass flex items-center justify-between gap-3 rounded-xl p-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							<span class="truncate font-medium">{s.name}</span>
							<span class="badge badge-sm">{s.status}</span>
						</div>
						<div class="tabular-nums text-base-content/40 text-xs">
							{s.inviteCode} · {new Date(s.createdAt).toLocaleString('de-DE')}
						</div>
					</div>
					<a href="/s/{s.id}" class="btn btn-xs btn-ghost gap-1">
						<ExternalLink size={11} /> öffnen
					</a>
					<form
						method="POST"
						action="?/deleteSession"
						use:enhance={confirmDelete(
							`Session "${s.name}" wirklich löschen? Alle Runden, Wetten und Events gehen verloren.`
						)}
					>
						<input type="hidden" name="sessionId" value={s.id} />
						<button class="btn btn-xs btn-error gap-1">
							<Trash2 size={11} /> Löschen
						</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
</main>
