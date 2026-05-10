# DWIGHT

> The programmable drinking-game framework.
> Wetten. Trinken. Gewinnen.

DWIGHT is a generic, mode-driven betting and drinking game. The Game Master defines the game (entities, rounds, bet templates), the players bet money on outcomes with live-quoted sportsbook odds, and a parallel drink economy lets players cash out money by drinking — three tiers, configurable prices.

Marble racing is one shipped example Mode (`murmelrennen-standard`). Anything else — card games, dart matches, prediction games — drops in by registering a new Mode.

---

## Docs

- [REQUIREMENTS.md](REQUIREMENTS.md) — full functional spec (REQ-* IDs)
- [SPRINT_PLAN.md](SPRINT_PLAN.md) — sprint-by-sprint delivery plan (D0–D7)
- [TRACEABILITY.md](TRACEABILITY.md) — req → artefact → test matrix
- [UI_UX.md](UI_UX.md) — brand voice, theme, components, screens, motion

---

## Stack

- SvelteKit 2 + Svelte 5 (runes)
- TypeScript strict
- Tailwind 4 + DaisyUI 5 (custom theme `dwight`)
- Drizzle ORM + PostgreSQL 16
- Vitest + Playwright
- jose (JWT), @node-rs/argon2 (password hashing)
- pnpm

---

## Status

Pre-D0. The workspace currently contains specifications only. Code lands in D0 (scaffold).
