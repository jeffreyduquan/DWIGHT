/**
 * @file schema.ts — Drizzle schema for DWIGHT (D3: predicate engine).
 *
 * Generic, mode-driven betting + dual-economy drinking game.
 * No hardcoded bet templates — bets are arbitrary boolean predicates over
 * counters of user-defined Trackables (e.g. "fouls", "overtakes") which are
 * either global or entity-scoped. A BetMarket is a parimutuel pool of
 * Outcomes (each outcome = predicate); winners share the pool proportionally.
 *
 * @implements REQ-DATA-001..005, REQ-AUTH-007, REQ-MODE-001..006, REQ-ENT-001..002,
 *             REQ-ROUND-001..006, REQ-TRACK-001..004, REQ-EVENT-001..004,
 *             REQ-MARKET-001..006, REQ-BET-001..004, REQ-ECON-001..005,
 *             REQ-DRINK-001..010, REQ-REBUY-001..006
 */
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// ---------- Enums ----------

export const sessionStatus = pgEnum('session_status', ['CREATED', 'ACTIVE', 'ENDED']);
export const sessionRole = pgEnum('session_role', ['HOST', 'PLAYER']);
export const roundStatus = pgEnum('round_status', [
	'SETUP',
	'BETTING_OPEN',
	'LIVE',
	'RESOLVING',
	'SETTLED',
	'CANCELLED'
]);
export const roundEventStatusEnum = pgEnum('round_event_status', [
	'PENDING',
	'CONFIRMED',
	'CANCELLED'
]);
export const betMarketStatusEnum = pgEnum('bet_market_status', [
	'OPEN',
	'LOCKED',
	'SETTLED',
	'VOID'
]);
export const trackableScopeEnum = pgEnum('trackable_scope', ['global', 'entity']);
export const drinkTypeEnum = pgEnum('drink_type', ['SCHLUCK', 'KURZER', 'BIER_EXEN']);
export const drinkOrigin = pgEnum('drink_origin', ['SELF', 'FORCE']);
export const drinkStatusEnum = pgEnum('drink_status', ['PENDING', 'CONFIRMED', 'CANCELLED']);
export const confirmerRole = pgEnum('confirmer_role', ['GM', 'PEER']);
export const confirmationModeEnum = pgEnum('confirmation_mode', ['GM', 'PEERS', 'EITHER']);

// ---------- JSONB shape types ----------

export type UserTotalStats = {
	roundsPlayed: number;
	betsWon: number;
	betsLost: number;
	moneyWon: number;
	drinksDrunk: { schluck: number; kurzer: number; bierExen: number };
	drinksDealt: { schluck: number; kurzer: number; bierExen: number };
};

const ZERO_USER_STATS: UserTotalStats = {
	roundsPlayed: 0,
	betsWon: 0,
	betsLost: 0,
	moneyWon: 0,
	drinksDrunk: { schluck: 0, kurzer: 0, bierExen: 0 },
	drinksDealt: { schluck: 0, kurzer: 0, bierExen: 0 }
};

export type DrinkPrices = { SCHLUCK: number; KURZER: number; BIER_EXEN: number };
export type DrinkType = 'SCHLUCK' | 'KURZER' | 'BIER_EXEN';
export type ConfirmationMode = 'GM' | 'PEERS' | 'EITHER';

export type ModeTerminology = {
	round: string;
	entity: string;
	startedVerb: string;
};

export type ModeDefaultEntity = {
	kind: string;
	name: string;
	attributes: Record<string, unknown>;
};

export type RebuyConfig = {
	enabled: boolean;
	drinkType: DrinkType;
	amount: number;
};

/** A user-defined countable event tracked per round. */
export type Trackable = {
	id: string; // stable slug, unique within a mode (e.g. "foul")
	label: string; // human label, e.g. "Foul"
	scope: 'global' | 'entity'; // global = one counter per round; entity = one counter per (round, entity)
	emoji?: string; // visual decoration
	color?: string; // hex
	description?: string;
};

