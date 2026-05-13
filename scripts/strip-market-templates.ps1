# Replaces the legacy Market-Templates UI block in ModeForm.svelte with a Bet-Graphs CTA.
$ErrorActionPreference = 'Stop'
$f = "$PSScriptRoot\..\src\lib\components\ModeForm.svelte"
$lines = Get-Content -LiteralPath $f
$startLine = ($lines | Select-String -SimpleMatch '<!-- Market Templates -->' | Select-Object -First 1).LineNumber
$endLine   = ($lines | Select-String -SimpleMatch '<!-- Advanced settings'   | Select-Object -First 1).LineNumber
if (-not $startLine -or -not $endLine) { throw "anchors not found" }
$startIdx = $startLine - 1
$endIdx   = $endLine - 1
Write-Host "Removing lines $startLine..$($endLine-1) ($($endIdx - $startIdx) lines)"

$tab = [char]9
$replacement = @(
  "$tab<!-- Bet-Graphs (replaces legacy Market-Templates UI) -->",
  "$tab<section class=`"glass glass-xl space-y-3 p-4 sm:p-5`">",
  "$tab$tab<header class=`"flex items-baseline gap-2`">",
  "$tab$tab$tab<span class=`"bg-warning/15 text-warning inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold`">4</span>",
  "$tab$tab$tab<h2 class=`"flex-1 text-base font-semibold`">Wetten (Bet-Graphs)</h2>",
  "$tab$tab</header>",
  "$tab$tab<p class=`"text-base-content/55 text-xs`">",
  "$tab$tab$tab" + 'Wetten werden als visueller <strong>Bet-Graph</strong> definiert &mdash; Knoten ablegen und Pins per Drag-to-Connect verbinden.',
  "$tab$tab</p>",
  "$tab$tab{#if initial.slug && initial.slug !== ''}",
  "$tab$tab$tab<a",
  "$tab$tab$tab$tabhref={`"/modes/`" + initial.slug + `"/graphs`"}",
  "$tab$tab$tab$tabclass=`"from-primary/20 to-success/20 border-primary/40 flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-gradient-to-r p-4 transition hover:shadow-lg`"",
  "$tab$tab$tab>",
  "$tab$tab$tab$tab<div class=`"flex items-center gap-3`">",
  "$tab$tab$tab$tab$tab<span class=`"text-2xl`" aria-hidden=`"true`">" + [System.Char]::ConvertFromUtf32(0x1F4D0) + "</span>",
  "$tab$tab$tab$tab$tab<div class=`"flex flex-col text-left`">",
  "$tab$tab$tab$tab$tab$tab<strong class=`"text-base`">Bet-Graphs " + [char]0x00F6 + "ffnen</strong>",
  "$tab$tab$tab$tab$tab$tab<small class=`"text-base-content/70`">Visueller Wett-Builder (Drag-to-Connect)</small>",
  "$tab$tab$tab$tab$tab</div>",
  "$tab$tab$tab$tab</div>",
  "$tab$tab$tab$tab<span class=`"text-xl`">" + [char]0x2192 + "</span>",
  "$tab$tab$tab</a>",
  "$tab$tab{:else}",
  "$tab$tab$tab<div class=`"border-base-content/15 bg-base-200/30 rounded-xl border border-dashed p-4 text-center text-sm`">",
  "$tab$tab$tab$tab<span class=`"text-base-content/60 block`">Bet-Graphs verf" + [char]0x00FC + "gbar nach dem ersten Speichern.</span>",
  "$tab$tab$tab</div>",
  "$tab$tab{/if}",
  "$tab</section>",
  ""
)

$head = $lines[0..($startIdx - 1)]
$tail = $lines[$endIdx..($lines.Count - 1)]
$new  = $head + $replacement + $tail
$new | Set-Content -LiteralPath $f -Encoding UTF8
Write-Host "Wrote $($new.Count) lines (was $($lines.Count))"
