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

Done — Phase 5c (Drink-Confirmation Rework + Host-Action Cleanup, REQ-UI-016/017/018):
- ☑ **Drink Confirmation Progress (REQ-UI-016):** `DrinkPanel.confirmProgress()` Helper berechnet `gmCount`/`peerCount`/`peerReq`/`finished`/`hostNeeded` aus `confirmations[]` + `session.config.confirmationMode/peerConfirmationsRequired`. Pro Drink jetzt zwei explizite Chips: `Host 0/1` und (bei PEERS/EITHER) `Spieler n/N` — werden sage-grün wenn erfüllt. Zusätzlich `Host muss bestätigen` Pill wenn ein Host-Sign noch fehlt. Ersetzt das frühere kryptische "N Bestätigung(en) — warte auf MODE". Buttons: "Bestätigen (Host)" / "Abbrechen". Styles inline: `.confirm-chip`, `.confirm-chip-done`, `.confirm-host-required`.
- ☑ **Beendet-Sektion collapsed (REQ-UI-017):** Landing-Page nutzt jetzt `<details>` für die "Beendet"-Liste — collapsed by default, Header zeigt Anzahl.
- ☑ **End-&-Delete-Button (REQ-UI-018):** Die zwei separaten Buttons "Session beenden" + "Session löschen" zu einem einzigen `btn-error` Button "Session beenden & löschen" zusammengeführt, mit `confirm()` Dialog. Nutzt die bestehende `?/deleteSession` Action → hard-delete + redirect '/'. `StopCircle` Import entfernt.

Notes:
- `StakePicker.svelte` weiterhin unused; kann später entfernt werden.
- Drinks-Server-Action `?/initiate` ist weiterhin im `s/[id]/+layout.server.ts` registriert und wird aus der Lobby genutzt — Pfad `/s/:id?/initiate` funktioniert wie zuvor.

Notes:
- Schema unverändert (Lego-Refactor + Section-Restructure verändern nur UI; alle 9 `kind` Werte, parseForm-Verträge und `?/` Action-Contracts bleiben)
- BottomDock-Badge nutzt Layout-Loader für Pending-Drink-Zähler (live via SSE)
- `StakePicker.svelte` bleibt im Repo (unused) — kann später entfernt werden, falls niemand reaktivieren will
- Carry-over: `+page.svelte.new` Workaround beibehalten falls erneut nötig (PowerShell `Move-Item -Force`)

---

## Phase 6 — Bet-Graph Foundation (Side-by-Side) ◐
**Goal:** Visueller, modularer Wett-Builder als Alternative zu `market_templates` -- additiv und legacy-kompatibel.

Done:
- ☑ Migration `0005_bet_graphs.sql`: `bet_graphs` Tabelle (mode-FK, `graph_json jsonb`) + `sessions.bet_graphs_snapshot jsonb`.
- ☑ Drizzle Schema: `GraphNodeKind` (22 Kinds), `GraphNode`/`GraphEdge`/`BetGraph`/`SessionBetGraph` Types; `betGraphs` Tabelle; `sessions.betGraphsSnapshot`.
- ☑ `src/lib/graph/catalog.ts` -- 22-Node-Spec + 6 Pin-Typen (Entity/EntityList/Trackable/Number/Boolean/Timestamp) + 4 Families (source/compute/logic/outcome).
- ☑ `src/lib/graph/validate.ts` -- TYPE_MISMATCH, MISSING_INPUT, MULTI_EDGE, NO/MULTI_OUTCOME, CYCLE-Detection.
- ☑ `src/lib/graph/preview.ts` -- generiert deutschen Satz aus Graph (Live-Preview).
- ☑ `src/lib/graph/compile.ts` -- Compiler zu `Predicate`-AST: deckt Wett-Familien A (race N=1 via `log_rank`), B (arg_max), C (sum+compare), D (count+compare). Unsupported Shapes: `{ok:false}` und werden geskippt.
- ☑ `src/lib/graph/graph.test.ts` -- 11 Tests (Validator + Compiler + Preview).
- ☑ `repos/betGraphs.ts` -- CRUD + `snapshotForMode`.
- ☑ `repos/sessions.ts` -- akzeptiert `betGraphsSnapshot` bei create.
- ☑ `/s/create` -- ruft `snapshotForMode` und persistiert Snapshot in Session.
- ☑ `repos/markets.ts:instantiateBetGraphs` -- am Round-Betting-Open neben `instantiateMarketTemplates` (side-by-side, nicht ersetzend).
- ☑ `/s/[id]/round/+page.server.ts` -- wired mit SSE-Emit.
- ☑ `/modes/[id]/graphs` MVP UI -- JSON-Editor mit live Preview-Satz + Validierungs-Badge + Help-Details. Discovery-Link auf `/modes/[id]`.
- ☑ `pnpm check` 0 errors / 13 warnings, vitest 60/60 grün.

Deferred → Phase 7:
- ☐ Visueller Blueprints-Style Editor (Tap-to-Connect, Mobile-First, vertikales Auto-Layout).
- ☐ Compiler-Erweiterung: Familien E (delta), F (time-compare), G (if-then), H (sequence), I (time-threshold), J (ranking) + Predicate-Engine-Primitive falls fehlend.
- ☐ Cutover-Entscheidung: `market_templates` löschen oder dauerhaft co-existieren.

---

## Phase 7 — Visueller Bet-Graph-Editor ◐
**Goal:** JSON-Textarea durch Tap-to-Connect Node-Canvas ersetzen. Mobile-first, vertikales Auto-Layout, kein freies Canvas-Pan.

Done:
- ☑ `src/lib/graph/GraphCanvas.svelte` (~530 Zeilen, $state/$derived/$effect): vertikales Auto-Layout (topologische Sortierung), Family-getönte Node-Karten, Pin-Buttons (links Inputs, rechts Outputs), SVG-Edge-Overlay mit kubischen Kurven, Tap-to-Connect mit Pin-Type-Check + Compat-Glow, per-Node Prop-Editor (enum/boolean/number/modeRef-trackable/entity), `×`-Delete pro Node, Edge-Hit-Circles für Edge-Selektion + Delete-Pill, FAB `+` öffnet Bottom-Sheet-Palette gruppiert nach `FAMILY_LABELS`, Live-Validation-Banner + Preview-Satz oben, pin-position ResizeObserver für korrekte SVG-Pfade.
- ☑ Drag-to-Connect: `pointerdown` auf Output-Pin startet Drag mit gestrichelter Ghost-Line, `pointerup` über kompatiblem Input-Pin (via `document.elementsFromPoint`) erzeugt Edge; Tap-to-Connect bleibt parallel als Fallback für ungenaue Touchscreens.
- ☑ `/modes/[id]/graphs/+page.svelte`: GraphCanvas in Edit-Form integriert; JSON-Textarea bleibt als `<details>` „Advanced" Fallback mit Live-Parse-Sync.
- ☑ `/modes/new` redirected nach Save auf `/modes/[id]` statt `/modes`, damit User die neue Mode sofort weiter konfiguriert (inkl. Bet-Graphs-Discovery-Link).
- ☑ `pnpm check` 0 errors / 15 warnings; vitest 60/60 grün.

