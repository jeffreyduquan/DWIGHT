CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_stats" jsonb DEFAULT '{"roundsPlayed":0,"betsWon":0,"betsLost":0,"moneyWon":0,"drinksDrunk":{"schluck":0,"kurzer":0,"bierExen":0},"drinksDealt":{"schluck":0,"kurzer":0,"bierExen":0}}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uniq" ON "users" USING btree ("username");