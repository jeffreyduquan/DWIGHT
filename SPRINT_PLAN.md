# DWIGHT — Sprint Plan

> Strategy: ship a thin vertical slice each sprint. Every sprint ends with `pnpm check` green, all tests green, and a runnable demo. The built-in Mode `murmelrennen-standard` serves as the battle-test content from D2 onwards.

---

## Status legend
- ☐ not started
- ◐ in progress
- ☑ done

---

## D0 — Workspace Scaffold ☑
**Goal:** empty SvelteKit project that compiles and renders the DWIGHT brand shell.

- Init SvelteKit 2 + Svelte 5 (`pnpm create svelte`) — minimal template, no demo content
- Tailwind 4 + DaisyUI 5 + `@tailwindcss/forms` + `@tailwindcss/vite`
- Drizzle ORM 0.45+ + drizzle-kit + `postgres` driver
- `jose` (JWT), `@node-rs/argon2` (password hashing)
- Vitest 4, Playwright
- ESLint + Prettier (with svelte + tailwind plugins)
- TypeScript strict, `$lib/` alias
- `docker-compose.yml`: `dwight-db` (postgres:16-alpine, port 5433) + `dwight-redis` (redis:7-alpine, port 6380)
- `.env.example` with `DATABASE_URL=postgres://dwight:dwight@localhost:5433/dwight`, `AUTH_SECRET`, `PUBLIC_APP_NAME=DWIGHT`, `PUBLIC_APP_URL=http://localhost:5174`
- `src/app.html` — DWIGHT title, `data-theme="dwight"`, theme-color `#050511`, viewport-fit cover, font links (Space Grotesk + Inter + Geist Mono)
- `src/routes/layout.css` — Quantum Plasma theme (DaisyUI custom theme `dwight`, OKLCH values), font tokens, `.glass`, `.aurora`, `.noise`, `.glow-primary`, `.glow-accent`, `.text-gradient-primary`, `.text-gradient-danger`, `.wordmark`, `.tabular`, `.fade-up`, `.dock-float`
- `src/lib/components/Logo.svelte` — hex+core+spark mark + DWIGHT wordmark
- `static/favicon.svg`, `static/manifest.webmanifest`
- Empty landing page renders the brand mark + "DWIGHT" wordmark
- **Done when:** `pnpm dev` boots cleanly on http://localhost:5174/, `pnpm check` 0 errors, `docker compose up -d` brings up healthy db + redis

---

## D1 — Auth ☑
**Goal:** users can register, log in, and stay logged in.

- Schema: `users` table only (id, username, password_hash, created_at, total_stats jsonb default zeroed)
- `pnpm db:push` works against `dwight-db`
- `src/lib/server/db/index.ts` — postgres-js client + drizzle wrapper
- `src/lib/server/auth/password.ts` — argon2id hash + verify
- `src/lib/server/auth/jwt.ts` — sign + verify with `jose`, issuer=`dwight`, audience=`dwight-web`, 30d
- `src/lib/server/auth/cookie.ts` — `dwight_session` HttpOnly Secure SameSite=Lax helpers
- `src/lib/server/auth/rateLimit.ts` — sliding-window in-memory limiter for login
- `src/lib/server/auth/validation.ts` — username/password format checks (zod or hand-rolled)
- `src/lib/server/repos/users.ts` — `findUserByUsername`, `findUserById`, `createUser`
- `src/hooks.server.ts` — read cookie → attach `event.locals.user`; refresh cookie sliding
- Routes: `/(auth)/login`, `/(auth)/register`, `/logout` (POST)
- `+layout.server.ts` exposes `data.user`
- Landing page shows lobby placeholder when logged-in, hero+CTA when guest
- **Done when:** register → login → logout flow works, password is argon2id-hashed in DB, JWT cookie set/cleared correctly, rate-limit triggers on 11th failed attempt within 5 minutes, Vitest covers password + JWT helpers

---

## D2 — Schema + Seed + Mode Picker ☑
**Goal:** the full DWIGHT data model is in place; user-authored Modes can be created; a host can create a Session bound to one.

