<!--
	@file s/create/+page.svelte — session creation
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';

	let { data, form } = $props();

	let selectedModeId = $state<string>(data.modes[0]?.id ?? '');
	const selectedMode = $derived(data.modes.find((m) => m.id === selectedModeId) ?? null);

	let rebuyEnabled = $state(selectedMode?.defaultConfig.rebuy.enabled ?? true);
	$effect(() => {
		if (selectedMode) rebuyEnabled = selectedMode.defaultConfig.rebuy.enabled;
	});

	const formError = $derived(form && 'error' in form ? (form.error as string) : null);
</script>

<header class="mb-6 flex items-center justify-between">
	<a href="/" class="text-base-content/60 hover:text-base-content text-sm">← zurück</a>
	<Logo size={32} />
</header>

<h1 class="display mb-1 text-3xl">
	<span class="text-gradient-primary">Session</span> erstellen
</h1>
<p class="text-base-content/60 mb-6 text-sm">Wähle einen Mode und starte den Abend.</p>

{#if formError}
	<div class="alert alert-error mb-4 text-sm">{formError}</div>
{/if}

{#if data.modes.length === 0}
	<!-- Empty state: user has no Modes yet -->
	<div class="glass rounded-2xl px-6 py-10 text-center">
		<p class="text-base-content/70 mb-2 text-sm">Du hast noch keinen Mode.</p>
		<p class="text-base-content/50 mb-6 text-xs">
			Ein Mode definiert Spielregeln, Entitäten, Drink-Preise und Wett-Templates.
		</p>
		<a href="/modes/new" class="btn btn-primary glow-primary rounded-xl">
			Ersten Mode erstellen
		</a>
	</div>
{:else}
	<form method="POST" use:enhance class="space-y-6">
		<!-- Mode picker (custom radio cards) -->
		<fieldset class="space-y-2">
			<legend class="text-base-content/70 mb-2 text-sm font-medium uppercase tracking-wider">
				Mode
			</legend>
			<div class="space-y-2">
				{#each data.modes as m (m.id)}
					<label
						class="glass flex cursor-pointer flex-col gap-1 rounded-xl p-4 transition {selectedModeId ===
						m.id
							? 'ring-primary ring-2'
							: 'opacity-70 hover:opacity-100'}"
					>
						<input
							type="radio"
							name="modeId"
							value={m.id}
							bind:group={selectedModeId}
							class="sr-only"
						/>
						<div class="flex items-baseline justify-between">
							<span class="font-medium">{m.name}</span>
							<span class="tabular text-base-content/40 text-xs">
								{m.defaultEntities.length} {m.terminology.entity}n
							</span>
						</div>
						{#if m.description}
							<p class="text-base-content/60 text-xs">{m.description}</p>
						{/if}
					</label>
				{/each}
			</div>
			<a href="/modes" class="text-primary text-xs hover:underline">Modes verwalten →</a>
		</fieldset>

		<!-- Name -->
		<label class="block space-y-1">
			<span class="text-base-content/70 text-sm font-medium uppercase tracking-wider">Name</span>
			<input
				type="text"
				name="name"
				placeholder="Freitag-Abend"
				class="input input-bordered glass h-12 w-full rounded-xl"
				required
				minlength="2"
				maxlength="64"
			/>
		</label>

		{#if selectedMode}
			<!-- Money -->
			<label class="block space-y-1">
				<span class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
					Startgeld
				</span>
				<input
					type="number"
					name="startingMoney"
					value={selectedMode.defaultConfig.startingMoney}
					min="100"
					step="50"
					class="input input-bordered glass tabular h-12 w-full rounded-xl"
					required
				/>
			</label>

			<!-- Drink prices -->
			<fieldset class="space-y-2">
				<legend class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
					Drink-Preise
				</legend>
				<div class="grid grid-cols-3 gap-2">
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Schluck</span>
						<input
							type="number"
							name="priceSchluck"
							value={selectedMode.defaultConfig.drinkPrices.SCHLUCK}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Kurzer</span>
						<input
							type="number"
							name="priceKurzer"
							value={selectedMode.defaultConfig.drinkPrices.KURZER}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
					<label class="glass flex flex-col gap-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Bier exen</span>
						<input
							type="number"
							name="priceBier"
							value={selectedMode.defaultConfig.drinkPrices.BIER_EXEN}
							min="0"
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
				</div>
			</fieldset>

			<!-- Confirmation mode -->
			<label class="block space-y-1">
				<span class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
					Bestätigungs-Modus
				</span>
				<select
					name="confirmationMode"
					value={selectedMode.defaultConfig.confirmationMode}
					class="select select-bordered glass h-12 w-full rounded-xl"
				>
					<option value="GM">Nur GM bestätigt</option>
					<option value="PEERS"
						>Nur Peers ({selectedMode.defaultConfig.peerConfirmationsRequired})</option
					>
					<option value="EITHER">GM oder Peers</option>
				</select>
				<p class="text-base-content/40 mt-1 text-xs">
					Wer bestätigt, dass ein Drink wirklich gekippt wurde.
				</p>
			</label>

			<!-- Rebuy -->
			<fieldset class="space-y-3">
				<legend class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
					Rebuy
				</legend>
				<label class="glass flex items-center justify-between rounded-xl p-3">
					<span class="space-y-1">
						<span class="block text-sm font-medium">Rebuy aktiv</span>
						<span class="text-base-content/40 block text-xs">
							Pleite-Spieler kippen einen Drink und bekommen Geld zurück.
						</span>
					</span>
					<input
						type="checkbox"
						name="rebuyEnabled"
						bind:checked={rebuyEnabled}
						class="toggle toggle-primary"
					/>
				</label>
				<div class="grid grid-cols-2 gap-2" class:opacity-40={!rebuyEnabled}>
					<label class="glass space-y-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Rebuy-Drink</span>
						<select
							name="rebuyDrinkType"
							value={selectedMode.defaultConfig.rebuy.drinkType}
							disabled={!rebuyEnabled}
							class="w-full bg-transparent text-sm outline-none"
						>
							<option value="SCHLUCK">Schluck</option>
							<option value="KURZER">Kurzer</option>
							<option value="BIER_EXEN">Bier exen</option>
						</select>
					</label>
					<label class="glass space-y-1 rounded-xl p-3">
						<span class="text-base-content/50 text-xs">Betrag pro Rebuy</span>
						<input
							type="number"
							name="rebuyAmount"
							value={selectedMode.defaultConfig.rebuy.amount}
							min="1"
							disabled={!rebuyEnabled}
							class="tabular w-full bg-transparent text-base outline-none"
						/>
					</label>
				</div>
			</fieldset>

			<!-- Entity preview -->
			{#if selectedMode.defaultEntities.length > 0}
				<section class="space-y-2">
					<span class="text-base-content/70 text-sm font-medium uppercase tracking-wider">
						{selectedMode.terminology.entity}n
					</span>
					<ul class="glass space-y-2 rounded-xl p-3 text-sm">
						{#each selectedMode.defaultEntities as e (e.name)}
							<li class="flex items-center gap-3">
								<span
									class="inline-block h-3 w-3 shrink-0 rounded-full"
									style="background: {(e.attributes as { color?: string })?.color ?? '#888'}"
								></span>
								<span>{e.name}</span>
								{#if (e.attributes as { emoji?: string })?.emoji}
									<span class="ml-auto text-base">
										{(e.attributes as { emoji?: string }).emoji}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{:else}
				<div class="text-base-content/50 rounded-xl border border-dashed border-white/10 p-3 text-xs">
					Dieser Mode hat keine voreingestellten {selectedMode.terminology.entity}n.
				</div>
			{/if}
		{/if}

		<button type="submit" class="btn btn-primary glow-primary h-14 w-full rounded-xl text-base">
			Session starten
		</button>
	</form>
{/if}
