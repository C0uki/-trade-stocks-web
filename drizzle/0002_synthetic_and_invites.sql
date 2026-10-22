CREATE TABLE "invite_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "scenarios_ranking_idx";--> statement-breakpoint
DROP INDEX "scenarios_one_active_ranked";--> statement-breakpoint
ALTER TABLE "fx_rates" DROP CONSTRAINT "fx_rates_currency_date_pk";--> statement-breakpoint
ALTER TABLE "fx_rates" ADD COLUMN "dataset" text DEFAULT 'real' NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_dataset_currency_date_pk" PRIMARY KEY("dataset","currency","date");--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "dataset" text DEFAULT 'real' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "dataset" text DEFAULT 'real' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_insider" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenarios_ranking_idx" ON "scenarios" USING btree ("dataset","mode","status","finished_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scenarios_one_active_ranked" ON "scenarios" USING btree ("user_id","dataset") WHERE "scenarios"."mode" = 'ranked' and "scenarios"."status" = 'active';