Open:
- ☐ Undo/Redo via history-stack in `$state`.
- ☐ Visual-Editor-E2E-Smoketest (Playwright).

---

## Phase 8 — Compiler-Familien-Erweiterung ☐
**Goal:** Compiler deckt alle 10 Wett-Familien ab.

Tasks:
- ☐ Familie E (delta): `delta` Node (Trackable, Window) → kompiliert via neuem `count_in_window` Predicate (Window = letzte N Sekunden / seit Round-Start / seit Marker).
- ☐ Familie F (time-compare): Vergleich zweier Timestamps; benötigt neues `timestamp_compare` Predicate (cmp + tolerance).
- ☐ Familie G (if-then): `if_then` Logic-Node → kompiliert zu `or(not(cond), then)` (klassische Implikation).
- ☐ Familie H (sequence): `sequence_match` Macro-Node → ordered-events Predicate (neue Primitive `events_in_order`).
- ☐ Familie I (time-threshold): „Event innerhalb T Sekunden" → `time_since` Compute-Node + `compare_number`; neue Engine-Funktion `time_since_event_start`.
- ☐ Familie J (ranking): `rank` Compute-Node (entity → number) + bestehender `log_rank` Predicate-Generalisierung (N>1).
- ☐ Tests: pro Familie 1 Compiler-Test + 1 Engine-Test in `predicate.test.ts`.
- ☐ Preview-Sentence-Erweiterung für neue Node-Kinds.

---

## Phase 9 — Legacy Cutover ☐
**Goal:** `market_templates` deprecaten und entfernen (Hardcut, ein einziger Sprint).

Tasks:
- ☐ Migrations-Script `scripts/migrate-templates-to-graphs.ts`: liest alle `modes.market_templates`, generiert äquivalente `BetGraph`-JSON, schreibt in `bet_graphs`. Idempotent + Trockenlauf-Modus.
- ☐ Per-User Migrations-Banner in `/modes`: „Du hast N alte Templates -- jetzt migrieren?" Knopf führt Script user-scoped aus.
- ☐ Drizzle Migration `0006_drop_market_templates.sql`: ALTER TABLE modes DROP COLUMN market_templates; ALTER TABLE sessions DROP COLUMN market_templates.
- ☐ Schema: `modes.market_templates` + `sessions.market_templates` + `MarketTemplate` type entfernen.
- ☐ `repos/markets.ts`: `instantiateMarketTemplates` löschen.
- ☐ `/s/[id]/round/+page.server.ts`: market-template-Instantiation-Call entfernen.
- ☐ `ModeForm.svelte`: Lego-Gallery für Wett-Templates entfernen; nur noch Discovery-Link zu `/modes/[id]/graphs`.
- ☐ `parseModeForm`: market_templates-Parsing weg.
- ☐ REQUIREMENTS-Update: REQ-MODE-003 (terminology/slug bereits weg) + alte Template-bezogene REQs markieren als „obsolet -- ersetzt durch REQ-MODE-007".

---

## Phase 10 — Visual Editor v2 + Live-Session Re-Sync ☑
**Goal:** GraphCanvas UX überarbeiten + Recovery-Pfad für Sessions, die vor Phase 9 erstellt wurden.

Tasks:
- ☑ `GraphCanvas.svelte` komplett neu: zentriertes Auto-Layout pro Tiefen-Reihe (`computeRows` via longest-incoming-path), schmale Cards (130–170px), Pin-getriebenes Hinzufügen (`suggestionsForInput` / `suggestionsForOutput` filtern `NODE_CATALOG`), Akzeptieren erstellt Node + Edge atomar.
- ☑ Input-Pins (`◀` caret, top-edge, rounded-bottom) vs Output-Pins (`▶` caret, bottom-edge, rounded-top) visuell klar unterscheidbar; `pin.compat` Pulse-Animation hebt zulässige Drop-Targets hervor.
- ☑ Allgemeiner `+ Node` FAB entfernt; nur Empty-State + Toolbar-`+ Quelle` Button bleiben für stand-alone Sources.
- ☑ Live-Sessions: neue `?/syncBetGraphs` Action in `s/[id]/round/+page.server.ts` (HOST-only) ruft `snapshotForMode(session.modeId)`, schreibt `sessions.betGraphsSnapshot`, instantiiert sofort in die laufende SETUP/BETTING_OPEN Round wenn `listMarketsByRound(current.id).length === 0`, emittiert `market_created` SSE.
- ☑ Empty-State auf der Round-Seite verlinkt jetzt zu `/modes/{modeId}/graphs` und bietet den Snapshot-Refresh-Knopf an.
- ☑ Tests: 78/78 grün; `pnpm check` 0 Errors.

---

## Phase 11 — Player Comfort & Session Settings ☑
**Goal:** Drink-Timer, simplere Bestätigung, GM-Settings, QR-Beitritt, Entity-Umbenennung, Landing-Polish.

Tasks:
- ☑ `ConfirmationMode` auf `GM | PEERS` reduziert; in PEERS-Modus zählt eine GM-Bestätigung als Peer. Legacy-Wert `EITHER` bleibt im DB-Enum, wird logisch als PEERS behandelt.
- ☑ Neue `lockMode: 'TIMER_LOCK' | 'LOCK' | 'NONE'` + `lockTimerSeconds` (Default 600) in `SessionConfig`. `freshModeDefaultConfig` setzt Default `TIMER_LOCK / 600`. `bets.placeBet` ruft `isLockedByDrinks()` (in `src/lib/drinks/lock.ts`) für lazy Timer-Check; `drinks.initiateSelfDrink/initiateForceDrink` setzen `betLocked=true` nur noch bei `lockMode === 'LOCK'`. Legacy `autoLockOnDrink` wird via `effectiveLockMode()` ausgewertet.
- ☑ `DrinkPanel.svelte`: Pending-Tab mit scrollbarer "Du musst trinken"-Liste auf sage→amber-Gradient + `Hourglass`-Timer-Pill, scrollbare "Andere → bestätigen"-Liste, scrollbare History-Liste; einzelne `Bestätigt n/N` Chip-Anzeige (GM zählt mit).
- ☑ Neues GM-only Route `s/[id]/settings/+page.{server.ts,svelte}` für Drink-Preise, Bestätigung, Lock-Modus + Timer, Rebuy und `entityOverrides[entityName]`. `updateSessionConfig()` Repo shallow-merged das Patch in `sessions.config`.
- ☑ Entity-Overrides werden in `s/[id]/+page.server.ts`, `s/[id]/round/+page.server.ts`, `s/[id]/info/+page.server.ts` an der `load()`-Grenze über `cfg.entityOverrides?.[e.name] || e.name` aufgelöst.
- ☑ Landing `+page.svelte`: bei `sessions.length === 0` rendert großer, zentrierter „Erste Session erstellen"-Tile mit Sage-Gradient-Kreis (`+` Icon, 6rem). „+ Session erstellen"-Pill-Button erscheint nur wenn ≥1 Session existiert. Admin-Gate auf Session-Erstellung entfernt (jeder eingeloggte User wird GM).
- ☑ Neuer `QrCode.svelte` (qrcode npm) rendert SVG-QR-Code für `${origin}/s/join?code=${inviteCode}`. Lobby zeigt QR + Code prominent oben. `/s/join` liest `?code=` URL-Param und befüllt das Input vor.
- ☑ Lobby „Session verwalten" hat jetzt zuerst einen primären „Einstellungen öffnen"-Button (`/s/[id]/settings`) vor dem Hard-Delete.
- ☑ Tests: 88/88 grün (neu: `src/lib/drinks/lock.test.ts` mit 10 Tests, `drinks.confirmation.test.ts` aktualisiert auf 3 Tests).
- ☑ `pnpm check`: 0 Errors, 15 Warnings (alle pre-existing / unkritische `$state` initial-capture Hinweise).

