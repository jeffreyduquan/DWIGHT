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
| REQ-MODE-001 | D2 / Phase 30 | `sessions.modeId` FK NOT NULL, `repos/sessions.ts` (`createSession` + `switchSessionMode`) | manual | ◐ |
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
| REQ-DRINK-006 | D4 / Phase 11.2 | `confirmDrink` GM/PEERS rule, `drizzle/0007_confirmation_mode_2vals.sql`, `scripts/check-confirmation-mode.mjs` | `drinks.confirmation.test.ts` | ☑ |
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
| REQ-DRINK-011 | Phase 11 | `src/lib/drinks/lock.ts` (`effectiveLockMode`, `isLockedByDrinks`, `timerSecondsRemaining`), `src/lib/server/repos/bets.ts` (lazy timer check), `src/lib/server/repos/drinks.ts` (`betLocked` nur bei `lockMode === 'LOCK'`) | `src/lib/drinks/lock.test.ts` | ☑ |
| REQ-DRINK-012 | Phase 11 | `src/routes/s/create/+page.server.ts` (kein `isAdmin`-Gate mehr) | manual | ☑ |
| REQ-UI-022 (Phase 11) | Phase 11 | `src/routes/+page.svelte` (Empty-State + große `.create-bubble`) | manual visual | ☑ |
| REQ-UI-023 (Phase 11) | Phase 11 | `src/lib/components/QrCode.svelte`, `src/routes/s/[id]/+page.svelte` (QR-Sektion), `src/routes/s/join/+page.server.ts` (`?code=` prefill) | manual visual | ☑ |
| REQ-UI-024 | Phase 11 | `src/lib/components/DrinkPanel.svelte` (scrollable Listen, `.drink-mine` Gradient, `Hourglass`-Timer-Pill) | `src/lib/drinks/lock.test.ts` (Timer-Logik) | ☑ |
| REQ-UI-025 | Phase 11 | `src/routes/s/[id]/settings/+page.{server.ts,svelte}`, `src/lib/server/repos/sessions.ts` (`updateSessionConfig`) | manual | ☑ |
| REQ-UI-026 | Phase 12 | `src/routes/s/[id]/+page.svelte` (`showQr` state + Toggle-Button neben Sound) | manual visual | ☑ |
| REQ-UI-027 | Phase 12 | `src/routes/s/create/+page.{svelte,server.ts}` (per-Entity `entityOverride__*` Inputs + Mapping in `default` Action) | manual | ☑ |
| REQ-UI-028 | Phase 12 | `src/lib/components/DrinkPanel.svelte` (3-Tab-Nav, `STACKABLE` Map, `pendingGroups` + `historyGroups` Derived, `expandedGroups` Toggle) | manual | ☑ |
| REQ-UI-029 | Phase 12 | `src/routes/s/[id]/round/+page.{svelte,server.ts}` (Settle-Modal, `settleBuckets` derived, `?/decideAndSettle` Action) | manual | ☑ |
| REQ-SESS-CONFIG-001 | Phase 11 | `src/lib/server/db/schema.ts` (`LockMode`, `ModeDefaultConfig` extensions), `src/lib/server/modes/defaults.ts`, `src/lib/drinks/lock.ts` (`effectiveLockMode` legacy fallback) | `src/lib/drinks/lock.test.ts` | ☑ |
| REQ-SESS-CONFIG-002 | Phase 11 | `src/routes/s/[id]/{+page,round/+page,info/+page}.server.ts` (entity-name override mapping), `src/lib/entities/names.ts` (`displayEntityName`/`applyOverrides`/`applyOverridesToText`), `src/routes/s/[id]/round/+page.server.ts` (market title + outcome label rewrite via `applyOverridesToText`) | `src/lib/entities/names.test.ts` | ☑ |
| REQ-SESS-CONFIG-003 | Phase 11 | `src/lib/server/repos/sessions.ts` (`updateSessionConfig`) | manual | ☑ |

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
| REQ-STAT-004 | Phase 12 | `src/lib/server/repos/stats.ts` (`drinksByType` SQL aggregate), `src/routes/s/[id]/stats/+page.svelte` (3-col Tile Schlücke/Shots/Exen) | manual | ☑ |
| REQ-UI-030 | Phase 13 | `src/routes/s/[id]/round/+page.svelte` (inline cancel button, kein `<details>`) | manual | ☑ |
| REQ-UI-031 | Phase 13 | `src/routes/s/create/+page.svelte` + `+page.server.ts` (minStake, showOdds, peerConfirmations, lock, rebuy, entityOverrides) | manual | ☑ |
| REQ-UI-032 | Phase 13 | `src/lib/components/ModeForm.svelte`, `src/routes/s/[id]/settings/+page.svelte`, `src/routes/s/create/+page.svelte` (`{#if confirmationMode==='PEERS'}`) | manual | ☑ |
| REQ-UI-033 | Phase 13 | `src/routes/s/[id]/+page.svelte` (QR-Panel mt-3 unter Buttonreihe) | manual | ☑ |
| REQ-MODE-007 | Phase 13 | `src/lib/server/modes/defaults.ts` (peerConfirmationsRequired:1, rebuy.amount:1500) | manual | ☑ |
| REQ-MODE-008 | Phase 14 | `src/lib/server/repos/modes.ts` (ModeInUseError, 23503 catch), `src/routes/modes/[id]/+page.server.ts` (409 statt 500) | manual | ☑ |
| REQ-MODE-009 | Phase 14 | `src/lib/server/modes/defaults.ts` (startingMoney:2000) | manual | ☑ |
| REQ-ECON-002 | Phase 14 | `src/lib/server/db/schema.ts` (maxStakePctOfStart), `src/lib/server/repos/bets.ts` (STAKE_ABOVE_MAX), `src/lib/server/modes/{defaults,parseForm}.ts`, `src/lib/components/ModeForm.svelte`, `src/routes/s/create/+page.{svelte,server.ts}`, `src/routes/s/[id]/settings/+page.{svelte,server.ts}` | manual | ☑ |
| REQ-UI-034 | Phase 14 | `src/lib/components/DrinkPanel.svelte` (unified list im `list`-Tab, max-h-[28rem] overflow-y-auto) | manual | ☑ |
| REQ-UI-035 | Phase 14 | `src/routes/s/[id]/+page.svelte` (Settings-Toggle im Footer neben QR/Sound) | manual | ☑ |
| REQ-UI-036 | Phase 14 | `src/routes/s/[id]/+page.svelte` (StateBadge), `src/routes/s/[id]/+page.server.ts` (`currentRound` im Load) | manual | ☑ |
| REQ-UI-037 | Phase 14 | `src/routes/s/[id]/round/+page.svelte` (setStake, Number-Input, Slider, Reset, 2/5/25% Quick-Set-Buttons, maxStakeAllowed) | manual | ☑ |
| REQ-UI-038 | Phase 15 | `src/lib/server/repos/modes.ts` (`listSessionsUsingMode`, blockers on `ModeInUseError`), `src/routes/modes/[id]/+page.{server.ts,svelte}` (blocker list rendered) | manual | ☑ |
| REQ-UI-039 | Phase 15 | `src/routes/s/[id]/round/+page.svelte` (slider `step=max(1,round(startingMoney/100))`) | manual | ☑ |
| REQ-DRINKS-007 | Phase 15 | `src/lib/drinks/lock.ts` (oldestAge), `src/lib/drinks/lock.test.ts` (10 statt 30) | vitest | ☑ |
| REQ-RT-005 | Phase 15 | `src/routes/s/[id]/+page.svelte` (zusätzliche SSE-Listener `round_live`/`round_settled`/`round_cancelled`) | manual | ☑ |
| REQ-UI-040 | Phase 16 | `src/routes/s/[id]/round/+page.svelte` (Quick-Set-Buttons entfernt, `.stake-number text-center`) | manual | ☑ |
| REQ-MODE-010 | Phase 16 | `drizzle/0008_bump_mode_defaults.sql`, `drizzle/meta/_journal.json`, `src/lib/server/modes/parseForm.ts` | manual | ☑ |
| REQ-DRINKS-008 | Phase 16 | `src/routes/s/[id]/+page.svelte`, `src/routes/s/[id]/round/+page.svelte` (`drink_initiated` → `navigator.vibrate(2000)` wenn `targetUserId === me.userId`) | manual | ☑ |
| REQ-MODE-011 | Phase 17 | `src/lib/components/ModeForm.svelte` (rewrite: name+entities+trackables only), `src/lib/server/modes/parseForm.ts` (auto-slug, defaults), `src/routes/modes/new/+page.server.ts` + `src/routes/modes/[id]/+page.server.ts` (auto-suffix on slug collision) | manual | ☑ |
| REQ-UI-041 | Phase 17 | `src/routes/modes/+page.svelte`, `src/routes/s/create/+page.svelte`, `src/routes/s/[id]/info/+page.svelte` (Literal `Spieler`), `src/lib/server/modes/parseForm.ts` (`DEFAULT_TERMINOLOGY`) | manual | ☑ |
| REQ-MODE-012 | Phase 17 | `src/routes/s/create/+page.svelte` (`SESSION_DEFAULTS` const), `src/routes/s/create/+page.server.ts` (`freshModeDefaultConfig()` fallback, kein `mode.defaultConfig` mehr konsultiert) | manual | ☑ |
| REQ-MODE-013 | Phase 18a | `drizzle/0009_drop_mode_slug.sql`, `drizzle/meta/_journal.json`, `src/lib/server/db/schema.ts` (slug-Spalte + uniqueIndex entfernt), `src/lib/server/repos/modes.ts` (`findBySlug` entfernt, `duplicateMode` ohne Slug-Suffix), `src/lib/server/modes/parseForm.ts` (kein Slug-Feld mehr), `src/routes/modes/new/+page.server.ts`, `src/routes/modes/[id]/+page.server.ts`, `src/routes/modes/+page.server.ts` | manual | ☑ |
| REQ-MODE-014 | Phase 19c | `drizzle/0010_drop_mode_unused_cols.sql`, `drizzle/meta/_journal.json`, `src/lib/server/db/schema.ts` (Spalten + `ModeTerminology` entfernt), `src/lib/server/repos/modes.ts` (`CreateModeInput` schmal + `duplicateMode` ohne Terminology/Config), `src/lib/server/modes/parseForm.ts` (kein `description`/`terminology`/`defaultConfig`), `src/routes/s/[id]/+page.server.ts`, `src/routes/s/[id]/info/+page.server.ts` | manual | ☑ |
| REQ-MODE-015 | Phase 30 | `src/lib/server/repos/sessions.ts` (`switchSessionMode`), `src/lib/server/repos/betGraphs.ts` (`countByModeIds`), `src/lib/server/sse/broadcaster.ts` (`mode_switched`), `src/routes/s/[id]/+page.server.ts` (`?/switchMode`, `availableModes` with `betGraphCount`), `src/routes/s/[id]/+page.svelte` (Mode-Picker UI with bet-graph count + warning) | vitest + manual | ☑ |
| REQ-MODE-007 (auto-sync) | Phase 30h | `src/routes/s/[id]/round/+page.server.ts` (`createRound` auto-syncs empty bet-graph snapshot from mode), `src/routes/s/create/+page.server.ts` (mode picker shows bet-graph count), `src/routes/s/create/+page.svelte` (warning for 0-graph modes), `src/routes/s/[id]/round/+page.svelte` (improved empty-state UX) | manual | ☑ |
| REQ-MODE-007 (auto-gen) | Phase 30i | `src/lib/server/modes/autoGraphs.ts` (`autoGenerateDefaultGraphs`), `src/routes/modes/new/+page.server.ts` (calls auto-gen on create), `src/routes/modes/[id]/+page.server.ts` (calls auto-gen on save), `src/routes/s/[id]/round/+page.server.ts` (`syncBetGraphs` + `createRound` call auto-gen before snapshot) | manual | ☑ |
| REQ-BET-020 | Phase 18b | `src/lib/graph/templates.ts` (7 Templates + `buildGraph` + `findTemplate`), `src/lib/graph/templates.test.ts` (8 Smoke-Tests) | vitest | ☑ |
| REQ-BET-021 | Phase 18b | `src/lib/graph/compile.ts` (`buildRaceOutcomes` mit N>1 Pfad), `src/lib/graph/graph.test.ts` (Test "race_to_threshold N>1") | vitest | ☑ |
| REQ-BET-022 | Phase 18b | `src/lib/graph/validate.ts` (`isNumberToTime` Coercion-Exception) | vitest (templates.test.ts) | ☑ |
| REQ-BET-023 | Phase 20a | `src/lib/graph/templates.ts` (`ENTITY_SCOPE_REQUIRED` Set + `templateRequiresEntityScope()`), `src/routes/modes/[id]/+page.svelte` (`compatibleTrackables` `$derived` + Warnhinweis bei leerer Liste) | manual | ☑ |
| REQ-BET-024 | Phase 21 | `src/lib/server/db/schema.ts` (`BetGraph v2`, `GraphNodePos`, `GRAPH_GRID_COLS/ROWS`), `drizzle/0011_graph_2_reset.sql`, `drizzle/meta/_journal.json`, `src/routes/modes/[id]/graphs/+page.server.ts` (`parseGraphJson` rejectet version!=2) | vitest | ☑ |
| REQ-BET-025 | Phase 21 | `src/lib/server/db/schema.ts` (`GraphNodeKind` 13 Core), `src/lib/graph/catalog.ts` (`CORE_KINDS`, `NODE_CATALOG`, `FAMILY_*`), `src/lib/graph/validate.ts` (`Entity→EntityList` Coercion) | `graph.test.ts` validate cases | ☑ |
| REQ-BET-026 | Phase 21 | `src/lib/graph/catalog.ts` (`ADVANCED_KINDS` + `advanced: true` Specs), `src/lib/graph/compile.ts` (delta/abs + first_occurrence/entity Reject-Pfade), `src/lib/graph/SlotGraphEditor.svelte` (Erweitert-Toggle in Sidebar) | `graph.test.ts` advanced cases | ☑ |
| REQ-BET-027 | Phase 21 | `src/lib/graph/compile.ts` (`buildWinnerFromRank`, `buildPodiumFromRank`, `compileBoolean`, `compileCounterExpr`, `compileTimestampExpr`, `cmpFromOp`), `src/lib/graph/graph.test.ts` (16 compileGraph cases) | vitest | ☑ |
| REQ-BET-028 | Phase 21 | `src/lib/graph/templates.ts` (7 v2-Builder mit `pos`), `src/lib/graph/templates.test.ts` (7 build+validate+compile smokes), Routes ohne `direction`-Param (`+page.server.ts`, `graphs/new/+page.server.ts`) | vitest | ☑ |
| REQ-UI-042 | Phase 18b | `src/routes/modes/[id]/graphs/new/+page.server.ts`, `src/routes/modes/[id]/graphs/new/+page.svelte` (Lucide-Cards + dynamisches Form) | manual | ☑ |
| REQ-UI-043 | Phase 18c | `src/routes/modes/[id]/+page.server.ts` (lädt `listByMode`, `deleteGraph`-Action), `src/routes/modes/[id]/+page.svelte` (Wetten-Section + CTAs) | manual | ☑ |
| REQ-UI-044 | Phase 18d | `src/lib/graph/catalog.ts` (`ENUM_LABELS` + `enumLabel()`), `src/lib/graph/GraphCanvas.svelte` (`enumLabel(p.name, v)` in enum-Options) | manual | ☑ |
| REQ-UI-045 | Phase 18e | `src/lib/graph/catalog.ts` (`advanced?` Flag auf `now`/`first_occurrence`/`delta`/`between`/`time_compare`/`not`/`if_then`/`sequence_match`), `src/lib/graph/GraphCanvas.svelte` (`showAdvanced` State + Filter in `suggestionsForInput`/`suggestionsForOutput`/`SOURCE_NODES` + Checkbox in beiden Sheet-Headern) | manual | ☑ |
| REQ-UI-046 | Phase 19a | `src/routes/modes/[id]/+page.svelte` (Inline-Modal + Picker), `src/routes/modes/[id]/+page.server.ts` (`createGraphFromTemplate` Action) | manual | ☑ |
| REQ-UI-047 | Phase 19b | `src/lib/graph/outcomeIcon.ts` (Helper), `src/routes/modes/[id]/+page.server.ts` (`icon` im Load), `src/routes/modes/[id]/+page.svelte` (Icon-Bubble + `?edit=` Link), `src/routes/modes/[id]/graphs/+page.svelte` (`$effect` liest `page.url.searchParams.get('edit')` + ruft `startEdit`) | manual | ☑ |
| REQ-UI-048 | Phase 20a | `src/lib/components/ModeForm.svelte` (Section-4 entfernt, Headlines "Entitäten"/"Events", Button "einzel"), `src/routes/modes/[id]/+page.svelte` ("Frei zeichnen" entfernt, Modal-Title "Entität wählen"), `src/routes/modes/+page.svelte` ("N Entitäten"), `src/routes/modes/[id]/graphs/new/+page.svelte` ("Entität wählen"), `src/lib/graph/templates.ts` (Field-Label/Errors/Title-Fallback auf "Entität") | manual | ☑ |
| REQ-UI-049 | Phase 21 | `src/lib/graph/SlotGraphEditor.svelte` (4-Region Grid-Layout, Catalog 280px, Inspector 320px, Statusbar) | manual | ☑ |
| REQ-UI-050 | Phase 21 | `src/lib/graph/SlotGraphEditor.svelte` (HTML5 DnD Sidebar→Canvas, Move existierender Tiles, Wire-Drag via Pointer-Events, `canConnect`, `findFreeSlotNear` Spiral-Search) | manual | ☑ |
| REQ-UI-051 | Phase 21 | `src/lib/graph/SlotGraphEditor.svelte` (Bezier-Path-Builder, Klick-zum-Löschen, `PIN_COLORS`/`FAMILY_COLORS` aus Catalog) | manual | ☑ |
| REQ-UI-052 | Phase 21 | `src/lib/graph/SlotGraphEditor.svelte` (`onkeydown` Handler: Entf/Backspace löscht, Ctrl+D dupliziert) | manual | ☑ |
| REQ-UI-053 | Phase 21 | `src/lib/components/Icon.svelte` (Lucide-Dispatcher), `src/lib/graph/catalog.ts` (`icon`-Feld pro Spec), `src/lib/graph/outcomeIcon.ts` (Trophy/CheckCircle2/Medal/Sparkles) | manual | ☑ |
| REQ-UI-054 | Phase 21 | `src/lib/graph/preview.ts` (`previewSentence` via `inputSource` + `result`-Pin), `src/lib/graph/graph.test.ts` (previewSentence cases) | vitest | ☑ |
| REQ-UI-055 | Phase 21 | `src/lib/graph/SlotGraphEditor.svelte` (kein `transform: scale`, nur `overflow: auto` auf Canvas) | manual | ☑ |
| REQ-UI-056 | Phase 22 | `src/routes/modes/[id]/+page.svelte` ("Eigene Wette bauen" Outline-Button unter Template-CTA, verlinkt `/modes/[id]/graphs`) | manual | ☑ |
| REQ-UI-057 | Phase 22 | `src/lib/graph/SlotGraphEditor.svelte` `<style>`-Block (DaisyUI-CSS-Vars `--color-base-*`/`--color-primary`/`color-mix`) | manual | ☑ |
| REQ-UI-058 | Phase 22 | `src/lib/graph/SlotGraphEditor.svelte` (`mobileCatalogOpen`/`mobileInspectorOpen` $state, `mobile-only` Toggle-Buttons in Statusbar, `@media (max-width: 767px)` Drawer-Layout), `src/lib/components/Icon.svelte` (X/Menu/Settings2), `src/lib/graph/grid.ts` (build-fix: Konstanten raus aus `$lib/server`) | manual | ☑ |
| REQ-UI-059 | Phase 23 | `src/lib/graph/SlotGraphEditor.svelte` (`spawnFromCatalog(kind)` Helper, `onclick` auf `.catalog-item` Button, `mobileCatalogOpen=false` nach Spawn) | manual | ☑ |
| REQ-UI-060 | Phase 23 | `src/lib/graph/SlotGraphEditor.svelte` (`visibleCols`/`visibleRows` $derived, ersetzt `COLS`/`ROWS` in `.canvas-grid`/`.grid-dots`/`.wires` width+height) | manual | ☑ |
| REQ-UI-061 | Phase 23 | `src/routes/modes/[id]/+page.svelte` (Wetten-Section: `mt-8` → `mt-4 border-t border-base-300 pt-4`) | manual | ☑ |
| REQ-UI-062 | Phase 24 | `src/lib/graph/SlotGraphEditor.svelte` (`SLOT_W/H`=140/80, `TILE_W/H`=120/60) | manual | ☑ |
| REQ-UI-063 | Phase 24 | `src/lib/graph/SlotGraphEditor.svelte` (`spawnFromCatalog` column-major scan) | manual | ☑ |
| REQ-UI-064 | Phase 24 | `src/lib/graph/SlotGraphEditor.svelte` (`.editor-grid grid-template-columns: 200px 1fr 240px`, `.catalog-item` padding/font) | manual | ☑ |
| REQ-UI-065 | Phase 25 | `src/lib/graph/SlotGraphEditor.svelte` (`pendingOutPin` $state, `onOutputPinClick`/`onInputPinClick`, `.pin.tap-active` + `.pin.tap-target` styles, Escape/canvas-click resets) | manual | ☑ |
| REQ-UI-066 | Phase 26 | `src/lib/graph/SlotGraphEditor.svelte` (`.editor-root grid-template-columns: 200px 1fr`, `.inspector` als `position: absolute` overlay, `.inspector.visible { transform: translateX(0) }`, `.inspector .mobile-drawer-head { display: flex }` für Desktop-Close, X-Click cleart selectedNodeId) | manual | ☑ |
| REQ-UI-067 | Phase 26 | `src/lib/graph/SlotGraphEditor.svelte` (`pinPopover` $state, `compatibleKinds`/`compatibleExistingPins`/`spawnAndWireFromPopover`/`connectFromPopover` Helper, `.pin-popover` Markup im canvas-grid, `.pin-popover*` CSS) | manual | ☑ |
| REQ-UI-068 | Phase 26 | `src/routes/modes/[id]/+page.svelte` (`templateAvailable()` Helper, `disabled` + Tooltip auf inkompatiblen Template-Buttons, `badge-ghost badge-xs` "einzel" auf Templates mit `templateRequiresEntityScope`) | manual | ☑ |
| REQ-UI-069 | Phase 27 | `src/lib/components/ModeForm.svelte` (`pb-24` aus `<form>` entfernt), `src/routes/modes/[id]/+page.svelte` + `src/routes/modes/new/+page.svelte` (`pt-8 pb-24` am Page-Wrapper) | manual | ☑ |
| REQ-UI-070 | Phase 27 | `src/lib/graph/SlotGraphEditor.svelte` (`class:empty={graph.nodes.length === 0}` an `.canvas-scroll`, `.canvas-scroll.empty { overflow-x: hidden }` + `.canvas-scroll.empty .canvas-grid { width: 100% !important; min-width: 100% }`) | manual | ☑ |
| REQ-UI-071 | Phase 27 | `src/lib/graph/SlotGraphEditor.svelte` (`.editor-root grid-template-columns: 1fr`, `.catalog` als `position: absolute; transform: translateX(-100%); transition`, `.catalog.mobile-open { transform: translateX(0) }`, `.mobile-only` und `.mobile-drawer-head` immer sichtbar; alte `@media (max-width: 767px)` Drawer-Logik entfernt) | manual | ☑ |
| REQ-UI-072 | Phase 27 | `src/routes/modes/[id]/+page.svelte` (`selectedTrackableId` $state, `selectedTrackable` $derived, `trackableCompatibleTemplates` $derived, `personalizedTitle(tplId, label)` Helper; Picker-UI als 2-Step Wizard mit Trackable→Template→Form; hidden input für Trackable in Form) | manual | ☑ |
| REQ-UI-073 | Phase 28 | `src/lib/graph/templates.ts` (TemplateId-Union erweitert um `finish_first`, `finish_last`, `count_zero`, `count_less_than`, `count_more_than`; neue `buildCountCompare()` builder; `ENTITY_SCOPE_REQUIRED` erweitert; icon-union erweitert um `X`, `Minus`, `Hash`), `src/routes/modes/[id]/+page.svelte` (`TPL_ICONS` + `personalizedTitle()` für neue IDs), `src/routes/modes/[id]/graphs/new/+page.svelte` (`ICONS` für neue IDs) | manual | ☑ |
| REQ-UI-074 | Phase 29 | `src/lib/graph/SlotGraphEditor.svelte` (`pinY` → `pinX`, `inputPinPos`/`outputPinPos` umgeschrieben auf vertikalen Flow, `bezierPath` mit `dy`, Pin-DOM `style:left` statt `style:top`, CSS `.pin-in {top}` / `.pin-out {bottom}`, Pin-Popover-Positionierung angepasst) | manual | ☑ |
| REQ-UI-075 | Phase 29 | `src/lib/graph/SlotGraphEditor.svelte` (neue `setNodeProp()` Helper, `.tile-body` rendert editierbares Control je nach `prop.kind` mit `+N`-Badge für weitere Properties, Click/Pointerdown/Dragstart-Propagation gestoppt, CSS `.tile-input`/`.tile-checkbox`/`.tile-more`) | manual | ☑ |
| REQ-UI-076 | Phase 29 | `src/lib/components/ModeForm.svelte` (Farb-Avatare bei Entity/Trackable entfernt), `src/routes/s/[id]/info/+page.svelte` (Lobby-Badges entfernt), `src/routes/s/create/+page.svelte` (Default-Entity Farbpunkt und Emoji entfernt), `src/routes/s/[id]/round/+page.svelte` (Entity-Button border-color und Trackable-Emoji entfernt), `src/routes/modes/[id]/+page.svelte` und `src/routes/modes/[id]/graphs/new/+page.svelte` (Trackable-Select Emoji-Präfix entfernt) | manual | ☑ |

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
