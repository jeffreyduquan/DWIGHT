CREATE TYPE "public"."bet_market_status" AS ENUM('OPEN', 'LOCKED', 'SETTLED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."round_event_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."trackable_scope" AS ENUM('global', 'entity');--> statement-breakpoint
CREATE TABLE "bet_markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by_user_id" uuid NOT NULL,
	"status" "bet_market_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bet_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"label" text NOT NULL,
	"predicate" jsonb NOT NULL,
	"order_index" integer NOT NULL,
	"is_winner" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"trackable_id" text NOT NULL,
	"entity_id" uuid,
	"delta" integer DEFAULT 1 NOT NULL,
	"status" "round_event_status" DEFAULT 'PENDING' NOT NULL,
	"proposed_by_user_id" uuid NOT NULL,
	"decided_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bet_offers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "round_outcomes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bet_offers" CASCADE;--> statement-breakpoint
DROP TABLE "round_outcomes" CASCADE;--> statement-breakpoint
ALTER TABLE "bets" DROP CONSTRAINT "bets_bet_offer_id_bet_offers_id_fk";
--> statement-breakpoint
DROP INDEX "bets_offer_idx";--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "outcome_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modes" ADD COLUMN "trackables" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "trackables" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bet_markets" ADD CONSTRAINT "bet_markets_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_markets" ADD CONSTRAINT "bet_markets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_outcomes" ADD CONSTRAINT "bet_outcomes_market_id_bet_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."bet_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_markets_round_idx" ON "bet_markets" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "bet_outcomes_market_idx" ON "bet_outcomes" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "round_events_round_idx" ON "round_events" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "round_events_round_status_idx" ON "round_events" USING btree ("round_id","status");--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_outcome_id_bet_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."bet_outcomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bets_outcome_idx" ON "bets" USING btree ("outcome_id");--> statement-breakpoint
ALTER TABLE "bets" DROP COLUMN "bet_offer_id";--> statement-breakpoint
ALTER TABLE "bets" DROP COLUMN "selection";--> statement-breakpoint
ALTER TABLE "bets" DROP COLUMN "quoted_multiplier_x100";--> statement-breakpoint
ALTER TABLE "bets" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "bets" DROP COLUMN "resolved_at";--> statement-breakpoint
ALTER TABLE "modes" DROP COLUMN "allowed_bet_templates";--> statement-breakpoint
DROP TYPE "public"."bet_status";