export type ModeDefaultConfig = {
	startingMoney: number;
	minStake: number;
	drinkPrices: DrinkPrices;
	confirmationMode: ConfirmationMode;
	peerConfirmationsRequired: number;
	forceDrinkTypesAllowed: DrinkType[];
	rebuy: RebuyConfig;
	/** Auto-lock a player from betting while they have a PENDING drink. Default true. */
	autoLockOnDrink?: boolean;
};

/**
 * Market templates defined at the Mode level.
 * Auto-instantiated as concrete betMarkets when a round opens its betting phase.
 *
 * `binary_count` shape: a counter-vs-n market.
 *   - entityScope 'global'  -> one market, predicate uses entityId=null
 *   - entityScope 'each'    -> one market PER session-entity, predicate.entityId=<entity.id>
 *     (`{entity}` placeholder in title is replaced with entity.name)
 *
 * `compare_entities` shape: a many-outcome market "which entity has the highest counter".
 *   - One outcome per session-entity (entity strictly > all others)
 *   - Optional Tie outcome (NOT any-winner) if tieBehavior='tie_outcome';
 *     otherwise a tie causes the market to settle with no winners -> void/refund.
 */
export type MarketTemplate =
	| {
			kind: 'binary_count';
			id: string;
			title: string;
			trackableId: string;
			entityScope: 'global' | 'each';
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			n: number;
	  }
	| {
			kind: 'compare_entities';
			id: string;
			title: string;
			trackableId: string;
			tieBehavior: 'tie_outcome' | 'void';
			/** 'max' = wer hat am meisten (Default). 'min' = wer hat am wenigsten. */
			direction?: 'max' | 'min';
	  }
	| {
			/**
			 * Range / "Over-Under-Range" Ja/Nein-Wette:
			 * counter ∈ [nMin .. nMax] (inklusiv). Scope wie binary_count.
			 */
			kind: 'range_count';
			id: string;
			title: string;
			trackableId: string;
			entityScope: 'global' | 'each';
			nMin: number;
			nMax: number;
	  }
	| {
			/**
			 * Head-to-Head: zwei feste Entities werden direkt verglichen.
			 * Referenziert per Name (Mode-Definition kennt noch keine Session-Entity-IDs);
			 * matched zur Round-Time via entity.name. Erzeugt 2 (oder 3 mit Tie) Outcomes.
			 */
			kind: 'head_to_head';
			id: string;
			title: string;
			trackableId: string;
			entityNameA: string;
			entityNameB: string;
			tieBehavior: 'tie_outcome' | 'void';
	  }
	| {
			/**
			 * Top-K Wette: Ein Markt mit einem Outcome pro Entity. Outcome "X" gewinnt,
			 * wenn X bei den Top-K (bzw. Bottom-K wenn direction='min') landet.
			 * Mehrere Outcomes können gewinnen → parimutuel verteilt Pot auf alle K Gewinner.
			 *
			 * "X in Top-K" wird realisiert als: count_entities_where (über alle anderen)
			 * "wieviele andere haben echt mehr X? cmp lt k".
			 */
			kind: 'top_k';
			id: string;
			title: string;
			trackableId: string;
			k: number;
			direction: 'max' | 'min';
	  }
	| {
			/**
			 * Count-matching: Binärer Ja/Nein Markt. „Mindestens k von N Entities erfüllen
			 * Bedingung: counter cmp n."
			 */
			kind: 'count_matching';
			id: string;
			title: string;
			trackableId: string;
			/** inner per-entity bedingung */
			perEntityCmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			perEntityN: number;
			/** outer aggregate */
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			k: number;
	  }
	| {
			/**
			 * Team-Total: Binärer Markt. „Summe von <trackable> über die genannten
			 * Entities (Team) cmp n". Beispiel: „Team Rot hat zusammen ≥10 Tore".
			 */
			kind: 'team_total';
			id: string;
			title: string;
			trackableId: string;
			/** Namen der Entities, die zum Team gehören (resolviert bei Round-Instanziierung). */
			entityNames: string[];
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			n: number;
	  }
	| {
			/**
			 * Spread: Binärer Markt über Differenz zweier benannter Entities.
			 * „(A.trackable − B.trackable) cmp n". Beispiel: „Marco hat ≥3 Tore
			 * mehr als Jonas".
			 */
			kind: 'spread';
			id: string;
			title: string;
			trackableId: string;
			entityNameA: string;
			entityNameB: string;
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			n: number;
	  }
	| {
			/**
			 * Reihenfolge: Wer wurde als N-ter für dieses Trackable eingetragen?
			 * position=1 → Erster, position=0 → Letzter (wird bei Instantiierung
			 * auf ents.length aufgelöst). Settlement basiert auf der Log-Reihenfolge
			 * (erster CONFIRMED Event pro Entity; Duplikate ignoriert).
			 */
			kind: 'ordered_finish';
			id: string;
			title: string;
			trackableId: string;
			/** 1 = Erster, 2 = Zweiter, …, 0 = Letzter */
			position: number;
	  };