Note: the original D2 plan called for a built-in `murmelrennen-standard` Mode with `allowedBetTemplates` + `houseEdgePct` + `baseMultipliersX100`. D3 removed bet templates and house edge entirely (REQ-MODE-004); Modes are now user-authored only and Trackables replace bet templates. The bullets below are kept for historic context.

- Full schema (modes, sessions, session_players, entities, rounds, round_outcomes, bet_offers, bets, drinks, drink_confirmations + all enums)
- Drizzle migration generated and applied
- `src/lib/server/db/seed.ts` — idempotent seed run via `pnpm exec tsx src/lib/server/db/seed.ts`:
  - Built-in Mode `murmelrennen-standard` (owner=null, full default config with drink prices SCHLUCK=50/KURZER=150/BIER_EXEN=500, baseMultipliersX100, houseEdgePct=0.05, etc.)
  - 4 marble entities pre-defined in `mode.defaultEntities`
  - Two demo users: `alice/alice123`, `bob/bob123`
- Repos: `modes.ts` (listAvailable, findBySlug), `sessions.ts` (createSession, listForUser, findById), `entities.ts` (createBatch, listForSession)
- Route `/s/create`:
  - Mode picker (V1: only one Mode → auto-selected)
  - Session name + invite code (auto-generated short code)
  - Defaults inherited from Mode; host can override drink prices + confirmation mode + brokeLockEnabled
  - On submit: create Session + insert entities from Mode defaults + auto-add host as PLAYER+HOST
- Route `/s/join` — accept invite code, add user to session_players
- Route `/s/:id` — lobby placeholder (player list, balances, "session not started" state)
- **Done when:** host can create a Session, invite code lets a 2nd user join, both see each other in the lobby with starting money

---

## D3 — Predicate Engine: Trackables + RoundEvents + Markets ☑
**Goal:** GM opens a Round, players propose count-events (trackables), GM confirms, GM creates predicate-based markets, players bet on outcomes, GM settles → parimutuel payout from the pool, no house edge.

**Replaces** the original D3 plan (bet templates + live odds + house edge) with the generic Predicate Engine (REQ-TRACK / REQ-EVENT / REQ-MARKET / REQ-BET).

Done:
- ☑ Schema D3 + migration `0003_d3_predicate_engine.sql` applied
- ☑ `src/lib/server/bets/predicate.ts` — Predicate-AST evaluator (count/and/or/not), `CounterSnapshot`, `negate`, `validatePredicate` — 14 tests
- ☑ `src/lib/server/bets/payout.ts` — parimutuel pool distribution, multi-winner equal split, void refund, residual rules — 9 tests
- ☑ Mode editor with Trackables section (label/scope/color/emoji)
- ☑ Session snapshots Trackables at creation
- ☑ Repos: `rounds.ts` (lifecycle), `events.ts` (propose/confirm/cancel + `getCounterSnapshot`), `markets.ts` (createMarket / createBinaryMarket / lockMarket / `settleRoundMarkets`), `bets.ts` (atomic `placeBet`)
- ☑ Lifecycle orchestrator `src/lib/server/round/lifecycle.ts` — `settleRound` and `cancelRoundWithRefund` (Cancel → auto VOID + refund)
- ☑ Route `/s/:id/round` — unified role-aware page with form actions: createRound, openBetting, goLive (locks markets), settle, cancel, proposeEvent, confirmEvent, cancelEvent, createMarket (binary YES/NO auto-negate), placeBet
- ☑ UI: HOST controls + event-buttons per Trackable × per Entity + pending-queue + market creation form + market list with pool/share, counter recap
- ☑ Lobby → Runde link
- ☑ `vitest`: 30/30, `pnpm check`: 0 errors

Deferred to later sprints (out of D3 done bar):
- ☐ SSE live updates (delivered in D4 alongside drinks SSE)
- ☐ DnD predicate builder UI (D5+ polish)
- ☐ Bulk-per-entity market UI (engine supports multi-outcome `createMarket(outcomes[])` already)
- ☐ Composite predicate UI (AND/OR/NOT — engine supports them via API)
- ☐ Browser smoke E2E (Playwright) — manual smoke after D3, automated in D5+

