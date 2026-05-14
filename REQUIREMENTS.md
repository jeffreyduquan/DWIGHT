# DWIGHT — Requirements

> **DWIGHT** is a generic, programmable drinking-game framework. The Game Master designs custom bets and rules; players bet money on round outcomes, and a parallel drink economy lets players cash out money by drinking.
>
> Marble racing is **not** the product. It is one **example Mode** used as battle-test content during development.

---

## 0. Vocabulary

| Term | Meaning |
|---|---|
| **Session** | One play night. Has a host, players, money balances, and a bound Mode. |
| **Mode** | A reusable game template (terminology, default entities, trackables, default config). Built-in or user-authored. |
| **Entity** | The thing rounds are played with — a marble, a player, a card, a coin, anything. |
| **Trackable** | A countable in-round event type defined on a Mode, scope=`global` or `entity` (e.g. foul, overtake). |
| **RoundEvent** | One proposed counter increment (`+1`) for a Trackable (optionally for one Entity), then GM-confirmed or cancelled. |
| **Predicate** | Boolean expression over counter values (`count(trackable, entity?) cmp n` with AND/OR/NOT). |
| **BetMarket** | A round-scoped pool containing multiple Outcomes (predicates) that share one stake pool. |
| **BetOutcome** | One labeled predicate inside a BetMarket. |
| **Bet** | A player's stake on one BetOutcome. Money-only economy. |
| **Drink** | A drink event: SCHLUCK, KURZER, or BIER_EXEN. Either SELF-issued (cash-out) or FORCE-issued (paid by attacker). |
| **GameMaster (GM)** | Session host; runs rounds, declares outcomes, can confirm drinks, edits config. |

---

## 1. Identity & Branding (REQ-BRAND-***)

- **REQ-BRAND-001** Product name is `DWIGHT`. Always set in caps in copy and frontend titles.
- **REQ-BRAND-002** No tagline shipped in V1. Tagline slot reserved for future use.
- **REQ-BRAND-003** Theme: light, monochrome, soft-neumorphic — "Soft Linen". Paper background `#F2EFE9` with subtle SVG grain. All controls are pill-shaped with a top-left highlight + bottom-right warm drop shadow (raised) or inset shadows (pressed/inputs). Sage `oklch(58% 0.05 148)` reserved for focus rings, active indicators, primary text accent — never used as a full color fill. Defined in `layout.css` as DaisyUI theme `dwight` (light, prefersdark=false).
- **REQ-BRAND-004** Type stack: Inter (display + body, 600/700 with -0.02em tracking on display, no uppercase gimmicks except `.eyebrow` micro-labels). Geist Mono for tabular numerics.
- **REQ-BRAND-005** Logo mark: 32×32 raised neumorphic pill (rounded-full, soft drop shadow) with a recessed sage dot center. Wordmark in Inter 700.
- **REQ-BRAND-006** Mobile-first PWA: viewport-fit cover, manifest, favicon, theme-color `#F2EFE9`, install prompt later.
- **REQ-BRAND-007** UI language: German (de-DE) for all player-facing copy. Code, comments, docs in English.

---

## 2. Authentication & Accounts (REQ-AUTH-***)

- **REQ-AUTH-001** Username + password registration. Minimum 3 chars username (a-z 0-9 _ -), minimum 8 chars password.
- **REQ-AUTH-002** Passwords stored only as argon2id hashes (no plaintext, no reversible scheme).
- **REQ-AUTH-003** Session is a signed JWT in an HttpOnly Secure SameSite=Lax cookie named `dwight_session`. Issuer=`dwight`, Audience=`dwight-web`. Default lifetime 30 days; refreshed on each request.
- **REQ-AUTH-004** Login endpoint is rate-limited per IP (sliding window, e.g. 10 attempts / 5 min). Failed attempts return generic error (no user-enumeration).
- **REQ-AUTH-005** Logout clears the cookie server-side (POST `/logout`).
- **REQ-AUTH-006** All session-scoped routes (`/s/:id/*`) reject unauthenticated requests with 302 to `/login`.
- **REQ-AUTH-007** A user has a stable UUID `id` and a stable display `username`. Username is unique (case-sensitive at storage; UI shows as entered).

---

## 3. Modes (REQ-MODE-***)

