# DWIGHT — Traceability

> Living matrix mapping every requirement (REQUIREMENTS.md) to the sprint that delivers it, the artefacts that implement it, and the tests that prove it.
>
> Status legend: ☐ pending · ◐ in progress · ☑ done

---

## REQ-BRAND — Identity & Branding

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-BRAND-001 | D0 | `src/app.html`, `package.json` (`name=dwight`) | manual visual | ☐ |
| REQ-BRAND-002 | D0 | (no copy) | n/a | ☐ |
| REQ-BRAND-003 | D0 | `src/routes/layout.css` (theme `dwight`) | manual visual | ☐ |
| REQ-BRAND-004 | D0 | `src/app.html` font links, `layout.css` font tokens | manual visual | ☐ |
| REQ-BRAND-005 | D0 | `src/lib/components/Logo.svelte` | manual visual | ☐ |
| REQ-BRAND-006 | D0 / D6 | `static/manifest.webmanifest`, `app.html` viewport+theme-color | Lighthouse PWA | ☐ |
| REQ-BRAND-007 | D0+ | all `+page.svelte` files | Playwright copy spot-checks | ☐ |

## REQ-AUTH — Authentication & Accounts

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-AUTH-001 | D1 | `src/lib/server/auth/validation.ts`, register form | `validation.test.ts` | ☐ |
| REQ-AUTH-002 | D1 | `src/lib/server/auth/password.ts` | `password.test.ts` | ☐ |
| REQ-AUTH-003 | D1 | `auth/jwt.ts`, `auth/cookie.ts`, `hooks.server.ts` | `jwt.test.ts` | ☐ |
| REQ-AUTH-004 | D1 | `auth/rateLimit.ts`, login action | `rateLimit.test.ts` | ☐ |
| REQ-AUTH-005 | D1 | `routes/logout/+server.ts` | Playwright `auth.spec.ts` | ☐ |
| REQ-AUTH-006 | D1 | `hooks.server.ts` redirect logic | Playwright `auth.spec.ts` | ☐ |
| REQ-AUTH-007 | D1 | `users` schema, `repos/users.ts` | unique constraint test | ☐ |

## REQ-MODE — Modes

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-MODE-001 | D2 | `sessions.modeId` FK NOT NULL, `repos/sessions.ts` | `sessions.test.ts` | ☐ |
| REQ-MODE-002 | D2 | `modes` table | seed test | ☐ |
| REQ-MODE-003 | D2 | `modes` schema (terminology, defaultEntities, allowedBetTemplates, defaultConfig) | seed test | ☐ |
| REQ-MODE-004 | D2 | `src/lib/server/db/seed.ts` | seed test (slug exists) | ☐ |
| REQ-MODE-005 | D2 | `routes/s/create/+page.svelte` Mode picker | Playwright `create-session.spec.ts` | ☐ |
| REQ-MODE-006 | D2 / D5 | `src/lib/utils/useTerminology.ts` | unit test | ☐ |

## REQ-ENT — Entities

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ENT-001 | D2 | `entities` table, session-create entity insert | `entities.test.ts` | ☐ |
| REQ-ENT-002 | D2 | `entities` schema | unit | ☐ |
| REQ-ENT-003 | D3 | `routes/s/[id]/round/host/+page.svelte` entity editor | Playwright | ☐ |

## REQ-ROUND — Rounds

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ROUND-001 | D3 | `rounds` schema (status enum), `repos/rounds.ts:transitionStatus` | `rounds.test.ts` | ☐ |
| REQ-ROUND-002 | D3 | host-only guards in `/round/host` actions | Playwright | ☐ |
| REQ-ROUND-003 | D3 | `placeBet.ts` status check | `placeBet.test.ts` | ☐ |
| REQ-ROUND-004 | D3 | `round_outcomes` schema, `resolveRound.ts` | `resolveRound.test.ts` | ☐ |
| REQ-ROUND-005 | D3 | invariant in `createRound` | `rounds.test.ts` | ☐ |

