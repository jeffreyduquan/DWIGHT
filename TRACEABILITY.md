# DWIGHT — Traceability

> Living matrix mapping every requirement (REQUIREMENTS.md) to the sprint that delivers it, the artefacts that implement it, and the tests that prove it.
>
> Status legend: ☐ pending · ◐ in progress · ☑ done

---

## REQ-BRAND — Identity & Branding

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-BRAND-001 | D0 | `src/app.html`, `package.json` (`name=dwight`) | manual visual | ☑ |
| REQ-BRAND-002 | D0 | (no tagline shipped) | n/a | ☑ |
| REQ-BRAND-003 | D0 | `src/routes/layout.css` (theme `dwight`) | manual visual | ☑ |
| REQ-BRAND-004 | D0 | `src/app.html` font links, `layout.css` font tokens | manual visual | ☑ |
| REQ-BRAND-005 | D0 | `src/lib/components/Logo.svelte` | manual visual | ☑ |
| REQ-BRAND-006 | D0 / D6 | `static/manifest.webmanifest`, `app.html` viewport+theme-color | Lighthouse PWA | ◐ |
| REQ-BRAND-007 | D0+ | all `+page.svelte` files | Playwright copy spot-checks | ☑ |

## REQ-AUTH — Authentication & Accounts

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-AUTH-001 | D1 | `src/lib/server/auth/validation.ts`, register form | (Playwright pending) | ☑ |
| REQ-AUTH-002 | D1 | `src/lib/server/auth/password.ts` | `password.test.ts` | ☑ |
| REQ-AUTH-003 | D1 | `auth/jwt.ts`, `auth/cookie.ts`, `hooks.server.ts` | `jwt.test.ts` | ☑ |
| REQ-AUTH-004 | D1 | `auth/rateLimit.ts`, login action | manual | ☑ |
| REQ-AUTH-005 | D1 | `routes/logout/+server.ts` | manual | ☑ |
| REQ-AUTH-006 | D1 | `hooks.server.ts` redirect logic | manual | ☑ |
| REQ-AUTH-007 | D1 | `users` schema, `repos/users.ts` | manual | ☑ |

## REQ-MODE — Modes

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-MODE-001 | D2 | `sessions.modeId` FK NOT NULL, `repos/sessions.ts` | manual | ☑ |
| REQ-MODE-002 | D2 | `modes` table | manual | ☑ |
| REQ-MODE-003 | D2 / D3 | `modes` schema (terminology, defaultEntities, trackables, defaultConfig); `ModeForm.svelte` Trackables UI | manual | ☑ |
| REQ-MODE-004 | D3 | `modes/new` no longer seeds a battle-test mode | manual | ☑ |
| REQ-MODE-005 | D2 | `routes/s/create/+page.svelte` Mode picker | manual | ☑ |
| REQ-MODE-006 | D2 / D5 | terminology helper | unit pending | ◐ |
| REQ-MODE-007 | Phase 6 | `drizzle/0005_bet_graphs.sql`, `src/lib/server/db/schema.ts` (`betGraphs`, `sessions.betGraphsSnapshot`), `src/lib/graph/{catalog,validate,preview,compile}.ts`, `src/lib/server/repos/betGraphs.ts`, `src/lib/server/repos/sessions.ts`, `src/lib/server/repos/markets.ts` (`instantiateBetGraphs`), `src/routes/s/create/+page.server.ts`, `src/routes/s/[id]/round/+page.server.ts` | `src/lib/graph/graph.test.ts` (11) | ◑ |

## REQ-ENT — Entities

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ENT-001 | D2 | `entities` table, session-create entity insert | manual | ☑ |
| REQ-ENT-002 | D2 | `entities` schema | manual | ☑ |
| REQ-ENT-003 | D5+ | entity editor in lobby (deferred) | Playwright | ☐ |