export type SessionConfig = ModeDefaultConfig;

/**
 * Predicate AST — boolean expression over counter values for a specific round.
 *
 * Leaf form:
 *   { kind: 'count', trackableId, entityId|null, cmp, n }
 *   evaluates to: counter(trackableId, entityId) cmp n
 *   where entityId === null means the GLOBAL counter (for scope='global' trackables)
 *   and entityId !== null means the per-entity counter (for scope='entity' trackables).
 *
 * Combinators: and / or / not.
 */
/**
 * CounterExpr — arithmetic expression tree over counter snapshot values.
 *
 * Forms:
 *  - `ref`: a single counter (global trackable or per-entity, with entityId).
 *    Legacy shape `{ trackableId, entityId }` without `kind` is also accepted
 *    by the evaluator and treated as `kind: 'ref'`.
 *  - `const`: a literal integer.
 *  - `sum` / `diff` / `mul` / `div`: arithmetic over an array of operands.
 *    For `diff` / `div`, evaluation is left-to-right: `a - b - c` / `a / b / c`.
 *    Division uses integer division; division by zero yields 0.
 *
 * Used inside `compare_counters` to enable team-totals, spreads, percentages
 * and other derived metrics without dedicated AST nodes.
 */
export type CounterExpr =
	| { kind: 'ref'; trackableId: string; entityId: string | null }
	| { kind: 'const'; value: number }
	| { kind: 'sum'; operands: CounterExpr[] }
	| { kind: 'diff'; operands: CounterExpr[] }
	| { kind: 'mul'; operands: CounterExpr[] }
	| { kind: 'div'; operands: CounterExpr[] };

export type Predicate =
	| {
			kind: 'count';
			trackableId: string;
			entityId: string | null;
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			n: number;
	  }
	| {
			/**
			 * Compare two counter expressions against each other.
			 * Used e.g. for "wer macht mehr X: Spieler A oder Spieler B" markets,
			 * or "team A total > team B total + 5".
			 *
			 * left/right are CounterExpr; legacy shape `{ trackableId, entityId }`
			 * without a `kind` field is accepted and treated as `kind:'ref'`.
			 */
			kind: 'compare_counters';
			left: CounterExpr | { trackableId: string; entityId: string | null };
			right: CounterExpr | { trackableId: string; entityId: string | null };
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
	  }
	| { kind: 'and'; children: Predicate[] }
	| { kind: 'or'; children: Predicate[] }
	| { kind: 'not'; child: Predicate }
	| {
			/**
			 * Count how many of the given candidate entities satisfy `child`,
			 * then compare that count via `cmp n`.
			 *
			 * Within `child`, the special entityId sentinel `'$self'` is replaced
			 * with each candidate entity's id during evaluation. This lets templates
			 * express things like "mind. 3 Spieler haben ≥1 Tor".
			 */
			kind: 'count_entities_where';
			candidates: string[];
			child: Predicate;
			cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
			n: number;
	  }
	| {
			/**
			 * True when entity `entityId` was logged (first CONFIRMED event for this
			 * trackable) at rank `position` (1-indexed) relative to all other entities.
			 * Populated via `rank:<trackableId>:<entityId>` entries in the counter
			 * snapshot computed by `getCounterSnapshot`.
			 */
			kind: 'log_rank';
			trackableId: string;
			entityId: string;
			position: number;
	  };