---

## Phase 11.2 — DB-Migration: ConfirmationMode auf 2 Werte ☑
**Goal:** `EITHER` aus dem Postgres-Enum entfernen, jetzt da kein Code-Pfad ihn mehr benötigt.

Tasks:
- ☑ Pre-flight Skript `scripts/check-confirmation-mode.mjs` (failt deploy wenn aktive Session noch `EITHER` hat).
- ☑ `drizzle/0007_confirmation_mode_2vals.sql`: Backfill `EITHER → PEERS` in `sessions.config` und `modes.default_config`, dann `RENAME TO ..._old` + `CREATE TYPE confirmation_mode AS ENUM ('GM','PEERS')` + `DROP TYPE ..._old`. Alles in einer Transaktion.
- ☑ `_journal.json` Eintrag idx 7.
- ☑ `schema.ts`: `pgEnum('confirmation_mode', ['GM','PEERS'])` und `type ConfirmationMode = 'GM' | 'PEERS'`.
- ☑ `drinks.ts`, `DrinkPanel.svelte`: alle `EITHER`-Kommentare/Branches entfernt; Logik unverändert (PEERS = effektive Gesamtanzahl ≥ Schwelle).
- ☑ `drinks.confirmation.test.ts`: EITHER-Test entfernt → 7 Tests. Gesamt 92/92.

---

## Phase 12 — UX-Refactor (User-Feedback) ☑
**Goal:** 6 konkrete Verbesserungen aus User-Feedback umsetzen.

Tasks:
- ☑ **#1 QR-Toggle (REQ-UI-026):** Lobby-QR hinter kleinem `QR`-Button neben Sound-Toggle versteckt; Panel mit Schließen-Button.
- ☑ **#2 Entity-Rename @create (REQ-UI-027):** `/s/create` rendert pro Default-Entity ein `<input>` (`entityOverride__<name>`); leere Werte = Original, gesetzte landen in `config.entityOverrides`.
- ☑ **#3+#4+#5 Drinks-Liste (REQ-UI-028):** `DrinkPanel.svelte` zu 3-Tab-Nav (Du / Andere / Drinks) umgebaut. "Drinks"-Tab merged Pending+History in einer Liste. Schlücke/Shots stacken pro `(targetUserId, drinkType)` mit `n×` Präfix + Click-to-Expand; Bier-Exen nie. Verlauf gruppiert ebenfalls per Bucket.
- ☑ **Session-Settings-Parität (REQ-UI-025 update):** `/s/[id]/settings` ergänzt um `startingMoney`, `minStake`, `showOdds`. Mode-Form Header "Erweitert" → "Standard Session-Einstellungen".
- ☑ **#7+#8 Ghost-Workflow (REQ-UI-029):** Round-Page: "Abrechnen" → **"Ergebnisse anzeigen"** öffnet Modal. Pro `(trackable, entity)` Bucket: Auto-Übernahme wenn nur eine Quelle Werte hat, sonst Radio-Pick `GM: n` vs `Ghost: Ø n (m Spieler)`. Neue Action `?/decideAndSettle` bestätigt gewählte Seite + cancelt andere + settled in einem Rutsch. Alter GM-Buffer-Panel entfernt.
- ☑ **#9 Statistik per Drink-Typ (REQ-STAT-004):** `stats.ts` liefert `drinksByType: {SCHLUCK,KURZER,BIER_EXEN}`. `/s/[id]/stats` Tile "Eigene Drinks" zeigt 3-Spalten-Grid Schlücke / Shots / Exen.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 13 Warnings (alle pre-existing).

---

## Phase 13 — Polish (User-Feedback) ☑
**Goal:** 5 mechanische Korrekturen aus User-Feedback.

Tasks:
- ☑ **#1 GM-Inline (REQ-UI-030):** Round-Page: `<details>`-GM-Panel entfernt. "Runde abbrechen" full-width `btn-sm btn-error btn-outline` direkt unter "Ergebnisse anzeigen".
- ☑ **#2 Create=Settings (REQ-UI-031):** `/s/create` exposed vollständige Config (startingMoney, minStake, showOdds, drinkPrices, confirmationMode + peerCount, lockMode/Timer, rebuy, entityOverrides). Server parsed alle Felder.
- ☑ **#3 Conditional Peer-Count (REQ-UI-032):** `peerConfirmationsRequired`-Input nur sichtbar wenn `confirmationMode === 'PEERS'`. Greift in ModeForm, Settings und Create.
- ☑ **#4 QR-unten (REQ-UI-033):** Lobby-QR-Panel rendert jetzt UNTER der Footer-Buttonreihe (mt-3) statt darüber.
- ☑ **#5 Defaults (REQ-MODE-007):** `freshModeDefaultConfig`: `peerConfirmationsRequired: 1`, `rebuy.amount: 1500`.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 15 Warnings (2 neue benigne `state_referenced_locally`).

---

## Phase 14 — Polish 2 (User-Feedback) ☑
**Goal:** 7 weitere Korrekturen aus User-Feedback.