## REQ-ROUND — Rounds

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ROUND-001 | D3 | `rounds` schema (status enum), `repos/rounds.ts:transitionStatus`, `round/lifecycle.ts:cancelRoundWithRefund` | manual smoke (DB transition graph asserted in code) | ☑ |
| REQ-ROUND-002 | D3 | host-only guard in `/s/[id]/round/+page.server.ts` actions | manual | ☑ |
| REQ-ROUND-003 | D3 | `repos/bets.ts:placeBet` status check | manual | ☑ |
| REQ-ROUND-004 | D3 | `repos/events.ts` propose/confirm/cancel | manual | ☑ |
| REQ-ROUND-005 | D3 | `repos/rounds.ts:createRound` rejects when active round exists | manual | ☑ |

## REQ-TRACK — Trackables & Predicates

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-TRACK-001 | D3 | `modes.trackables`, `sessions.trackables`, `parseForm.ts` | manual | ☑ |
| REQ-TRACK-002 | D3 | `Trackable.scope` enum + validation in `proposeEvent` | manual | ☑ |
| REQ-TRACK-003 | D3 | `bets/predicate.ts:evalPredicate` (count/and/or/not) | `predicate.test.ts` (14 tests) | ☑ |
| REQ-TRACK-004 | D3 | `events.ts:getCounterSnapshot` + `markets.ts:settleRoundMarkets` | `predicate.test.ts` + manual settle | ☑ |

## REQ-EVENT — Round Events

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-EVENT-001 | D3 | `round_events.delta` default 1, scope validation | manual | ☑ |
| REQ-EVENT-002 | D3 | `proposeEvent` (any user) vs `confirmEvent`/`cancelEvent` (HOST only) | manual | ☑ |
| REQ-EVENT-003 | D3 | cancelled events excluded from `getCounterSnapshot` | manual | ☑ |
| REQ-EVENT-004 | D3 | `round_events` columns: `proposedByUserId`, `decidedByUserId`, `decidedAt` | manual | ☑ |

## REQ-MARKET — Markets & Outcomes

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-MARKET-001 | D3 | `bet_markets`, `bet_outcomes` schema; `createMarket` requires ≥2 outcomes | manual | ☑ |
| REQ-MARKET-002 | D3 | HOST-only guard in `?/createMarket` action | manual | ☑ |
| REQ-MARKET-003 | D3 | `markets.ts:createBinaryMarket` (auto YES/NEIN via `negate`) | manual | ☑ |
| REQ-MARKET-004 | D5+ | bulk-per-entity UI deferred; engine supports `createMarket(outcomes[])` | unit pending | ☐ |
| REQ-MARKET-005 | D3 | single market = shared pool (parimutuel by design) | `payout.test.ts` | ☑ |
| REQ-MARKET-006 | D3 | `bets/payout.ts:computeMarketPayouts` (equal split across winners + integer residual) | `payout.test.ts` (9 tests) | ☑ |
| REQ-MARKET-007 | D8 | `db/schema.ts:MarketTemplate`; `modes.market_templates` + `sessions.market_templates` (snapshot); `parseModeForm` parses template rows; `ModeForm.svelte` template editor; `markets.ts:instantiateMarketTemplates` called from `?/createRound` | manual | ☑ |
| REQ-MARKET-008 | D8 | `db/schema.ts:Predicate` extended with `compare_counters`; `bets/predicate.ts:evalPredicate`/`validatePredicate` updated; `cmp` enum now includes `gt`/`lt` | `predicate.test.ts` (22 tests) | ☑ |

## REQ-BET — Bets & Settlement

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-BET-001 | D3 | `bets` schema; `repos/bets.ts:placeBet` (atomic debit + insert) | manual | ☑ |
| REQ-BET-002 | D3 | `placeBet` market.OPEN + round status validation | manual | ☑ |
| REQ-BET-003 | D3 | `markets.ts:settleRoundMarkets` sets `betOutcomes.isWinner` | manual | ☑ |
| REQ-BET-004 | D3 | `payout.ts` parimutuel, no house edge | `payout.test.ts` | ☑ |
| REQ-BET-005 | D3 | `payout.ts` void path = refund all stakes | `payout.test.ts` | ☑ |
| REQ-BET-006 | D3 | `bets.payoutAmount` + `settledAt` written once in settle tx | manual | ☑ |