---

## D4 — Drinks + SSE ☑
**Goal:** the dual economy is real — players can self-cash-out by drinking, force-drink each other, and confirmation rules work. Plus in-process SSE live updates.

Done:
- ☑ `src/lib/server/repos/drinks.ts` — `initiateSelfDrink`, `initiateForceDrink`, `confirmDrink` (GM/PEERS/EITHER), `cancelDrink` (refunds FORCE)
- ☑ `src/lib/server/sse/broadcaster.ts` — in-process channel map + `emit(sessionId, type, payload)`
- ☑ `/s/[id]/stream/+server.ts` — SSE endpoint with heartbeat
- ☑ `/s/[id]/drinks/+page.{server,svelte}` — 4 tabs: Offen / Cashout / Force / Verlauf, role-aware confirm (GM vs PEER)
- ☑ Rebuy flow: SELF drink with `rebuyAmount` credits target on CONFIRMED
- ☑ SSE wired into round actions + drink actions (drink_initiated, drink_confirmed, drink_cancelled, balance_updated, round_*, market_*, bet_placed)
- ☑ Round + Drinks pages auto-invalidate on SSE events
- ☑ Vitest `drinks.confirmation.test.ts` covers GM / PEERS / EITHER thresholds (33/33 green)
- ☑ Lobby → Drinks link enabled

Deferred:
- ☐ Playwright E2E (D5+)
- ☐ Broke-lock auto-clear on SELF-drink confirm (current impl credits balance which lifts the broke condition implicitly; explicit `bet_locked` flag manipulation deferred until we adopt the explicit lock from REQ-ECON-002)
- ☐ GM balance-adjust UI (REQ-GM-004 part 2)

---

## D5 — Stats + Polish ◐
**Goal:** the night-after experience.

Done:
- ☑ `src/lib/server/repos/stats.ts` — `getSessionLeaderboard`, `getMySessionStats`, `getRoundHistory`
- ☑ `/s/[id]/stats` route — podium top-3 + remaining leaderboard + my-stats grid (P/L, ROI, Trefferquote, Drinks self/force) + round history
- ☑ Lobby → Stats link

Deferred:
- ☐ Round-transition animations (win/loss flash, drink-confirm pulse) — D6 polish pass
- ☐ Settled-round live recap modal — D6
- ☐ Empty-state polish across all routes — D6

---

## D6 — PWA + Sound ☑
**Goal:** install-to-home-screen and audio cues.

Done:
- ☑ Self-hosted fonts via `@fontsource/{space-grotesk,inter,geist-mono}` — Google Fonts links removed from `app.html`
- ☑ `src/service-worker.ts` — precache app shell + built assets at install, cache-first for assets, network-first navigation with offline fallback to `/`, never intercept `/stream` SSE
- ☑ Manifest enhanced: `scope`, `categories`, `lang: de`
- ☑ `src/lib/client/sounds.svelte.ts` — WebAudio synth (bet/live/win/lose/drink), localStorage toggle
- ☑ Sound cues wired in round (`round_live`/`bet_placed`/`round_settled`) + drinks (`drink_confirmed`)
- ☑ Sound toggle button in lobby

Deferred:
- ☐ Lighthouse PWA audit (manual when on https)
- ☐ Round-transition visual animations (win/loss flash) — minor polish

---

## D7 — Deploy ☑
**Goal:** DWIGHT runs on the netcup server (or equivalent).

Done:
- ☑ `@sveltejs/adapter-node` (was already configured)
- ☑ `Dockerfile` multi-stage (deps → build → runtime) on `node:22-alpine` w/ pnpm, healthcheck via `/healthz`
- ☑ `docker-compose.prod.yml` with app + postgres-16-alpine + Caddy reverse proxy + Let's Encrypt
- ☑ `Caddyfile` with SSE-aware `flush_interval -1` for `/s/:id/stream`
- ☑ `.env.prod.example` template
- ☑ `/healthz` endpoint (DB readiness probe)
- ☑ `.github/workflows/deploy.yml` — build/test → push GHCR → SSH deploy → curl smoke
- ☑ `DEPLOY.md` instructions