- **REQ-MODE-001** Every Session is bound to exactly one Mode at create-time. Mode is immutable for the Session's lifetime.
- **REQ-MODE-002** Modes are stored in a `modes` table. Built-in Modes have `owner_user_id = null`. User-authored Modes have an owner.
- **REQ-MODE-003** A Mode declares: slug (unique), name, description, terminology overrides (round noun / entity noun / live-verb), default entity list, Trackables (`id`, `label`, `scope`, optional visual attributes), and default config blob.
- **REQ-MODE-004** Modes are user-authored by default; no mandatory built-in battle-test mode in V1.
- **REQ-MODE-005** Session-create UI shows a Mode picker over the user's available Modes.
- **REQ-MODE-006** A Mode's terminology is consulted by the UI helper `useTerminology(modeId)` which returns `{ round, entity, startedVerb }` with sensible defaults (`Runde` / `Entität` / `läuft`).
- **REQ-MODE-007** A Mode owns zero or more **Bet-Graphs** (table `bet_graphs`): visual node-graph definitions (`{version:1, nodes:[], edges:[]}`) that compile to runtime markets. At session-create the snapshot is copied to `sessions.bet_graphs_snapshot`; at round-betting-open the compiler emits one market per supported outcome via `compileSessionGraphs` and spawns them alongside legacy `market_templates` (side-by-side). Unsupported shapes are skipped (no hard fail). Supported in Phase 6: Wett-Familien A (race, N=1 via `log_rank`), B (arg_max), C (sum+compare), D (count+compare). Other families return `ok:false` and are skipped.

---

## 4. Entities (REQ-ENT-***)

- **REQ-ENT-001** Entities are session-scoped. Created from `mode.defaultEntities` at Session creation.
- **REQ-ENT-002** Each Entity has: kind (free text, e.g. `marble`, `player`, `card`), name, attributes JSONB (color, emoji, image, etc.), order index.
- **REQ-ENT-003** Host can edit, reorder, add, remove entities while no Round is LIVE.

---

## 5. Rounds (REQ-ROUND-***)

- **REQ-ROUND-001** A Round has status `SETUP → BETTING_OPEN → LIVE → RESOLVING → SETTLED`. Forward-only transitions. From any non-terminal state the GM can additionally transition to `CANCELLED`, which automatically voids all of the round's markets and refunds every stake.
- **REQ-ROUND-002** Only the GM can transition a Round status.
- **REQ-ROUND-003** New bets are accepted only in `BETTING_OPEN`. They are locked at `LIVE`.
- **REQ-ROUND-004** During `LIVE`, players may propose RoundEvents and the GM confirms or cancels them. Confirmed events mutate the round counter state; cancelled events do not count.
- **REQ-ROUND-005** A Session has at most one non-SETTLED Round at a time.

---

## 6. Trackables & Predicates (REQ-TRACK-***)

- **REQ-TRACK-001** A Trackable is defined at Mode-level and snapshotted onto each Session at create-time.
- **REQ-TRACK-002** Trackable scope is either `global` (one counter per round) or `entity` (one counter per round and entity).
- **REQ-TRACK-003** Predicates are AST JSON (`count` leaf with `gte/lte/eq`, plus `and/or/not`).
- **REQ-TRACK-004** Predicate evaluation uses the round's confirmed counter snapshot at settle-time.

---

## 7. Round Events (REQ-EVENT-***)

- **REQ-EVENT-001** A RoundEvent always represents `delta = +1` for a Trackable; it can target an Entity when scope=`entity`.
- **REQ-EVENT-002** Players can propose events; only GM can confirm or cancel.
- **REQ-EVENT-003** Undo is supported by cancelling a previously confirmed event (or equivalent negative correction internally), followed by re-evaluation at settle.
- **REQ-EVENT-004** Event timeline is audit-visible (who proposed, who decided, when, status).

---

## 8. Markets & Outcomes (REQ-MARKET-***)