## REQ-ECON — Money Economy

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ECON-001 | D2 | `session_players.moneyBalance`, session-create init | manual | ☑ |
| REQ-ECON-002 | D3 | `placeBet` row-level lock on `session_players` | concurrency test pending | ◐ |
| REQ-ECON-003 | D3 | atomic debit on place; credit in settle tx | manual | ☑ |
| REQ-ECON-004 | D3 | `payout.ts` integer math + deterministic residual rule | `payout.test.ts` | ☑ |
| REQ-ECON-005 | D3 | `bets.settledAt` set once; no further mutations | manual | ☑ |

## REQ-ODDS — Live Market View

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ODDS-001 | D3 | `/round/+page.svelte` shows pool + stake per outcome + % share | manual | ☑ |
| REQ-ODDS-002 | D3 | parimutuel by design (no quoted multiplier) | `payout.test.ts` | ☑ |
| REQ-ODDS-003 | D4 | SSE rebroadcast on bet-placed (deferred to D4 SSE work) | integration | ☐ |

## REQ-DRINK — Drink Economy

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-DRINK-001 | D2 | `drink_type` enum | schema | ☑ |
| REQ-DRINK-002 | D2 | `defaultConfig.drinkPrices` | manual | ☑ |
| REQ-DRINK-003 | D4 | `repos/drinks.ts:initiateSelfDrink`, finalize credits target | `drinks.confirmation.test.ts` | ☑ |
| REQ-DRINK-004 | D4 | `initiateForceDrink` (debit attacker, no target credit) | manual | ☑ |
| REQ-DRINK-005 | D4 | `drinks.priceSnapshot` captured at issue | manual | ☑ |
| REQ-DRINK-006 | D4 | `confirmDrink` GM/PEERS/EITHER rule | `drinks.confirmation.test.ts` | ☑ |
| REQ-DRINK-007 | D4 | `cancelDrink` (GM-only, FORCE refund) | manual | ☑ |
| REQ-DRINK-008 | D4 | `forceDrinkTypesAllowed` validation in `initiateForceDrink` | manual | ☑ |
| REQ-DRINK-009 | D2 | `drinks.session_id` | schema | ☑ |
| REQ-DRINK-010 | D4 | `confirmDrink` rejects when target===confirmer | manual | ☑ |

## REQ-REBUY — Rebuy via Drink

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-REBUY-001 | D2 | `defaultConfig.rebuy` | manual | ☑ |
| REQ-REBUY-002 | D4 | `initiateSelfDrink` accepts `rebuyAmount` snapshot | manual | ☑ |
| REQ-REBUY-003 | D4 | `confirmDrink` credits `priceSnapshot + rebuyAmount` on finalize | manual | ☑ |
| REQ-REBUY-004 | D4 | no per-session limit enforced | manual | ☑ |
| REQ-REBUY-005 | D5 | explicit `bet_locked` flag handling | pending | ☐ |
| REQ-REBUY-006 | D4 | `balance_updated` SSE on finalize | manual | ☑ |

## REQ-RT — Real-Time

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-RT-001 | D4 | `routes/s/[id]/stream/+server.ts` | manual | ☑ |
| REQ-RT-002 | D4 | `sse/broadcaster.ts` event types (17 types) | manual | ☑ |
| REQ-RT-003 | D4 | in-process `channels: Map<sessionId, Set<Client>>` | manual | ☑ |
| REQ-RT-004 | D4 | `SseMessage = { type, payload, ts }`; clients invalidateAll() | manual | ☑ |