Tasks:
- ☑ **#1 Mode-Delete Bug (REQ-MODE-008):** `deleteMode` fängt PG-FK-Error `23503` → `ModeInUseError`. Route-Action liefert 409 statt 500 mit deutscher Fehlermeldung.
- ☑ **#2 Drinks-Liste merged (REQ-UI-034):** `DrinkPanel.svelte` `list`-Tab: alles in ein `<ul max-h-[28rem] overflow-y-auto>`. Pending bleibt expandable, History flach.
- ☑ **#3 Lobby-Settings-Toggle (REQ-UI-035):** Settings-Panel hinter neuem `Settings`-Button neben QR + Sound, default zu.
- ☑ **#4 Wett-Status-Badge (REQ-UI-036):** Lobby zeigt klickbaren Status-Banner (Wetten offen / geschlossen / Auflösung / Ergebnis / etc.) → linkt auf `/round`.
- ☑ **#5 Bet-Stake-UI (REQ-UI-037):** 2/5/25% Quick-SET-Buttons, editable Number-Input + Range-Slider + Reset + Setzen.
- ☑ **#6 maxStakePctOfStart (REQ-ECON-002):** Neues SessionConfig-Feld (default 50). `placeBet` wirft `STAKE_ABOVE_MAX`. UI in ModeForm/Settings/Create.
- ☑ **#7 Startgeld-Default 2000 (REQ-MODE-009):** `freshModeDefaultConfig().startingMoney: 2000`.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 18 Warnings (3 neue benigne `state_referenced_locally` durch `confirmationMode`-`$state` Capture).

---

## Phase 15 — Polish 3 (User-Feedback) ☑
**Goal:** Drink-Timer Fix + 3 UX-Verfeinerungen.

Tasks:
- ☑ **#1 Drink-Timer hält (REQ-DRINKS-007):** `timerSecondsRemaining` rechnet jetzt mit dem ÄLTESTEN pending Drink — neue Drinks lassen den Timer weiterlaufen. Test angepasst (10s statt 30s erwartet).
- ☑ **#2 Stake-Slider Snap (REQ-UI-039):** Slider-step = `max(1, round(startingMoney / 100))` ≈ 1% vom Startgeld, unabhängig von `maxStakeAllowed`.
- ☑ **#3 Lobby Bet-Badge live (REQ-RT-005):** Lobby invalidiert auf `round_opened|round_live|round_settled|round_cancelled` → Badge updated automatisch.
- ☑ **#4 Bessere Mode-In-Use UX (REQ-UI-038):** `ModeInUseError.blockers` listet referenzierende Sessions (id+name+status). Edit-Page rendert sie als klickbare Liste.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 18 Warnings (unverändert).

---

## Phase 16 — Polish 4 (User-Feedback) ☑
**Goal:** Defaults nachziehen, Stake-UI entrümpeln, haptisches Feedback.

Tasks:
- ☑ **#1 Defaults 2000/1500 (REQ-MODE-010):** Migration `0008_bump_mode_defaults.sql` updated bestehende Modes (`startingMoney 1000 → 2000`, `rebuy.amount 1000 → 1500`). `parseForm.ts` defaults bumped. Migration via `drizzle-kit migrate` applied.
- ☑ **#2 Stake-UI entrümpelt (REQ-UI-040):** `[2%, 5%, 25%]` Quick-Set-Buttons + `stakes`/`stakeOptions()` entfernt. Number-Input zentriert (`.stake-number text-center` + spin-button hidden).
- ☑ **#3 Vibration on receive (REQ-DRINKS-008):** Lobby + round listen für `drink_initiated`, parsen `payload.targetUserId`, `navigator.vibrate(2000)` wenn match.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 21 Warnings (+3 ungenutzte CSS-Selektoren `.stake-row`/`.stake-chip-active` — werden Phase 17 entfernt falls nicht reaktiviert).

---

## Phase 17 — Mode-Vereinfachung ☑
**Goal:** Mode-Form radikal eindampfen. Slug, Beschreibung, Terminologie und alle Session-Defaults verschwinden aus der Mode-UI. Terminologie wird hart auf "Spieler"/"Runde"/"läuft" gesetzt. CSS-Reste aus Phase 16 entsorgen.

Tasks:
- ☑ **#1 Mode form vereinfacht (REQ-MODE-011):** `ModeForm.svelte` zeigt nur noch `Name`, `Spieler/Entities`, `Trackables`, `Bet-Graphs`-Link. Slug-Input, Description-Textarea, Terminologie-Sektion und sämtliche Session-Settings (Ökonomie, Drinks, Confirmation, Lock, Rebuy) entfernt. Slug wird in `parseModeForm` aus dem Namen via `slugify(name)` abgeleitet; bei Kollision automatisch suffixiert. DB-Spalten bleiben unverändert (description/terminology/defaultConfig werden mit Defaults gefüllt).
- ☑ **#2 Terminologie hardcoded (REQ-UI-041):** Alle UI-Stellen mit `mode.terminology.entity` → Literal `Spieler`. Loader in `/modes`, `/modes/[id]`, `/s/create`, `/s/[id]/info` geben `terminology` nicht mehr aus. `DEFAULT_TERMINOLOGY` Konstante in `parseForm.ts` füllt die DB.
- ☑ **#3 Session-Defaults in /s/create (REQ-MODE-012):** `SESSION_DEFAULTS` Konstante in `+page.svelte` ersetzt alle `selectedMode.defaultConfig.X` Zugriffe. Server-Action fällt auf `freshModeDefaultConfig()` zurück; `mode.defaultConfig` wird nicht mehr konsultiert.
- ☑ **#4 CSS-Cleanup:** Ungenutzte Selektoren `.stake-row`/`.stake-label`/`.stake-chip-active`/`.stake-running` aus `s/[id]/round/+page.svelte` entfernt.

Acceptance:
- ☑ `pnpm vitest run`: 93/93.
- ☑ `pnpm check`: 0 Errors, 12 Warnings (war 21, -9 weil viele waren auf entfernten Settings-Sections in ModeForm).
- ☑ Mode neu anlegen, speichern, Session daraus erstellen funktioniert ohne UI-Regression.

---

## Phase 18 — Mode/Bet-Graph Vereinfachung ☑
**Goal:** Den Mode/Bet-Graph-Workflow vom Coder-Tool zum normalen Form-UI machen. Slug ganz raus, Wetten aus 7 Vorlagen generieren statt frei zeichnen, Wetten in den Mode-Editor inline, Graph-Editor mit deutschen Labels und Operator-Symbolen, seltene Nodes hinter "Erweitert"-Toggle.