Notes:
- Final hostname/server still to provision (`PUBLIC_HOST` placeholder in `.env.prod.example`)
- DB migration strategy on first deploy: run `pnpm db:push` from local with `DATABASE_URL` tunneled via SSH

---

## D8 — Market Templates in Mode (Architektur-Korrektur) ☑
**Goal:** Wetten werden im **Mode** definiert, nicht ad-hoc pro Runde.

Done:
- ☑ Phase A: Predicate-Engine erweitert um `compare_counters` (counter A cmp counter B) + neue `cmp` Werte `gt`/`lt`; 22 vitest-Tests (`predicate.test.ts`)
- ☑ Phase B: Schema — `modes.market_templates` + `sessions.market_templates` (Snapshot wie `trackables`); Migration `0004_market_templates.sql`; `MarketTemplate` type (varianten `binary_count` + `compare_entities`)
- ☑ Phase B: `parseModeForm` + `ModeForm.svelte` Section „Wetten-Templates" (Binär & Vergleich, Trackable-Picker, scope/cmp/n + Gleichstand-Verhalten)
- ☑ Phase C: `markets.ts:instantiateMarketTemplates({roundId, sessionId, createdByUserId})` aufgerufen aus `?/createRound`; idempotent; `{entity}`/`{n}` Title-Placeholder; Compare-Markets bauen N (+ optional Tie) Outcomes mit strikten max-Predicates
- ☑ Phase D: Manuelle Markt-Form hinter `<details>` „Manueller Markt (Override)" versteckt; `describePredicate` erweitert (compare_counters + gt/lt); my-stake Outcomes farbig hervorgehoben
- ☑ Mode-Edit Save-Action: `default` → `save` umbenannt (SvelteKit verbietet `default`+benannte koexistent)
- ☑ `/modes/new?next=…` Flow: nach Mode-Erstellung Redirect zum referrer (z.B. `/s/create`)

Notes:
- 41 vitest-Tests grün, 0 type errors
- Komplexere Template-Predicates (AND/OR/NOT-Compounds) bleiben Override-only (manueller Markt)
- Mode-Editor zeigt Trackables-Slug per `trackableIdFor(label)` clientseitig — muss mit `slugifyTrackableId` server-seitig synchron bleiben

---

## D9 — UX Simplification & Mobile Polish ☑
**Goal:** Player-first vereinfachte Oberfläche, klares IA, modulares Wetten-Builder (REQ-UI-005, REQ-UI-006).

Done — Phase 1 (Player-Chrome):
- ☑ Shared chrome: `SessionTopBar` + `BottomDock` extrahiert → `src/lib/components/`; eingehängt via `s/[id]/+layout.svelte` + `s/[id]/+layout.server.ts` (lädt session, me, mode, pending-drinks für Dock-Badge)
- ☑ Lobby `s/[id]/+page.svelte`: eigener Header / Balance-Hero / Bottom-Nav entfernt — nur noch Domain-Content (Drinks-Embed, Spieler, Entities, GM-Danger-Zone, Sound)
- ☑ Drinks-Page entschlackt (eigener Header & Coins-Hero raus, kompakter glass-Wrapper um `DrinkPanel`)
- ☑ Stats-Page entschlackt (eigener Header → schmale `eyebrow`-Zeile)
- ☑ Round-Page komplett neu (`s/[id]/round/+page.svelte`, ~500 Zeilen): Status-Pille + Märkte (Primary) + per-Trackable Event-Akkordeons + ein einzelner „GM-Werkzeuge"-Disclosure (Lifecycle + Pending-Queue + Counter-Recap). Alle bestehenden `?/` Action-Contracts unverändert.