- **REQ-MARKET-001** A BetMarket belongs to one Round and has 2..N Outcomes; all Outcomes in a market share one stake pool.
- **REQ-MARKET-002** GM/Host creates BetMarkets (players do not create offers directly in V1).
- **REQ-MARKET-003** Single-market creation auto-generates a counter-outcome: `JA` predicate plus `NEIN` = logical NOT.
- **REQ-MARKET-004** Bulk entity-market creation creates one shared market with one outcome per Entity plus one auto `keine davon` outcome. _(Deferred to D5+; the engine already supports multi-outcome markets via `createMarket(outcomes[])`; UI form is binary-only in D3.)_
- **REQ-MARKET-005** Bulk sibling outcomes share one market pool (multi-outcome market), not isolated mini-pools.
- **REQ-MARKET-006** If multiple outcomes evaluate true at settle, the market pool is split equally across winning outcomes before bettor-level proportional payouts.
- **REQ-MARKET-007** Market templates are defined at the **Mode** level (not per Round). Two template shapes: `binary_count` (counter `cmp` n, with `entityScope='global'` → one market or `'each'` → one market per session entity, supporting `{entity}` / `{n}` title placeholders) and `compare_entities` (one outcome per session entity = "strictly greatest counter", optional Gleichstand outcome). At round creation, all templates are auto-instantiated as concrete BetMarkets; ad-hoc market creation in the Round UI is hidden behind a HOST-only "Manueller Markt (Override)" disclosure.
- **REQ-MARKET-008** Predicate engine supports `compare_counters` (counter A `cmp` counter B; with `gt|lt|gte|lte|eq`) in addition to `count` (counter `cmp` n) and `and`/`or`/`not` combinators.

---

## 9. Bets & Settlement (REQ-BET-***)

- **REQ-BET-001** A Bet locks: `outcome_id`, `stake`, `created_at`; stake is deducted immediately.
- **REQ-BET-002** Bets are accepted only while market status is `OPEN` and round status is `BETTING_OPEN`.
- **REQ-BET-003** On round settle, each outcome predicate is evaluated against the confirmed counter snapshot and marked winner/loser.
- **REQ-BET-004** Market payout model is parimutuel, no house edge: full market pool is redistributed to winning outcomes (REQ-MARKET-006), then to winning bets proportionally by stake.
- **REQ-BET-005** If a market has no winning outcomes, it is VOID and all stakes in that market are refunded.
- **REQ-BET-006** Bet history is immutable once settled/voided.

---

## 10. Money Economy (REQ-ECON-***)

- **REQ-ECON-001** Every player has a per-Session integer money balance (cents/units; never floats). Initial balance from `mode.defaultConfig.startingMoney`.
- **REQ-ECON-002** Bet placement is atomic and validated against canonical money balance (no race conditions; PG transaction with row-level lock on `session_players`).
- **REQ-ECON-003** On placement: stake is deducted immediately. On settle/void: payout or refund is credited exactly once.
- **REQ-ECON-004** Payout math uses integer-safe distribution rules; residual rounding remainder stays deterministic (implementation-defined but consistent and audited).
- **REQ-ECON-005** Bet history is immutable once SETTLED.

---

## 11. Live Market View (REQ-ODDS-***)

- **REQ-ODDS-001** Players see dynamic, informational market metrics during betting (`pool total`, `stake per outcome`, `implied share`).
- **REQ-ODDS-002** Displayed metrics are indicative only; actual payout is determined at settle-time by parimutuel distribution.
- **REQ-ODDS-003** Market metrics are rebroadcast over SSE whenever a bet is accepted.

---

## 12. Drink Economy (REQ-DRINK-***)