## REQ-UI — UI Routes

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-UI-001 | D0 / D1 | `/`, `/login`, `/register` | manual | ☑ |
| REQ-UI-002 | D2 / D3 / D4 / D5 | route tree under `/s/*` (lobby + round live; drinks/stats pending) | manual | ◐ |
| REQ-UI-003 | D0+ | all `+page.svelte` (German copy) | manual | ☑ |
| REQ-UI-004 | D0+ | Tailwind responsive utilities | manual mobile viewport | ☑ |
| REQ-UI-005 | D9 | `src/lib/components/SessionTopBar.svelte`, `src/lib/components/BottomDock.svelte`, `src/routes/s/[id]/+layout.svelte`, `src/routes/s/[id]/+layout.server.ts` | manual mobile viewport (lobby/round/drinks/stats) | ☑ |
| REQ-UI-006 | D9 | `src/lib/components/ModeForm.svelte` (kindGallery + addTemplate) | manual `/modes/new` | ☑ |
| REQ-UI-007 | D9 | `src/lib/components/ModeForm.svelte` (entity row, trackable row, PALETTE, colorFor, initialFor, scope chip toggle, hidden inputs) | manual `/modes/new` + `/modes/[id]` | ☑ |
| REQ-UI-008 | D9 | `src/lib/server/db/schema.ts` (`ModeDefaultConfig.showOdds`), `src/lib/server/modes/parseForm.ts`, `src/lib/server/modes/defaults.ts`, `src/lib/components/ModeForm.svelte` (Quoten-Toggle), `src/routes/s/[id]/round/+page.svelte` (conditional render) | manual | ☑ |
| REQ-UI-009 | D9 | `src/routes/s/[id]/round/+page.svelte` (Quick-Stake-Chips Form) | manual `/s/:id/round` | ☑ |
| REQ-UI-010 | D9 / Phase 5 | `src/routes/s/[id]/drinks/+page.server.ts` (redirect), `src/routes/s/[id]/+page.svelte` (Lobby DrinkPanel), `src/lib/components/BottomDock.svelte` (Drinks-Tab entfernt), `src/lib/components/DrinkPanel.svelte` (Buy-In/Verteilen Wording) | manual `/s/:id` + `/s/:id/drinks` Redirect | ☑ |
| REQ-UI-011 | D9 / Phase 5 | `src/routes/s/[id]/info/+page.server.ts`, `src/routes/s/[id]/info/+page.svelte`, `src/lib/components/BottomDock.svelte` (Wettinfos-Tab) | manual `/s/:id/info` | ☑ |
| REQ-UI-012 | D9 / Phase 5 | `src/routes/s/[id]/round/+page.svelte` (Wetten rewrite: stake-row 2/5/25 % + RotateCcw reset, per-outcome Setzen-Button, kein eyebrow/predicate-subtext, Starten/Abrechnen + GM-Disclosure) | manual `/s/:id/round` | ☑ |
| REQ-UI-013 | D9 / Phase 5 | `src/lib/components/SessionTopBar.svelte` (minimal: back + pills + prominenter Balance-Chip), `src/routes/s/[id]/+layout.svelte` | manual mobile viewport | ☑ |
| REQ-UI-014 | D9 / Phase 5 | `src/routes/s/[id]/+layout.server.ts` (ENDED-redirect zu /stats), `src/routes/s/[id]/+layout.svelte` (kein BottomDock wenn isEnded), `src/lib/components/SessionTopBar.svelte` (Beendet-Pill), `src/routes/s/[id]/+page.server.ts` (endSession → redirect '/'), `src/routes/+page.svelte` (Aktiv vs. Beendet Listen) | manual `/s/:id` nach endSession, `/` mit gemischten Sessions | ☑ |
| REQ-UI-015 | D9 / Phase 5 | `src/routes/modes/new/+page.server.ts` (redirect '/modes'), `src/routes/modes/[id]/+page.server.ts` (redirect '/modes' bereits vorhanden) | manual `/modes/new` + `/modes/[id]` save | ☑ |
| REQ-UI-016 | D9 / Phase 5c | `src/lib/components/DrinkPanel.svelte` (`confirmProgress` helper, `.confirm-chip` / `.confirm-host-required` Styles) | manual `/s/:id` Drink-Panel mit allen drei confirmationModes | ☑ |
| REQ-UI-017 | D9 / Phase 5c | `src/routes/+page.svelte` (`<details>` für Beendet-Sektion) | manual `/` mit ENDED-Sessions | ☑ |
| REQ-UI-018 | D9 / Phase 5c | `src/routes/s/[id]/+page.svelte` (kombinierter Beenden-&-Löschen-Button mit confirm()), `src/routes/s/[id]/+page.server.ts` (deleteSession Action bleibt) | manual Host Session löschen | ☑ |
| REQ-UI-019 | Phase 6 | `src/routes/modes/[id]/graphs/+page.{server.ts,svelte}`, `src/routes/modes/[id]/+page.svelte` (Discovery-Link) | manual | ◑ |
| REQ-UI-020 | Phase 6 | `src/lib/graph/{validate,preview,compile}.ts`, `src/lib/server/repos/markets.ts` (`instantiateBetGraphs` log-and-skip) | `src/lib/graph/graph.test.ts` | ◑ |
| REQ-UI-021 | Phase 7 | `src/lib/graph/GraphCanvas.svelte`, `src/routes/modes/[id]/graphs/+page.svelte` (integration) | manual visual | ◑ |
| REQ-UI-022 | Phase 10 | `src/lib/graph/GraphCanvas.svelte` (zentriertes Reihen-Layout, schmale Cards, Pin-getriebenes Add via `suggestionsForInput`/`suggestionsForOutput`) | manual visual | ◑ |
| REQ-UI-023 | Phase 10 | `src/routes/s/[id]/round/+page.server.ts` (`?/syncBetGraphs`), `src/routes/s/[id]/round/+page.svelte` (Recovery-Empty-State) | manual | ◑ |