Done — Phase 2 (Mode-Builder + Mobile-Grids):
- ☑ ModeForm Wetten-Bausteine: 9-Button-Reihe + langer Erklär-`<ul>` ersetzt durch Lego-Gallery (2-spaltige Karten mit Icon + Label + Beispiel). Single `addTemplate(kind)` Funktion, picker-Toggle. Per-Template Form unverändert.
- ☑ ModeForm Struktur neu: numerierte Sektionen 1 „Name deinen Mode" / 2 „Wer / Was tritt an?" (Entitäten) / 3 „Was zählen wir mit?" (Trackables) / 4 „Welche Wetten gibt's?" (Lego). Terminology hinter optionalem `<details>`. Geld/Drinks/Bestätigung/Rebuy in einem einzigen „5 — Erweitert" disclosure gesammelt.
- ☑ Sticky Save-Bar (fixed bottom max-w-md) ersetzt den großen 2-Spalt-Save-Block.
- ☑ Alle fixed-width grids (`grid-cols-[1fr_5rem_3rem_2.5rem]` Entitäten, `grid-cols-[1fr_7rem_5rem_2.5rem]` Trackables, `grid-cols-3` Terminologie/Drink-Preise, `grid-cols-2` Ökonomie/Bestätigung/Rebuy) → flex-wrap mobile / grid `sm:` breakpoint
- ☑ DrinkPanel Tabs: `btn-sm` → `btn-xs sm:btn-sm` mit `px-1 sm:px-3` für 360px-Geräte
- ☑ Layout-CSS: Aurora-Opacity 0.45 → 0.22, Noise-Opacity 0.05 → 0.03, Blur 90 → 110 px (Linear/Vercel-Feel)

Done — Phase 3 (Radikal-Simplifizierung Player-Inputs, REQ-UI-007/008/009):
- ☑ ModeForm Entity-Row radikal entschlackt: nur Name-Input + Auto-Avatar-Chip (deterministisches Palette via Name-Hash, Initial als Buchstabe oder gespeichertes Emoji). `entityKind` fix `"entity"`, `entityColor` aus Palette, `entityEmoji` aus optionalem alten Wert — alle via hidden inputs.
- ☑ ModeForm Trackable-Row radikal entschlackt: Name-Input + Avatar-Chip + 2-Button-Chip-Toggle (`pro` / `global`). Color/Emoji-Picker komplett raus, Auto-Color via gleichem Hash.
- ☑ Schema/parseForm/defaults: `ModeDefaultConfig.showOdds?: boolean` (default `true`); `freshModeDefaultConfig` setzt `showOdds: true` + `autoLockOnDrink: true`.
- ☑ ModeForm „Erweitert" enthält jetzt einen Toggle „Quoten anzeigen".
- ☑ Round-Page Bet-UI radikal vereinfacht: `StakePicker` entfernt, ersetzt durch **One-Tap Quick-Stake-Chips** (`Min`/`~25%`/`~50%`/`All-in`, dedupliziert & geclamped). Jeder Chip ist ein Submit-Button mit `name="stake" value={amount}` — kein Stake-Input, kein Expand/Collapse mehr.
- ☑ Quoten (Multiplikator + Prozent) werden conditional gerendert basierend auf `data.session.config.showOdds`.

Done — Phase 4 (Sage-Cream Theme-Reset, REQ-BRAND-003/004/005/006):
- ☑ `src/routes/layout.css` komplett neu (~270 Z., war ~496): DaisyUI Theme `dwight` jetzt **light** (`prefersdark: false`), cream Basis `oklch(97% 0.014 92)`, sage `oklch(60% 0.055 148)` als einziger Akzent, muted-coral für `accent` (Drinks/Danger). Keine Aurora, kein Noise, kein Glassmorphism, kein Gradient-Text, kein Glow. `.glass`/`.glass-xl`/`.glass-2xl` jetzt clean weiße Cards mit 1px warmem Border. `.glow-primary`/`.glow-accent` neutralisiert (nur Helligkeits-Hover). `.text-gradient-*` jetzt solide Farbe. Inputs mit sage Focus-Ring.
- ☑ Inter ersetzt Space Grotesk als Display-Font (Fontsource Imports bleiben, nur CSS-Var auf Inter).
- ☑ `Logo.svelte` komplett neu: 28×28 sage rounded-square mit cream Dot statt Hex-Frame mit Photon-Glow.
- ☑ `static/favicon.svg` + `src/lib/assets/favicon.svg` auf neue Mark aktualisiert.
- ☑ `app.html` `theme-color` `#050511` → `#FAF7F0` (Cream).
- ☑ Hardcoded `border-white/*` / `bg-white/*` in 4 Stellen (ModeForm, modes/[id], s/create) durch `border-base-300` / `bg-base-100` ersetzt (Light-Theme legibility).
- ☑ REQUIREMENTS REQ-BRAND-003/004/005/006 entsprechend aktualisiert.

