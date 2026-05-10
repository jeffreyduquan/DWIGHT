# DWIGHT — Sprint Plan

> Strategy: ship a thin vertical slice each sprint. Every sprint ends with `pnpm check` green, all tests green, and a runnable demo. The built-in Mode `murmelrennen-standard` serves as the battle-test content from D2 onwards.

---

## Status legend
- ☐ not started
- ◐ in progress
- ☑ done

---

## D0 — Workspace Scaffold ☐
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

## D1 — Auth ☐
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

## D2 — Schema + Seed + Mode Picker ☐
**Goal:** the full DWIGHT data model is in place; one built-in Mode exists; a host can create a Session bound to it.

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

## D3 — Rounds + Bet Templates + Live Odds ☐
**Goal:** GM opens a Round, declares BetOffers, players bet, GM declares outcome, payouts settle.

- Repos: `rounds.ts` (createRound, transitionStatus, declareOutcome), `betOffers.ts` (createBatch, listForRound), `bets.ts` (placeBet, listForRound, listForUser)
- BetTemplate registry `src/lib/server/bets/templates/` — one module per template:
  - `winner.ts`, `loser.ts`, `topN.ts`, `h2h.ts`, `exactRank.ts`, `podiumExact.ts`, `boolean.ts`
  - Each exports `{ id, label, outcomeKind, validateSelection, resolve }`
  - `index.ts` exports the registry map
- Live-odds module `src/lib/server/economy/quotes.ts`:
  - `computeQuotes(betOfferId)` — pure function: input = open bets on offer + mode config; output = per-outcome multiplier
  - Floor multiplier 1.10x, fallback to base when below `minStakeForLiveOdds`
- `src/lib/server/economy/placeBet.ts` — atomic transaction: validate selection → compute current quote → lock multiplier → debit balance → insert bet → recompute broke-lock → return new bet + updated quotes
- `src/lib/server/economy/resolveRound.ts` — atomic: read outcome → for each open bet on round, dispatch to template's `resolve()` → update status + payout → credit winnings → update user `total_stats`
- SSE broadcaster `src/lib/server/sse/broadcaster.ts` — in-memory channels keyed by sessionId; `emit(sessionId, event)`
- Route `/s/:id/round` — list BetOffers, current quotes, bet form, my open bets
- Route `/s/:id/round/host` — GM panel: pick BetTemplates from Mode allow-list, configure each (e.g. h2h pair), open betting, go LIVE, declare outcome, settle
- **Done when:** Vitest covers each template's resolve() + the quote formula + placeBet atomicity; browser run: alice bets on a winner offer, bob bets on a different one, GM declares outcome, balances update correctly, multiplier visible to both before placement is what gets locked

---

## D4 — Drinks ☐
**Goal:** the dual economy is real — players can self-cash-out by drinking, force-drink each other, and confirmation rules work.

- Repos: `drinks.ts` (initiateSelf, initiateForce, addConfirmation, cancel)
- `src/lib/server/economy/drinks.ts`:
  - `initiateSelfDrink(userId, sessionId, drinkType)` — atomic: insert PENDING SELF drink with priceSnapshot
  - `initiateForceDrink(attackerId, targetId, sessionId, drinkType)` — atomic: validate type allowed, debit attacker, insert PENDING FORCE drink
  - `confirmDrink(drinkId, confirmerUserId)` — atomic: check role (GM vs PEER), enforce target≠confirmer, count confirmations against `confirmationMode` rule, on threshold met → set CONFIRMED, credit target if SELF, clear `bet_locked` if SELF, emit SSE
  - `cancelDrink(drinkId, gmUserId)` — atomic: check GM, set CANCELLED, refund attacker if FORCE
- Route `/s/:id/drinks`:
  - Cash-out tab: pick tier → "Ich trinke einen X" → goes PENDING in own queue
  - Force tab: pick target + tier → "X für Y bezahlen" → debits me, queues for target
  - Pending tab: list of my pending drinks (incoming forces + my own self) with "Confirm" buttons that send confirmations to OTHER users' drinks (peer signoff UI)
  - History tab: confirmed/cancelled drinks chronological
- Broke-lock UX in bet placement form: if `bet_locked`, show inline CTA "Du bist pleite. Trink einen, um wieder mitzuspielen." with link to `/s/:id/drinks`
- SSE events wired: `drink_initiated`, `drink_confirmed`, `drink_cancelled`, `balance_updated`, `bet_lock_changed`
- **Done when:** Vitest covers all three confirmation modes (`GM`/`PEERS`/`EITHER`) including peer-self-confirm rejection; browser: alice goes broke, locks, drinks BIER_EXEN, bob confirms, alice unlocks and bets again

---

## D5 — Stats + Polish ☐
**Goal:** the night-after experience.

- Repo `stats.ts` — `getSessionLeaderboard(sessionId)`, `getMySessionStats(sessionId, userId)`, `getRoundHistory(sessionId)`
- Route `/s/:id/stats` — leaderboard with medal podium + my-summary cards (Bilanz, ROI%, Drinks self/forced, Trefferquote) + round history accordion
- Animations on round transitions, win/loss flash, drink-confirm pulse
- Settled-round live recap: who won how much, who drank what
- Empty-state polish across all routes
- **Done when:** stats route shows correct numbers across two test sessions; visuals feel finished on mobile

---

## D6 — PWA + Sound ☐
**Goal:** install-to-home-screen and audio cues.

- Self-hosted fonts via `@fontsource` (Space Grotesk + Inter + Geist Mono)
- Service worker with offline shell + cached static assets
- Manifest `display: standalone`, theme-color, full icon set
- Optional sound effects (toggleable via session config): bet placed, round live, you won, you lost, drink confirmed
- Lighthouse PWA audit ≥ 90
- **Done when:** Chrome shows "Install DWIGHT" prompt; offline reload of `/` shows cached shell

---

## D7 — Deploy ☐
**Goal:** DWIGHT runs on the netcup server (or equivalent).

- `@sveltejs/adapter-node` build
- `Dockerfile` for the app
- `docker-compose.prod.yml` with app + db + redis + reverse proxy (caddy or nginx) + Let's Encrypt
- GitHub Actions: build → push image → ssh deploy
- Production secrets via env (`AUTH_SECRET`, `DATABASE_URL`)
- `/healthz` endpoint
- Smoke test in CI hits `/healthz` after deploy
- **Done when:** https://dwight.example.tld serves login page

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