export type EntityAttributes = {
	color?: string;
	emoji?: string;
	imageUrl?: string;
	[k: string]: unknown;
};

// ---------- Tables ----------

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		username: text('username').notNull(),
		passwordHash: text('password_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		totalStats: jsonb('total_stats').$type<UserTotalStats>().default(ZERO_USER_STATS).notNull()
	},
	(t) => [uniqueIndex('users_username_uniq').on(t.username)]
);

export const modes = pgTable(
	'modes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		description: text('description').notNull(),
		ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
		terminology: jsonb('terminology').$type<ModeTerminology>().notNull(),
		defaultEntities: jsonb('default_entities').$type<ModeDefaultEntity[]>().notNull(),
		trackables: jsonb('trackables').$type<Trackable[]>().default([]).notNull(),
		marketTemplates: jsonb('market_templates').$type<MarketTemplate[]>().default([]).notNull(),
		defaultConfig: jsonb('default_config').$type<ModeDefaultConfig>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [uniqueIndex('modes_slug_uniq').on(t.slug)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		hostUserId: uuid('host_user_id')
			.references(() => users.id)
			.notNull(),
		modeId: uuid('mode_id')
			.references(() => modes.id)
			.notNull(),
		name: text('name').notNull(),
		inviteCode: text('invite_code').notNull(),
		status: sessionStatus('status').default('CREATED').notNull(),
		config: jsonb('config').$type<SessionConfig>().notNull(),
		// Trackables are snapshotted onto the session at creation, so changes to
		// the underlying Mode don't retro-affect an active session.
		trackables: jsonb('trackables').$type<Trackable[]>().default([]).notNull(),
		marketTemplates: jsonb('market_templates').$type<MarketTemplate[]>().default([]).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		endedAt: timestamp('ended_at', { withTimezone: true })
	},
	(t) => [uniqueIndex('sessions_invite_code_uniq').on(t.inviteCode)]
);

export const sessionPlayers = pgTable(
	'session_players',
	{
		sessionId: uuid('session_id')
			.references(() => sessions.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id')
			.references(() => users.id)
			.notNull(),
		role: sessionRole('role').default('PLAYER').notNull(),
		moneyBalance: integer('money_balance').notNull(),
		betLocked: boolean('bet_locked').default(false).notNull(),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.sessionId, t.userId] })]
);

export const entities = pgTable(
	'entities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.references(() => sessions.id, { onDelete: 'cascade' })
			.notNull(),
		kind: text('kind').notNull(),
		name: text('name').notNull(),
		attributes: jsonb('attributes').$type<EntityAttributes>().default({}).notNull(),
		orderIndex: integer('order_index').notNull()
	},
	(t) => [index('entities_session_idx').on(t.sessionId)]
);