Done — Phase 4b ("Soft Linen" Neumorphic Light, REQ-BRAND-003/005 Überarbeitung):
- ☑ `layout.css` komplett neu: monochromer Paper-Look mit dezenter SVG-Grain-Textur, pill-shaped Controls, raised/inset Neumorphic-Shadows (top-left weißes Highlight + bottom-right warmer Drop), `--radius-field: 9999px`. Sage nur noch für Focus-Ring + Active-Dot.
- ☑ Alle `.btn`/`.btn-primary`/`.btn-accent`/`.btn-ghost`/`.btn-sm`/`.btn-circle` neumorphisch redefiniert. Pressed-State = inset Shadow.
- ☑ Alle `.input`/`.select`/`.textarea` pressed-in (Shadow-Inset). Pill-shaped.
- ☑ `input[type=range]`, `.checkbox`, `.radio`, `.toggle`: raised Thumb über pressed Track — matched exakt mit Referenzbild (`clean-gui-elements-preview.jpg`).
- ☑ `Logo.svelte` und Favicons als raised Pill mit recessed sage Dot.
- ☑ `app.html` `theme-color` `#FAF7F0` → `#F2EFE9`.
- ☑ REQ-BRAND-003/004/005/006 auf "Soft Linen" aktualisiert.

Done — Phase 5 (User-Directed Structural Simplification, REQ-UI-010/011/012/013):
- ☑ **Drinks-only-in-Lobby (REQ-UI-010):** `BottomDock` "Drinks"-Tab entfernt. `/s/:id/drinks` route auf permanenten 303-Redirect zur Lobby reduziert (`+page.svelte` gelöscht, `+page.server.ts` slim load). Lobby (`/s/:id/+page.svelte`) komplett überarbeitet — `DrinkPanel` direkt eingebettet (kein `compact`), nur noch Invite-Code-Chip + DrinkPanel + Player-Liste + optional Host-Session-Manage.
- ☑ **Wording (REQ-UI-010):** `DrinkPanel` Tab-Labels `Cashout` → **Buy-In**, `Force` → **Verteilen**. Action-Button "Zwingen" → "Verteilen". Section-Headers entsprechend.
- ☑ **Wettinfos-Tab (REQ-UI-011):** Neue Route `/s/:id/info` mit `+page.server.ts` (lädt mode + trackables + entities) und `+page.svelte` (2 Sections: Entities mit Color/Emoji/Initial-Avatar, Trackables mit Scope/Emoji/Description). `BottomDock` Tabs jetzt: Lobby · Wetten · Wettinfos · Stats (`BookOpen`-Icon).
- ☑ **Wetten-Redesign (REQ-UI-012):** `/s/:id/round/+page.svelte` komplett neu geschrieben (~600 LOC, `create_file` nach `Remove-Item` wegen partial-replace Korruption). "Runde" → **Wetten**. Kein Round-Number, kein Status-Eyebrow, kein `describePredicate`-Subtext. **Accumulator-Stake:** Pro Market `stakeTotals` $state als laufende Summe — jeder Chip-Tap (`+2%` / `+5%` / `+25%` von `startingMoney`) addiert auf den Total; `RotateCcw` Reset setzt auf 0. Pro Outcome eigener `Setzen · {n}` Submit-Button mit `use:enhance` Callback der nach erfolgreichem placeBet den Counter zurücksetzt. Chips disablen sobald nächster Tap das Balance überschreiten würde. Host-Controls auf einen Primary-Button kollabiert (**Starten** für SETUP/BETTING_OPEN, **Abrechnen** für LIVE) + sekundäres `GM`-Disclosure für Cancel + Buffer-Review. Neumorphische `.market-card` / `.outcome-row` / `.stake-running` Styles inline.
- ☑ **SessionTopBar minimal (REQ-UI-013):** `sessionName` + `subtitle` Props entfernt. Nur noch Back-Link, Host/Gesperrt-Pills, prominente `tabular text-2xl` Balance-Chip mit raised Neumorphic-Shadow (`.balance-chip`, `.balance-locked` coral-Variante).
- ☑ **Layout-Wire-up:** `s/[id]/+layout.svelte` reicht nur noch `balance/betLocked/isHost/backHref/backLabel` durch. `+layout.server.ts` Loader unverändert (`pendingDrinks` etc. nun unused-but-harmless).
- ☑ `svelte-check` 0 Errors / 13 Warnings (unchanged baseline).
- ☑ REQ-UI-005 aktualisiert (neue Tab-Liste, drink-pending Badge wandert in Lobby).

