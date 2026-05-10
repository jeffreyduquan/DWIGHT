CREATE TYPE "public"."bet_status" AS ENUM('OPEN', 'WON', 'LOST', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."confirmation_mode" AS ENUM('GM', 'PEERS', 'EITHER');--> statement-breakpoint
CREATE TYPE "public"."confirmer_role" AS ENUM('GM', 'PEER');--> statement-breakpoint
CREATE TYPE "public"."drink_origin" AS ENUM('SELF', 'FORCE');--> statement-breakpoint
CREATE TYPE "public"."drink_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."drink_type" AS ENUM('SCHLUCK', 'KURZER', 'BIER_EXEN');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('SETUP', 'BETTING_OPEN', 'LIVE', 'RESOLVING', 'SETTLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."session_role" AS ENUM('HOST', 'PLAYER');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('CREATED', 'ACTIVE', 'ENDED');--> statement-breakpoint
CREATE TABLE "bet_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_offer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"selection" jsonb NOT NULL,
	"stake" integer NOT NULL,
	"quoted_multiplier_x100" integer NOT NULL,
	"status" "bet_status" DEFAULT 'OPEN' NOT NULL,
	"payout_amount" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drink_confirmations" (
	"drink_id" uuid NOT NULL,
	"confirmer_user_id" uuid NOT NULL,
	"role" "confirmer_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drink_confirmations_drink_id_confirmer_user_id_pk" PRIMARY KEY("drink_id","confirmer_user_id")
);
--> statement-breakpoint
CREATE TABLE "drinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"attacker_user_id" uuid,
	"drink_type" "drink_type" NOT NULL,
	"origin" "drink_origin" NOT NULL,
	"price_snapshot" integer NOT NULL,
	"status" "drink_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"owner_user_id" uuid,
	"terminology" jsonb NOT NULL,
	"default_entities" jsonb NOT NULL,
	"allowed_bet_templates" jsonb NOT NULL,
	"default_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_outcomes" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"declared_by" uuid NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"status" "round_status" DEFAULT 'SETUP' NOT NULL,
	"started_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_players" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "session_role" DEFAULT 'PLAYER' NOT NULL,
	"money_balance" integer NOT NULL,
	"bet_locked" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_players_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"mode_id" uuid NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"status" "session_status" DEFAULT 'CREATED' NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bet_offers" ADD CONSTRAINT "bet_offers_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_bet_offer_id_bet_offers_id_fk" FOREIGN KEY ("bet_offer_id") REFERENCES "public"."bet_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drink_confirmations" ADD CONSTRAINT "drink_confirmations_drink_id_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drink_confirmations" ADD CONSTRAINT "drink_confirmations_confirmer_user_id_users_id_fk" FOREIGN KEY ("confirmer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drinks" ADD CONSTRAINT "drinks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drinks" ADD CONSTRAINT "drinks_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drinks" ADD CONSTRAINT "drinks_attacker_user_id_users_id_fk" FOREIGN KEY ("attacker_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modes" ADD CONSTRAINT "modes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_outcomes" ADD CONSTRAINT "round_outcomes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_outcomes" ADD CONSTRAINT "round_outcomes_declared_by_users_id_fk" FOREIGN KEY ("declared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_players" ADD CONSTRAINT "session_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mode_id_modes_id_fk" FOREIGN KEY ("mode_id") REFERENCES "public"."modes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_offers_round_idx" ON "bet_offers" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "bets_offer_idx" ON "bets" USING btree ("bet_offer_id");--> statement-breakpoint
CREATE INDEX "bets_user_idx" ON "bets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drinks_session_target_idx" ON "drinks" USING btree ("session_id","target_user_id");--> statement-breakpoint
CREATE INDEX "entities_session_idx" ON "entities" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modes_slug_uniq" ON "modes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rounds_session_idx" ON "rounds" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_invite_code_uniq" ON "sessions" USING btree ("invite_code");