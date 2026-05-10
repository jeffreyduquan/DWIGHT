# DWIGHT — UI / UX

> Mobile-first PWA. Future-modern, clean, epic. The dark canvas does the work; restraint everywhere except the moments that earn drama.

---

## 1. Brand voice

| | |
|---|---|
| **Tone** | Confident, dry, slightly conspiratorial. The app is the GM behind the GM. |
| **Density** | Sparse. Lots of negative space. Numbers and CTAs do the heavy lifting. |
| **Drama** | Reserved for: round going live, you winning, you losing, drink confirmed. |
| **Copy** | German for users, no exclamation marks except for true wins, never use "fun" words. |

---

## 2. Theme — Quantum Plasma

DaisyUI custom theme `dwight`, all colors in OKLCH.

| Token | Hex (display) | OKLCH | Use |
|---|---|---|---|
| `--color-primary` | `#00FFA3` | photon green | Main CTA, win highlight, active state |
| `--color-secondary` | `#A78BFA` | iris violet | Secondary CTA, info accents |
| `--color-accent` | `#FF3D71` | plasma pink | Drinks, force-actions, danger highlight |
| `--color-base-100` | `#050511` | deep void | Page background |
| `--color-base-200` | `#0B0B1F` | | Cards, raised surfaces |
| `--color-base-300` | `#16162E` | | Inputs, dividers |
| `--color-base-content` | `#F4F4FF` | | Primary text |
| `--color-success` | photon green | | Bet WON, drink CONFIRMED |
| `--color-warning` | amber | | Pending drinks |
| `--color-error` | plasma pink | | Bet LOST, validation errors |

Effects:
- **Aurora** — slow drifting photon-green + iris-violet radial gradients on landing/lobby
- **Noise** — 0.05 opacity noise overlay sitewide
- **Glass** — `rgba(255,255,255,0.04)` background, `1px` iridescent border (photon→iris gradient), `8px` blur, soft inner highlight
- **Glow-primary** — soft photon-green halo on win/active CTAs
- **Glow-accent** — soft plasma-pink halo on drink/danger CTAs
- **Text-gradient-primary** — photon → iris → blue across "DWIGHT" and key headings
- **Text-gradient-danger** — plasma pink → iris violet for drink-related headings
- **Fade-up** — 280ms cubic ease, 12px translate, used for staggered list reveals

---

## 3. Type stack

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display / wordmark | **Space Grotesk** | 500, 600, 700 | uppercase, tracking 0.04em for `DWIGHT` |
| Body | **Inter** | 400, 500, 600 | UI labels, paragraphs |
| Numerics / mono | **Geist Mono** (`ss01`) | 500 | balances, multipliers, invite codes, all numbers |

CSS classes:
- `.display` — Space Grotesk, weight 600, tight tracking
- `.wordmark` — Space Grotesk, weight 700, uppercase, tracking 0.04em
- `.tabular` — Geist Mono with `font-feature-settings: "ss01"`, used on every money/multiplier/code render

V1 ships fonts via Google Fonts CDN with preconnect; V6 swap to `@fontsource` self-hosted.

---

## 4. Layout primitives

- **Mobile width**: 100% with `px-6` page padding, `max-w-md mx-auto` content column
- **Tablet/desktop**: same column locked at `max-w-md` for V1; multi-pane only in `/round/host`
- **Vertical rhythm**: `py-12` for full-page contexts, `space-y-6` between blocks, `space-y-2` inside lists
- **Touch targets**: 44px minimum hit; primary CTA buttons `h-14 rounded-xl`
- **Safe areas**: respect notch/dynamic-island via `env(safe-area-inset-*)` on top + bottom

---

## 5. Component vocabulary (target inventory)

| Component | Purpose |
|---|---|
| `<Logo>` | hex+core+spark mark + DWIGHT wordmark, `size` prop, `showWordmark` prop |
| `<Card>` | `.glass` base wrapper, optional `interactive` for hover/press |
| `<MoneyPill>` | tabular-rendered amount with sign-aware color (positive = primary, negative = error) |
| `<MultiplierBadge>` | tabular x.xx formatting, glow-primary halo when bet placed |
| `<EntityChip>` | colored dot (from `attributes.color`) + name; reusable for any kind of entity |
| `<DrinkBadge>` | tier glyph (Schluck=⌒, Kurzer=▣, Bier Exen=▥) + tier name + price tabular |
| `<BetForm>` | one BetOffer's prompt + selection input + stake input + live multiplier + confirm |
| `<RoundStatusPill>` | colored capsule per status (SETUP gray, BETTING_OPEN primary, LIVE accent pulse, RESOLVING amber, SETTLED muted) |
| `<PendingDrinkRow>` | drink + countdown + confirm-CTA |
| `<Leaderboard>` | medal podium + scrollable rank list |
| `<TopBar>` | session name + my balance + bet-lock indicator |
| `<BottomDock>` | floating glass nav for Round / Drinks / Stats inside a session |

---

## 6. Key screens

### 6.1 Landing (guest)