## REQ-GM — Game Master Tools

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-GM-001 | D3 | mode/session config form (per-Session edit deferred) | manual | ◐ |
| REQ-GM-002 | D3 | `/s/[id]/round` HOST market creation UI | manual | ☑ |
| REQ-GM-003 | D3 | `/s/[id]/round` HOST pending-event queue (confirm/cancel) | manual | ☑ |
| REQ-GM-004 | D4 | drink confirm/cancel + balance-adjust UI (pending) | pending | ☐ |

## REQ-STAT — Stats

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-STAT-001 | D5 | `repos/stats.ts:getSessionLeaderboard` + `/stats` podium | manual | ☑ |
| REQ-STAT-002 | D5 | `getMySessionStats` (ROI, hit-rate, drinks) | manual | ☑ |
| REQ-STAT-003 | D5 | `getRoundHistory` + history list in UI | manual | ☑ |

## REQ-DATA — Data

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-DATA-001 | D2 / D3 | `src/lib/server/db/schema.ts`; migrations 0001..0003 | drizzle-kit generate | ☑ |
| REQ-DATA-002 | D2+ | integer columns everywhere | type review | ☑ |
| REQ-DATA-003 | D2+ | `timestamptz` everywhere | schema review | ☑ |
| REQ-DATA-004 | D2 / D3 | jsonb columns (trackables, predicate, terminology, …) | manual | ☑ |
| REQ-DATA-005 | D3 | `onDelete: cascade` FKs incl. round_events / bet_markets / bet_outcomes / bets | manual | ☑ |

## REQ-INFRA — Infra

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-INFRA-001 | D0 | `docker-compose.yml` | manual `docker compose up` | ☑ |
| REQ-INFRA-002 | D0 / D2 / D3 | `drizzle.config.ts`; `docker cp`+`psql -f` workflow | manual | ☑ |
| REQ-INFRA-003 | D7 | `Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`, `.env.prod.example`, `routes/healthz/+server.ts`, `.github/workflows/deploy.yml`, `DEPLOY.md` | smoke `/healthz` | ☑ |
| REQ-INFRA-PWA | D6 | `src/service-worker.ts`, `@fontsource/*`, `static/manifest.webmanifest` | manual | ☑ |

## REQ-TEST — Testing

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-TEST-001 | D3+ | Vitest suites: `predicate.test.ts`, `payout.test.ts`, `jwt.test.ts`, `password.test.ts` (30/30 green) | self | ◐ (drinks pending) |
| REQ-TEST-002 | D5+ | Playwright suites (pending) | pending | ☐ |
| REQ-TEST-003 | D3+ | per-test fixtures define custom modes; no shared marble fixture | self | ☑ |
