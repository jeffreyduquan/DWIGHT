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