## REQ-BET — Bet Templates

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-BET-001 | D3 | `bets/templates/winner.ts` | `winner.test.ts` | ☐ |
| REQ-BET-002 | D3 | `bets/templates/loser.ts` | `loser.test.ts` | ☐ |
| REQ-BET-003 | D3 | `bets/templates/topN.ts` | `topN.test.ts` | ☐ |
| REQ-BET-004 | D3 | `bets/templates/h2h.ts` | `h2h.test.ts` | ☐ |
| REQ-BET-005 | D3 | `bets/templates/exactRank.ts` | `exactRank.test.ts` | ☐ |
| REQ-BET-006 | D3 | `bets/templates/podiumExact.ts` | `podiumExact.test.ts` | ☐ |
| REQ-BET-007 | D3 | `bets/templates/boolean.ts` | `boolean.test.ts` | ☐ |
| REQ-BET-008 | D3 | host round-setup UI | Playwright | ☐ |
| REQ-BET-009 | D3 | `bets/templates/index.ts` registry | adding-template-without-migration test | ☐ |

## REQ-OFFER — Bet Offers

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-OFFER-001 | D3 | `bet_offers` schema | unit | ☐ |
| REQ-OFFER-002 | D3 | `economy/quotes.ts` | `quotes.test.ts` | ☐ |
| REQ-OFFER-003 | D3 | `repos/betOffers.ts` | unit | ☐ |

## REQ-ECON — Money Economy

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ECON-001 | D2 | `session_players.moneyBalance`, session-create | seed integration | ☐ |
| REQ-ECON-002 | D3 | `bets` schema (`quotedMultiplierX100`), `placeBet.ts` | `placeBet.test.ts` | ☐ |
| REQ-ECON-003 | D3 | `resolveRound.ts` (won/lost/void payout math) | `payout.test.ts` | ☐ |
| REQ-ECON-004 | D3 | PG transaction + row-level lock | `placeBet.concurrency.test.ts` | ☐ |
| REQ-ECON-005 | D3 | settled-bet immutability invariant | `bets.test.ts` | ☐ |

## REQ-ODDS — Live-Quoted Odds

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-ODDS-001 | D3 | `economy/quotes.ts` | `quotes.test.ts` | ☐ |
| REQ-ODDS-002 | D3 | `economy/quotes.ts:computeQuotes` | `quotes.test.ts` | ☐ |
| REQ-ODDS-003 | D3 | `economy/quotes.ts` (formula + minStake fallback) | `quotes.test.ts` | ☐ |
| REQ-ODDS-004 | D3 | `economy/quotes.ts` (floor) | `quotes.test.ts` | ☐ |
| REQ-ODDS-005 | D3 | `placeBet.ts` emits `quotes_updated` | SSE integration | ☐ |
| REQ-ODDS-006 | D3 | `bets.quotedMultiplierX100` is the locked snapshot | `placeBet.test.ts` | ☐ |

## REQ-DRINK — Drink Economy

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-DRINK-001 | D2 | `drink_type` enum | schema test | ☐ |
| REQ-DRINK-002 | D2 | `mode.defaultConfig.drinkPrices`, `session.config.drinkPrices` | seed test | ☐ |
| REQ-DRINK-003 | D4 | `economy/drinks.ts:initiateSelfDrink` + confirm credits target | `drinks.self.test.ts` | ☐ |
| REQ-DRINK-004 | D4 | `economy/drinks.ts:initiateForceDrink` + no-credit-on-confirm | `drinks.force.test.ts` | ☐ |
| REQ-DRINK-005 | D4 | `drinks.priceSnapshot` column | `drinks.snapshot.test.ts` | ☐ |
| REQ-DRINK-006 | D4 | `economy/drinks.ts:confirmDrink` rule dispatch | `drinks.confirmation.test.ts` | ☐ |
| REQ-DRINK-007 | D4 | `economy/drinks.ts:cancelDrink` (force refund) | `drinks.cancel.test.ts` | ☐ |
| REQ-DRINK-008 | D4 | `forceDrinkTypesAllowed` validation | `drinks.force.test.ts` | ☐ |
| REQ-DRINK-009 | D2 | `drinks.session_id` (no round FK) | schema test | ☐ |
| REQ-DRINK-010 | D4 | confirmer-≠-target check in `confirmDrink` | `drinks.confirmation.test.ts` | ☐ |