Done — Phase 5b (Lifecycle-Fixes, REQ-UI-014/015):
- ☑ **Ended-Session-Recap (REQ-UI-014):** `s/[id]/+layout.server.ts` erkennt `status === 'ENDED'` und redirected jede Non-Stats-Route auf `/s/:id/stats`. `+layout.svelte` rendert kein BottomDock mehr wenn `isEnded`. `SessionTopBar` zeigt `Beendet`-Pill statt Host/Gesperrt. `endSession` Action redirected nach `/` (vorher `return ok` → User blieb auf "Session bereits beendet"-Screen). Landing-Page (`/+page.svelte`) listet Sessions getrennt: Aktiv (Link auf `/s/:id`) und Beendet (Link auf `/s/:id/stats` mit dezenter Opacity).
- ☑ **Save-and-Close (REQ-UI-015):** `modes/new/+page.server.ts` redirected nach `'/modes'` (vorher `/modes/{id}`), damit User nach Create direkt zur Templates-Liste zurückkehrt. `modes/[id]` save war bereits korrekt.

Notes:
- `StakePicker.svelte` weiterhin unused; kann später entfernt werden.
- Drinks-Server-Action `?/initiate` ist weiterhin im `s/[id]/+layout.server.ts` registriert und wird aus der Lobby genutzt — Pfad `/s/:id?/initiate` funktioniert wie zuvor.

Notes:
- Schema unverändert (Lego-Refactor + Section-Restructure verändern nur UI; alle 9 `kind` Werte, parseForm-Verträge und `?/` Action-Contracts bleiben)
- BottomDock-Badge nutzt Layout-Loader für Pending-Drink-Zähler (live via SSE)
- `StakePicker.svelte` bleibt im Repo (unused) — kann später entfernt werden, falls niemand reaktivieren will
- Carry-over: `+page.svelte.new` Workaround beibehalten falls erneut nötig (PowerShell `Move-Item -Force`)

---

## Carry-over from MarbleTrace prototype (reference inspiration only)

The `c:\Users\jawra\Documents\Projects\MarbleTrace` workspace contains a working prototype of the marble-racing-only predecessor. Files there will be **read for inspiration** but never copy-pasted unless they have **zero domain coupling**. Eligible carry-over candidates (each must be re-reviewed before reuse):

- `src/lib/server/auth/{jwt,cookie,password,rateLimit,validation}.ts` — auth primitives, no marble-leakage
- Visual design tokens in `layout.css` — Quantum Plasma palette already DWIGHT-native
- `Logo.svelte` — DWIGHT mark already designed
- Tailwind/Vite/SvelteKit/Drizzle config skeletons
- `app.html` shell (DWIGHT title + theme + fonts)
- `manifest.webmanifest`, `favicon.svg`

Files **not** to carry over (re-write fresh against DWIGHT model):
- All repos (the old ones reflect the marble schema)
- All economy code (old model has no live odds, no drinks, no broke-lock)
- All routes under `/s/[id]/race/*`
- All tests (old assertions are tied to dead types)
- `marblePalette.ts`, `Marble.svelte`
- All docs (this set replaces them)

---

## Cumulative timeline (rough)
- D0–D1: foundation
- D2–D3: data + bets
- D4: drinks (the differentiator)
- D5–D6: polish + PWA
- D7: deploy