export const rounds = pgTable(
	'rounds',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.references(() => sessions.id, { onDelete: 'cascade' })
			.notNull(),
		roundNumber: integer('round_number').notNull(),
		status: roundStatus('status').default('SETUP').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		lockedAt: timestamp('locked_at', { withTimezone: true }),
		settledAt: timestamp('settled_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('rounds_session_idx').on(t.sessionId)]
);

/**
 * Atomic counter increment events.
 * delta is always +1 in V1. Undo = CANCELLED (status flip); a cancelled event
 * does not contribute to the counter. confirmedAt is set when GM accepts.
 */
export const roundEvents = pgTable(
	'round_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		roundId: uuid('round_id')
			.references(() => rounds.id, { onDelete: 'cascade' })
			.notNull(),
		trackableId: text('trackable_id').notNull(), // refers to Trackable.id in session.trackables
		entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
		delta: integer('delta').notNull().default(1),
		status: roundEventStatusEnum('status').default('PENDING').notNull(),
		proposedByUserId: uuid('proposed_by_user_id')
			.references(() => users.id)
			.notNull(),
		decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		decidedAt: timestamp('decided_at', { withTimezone: true })
	},
	(t) => [
		index('round_events_round_idx').on(t.roundId),
		index('round_events_round_status_idx').on(t.roundId, t.status)
	]
);

/**
 * A market = a pool of mutually-related Outcomes. Stakes from all bettors on
 * any outcome in the same market go into one pool. On settle, the pool is
 * split equally between WINNING outcomes (predicates that evaluated true),
 * and within each winning outcome, payouts are proportional to stake.
 */
export const betMarkets = pgTable(
	'bet_markets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		roundId: uuid('round_id')
			.references(() => rounds.id, { onDelete: 'cascade' })
			.notNull(),
		title: text('title').notNull(),
		description: text('description'),
		createdByUserId: uuid('created_by_user_id')
			.references(() => users.id)
			.notNull(),
		status: betMarketStatusEnum('status').default('OPEN').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		settledAt: timestamp('settled_at', { withTimezone: true })
	},
	(t) => [index('bet_markets_round_idx').on(t.roundId)]
);

export const betOutcomes = pgTable(
	'bet_outcomes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		marketId: uuid('market_id')
			.references(() => betMarkets.id, { onDelete: 'cascade' })
			.notNull(),
		label: text('label').notNull(),
		predicate: jsonb('predicate').$type<Predicate>().notNull(),
		orderIndex: integer('order_index').notNull(),
		// Set on settle: true if predicate evaluated true at round-settle.
		isWinner: boolean('is_winner'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('bet_outcomes_market_idx').on(t.marketId)]
);

export const bets = pgTable(
	'bets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		outcomeId: uuid('outcome_id')
			.references(() => betOutcomes.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id')
			.references(() => users.id)
			.notNull(),
		stake: integer('stake').notNull(),
		// Set on settle: pool share credited to the user (0 if losing outcome).
		payoutAmount: integer('payout_amount'),
		settledAt: timestamp('settled_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('bets_outcome_idx').on(t.outcomeId), index('bets_user_idx').on(t.userId)]
);

export const drinks = pgTable(
	'drinks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.references(() => sessions.id, { onDelete: 'cascade' })
			.notNull(),
		targetUserId: uuid('target_user_id')
			.references(() => users.id)
			.notNull(),
		attackerUserId: uuid('attacker_user_id').references(() => users.id),
		drinkType: drinkTypeEnum('drink_type').notNull(),
		origin: drinkOrigin('origin').notNull(),
		priceSnapshot: integer('price_snapshot').notNull(),
		// If non-null, this drink is also a rebuy: on confirmation, credits the
		// target user with `rebuyAmount` money in the session balance.
		rebuyAmount: integer('rebuy_amount'),
		status: drinkStatusEnum('status').default('PENDING').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true })
	},
	(t) => [index('drinks_session_target_idx').on(t.sessionId, t.targetUserId)]
);

export const drinkConfirmations = pgTable(
	'drink_confirmations',
	{
		drinkId: uuid('drink_id')
			.references(() => drinks.id, { onDelete: 'cascade' })
			.notNull(),
		confirmerUserId: uuid('confirmer_user_id')
			.references(() => users.id)
			.notNull(),
		role: confirmerRole('role').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.drinkId, t.confirmerUserId] })]
);