Tasks:
- ☑ **18a Slug-Cleanup (REQ-MODE-013):** Migration `0009_drop_mode_slug.sql` droppt `modes.slug` + `modes_slug_uniq`. Aus `schema.ts`, `repos/modes.ts` (`findBySlug` entfernt), `parseForm.ts`, `/modes/new` und `/modes/[id]` ist Slug komplett raus. Modes nur noch per UUID adressiert.
- ☑ **18b Wett-Vorlagen (REQ-BET-020, REQ-BET-021, REQ-BET-022, REQ-UI-042):** Neues Modul `src/lib/graph/templates.ts` mit 7 Templates (`race`, `champion`, `loser`, `will_player`, `will_happen`, `podium`, `race_vs_time`) als `TemplateSpec` mit Lucide-Icon-Namen, Feldern und German sentence-Preview. `buildGraph()` emittiert valides BetGraph-JSON. Compiler erweitert für `race_to_threshold` mit N>1 (per-Entity `count(gte,N)` Predicates + `OnFirstSatisfied`). Validator erlaubt einseitige Number→Timestamp Coercion. Neue Route `/modes/[id]/graphs/new` mit Karten-Picker und dynamischem Form pro Template.
- ☑ **18c One-Page Mode-Editor (REQ-UI-043):** `/modes/[id]/+page.server.ts` lädt Bet-Graphs des Modes mit. `/modes/[id]/+page.svelte` zeigt Wettenliste inline (Name + Preview + Bearbeiten-Link + Delete) und 2 CTAs: "+ Wette aus Vorlage" / "+ Frei zeichnen". Eigene `deleteGraph`-Action.
- ☑ **18d Graph-Editor Polish (REQ-UI-044):** `catalog.ts` exportiert `enumLabel()` + `ENUM_LABELS`-Map mit Operator-Symbolen (`=`/`≠`/`>`/`<`/`≥`/`≤`), DE-Labels für Trigger (`Am Ende`/`Sobald erfüllt`), Direction (`↑ hoch`/`↓ runter`) und Delta-Mode. `GraphCanvas.svelte` zeigt diese Labels in allen enum-Dropdowns.
- ☑ **18e Catalog-Triage (REQ-UI-045):** `NodeSpec.advanced` Flag. Markiert: `now`, `first_occurrence`, `delta`, `between`, `time_compare`, `not`, `if_then`, `sequence_match`. Beide Picker-Sheets (Source-Picker + Pin-Picker) bekommen "Erweitert"-Checkbox; default versteckt sind Advanced-Nodes.

Acceptance:
- ☑ `pnpm vitest run`: 102/102 (93 + 1 race-N>1 + 8 templates).
- ☑ `pnpm check`: 0 Errors, 12 Warnings.
- ☑ Alle 7 Templates: `buildGraph → validateGraph.ok → compileGraph.ok` (Smoke-Test pro Template).
- ☑ Mode-Editor zeigt Wettenliste inline; Delete-Action funktioniert.

---

## Phase 19 — Mode-Editor UX Cleanup ☑
**Goal:** Letzte Reste aus dem Mode-Editor wegputzen: ungenutzte DB-Spalten droppen, Template-Picker als Modal inline statt eigene Route, Bet-Graph-Karten mit aussagekräftigem Outcome-Icon und Direkt-Edit per URL-Param.

Tasks:
- ☑ **19c DB-Cleanup (REQ-MODE-014):** Migration `0010_drop_mode_unused_cols.sql` droppt `modes.description`, `modes.terminology`, `modes.default_config`. `schema.ts` entfernt die Spalten + `ModeTerminology`-Type. `repos/modes.ts` `CreateModeInput` schrumpft auf `{ownerUserId, name, defaultEntities, trackables}`. `parseForm.ts` rauchfrei umgeschrieben (kein DEFAULT_TERMINOLOGY, kein freshModeDefaultConfig). `s/[id]/+page.server.ts` und `s/[id]/info/+page.server.ts` lesen kein `mode.terminology` mehr.
- ☑ **19a Inline Template-Modal (REQ-UI-046):** `/modes/[id]/+page.svelte` öffnet einen DaisyUI-Glass-Dialog beim Klick auf "+ Wette aus Vorlage". 7 Karten + dynamisches Form inline. Neue Action `?/createGraphFromTemplate` baut + persistiert. Route `/modes/[id]/graphs/new` bleibt als no-JS-Fallback.
- ☑ **19b Outcome-Icons + Direkt-Edit (REQ-UI-047):** Neuer Helper `src/lib/graph/outcomeIcon.ts` mappt Bet-Graph → Lucide-Icon (`Trophy`/`CheckCircle2`/`Medal`/`Sparkles`). Karten im Mode-Editor zeigen Icon-Bubble und verlinken auf `/modes/[id]/graphs?edit=<graphId>`. Graphs-Page liest `?edit=` per `$effect` aus `page.url.searchParams` und ruft `startEdit` auf dem passenden Graph.

Acceptance:
- ☑ `pnpm vitest run`: 102/102.
- ☑ `pnpm check`: 0 Errors.
- ☑ Mode-Editor öffnet Template-Picker inline ohne Routenwechsel.
- ☑ Klick auf Bet-Graph-Karte landet direkt in `startEdit` für diesen Graph.

---

## Phase 20a — Mode-Vocab + Wetten-Dedupe ☑
**Goal:** Doppelte Bet-Graph-Einstiegspunkte aus dem Mode-Editor entfernen, Vokabular im Editor von "Spieler" auf "Entitäten" / "Events" / "einzel" umstellen, und Template-Picker so filtern, dass nur scope-passende Trackables vorgeschlagen werden.

Tasks:
- ☑ **20a Dedupe + Vocab (REQ-UI-048):** ModeForm Section 4 (Bet-Graphs-Link-Block) komplett raus. Auf `/modes/[id]` nur noch ein CTA "+ Wette aus Vorlage" (kein "Frei zeichnen" mehr). Headlines im ModeForm umbenannt: "Spieler" → "Entitäten", "Was zählen wir mit?" → "Events". Scope-Toggle-Button "pro" → "einzel". Listenansicht `/modes` zeigt "N Entitäten". `templates.ts` benennt Entity-Feld-Label + Fehlermeldungen + Title-Fallback auf "Entität".
- ☑ **20a Scope-Filter (REQ-BET-023):** `templates.ts` exportiert `templateRequiresEntityScope(id)` (true für `race`, `champion`, `loser`, `will_player`, `podium`). Picker-Modal-Dropdown filtert `data.mode.trackables` auf `scope === 'entity'` wenn nötig; Warnhinweis bei leerer Liste.

Acceptance:
- ☑ `pnpm vitest run`: 102/102.
- ☑ `pnpm check`: 0 Errors.
- ☑ Mode-Editor hat exakt einen Bet-Graph-Einstiegspunkt.
- ☑ Beim Auswählen von `champion` zeigt das Trackable-Dropdown nur entity-scoped Events.

---

## Phase 21 — Graph 2.0 Big-Bang ☑
**Goal:** Bet-Graph-Editor komplett ersetzen: 2D 20×10 Slot-Grid (X = Datenfluss, Y = parallele Ketten), Drag&Drop mit Snap-to-Slot, Bezier-Wires, kein Zoom, neue 13 Core + 5 Advanced Bausteine, opake DB-Persistenz. Branch `graph-2.0`, ein Big-Bang-Migration (`0011_graph_2_reset.sql`) droppt die alte `bet_graphs` Tabelle und Session-Snapshots. Predicate-AST der Runtime-Engine bleibt unverändert.