- Aurora background
- Logo centered, large
- Headline: `Wetten. Trinken. Gewinnen.` — three lines, primary gradient on first line
- Subline (German): `Das programmierbare Trinkspiel — Wetten, Modi, Regeln. Du baust den Abend.`
- Primary CTA `Konto erstellen`, glass secondary `Einloggen`
- Footer: `DWIGHT · v0.x` in tabular

### 6.2 Lobby (logged-in landing)

- Logo + wordmark
- "Hallo, {username}"
- "Deine Sessions" heading
- Glass cards per session: name, invite code (tabular), status pill
- Empty state: glass card with logo glyph + "Noch keine Sessions."
- Primary CTA `Session erstellen`, glass `Mit Code beitreten`, faint logout link

### 6.3 `/s/create`

- Step 1: pick Mode (V1: only one card showing, auto-selected)
- Step 2: session name + auto-generated invite code (with regenerate icon)
- Step 3: collapsed config overrides (drink prices, confirmation mode dropdown, broke-lock toggle, starting money)
- Step 4: entity preview (defaults from Mode), edit names/colors inline
- Big primary CTA `Session starten`

### 6.4 Session lobby `/s/:id`

- TopBar: session name + my balance (tabular) + bet-lock indicator if locked
- Player list with balances, host badge
- BottomDock: Round / Drinks / Stats

### 6.5 `/s/:id/round` (player view)

- Round status pill at top (LIVE pulses)
- BetOffer list (cards):
  - Prompt (e.g. "Wer gewinnt das Rennen?")
  - Per-outcome row: entity chip + live multiplier (tabular) + tap to select
  - Selected outcome highlighted glow-primary
  - Stake input (large tabular, +/- buttons)
  - Big confirm `Wette platzieren`
  - Locked multiplier confirmation toast on success
- My open bets accordion at bottom

### 6.6 `/s/:id/round/host` (GM view)

- Status transition stepper (SETUP → BETTING_OPEN → LIVE → RESOLVING → SETTLED) with current step highlighted
- BetOffer composer: pick template, supply config, add to round
- "Wettannahme öffnen" / "Rennen läuft" / "Ergebnis erklären" big primary CTA per state
- Outcome declarer matched to outcomeKind:
  - **ranking** — drag-rank entities into 1, 2, 3, …; "Ausfall" toggle per entity
  - **boolean** — Ja / Nein toggle
  - **numeric** — number input
- Inline live odds preview + bet count per offer

### 6.7 `/s/:id/drinks`

Tabs: `Selbst` · `Andere zwingen` · `Offen` · `Verlauf`

- **Selbst**: 3 large drink-tier cards (Schluck/Kurzer/Bier Exen) showing price; tap → confirm modal → goes PENDING in own queue
- **Andere zwingen**: pick target (player chip selector) + drink tier; price shown, tap pays + queues
- **Offen**: my pending drinks (incoming forces + my own selfs) with status (waiting for: GM / N peers); separately, OTHER players' pending drinks I can confirm with a single tap
- **Verlauf**: chronological confirmed/cancelled list

### 6.8 `/s/:id/stats`

- 5-card my-summary row (Bilanz, ROI%, Trefferquote, Drinks self, Drinks erzwungen)
- Leaderboard with podium + rank list, "DU" badge highlighted
- Round history accordion: round number, winner, my stake/payout per round

---

## 7. Motion language

- **Soft**: 220–280ms cubic ease for state changes, hovers, slide-ins
- **Punchy**: 120ms snap for bet-confirm flash, drink-confirm pulse
- **Pulse**: 1.6s loop on LIVE status pill
- **Aurora drift**: 14s loop, infinite, on landing/lobby
- **Reduced motion**: respect `prefers-reduced-motion: reduce` — replace pulses with static, kill aurora drift, keep transitions but at 80ms

---

## 8. Sound (D6, optional)

| Event | Sound | Notes |
|---|---|---|
| Bet placed | tiny ascending blip | tabular-feel |
| Round LIVE | three-note motif | dramatic but short |
| You won | photon-shimmer up-arpeggio | not too loud |
| You lost | dry low thud | one-shot |
| Drink confirmed | glass clink | satisfying |
| Bet locked (broke) | descending muted blip | warning |

All toggleable via session config `soundsEnabled`. Default off until D6 ships.

---

## 9. Accessibility

- All color contrast ≥ 4.5:1 against base-100 (verified with OKLCH math)
- All interactive elements have `aria-label` or visible label
- Focus visible: 2px photon-green ring with 2px offset on `:focus-visible`
- Keyboard: tab order follows visual order; primary CTA reachable in ≤ 3 tabs
- Live regions: SSE-driven status changes use `aria-live="polite"` for non-critical, `aria-live="assertive"` only for own-bet-resolved / own-drink-confirmed

---

## 10. Open visual decisions (track here, decide before D5)

- Drink tier glyphs — current placeholders ⌒ ▣ ▥; consider custom SVG icons
- Entity color palette default (the 4 demo marbles ship with: photon green, iris violet, plasma pink, amber — needs review)
- Aurora intensity on smaller phones (may need to dial down for OLED battery)
- Leaderboard medal style — text emoji 🥇🥈🥉 vs custom SVG