- **REQ-DRINK-001** Three drink tiers: `SCHLUCK` (sip), `KURZER` (shot), `BIER_EXEN` (chug a beer).
- **REQ-DRINK-002** Each tier has a money value configured per Mode (`drinkPrices.{SCHLUCK,KURZER,BIER_EXEN}`). The same value serves both as the SELF cash-out and the FORCE price (single source of truth).
- **REQ-DRINK-003** **SELF (cash-out)**: a player chooses a drink tier and self-issues a Drink with `origin = SELF`. On confirmation, the player's balance is credited by `priceSnapshot`.
- **REQ-DRINK-004** **FORCE**: an attacker chooses a drink tier and a target. `priceSnapshot` is debited from the attacker. A Drink with `origin = FORCE` is created in PENDING status assigned to the target. On confirmation, **no money credit** to the target — force-drinks are pure punishment.
- **REQ-DRINK-005** A Drink's `priceSnapshot` is captured at issue time and never changes if the Mode config later changes.
- **REQ-DRINK-006** Confirmation rule per Mode (`confirmationMode`): `GM` (1 GM signoff) or `PEERS` (N distinct signoffs, `peerConfirmationsRequired`). In `PEERS` mode a GM confirmation counts as a peer. As of Phase 11.2 only `GM` and `PEERS` are valid; the legacy `EITHER` value has been removed from the enum and backfilled to `PEERS`.
- **REQ-DRINK-007** A Drink can be cancelled by the GM at any time before confirmation. Cancelled SELF drinks do not credit. Cancelled FORCE drinks **refund** the attacker.
- **REQ-DRINK-008** Only drink tiers in `mode.forceDrinkTypesAllowed` may be used to FORCE another player. SELF can use any tier.
- **REQ-DRINK-009** Drinks are session-scoped, not round-scoped. They can be issued and confirmed at any time during the Session.
- **REQ-DRINK-010** Self-confirming your own drink as a peer is forbidden. The target cannot count as a confirmation peer for their own Drink.
- **REQ-DRINK-011** **Lock policy** (`lockMode`, default `TIMER_LOCK`):
  - `TIMER_LOCK` — player may keep betting for `lockTimerSeconds` (default 600s = 10min). After expiry the player is locked from new bets until the drink is confirmed or cancelled.
  - `LOCK` — player is hard-locked from betting the moment a drink is PENDING.
  - `NONE` — drinks never affect betting.
- **REQ-DRINK-012** Any user with an account may create a session and automatically becomes its GM (host). No admin role is required.

---

## 13. Rebuy via Drink (REQ-REBUY-***)