## REQ-BROKE — Broke-Lock

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-BROKE-001 | D3 | `placeBet.ts` post-debit lock check, `session_players.bet_locked` | `brokeLock.test.ts` | ☐ |
| REQ-BROKE-002 | D4 | `confirmDrink` clears lock on SELF confirm | `brokeLock.test.ts` | ☐ |
| REQ-BROKE-003 | D4 | SSE `bet_lock_changed`, UI guard in bet form | Playwright | ☐ |

## REQ-RT — Real-Time

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-RT-001 | D3 | `routes/s/[id]/stream/+server.ts` | integration | ☐ |
| REQ-RT-002 | D3 / D4 | `sse/broadcaster.ts` event types | `broadcaster.test.ts` | ☐ |
| REQ-RT-003 | D3 | in-memory channel map | unit | ☐ |
| REQ-RT-004 | D3 | event payload contracts | unit | ☐ |

## REQ-UI — UI Routes

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-UI-001 | D0 / D1 | `/`, `/login`, `/register` | Playwright | ☐ |
| REQ-UI-002 | D2 / D3 / D4 / D5 | route tree under `/s/*` | Playwright | ☐ |
| REQ-UI-003 | D0+ | all `+page.svelte` | manual + Playwright copy spot-check | ☐ |
| REQ-UI-004 | D0+ | Tailwind responsive utilities | manual mobile viewport | ☐ |

## REQ-GM — Game Master Tools

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-GM-001 | D2 / D3 | session config edit form | Playwright | ☐ |
| REQ-GM-002 | D3 | `/s/[id]/round/host` setup UI | Playwright | ☐ |
| REQ-GM-003 | D3 | outcome declaration UI per outcomeKind | Playwright | ☐ |
| REQ-GM-004 | D4 | drink confirm/cancel + balance adjust UI | Playwright + audit-log test | ☐ |

## REQ-STAT — Stats

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-STAT-001 | D5 | `repos/stats.ts:getSessionLeaderboard` | unit | ☐ |
| REQ-STAT-002 | D5 | `repos/stats.ts:getRoundHistory` | unit | ☐ |
| REQ-STAT-003 | D3 / D4 | `users.total_stats` updates inside resolve/confirm txs | integration | ☐ |

## REQ-DATA — Data

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-DATA-001 | D2 | `src/lib/server/db/schema.ts` | drizzle-kit generate | ☐ |
| REQ-DATA-002 | D2+ | integer columns everywhere | type review | ☐ |
| REQ-DATA-003 | D2+ | `timestamptz` everywhere | schema review | ☐ |
| REQ-DATA-004 | D2 | jsonb columns | unit | ☐ |
| REQ-DATA-005 | D2 | `onDelete: cascade` FKs | cascade test | ☐ |

## REQ-INFRA — Infra

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-INFRA-001 | D0 | `docker-compose.yml` | manual `docker compose up` | ☐ |
| REQ-INFRA-002 | D0 / D2 | `drizzle.config.ts`, `package.json` scripts | manual `pnpm db:push` | ☐ |
| REQ-INFRA-003 | D7 | deploy artefacts | smoke `/healthz` | ☐ |

## REQ-TEST — Testing

| Req | Sprint | Artefacts | Tests | Status |
|---|---|---|---|---|
| REQ-TEST-001 | D3 / D4 | Vitest suites | self | ☐ |
| REQ-TEST-002 | D3 / D4 | Playwright suites | self | ☐ |
| REQ-TEST-003 | D2+ | shared fixture using `murmelrennen-standard` | self | ☐ |
