// Replaces the legacy Market-Templates UI section in ModeForm.svelte with a Bet-Graphs CTA.
// Uses Node.js so we sidestep PowerShell encoding quirks.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/lib/components/ModeForm.svelte';
const src = readFileSync(path, 'utf8');

const startMarker = '\t<!-- Market Templates -->';
const endMarker = '\t<!-- Advanced settings (Terminology + Economy + Drinks + Confirmation + Rebuy) -->';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) throw new Error('markers not found');

const replacement = `\t<!-- Bet-Graphs (replaces legacy Market-Templates UI) -->
\t<section class="glass glass-xl space-y-3 p-4 sm:p-5">
\t\t<header class="flex items-baseline gap-2">
\t\t\t<span class="bg-warning/15 text-warning inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold">4</span>
\t\t\t<h2 class="flex-1 text-base font-semibold">Wetten (Bet-Graphs)</h2>
\t\t</header>
\t\t<p class="text-base-content/55 text-xs">
\t\t\tWetten werden als visueller <strong>Bet-Graph</strong> definiert &mdash; Knoten
\t\t\tablegen und Pins per Drag-to-Connect verbinden.
\t\t</p>
\t\t{#if modeId}
\t\t\t<a
\t\t\t\thref={'/modes/' + modeId + '/graphs'}
\t\t\t\tclass="from-primary/20 to-success/20 border-primary/40 flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-gradient-to-r p-4 transition hover:shadow-lg"
\t\t\t>
\t\t\t\t<div class="flex items-center gap-3">
\t\t\t\t\t<span class="text-2xl" aria-hidden="true">📐</span>
\t\t\t\t\t<div class="flex flex-col text-left">
\t\t\t\t\t\t<strong class="text-base">Bet-Graphs öffnen</strong>
\t\t\t\t\t\t<small class="text-base-content/70">Visueller Wett-Builder (Drag-to-Connect)</small>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t\t<span class="text-xl">→</span>
\t\t\t</a>
\t\t{:else}
\t\t\t<div class="border-base-content/15 bg-base-200/30 rounded-xl border border-dashed p-4 text-center text-sm">
\t\t\t\t<span class="text-base-content/60 block">Bet-Graphs verfügbar nach dem ersten Speichern.</span>
\t\t\t</div>
\t\t{/if}
\t</section>

`;

const out = src.slice(0, startIdx) + replacement + src.slice(endIdx);
writeFileSync(path, out, 'utf8');
console.log(`removed ${src.length - (out.length - replacement.length)} chars, inserted ${replacement.length}, new size ${out.length}`);