- **REQ-REBUY-001** Each Session has a `rebuy` config object: `{ enabled: boolean, drinkType: DrinkType, amount: number }`. Defaults come from the Mode but the Host can override at session creation and via GM edit.
- **REQ-REBUY-002** When `rebuy.enabled = true` and a player's `moneyBalance ≤ 0`, the player can self-trigger a Rebuy: the server creates a `Drink` row with `origin = SELF`, `drinkType = rebuy.drinkType`, `priceSnapshot = drinkPrices[drinkType]`, and `rebuy_amount = rebuy.amount`. The Drink starts as `PENDING`.
- **REQ-REBUY-003** Money is **only** credited once the Drink is confirmed per the session's `confirmationMode` (GM / PEERS). On confirmation, `+rebuy_amount` is added to the player's `moneyBalance` and the rebuy event is broadcast.
- **REQ-REBUY-004** Rebuys are unlimited per player per session.
- **REQ-REBUY-005** A pending rebuy does NOT immediately unlock the player; the player remains bet-blocked until the rebuy drink is confirmed (so they can't double-dip a single rebuy across rounds).
- **REQ-REBUY-006** Rebuy state changes are broadcast via SSE so all clients update balances + lock indicators in real time.

---

## 14. Real-Time (REQ-RT-***)

> Status: implemented in D4 via in-process SSE broadcaster.

- **REQ-RT-001** Each Session has one SSE channel (`/s/:id/stream`). Authorized players subscribe; unauthorized requests close.
- **REQ-RT-002** Event types broadcast:
  - `round_opened`, `round_live`, `round_settled`, `round_cancelled`
  - `round_event_proposed`, `round_event_confirmed`, `round_event_cancelled`
  - `market_created`, `market_locked`, `market_settled`, `bet_placed`
  - `market_metrics_updated` (market-id + per-outcome stakes/shares)
  - `drink_initiated`, `drink_confirmed`, `drink_cancelled`
  - `balance_updated` (per player)
  - `bet_lock_changed` (per player)
- **REQ-RT-003** Broadcaster is in-process for V1 (single Node process). Cluster/multi-instance defers to V2 (Redis pub/sub).
- **REQ-RT-004** SSE messages carry only IDs and the diff. Clients re-fetch full state on reconnect.

---

## 15. UI Routes (REQ-UI-***)

- **REQ-UI-001** Public:
  - `/` — landing (guest) or lobby (logged-in)
  - `/login`, `/register`
- **REQ-UI-002** Authed:
  - `/s/create` — Mode picker + session config overrides + initial entity edit
  - `/s/join` — invite code
  - `/s/:id` — session lobby (players, balances, drinks tab, history)
  - `/s/:id/round` — unified round page (role-aware): players see markets + stake form; HOST also sees lifecycle controls, event approval queue, and market creation form.
  - `/s/:id/drinks` — drink dashboard (initiate self, force, confirm pending, history)
  - `/s/:id/stats` — leaderboard + my stats + round history
- **REQ-UI-003** All player-facing copy is German. Numbers use `tabular` (Geist Mono ss01).
- **REQ-UI-004** Mobile viewports are first-class. Desktop is a side-effect of fluid layout.
- **REQ-UI-005** All `/s/:id/*` routes share one chrome: a compact `SessionTopBar` (back link, Host/Gesperrt pills, prominent balance chip) and a sticky `BottomDock` (Lobby · Wetten · Wettinfos · Stats). Both are rendered once in `s/[id]/+layout.svelte`; child pages render only domain content. Min 48px touch targets. Pending-drink badge surfaces on the Lobby tab (since drinks now live there).
- **REQ-UI-006** Mode template builder uses a **Lego-style gallery**: collapsed by default, opens a 2-column visual card grid (icon + label + one-line example) for each of the 9 market-template kinds. Adding a kind appends a single per-template detail form below. No 9-button toolbar.
- **REQ-UI-007** Entity & Trackable rows in `ModeForm` show only **one visible input** (the name). Color is auto-derived from a deterministic palette (stable hash of the name); the avatar chip displays the first character (or stored emoji). Trackable scope is a 2-button chip toggle (`pro` / `global`), not a dropdown. `kind`/`color`/`emoji` form fields are submitted as hidden inputs to keep the parseForm contract.
- **REQ-UI-008** Mode has an optional `defaultConfig.showOdds` boolean (default `true`). When `false`, market UIs in the round page hide the parimutuel multiplier (`1.82×`) and percentage column entirely. Players still see their own placed stake.
- **REQ-UI-009** Bet placement uses **one-tap quick-stake chips** (Min · ~25% · ~50% · All-in, deduped & clamped to ≥`minStake` and ≤`balance`). Each chip is a submit button with `name="stake" value={amount}` inside the `?/placeBet` form — no separate stake input, no expand/collapse details. Players with insufficient balance see a short hint instead of chips.
- **REQ-UI-010** Drinks UI lives **only in the Lobby** (`/s/:id`). The dedicated `/s/:id/drinks` route is a permanent redirect to the lobby; the BottomDock has no Drinks tab. Buy-In/Verteilen are first-class actions in the lobby's embedded `DrinkPanel`. Wording: tab labels are **Buy-In** (was Cashout) and **Verteilen** (was Force).
- **REQ-UI-011** The BottomDock surfaces a **Wettinfos** tab at `/s/:id/info` listing the session's Entities (with attribute color/emoji/initial avatar) and Trackables (with scope, emoji, description). Replaces the previous Drinks tab. Tabs are: Lobby · Wetten · Wettinfos · Stats.
- **REQ-UI-012** The Round page is labelled **Wetten** and uses an **accumulator stake** flow per market: a shared chip row of `+2% · +5% · +25% of startingMoney` adds its value to a running total per market on each tap (multi-tap stacks); a circular `RotateCcw` reset chip zeros the total. Each outcome row carries its own `Setzen · {n}` submit button that places the accumulated total on that outcome and resets the counter. Chips disable when the next tap would exceed the player's balance. No round number, no eyebrow status text, no `describePredicate` subtext. Host controls collapse to a single primary action (**Starten** for SETUP/BETTING_OPEN, **Abrechnen** for LIVE) plus a secondary `GM` disclosure for Cancel + event buffer review.
- **REQ-UI-013** `SessionTopBar` is minimal: back link, optional Host/Gesperrt pills, and a prominent `tabular text-2xl` balance chip with neumorphic raised shadow. Session name and subtitle are intentionally omitted from chrome to maximise content density on phones.
- **REQ-UI-014** **Ended sessions are read-only recaps.** When `session.status === 'ENDED'`, the `/s/:id/*` layout redirects every non-stats route to `/s/:id/stats`, hides the `BottomDock`, and renders only a `Beendet` pill in the top bar with a back-to-home link. Host's `?/endSession` action returns the user to the landing page. Closed sessions appear on the landing page under a separate "Beendet" group; clicking a closed session opens its stats recap directly.
- **REQ-UI-015** Mode-template editing follows a **save-and-close** pattern: both `/modes/new` and `/modes/:id` `?/save` actions redirect to `/modes` on success, so the user always returns to the templates list after saving (no half-open edit views).
- **REQ-UI-016** Drink confirmation progress is shown as **explicit `x/y` chips** per drink: a `Host 0/1` chip and (for `PEERS` mode) a `Spieler n/N` chip, each turning sage-green when satisfied. When the active mode requires a host signature that is still missing, an additional `Host muss bestätigen` pill is rendered. No more raw "n Bestätigung(en) — warte auf MODE" copy.
- **REQ-UI-017** Closed sessions on the landing page collapse into a `<details>` block ("Beendet ({n})") that is closed by default. Active sessions render expanded above it.
- **REQ-UI-018** The Host's only session-lifecycle button in the lobby is a single **"Session beenden & löschen"** action that opens a native confirmation modal and, on confirm, hard-deletes the session and all dependent rows (rounds, bets, drinks, events) via the existing `?/deleteSession` action, then redirects to `/`. The separate "Session beenden" (mark ENDED) button has been removed from the UI.
- **REQ-UI-019** Bet-Graphs per Mode are managed at `/modes/[id]/graphs`. Phase 6 ships an MVP JSON-textarea editor: list rows show name + description + live-derived German preview sentence + a `✓ Valid` or `⚠ N Validierungsfehler` badge. Create/Save/Delete via SvelteKit form actions; `confirm()` gates delete. A discovery link `Bet-Graphs (visueller Wett-Builder, Phase 6)` lives on `/modes/[id]`. The visual Blueprints-style editor lands in a follow-up phase.
- **REQ-UI-020** The graph validator (`validateGraph`) and preview (`previewSentence`) run on every load; the compiler (`compileGraph` / `compileSessionGraphs`) returns a discriminated union (`{ok:true, market}` | `{ok:false, error}`) and only valid + supported graphs spawn markets — unsupported shapes log-and-skip so legacy `market_templates` keep working unaffected.
- **REQ-UI-021** Phase 7 ships the visual Blueprints-style editor (`src/lib/graph/GraphCanvas.svelte`): nodes auto-layout vertically by topological order; pins are coloured by `PIN_COLORS`; **drag-to-connect** (pointerdown on output pin → dashed ghost line follows cursor → pointerup over compatible input pin creates edge via `document.elementsFromPoint`) plus tap-to-connect fallback for inaccurate touchscreens; inline per-node prop editor with `<select>`/`<input>` driven by `NodeSpec.props`; `+` FAB opens bottom-sheet palette grouped by `NODE_FAMILY`; SVG overlay draws curved edges between pin centres and supports tap-to-select / delete. JSON-textarea remains as `<details>` Advanced fallback. After creating a new mode at `/modes/new` the user is redirected to `/modes/[id]` (not `/modes`) so the Bet-Graphs discovery link is immediately visible.
- **REQ-UI-022** **Phase 11 landing empty state.** When `data.sessions.length === 0` the landing page renders **only** a centred "Erste Session erstellen" tile with a prominent circular sage-gradient `+` icon (no list, no extra "Session erstellen" pill button). The pill button reappears only once at least one session exists.
- **REQ-UI-023** **Phase 11 lobby QR code.** Every `/s/[id]/` lobby renders a QR code at top encoding `${origin}/s/join?code=${inviteCode}` alongside the 6-char code. Scanning navigates the joiner to `/s/join` with the code prefilled (via `?code=…` URL parameter).
- **REQ-UI-024** **Phase 11 DrinkPanel.** The pending tab renders two scrollable lists (`max-h-80 overflow-y-auto`): "Du musst trinken" on a sage→amber gradient card with a `Hourglass` timer pill when `TIMER_LOCK` is active, and "Andere → bestätigen" below. The history tab is a single scrollable list (`max-h-96 overflow-y-auto`). Each row shows a single `Bestätigt n/N` chip (GM-mode shows `GM 0/1`); GM confirmations count toward the peer total in PEERS mode.
- **REQ-UI-025** **Phase 11 session settings.** `/s/[id]/settings` is a GM-only page (`me.role === 'HOST'`) reached from the lobby's "Session verwalten" section. It exposes drink prices, `confirmationMode`, `peerConfirmationsRequired`, `lockMode` (TIMER_LOCK | LOCK | NONE) + `lockTimerSeconds`, rebuy config, and per-session `entityOverrides[entityName] → string`. Saving redirects back to `/s/[id]/`. **Phase 12 parity:** the page additionally exposes `startingMoney`, `minStake`, and `showOdds` — i.e. every advanced field the Mode form offers under "Standard Session-Einstellungen" can also be overridden per session.
- **REQ-UI-026** **Phase 12 QR toggle.** The lobby QR code is hidden by default behind a small `QR` button placed next to the sound toggle in the footer button row. Clicking toggles a panel containing the code; the panel has its own "Schließen" button. State is local (no server round-trip).
- **REQ-UI-027** **Phase 12 entity rename at session creation.** `/s/create` renders an `<input type="text" name="entityOverride__<entityName>">` per default entity instead of a static preview. Empty values keep the Mode-default name; non-empty values are written to `session.config.entityOverrides[entityName]` server-side, then applied uniformly through `REQ-SESS-CONFIG-002`.
- **REQ-UI-028** **Phase 12 unified drinks list.** The DrinkPanel's "Drinks" tab merges pending + history into a single list with three sections (mine, others-to-confirm, history). Stackable drink types (`SCHLUCK`, `KURZER`) collapse multiple pending entries per `(targetUserId, drinkType)` bucket into a single row with a `n×` prefix and click-to-expand; sources are deduped under "Erzwungen von …". `BIER_EXEN` is never stacked. History rows of the same bucket also collapse by `(targetUserId, drinkType, status)` and show count.
- **REQ-UI-029** **Phase 12 ghost-workflow settle.** The GM no longer sees a per-event "Buffer prüfen" panel. Instead, the previous "Abrechnen" CTA is renamed to **"Ergebnisse anzeigen"** and opens a modal grouping pending events by `(trackable, entityId)`. For each bucket: if only GM or only ghost values exist the source is auto-applied; otherwise the GM picks `mine` (own count) vs `others` (ghost average + N players). Submitting hits `?/decideAndSettle`, which confirms the chosen side, cancels the other, and settles the round in one transaction.

---

## 16b. Session Config (REQ-SESS-CONFIG-***)

- **REQ-SESS-CONFIG-001** Session config is a JSONB merge of Mode defaults + per-session overrides. New fields added in Phase 11 (`lockMode`, `lockTimerSeconds`, `entityOverrides`) are optional and read with safe fallbacks (`lockMode ?? 'TIMER_LOCK'`, `lockTimerSeconds ?? 600`, `entityOverrides ?? {}`). Legacy `autoLockOnDrink` is honoured for existing sessions: `false → 'NONE'`, otherwise `'TIMER_LOCK'`.
- **REQ-SESS-CONFIG-002** Entity-name overrides resolve at the `load()` boundary: every server route that returns entity rows applies `cfg.entityOverrides?.[e.name] || e.name` before sending to the client, so the UI never has to know about overrides.
- **REQ-SESS-CONFIG-003** `updateSessionConfig(sessionId, patch)` shallow-merges the patch into the existing `session.config` JSONB and persists it. Route-level guard requires `me.role === 'HOST'`.
- **REQ-UI-022** Phase 10 ships the visual editor v2 (`src/lib/graph/GraphCanvas.svelte` rewrite): nodes are arranged in **centered rows by depth** (longest-incoming-path) — each row's width fits content and `justify-content: center` keeps the layout symmetric. Node cards are narrow (`min-width: 130px; max-width: 170px`). **Input pins** render on the TOP edge with a `◀` caret and rounded-bottom shape; **output pins** render on the BOTTOM edge with a `▶` caret and rounded-top shape — making direction unambiguous. The general `+` FAB is removed; new nodes are added **by tapping an unconnected pin**, which opens a bottom sheet listing only nodes whose opposite-side pin type matches (`suggestionsForInput` / `suggestionsForOutput` filter `NODE_CATALOG`). Selecting a suggestion creates both the node and the connecting edge in one step. Only the initial empty state and an explicit `+ Quelle` toolbar button can spawn standalone source nodes.
- **REQ-UI-023** The Host can re-snapshot the active session's Bet-Graphs into the currently open SETUP/BETTING_OPEN round via the new `?/syncBetGraphs` action (`src/routes/s/[id]/round/+page.server.ts`). The round empty-state in `+page.svelte` surfaces a "Bet-Graphs neu laden + spawnen" button when `session.hasBetGraphsSnapshot` is true, and a "Bet-Graphs anlegen → Snapshot aktualisieren" path when the mode has no graphs yet. This is the recovery flow for sessions that pre-date Phase 9 (`market_templates` removal).

---

## 16. Game Master Tools (REQ-GM-***)

- **REQ-GM-001** GM can edit per-Session config (drink prices, confirmation mode, rebuy config, etc.) at any time. Changes take effect for new actions; existing Drinks keep their `priceSnapshot`.
- **REQ-GM-002** GM defines BetMarkets per Round at SETUP/LIVE (within status constraints), including single and bulk entity markets.
- **REQ-GM-003** GM moderates proposed RoundEvents (confirm/cancel) and can undo mistaken events.
- **REQ-GM-004** GM can confirm or cancel any pending Drink. GM can manually adjust any player's balance (audit logged).

---

## 17. Stats (REQ-STAT-***)

- **REQ-STAT-001** Per-Session leaderboard: balance, bets won/lost, ROI%, drinks (self/forced/forced-on-others), money won/lost.
- **REQ-STAT-002** Per-player round history with stake / payout / drink list per round.
- **REQ-STAT-003** All-time per-user stats live in `users.total_stats` JSONB. Updated transactionally with each bet resolve / drink confirm.
- **REQ-STAT-004** **Phase 12 per-drink-type breakdown.** `getSessionLeaderboard` and `getMySessionStats` additionally return `drinksByType: { SCHLUCK, KURZER, BIER_EXEN }` (CONFIRMED only, target = user). The "Eigene Drinks" stat tile on `/s/[id]/stats` shows the three counts in a 3-column grid labelled "Schlücke / Shots / Exen".

---

## 18. Data (REQ-DATA-***)

- **REQ-DATA-001** PostgreSQL 16. Schema in Drizzle (typescript-first). All schema changes via Drizzle migrations.
- **REQ-DATA-002** All money in **integer** units, no floats anywhere in the money or drink-price math.
- **REQ-DATA-003** All timestamps `timestamptz`, written as UTC.
- **REQ-DATA-004** JSONB used for: `mode.terminology`, `mode.default_entities`, `mode.trackables`, `mode.default_config`, `session.config`, `session.trackables`, `entity.attributes`, `bet_outcome.predicate`, `user.total_stats`.
- **REQ-DATA-005** Foreign keys with `onDelete: cascade` between `session → entities/rounds/round_events/bet_markets/bet_outcomes/bets/drinks` so Session deletion is surgical.

---

## 19. Infra (REQ-INFRA-***)

- **REQ-INFRA-001** Local dev: `docker-compose up` brings up `dwight-db` (postgres:16-alpine, port 5433) + `dwight-redis` (redis:7-alpine, port 6380, optional V2).
- **REQ-INFRA-002** Migrations: `pnpm db:generate` (Drizzle Kit) + apply via the documented `psql -f` workflow when running headless. Interactive `pnpm db:push` for normal local work.
- **REQ-INFRA-003** Production deploy is out of scope for the requirements doc. Sprint plan covers it.

---

## 20. Testing (REQ-TEST-***)

- **REQ-TEST-001** Vitest unit tests for: predicate eval (AND/OR/NOT, global/entity counters), market settle math (single winner, multi-winner split, void), drink lifecycle (SELF + FORCE × confirmation modes), rebuy crediting on confirmation.
- **REQ-TEST-002** Playwright E2E for: register/login, create Mode with trackables, create Session, create market (single + bulk), propose/confirm events, place bets, settle round, drink cash-out, force-drink confirmed by peers, rebuy via drink.
- **REQ-TEST-003** Fixtures use explicit custom Modes and Trackables; no mandatory marble fixture.

---

## 21. Out of Scope (V1)

- Multi-tenancy / org accounts
- Pluggable BetTemplate marketplace (V1 has only the registry; sharing UI deferred)
- Mobile native app (PWA only)
- I18n beyond German
- Loans / credit between players
- Drinks scheduled to expire automatically
- External event ingestion / automation (API/webhook/vision) for auto-counting events