Tasks:
- ☑ **21a Foundation:** `schema.ts` neue `GraphNodeKind` (13+5), `GraphNodePos`, `BetGraph v2` mit `grid`; `GRAPH_GRID_COLS=20`/`GRAPH_GRID_ROWS=10`. `catalog.ts` neu mit `NODE_CATALOG`, `FAMILY_LABELS`, `FAMILY_COLORS`, `PIN_COLORS`, `CORE_KINDS`, `ADVANCED_KINDS`, `ENUM_LABELS`, jeder Spec hat `icon: <LucideName>`. (REQ-BET-024, REQ-BET-025, REQ-BET-026)
- ☑ **21b Compiler+Validator:** `compile.ts` mit `buildWinnerFromRank` (threshold>0 → `count` per Entity, sonst `compare_counters` self vs others), `buildPodiumFromRank` (withOrder=true → topK×N log_rank, sonst per-entity OR), `compileBoolean` Cases compare/between/combine/condition/sequence_match/time_compare, `compileCounterExpr` aggregate (entities→sum, entity→ref) + delta (signed→diff). `validate.ts` Coercions `Number→Timestamp`, `EntityList→Entity`, `Entity→EntityList`. (REQ-BET-027)
- ☑ **21c Templates:** `templates.ts` 7 Templates auf v2-Graph mit Slot-`pos`. `TemplateParams` ohne `direction`/`mode`. Neuer Core-Kind `entity` (mit `entityName: modeRef` Prop) damit will_player single-entity scope geht. (REQ-BET-028)
- ☑ **21d Editor-UI:** `SlotGraphEditor.svelte` (~700 LOC) ersetzt alten Free-Canvas: 4-Region Layout (Catalog 280px / Canvas / Inspector 320px / Statusbar), HTML5-DnD aus Sidebar + Move existierender Tiles + Wire-Drag via Pointer-Events mit Bezier-Pfad, Inspector mit prop-typ-spezifischen Editoren. `Icon.svelte` als Lucide-Dispatcher. Keyboard: `Entf`/`Backspace` löscht, `Ctrl+D` dupliziert. **Kein Zoom — nur Scroll.** (REQ-UI-049, REQ-UI-050, REQ-UI-051, REQ-UI-052, REQ-UI-053, REQ-UI-055)
- ☑ **21e Migration + Routes + Preview:** `drizzle/0011_graph_2_reset.sql` droppt + legt `bet_graphs` neu an, resettet `sessions.bet_graphs_snapshot`. Journal-Eintrag idx 11. `/modes/[id]/graphs/+page.{svelte,server}.ts` importieren `SlotGraphEditor`, JSON-Paste rejectet version!=2. Routes ohne `direction`-Param. `preview.ts` neu via `inputSource` über `result`-Pin. `outcomeIcon.ts` neu (Trophy/CheckCircle2/Medal/Sparkles). Alter `GraphCanvas.svelte` gelöscht. (REQ-BET-024, REQ-UI-054)
- ☑ **21f Tests:** `graph.test.ts` 23 Cases (validateGraph 6, compileGraph 16, previewSentence 2) auf 2.0-Kinds; `templates.test.ts` smoke alle 7 Templates (build+validate+compile). 31/31 green.
- ☑ **21g Docs + Merge:** REQUIREMENTS.md (REQ-BET-024..028, REQ-UI-049..055), SPRINT_PLAN.md, TRACEABILITY.md aktualisiert; Branch nach `main` gemerged.

Acceptance:
- ☑ `pnpm vitest run`: 105/105 (+3 vs Phase 20a).
- ☑ `pnpm check`: 0 Errors.
- ☑ Editor scrollt im 20×10 Grid ohne Zoom; Drag&Drop snapt zum Slot.
- ☑ Migration 0011 droppt alte `bet_graphs` und legt sie identisch neu an; Session-Snapshots reset.
- ☑ Alle 7 Templates bauen v2-Graphen mit gültigen `pos`-Slots.

---

## Phase 22 — Graph 2.0 UX-Polish ☑
**Goal:** Nach Phase 21 fehlte (a) der Einstieg zum Freeform-Editor, (b) der Editor-Style passte nicht zum App-Theme, (c) auf Mobile war der Editor unbenutzbar. Diese Phase fügt einen sekundären "Eigene Wette bauen"-CTA hinzu, swappt alle `oklch()`-Hardcodes auf DaisyUI-Tokens, und macht das 3-Spalten-Layout responsive mit Drawer-Pattern.

Tasks:
- ☑ **22a "Eigene Wette" CTA (REQ-UI-056):** Auf `/modes/[id]/+page.svelte` unter dem Primary-CTA "Wette aus Vorlage" einen Outline-Button mit Pencil-Icon, der nach `/modes/[id]/graphs` führt.
- ☑ **22b DaisyUI-Tokens (REQ-UI-057):** `SlotGraphEditor.svelte` Style-Block komplett umgestellt auf `var(--color-base-*)`, `var(--color-primary)`, `color-mix(in oklab, …)` für Schatten. Editor-Root hat Rahmen + Radius. Funktioniert in Light- und Dark-Theme.
- ☑ **22c Mobile-Drawer (REQ-UI-058):** Media-Query `@media (max-width: 767px)`: Grid kollabiert auf eine Spalte, Catalog/Inspector werden absolute Drawers mit Slide-Transition, Statusbar bekommt zwei `mobile-only` Toggle-Buttons (Menu + Settings2). Tile-Click öffnet Inspector automatisch. Neue Lucide-Icons (`X`, `Menu`, `Settings2`) im `Icon.svelte` registriert.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich (vorher: `vite-plugin-sveltekit-guard` lehnte `$lib/server/db/schema` Value-Import in `.svelte` ab → Fix in der gleichen Phase: Konstanten `GRAPH_GRID_COLS/ROWS` nach `src/lib/graph/grid.ts` verschoben; schema.ts re-exportiert für Server-Code).
- ☑ Eigene Wette ist von `/modes/[id]` aus erreichbar.

---

## Phase 23 — Graph 2.0 UX-Fixes ☑
**Goal:** Nach Phase 22 meldete Tester drei Probleme: (a) sichtbare Lücke zwischen Events- und Wetten-Sektion auf `/modes/[id]`, (b) Canvas zeigt immer das volle 20×10-Grid (3600×1100px) — selbst leere Graphen wirken riesig und Drop-Targets sind schwer zu finden, (c) Tap auf Catalog-Items spawnt nichts — Touch-Geräte feuern keinen `dragstart`, also war der Editor auf Mobile faktisch tot.

Tasks:
- ☑ **23a Events↔Wetten Flow (REQ-UI-061):** `mt-8` zwischen `ModeForm` und Wetten-Section ersetzt durch `mt-4 border-t border-base-300 pt-4` → Sektionen lesen sich als ein zusammenhängender Bearbeitungsfluss.
- ☑ **23b Auto-Fit Canvas (REQ-UI-060):** `visibleCols`/`visibleRows` als `$derived` aus `max(occupiedCol)+3` bzw. `max(occupiedRow)+2` (min 6×4, max COLS×ROWS). `.canvas-grid`, `.grid-dots`, `.wires` skalieren mit. Leerer Graph zeigt 6×4 statt 20×10. Logische Drop-Range bleibt COLS×ROWS.
- ☑ **23c Click-to-Spawn (REQ-UI-059):** Catalog-Item-Button bekommt `onclick={() => spawnFromCatalog(kind)}` zusätzlich zum HTML5-DnD. `spawnFromCatalog` sucht row-major nach erstem freien Slot, ruft `addNodeAt`, schließt `mobileCatalogOpen`. Title-Tooltip angepasst.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.
- ☑ Auf Touch + Desktop: Klick auf Catalog-Item legt sofort einen Node ins Canvas.
- ☑ Leerer Graph rendert kompakt (≈1080×440px statt 3600×1100px).

---

## Phase 24 — Editor Densification (Pass 1) ☑
**Goal:** Tester meldete (a) Nodes zu groß, (b) Catalog & Inspector verstopfen das Interface und verdecken Pins beim Wiring, (c) Default-Layout sollte vertikal statt horizontal wachsen. Diese Phase verdichtet Tile- und Sidebar-Geometrie und ändert die Spawn-Reihenfolge auf column-major. Template-Konsistenz (Single/Global Events) wird in einer Folge-Phase angegangen.

Tasks:
- ☑ **24a Compact Tiles (REQ-UI-062):** `SLOT_W/H` 180/110→140/80, `TILE_W/H` 160/90→120/60. Header-Padding und Body unverändert, font bleibt 0.7rem.
- ☑ **24b Vertical-Default Spawn (REQ-UI-063):** `spawnFromCatalog` Schleife auf column-major umgestellt. Erste 10 Click-Spawns landen in Spalte 0 untereinander.
- ☑ **24c Schlanke Sidebars (REQ-UI-064):** Grid-Columns 260/300→200/240; Catalog-Item Padding `0.4rem 0.55rem`→`0.25rem 0.4rem`, Font 0.78→0.7rem.

Open (Phase 25):
- Template-Konsistenz: "Standard-Wetten sagen teils dasselbe, je nach Event-Setup (single/global)" — braucht User-Input zur konkreten Soll-Liste.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 25 — Tap-to-Wire ☑
**Goal:** Pin-Verbindungen per Drag waren auf Touch nicht zuverlässig. Diese Phase ergänzt einen Tap1→Tap2 Pfad parallel zum existierenden Drag.

Tasks:
- ☑ **25a Tap-to-Wire (REQ-UI-065):** `pendingOutPin` $state, `onOutputPinClick`/`onInputPinClick` Handler. Click auf Output-Pin selektiert (oder de-selektiert) ihn; Click auf kompatiblen Input erstellt Edge. Visual: `.tap-active` Primary-Ring + `.tap-target` `pin-pulse` Animation auf kompatiblen Inputs. `Escape` und Canvas-leer-Click brechen ab.

Offen (Phase 26, größerer Refactor):
- **26a** Inline-Properties auf der Node (Inspector entfällt für Standard-Felder).
- **26b** Click auf leeren Pin → Popover "neuen passenden Node spawnen ODER mit existierendem verbinden".
- **26c** Template-Wizard mit Setup-Fragen zur Trackable-Scope-Klärung (single vs. global).

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 26 — Editor Pass-2 ☑

**Goal:** Inspector + Catalog dominierten das Interface. Diese Phase macht den Inspector zu einem on-demand Overlay, lässt den Canvas voll atmen, und legt 26b/26c als Folge-Sub-Phasen an.

Tasks:
- ☑ **26a Inspector-Overlay (REQ-UI-066):** Inspector ist `position: absolute` overlay statt Grid-Spalte. Slides in/out via `transform: translateX` + `.visible` (gebunden an `selectedNode !== null`). Desktop hat permanenten X-Close-Button. Canvas-leer-Click cleart Selektion → Inspector verschwindet.
- ☑ **26b Pin-Popover (REQ-UI-067):** `pinPopover` $state + `compatibleKinds`/`compatibleExistingPins`/`spawnAndWireFromPopover`/`connectFromPopover` Helper. Click auf Pin öffnet anchored Popover mit Existing-Connect-Liste und Spawn-Liste. Spawn legt Node neben Source und verdrahtet automatisch. Escape/Canvas-Click schließen.
- ☑ **26c Template-Verfügbarkeit (REQ-UI-068):** `templateAvailable(tplId)` Helper in `/modes/[id]/+page.svelte`. Inkompatible Templates sind `disabled` mit Tooltip; einzel-Templates bekommen Badge "einzel" neben Titel. Damit sieht der User sofort welche Vorlagen mit dem aktuellen Trackable-Setup funktionieren.

Acceptance (26a):
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 27 — UX-Refinement Pass-3 ☑

**Goal:** Senior-UX-Pass auf das gesamte Editor- und Mode-Interface — Lücken schließen, Canvas befreien, Template-Flow personalisieren.

Tasks:
- ☑ **27a Mode-Page Spacing (REQ-UI-069):** `pb-24` (Buffer für fixe Save-Bar) von `<form>` in `ModeForm` ans äußere Page-Container (`/modes/[id]/+page.svelte`, `/modes/new/+page.svelte`) verschoben. Schließt die Lücke zwischen Mode-Form (Trackables) und Folgesektionen (Wetten, Delete).
- ☑ **27b Graph-Canvas leer kein X-Scroll (REQ-UI-070):** `.canvas-scroll.empty { overflow-x: hidden }` + `.canvas-scroll.empty .canvas-grid { width: 100% !important }`. Bei leerem Graph erscheint keine horizontale Scrollbar.
- ☑ **27c Catalog/Inspector als Drawer auf allen Breakpoints (REQ-UI-071):** `.editor-root` ist jetzt einspaltig (`grid-template-columns: 1fr`). Catalog ist absolute-positioniertes Drawer das per `.mobile-open` reinslidet (analog Inspector aus 26a). `.mobile-only` Buttons in der Statusbar immer sichtbar zum Öffnen. Canvas hat damit immer volle Breite.
- ☑ **27d Template-Wizard trackable-first (REQ-UI-072):** Picker ist 2-Step-Wizard: Step 1 wählt Trackable (mit Scope-Badge), Step 2 zeigt nur kompatible Templates mit personalisierten Titeln (`personalizedTitle(tplId, label)`), Step 3 (Form) bekommt Trackable als hidden input und fragt nur Restparameter ab. Bei leerer Trackable-Liste Hinweis statt leerer Auswahl.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 28 — Renn-Templates & Count-Brackets ☑

User-Feedback: "im template möchte ich für renn wetten noch folgendes: Wer wird gewinnen? Einzel; Wie oft wird überholt? 0, weniger als X, mehr als X." Drei Bracket-Wetten werden bewusst als drei separate binäre Templates angelegt — kein Schema-Umbau für Multi-Outcome.

- ☑ **28 Fünf neue Templates (REQ-UI-073):** `templates.ts` erweitert um `finish_first` (entity-scope, Schwelle N standardmäßig 1, Wiederverwendung der `buildRace`-Engine), `finish_last` (entity-scope, `buildRankWinner(direction='asc')`), `count_zero` (global/entity, neuer `buildCountCompare(op='eq', threshold=0)`), `count_less_than` (`op='lt'`) und `count_more_than` (`op='gt'`). `ENTITY_SCOPE_REQUIRED` umfasst die zwei Renn-Templates. Icon-Set in `TPL_ICONS` (`modes/[id]/+page.svelte`) und `ICONS` (`modes/[id]/graphs/new/+page.svelte`) sowie `personalizedTitle()` (`modes/[id]/+page.svelte`) decken die neuen IDs ab.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 29 — Senior UX Refinement Pass-4 ☑

User-Feedback nach Phase 28: drei UX-Schmerzpunkte im Graph-Editor und in den Entity/Event-Anzeigen.

- ☑ **29a Pins oben/unten (REQ-UI-074).** Pins sitzen jetzt auf der oberen (Inputs) bzw. unteren (Outputs) Kante des Node-Tiles, da der Graph konzeptionell von oben nach unten verläuft. `pinX(idx, total)` ersetzt das alte `pinY`-Layout, `inputPinPos`/`outputPinPos`/`bezierPath` arbeiten vertikal (Kontrollpunkte über `dy`). CSS und Pin-Popover-Positionierung angepasst.
- ☑ **29b Inline Node Editor (REQ-UI-075).** Die Tile-Body ist nicht mehr nur eine Read-only-Vorschau, sondern enthält ein editierbares Control für die primäre Property des Nodes (`input`/`select`/`checkbox` je nach `prop.kind`). Bei mehr als einer Property kennzeichnet ein `+N`-Badge weitere im Inspektor verfügbare Eigenschaften. Neue Helper-Funktion `setNodeProp(node, key, value)` erlaubt Editing ohne Selektion; Click/Pointerdown/Dragstart-Propagation wird gestoppt damit Editing nicht mit Node-Drag/Select kollidiert.
- ☑ **29c Farbige Entity/Event-Icons entfernt (REQ-UI-076).** Die runden Farbbadges und Emoji-Avatare bei Entitäten und Events (Trackables) sind UI-weit entfernt — sie waren reine Dekoration, vom User nicht editierbar und führten zu Verwirrung. Betrifft `ModeForm.svelte`, `s/[id]/info/+page.svelte`, `s/create/+page.svelte`, `s/[id]/round/+page.svelte`, `modes/[id]/+page.svelte`, `modes/[id]/graphs/new/+page.svelte`.

Acceptance:
- ☑ `pnpm vitest run`: 105/105.
- ☑ `pnpm check`: 0 Errors.
- ☑ `pnpm exec vite build`: erfolgreich.

---

## Phase 30 — Mode Switching ◐
**Goal:** Host can switch the active Mode of a Session mid-game (e.g. after a race game, switch to a different game type), preserving players, balances, and history.

Tasks:
- ☑ **30a Repo: `switchSessionMode()`** in `src/lib/server/repos/sessions.ts`. Guards: HOST-only, no active (non-terminal) round. In a single PG transaction: (1) UPDATE `sessions.modeId`, `sessions.trackables` (re-snapshot from new mode), `sessions.betGraphsSnapshot` (via `snapshotForMode`), clear `config.entityOverrides`; (2) DELETE all `entities` WHERE `sessionId`; (3) INSERT new entities from `mode.defaultEntities`; (4) return updated session.
- ☑ **30b SSE event: `mode_switched`.** New event type in `src/lib/server/sse/broadcaster.ts`. Payload: `{ newModeId, newModeName }`. Clients invalidateAll() on receipt.
- ☑ **30c Route action: `?/switchMode`** in `src/routes/s/[id]/+page.server.ts` (lobby). HOST-only guard + active-round check. Calls `switchSessionMode()` + emits `mode_switched` SSE.
- ☑ **30d Lobby UI.** GM section on `/s/[id]/+page.svelte` shows "Mode wechseln" button when no active round. Opens a Mode-picker modal. Confirmation dialog warns: "Spieler und Guthaben bleiben. Entitäten und Wett-Vorlagen werden ersetzt."
- ☑ **30e Info-Page refresh.** `/s/[id]/info/+page.svelte` + `+page.server.ts` already load from `session.trackables` and `entities` — no code change needed, verified.
- ☑ **30f Tests.** Vitest: `switchSessionMode` guards (reject if active round, reject if ENDED), happy-path (players preserved, entities replaced, trackables re-snapshotted). 13 tests.
- ☑ **30g UX: bet-graph count in mode picker.** `countByModeIds()` in `betGraphs.ts`. Mode picker shows per-mode bet-graph count + warning for modes with 0 graphs. Confirm dialog warns before switching to a mode without bet graphs.

Acceptance:
- ☑ `pnpm vitest run`: all green (123/123).
- ☐ `pnpm check`: 0 Errors.
- ☐ Mode switch preserves player balances, drinks, and settled round history.
- ☐ Entities + trackables + betGraphsSnapshot reflect the new Mode.
- ☐ SSE notifies all clients; lobby and round pages reload correctly.

### Phase 30h — Bet-Graph Auto-Sync Fix ☑
**Root cause:** When a mode has 0 bet-graphs at session-creation time, `snapshotForMode()` returns `[]`. Even if bet-graphs are later added to the mode, the session's snapshot stays empty — making the round page show "keine Bet-Graphs" permanently.

**Fix (3 changes):**
- ☑ **Auto-sync on round creation:** `createRound` action now checks if `session.betGraphsSnapshot` is empty and, if so, re-snapshots from the mode before instantiating markets. This means bet-graphs added to the mode after session creation are automatically picked up on the next round.
- ☑ **Session create page:** Mode picker cards now show bet-graph count per mode + warning for modes with 0 graphs (links to graph editor).
- ☑ **Round page UX:** Empty-state message improved — "Bet-Graphs vom Mode laden" button with hint text.

---

## Carry-over from MarbleTrace prototype (reference inspiration only)

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
