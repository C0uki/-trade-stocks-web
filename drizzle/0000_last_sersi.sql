CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "daily_bars" (
	"instrument_id" integer NOT NULL,
	"date" date NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision NOT NULL,
	CONSTRAINT "daily_bars_instrument_id_date_pk" PRIMARY KEY("instrument_id","date")
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"instrument_id" integer NOT NULL,
	"ex_date" date NOT NULL,
	"amount" double precision NOT NULL,
	CONSTRAINT "dividends_instrument_id_ex_date_pk" PRIMARY KEY("instrument_id","ex_date")
);
--> statement-breakpoint
CREATE TABLE "equity_history" (
	"scenario_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"equity" double precision NOT NULL,
	CONSTRAINT "equity_history_scenario_id_day_pk" PRIMARY KEY("scenario_id","day")
);
--> statement-breakpoint
CREATE TABLE "fundamentals" (
	"instrument_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"eps_ttm" double precision,
	"bps" double precision,
	CONSTRAINT "fundamentals_instrument_id_report_date_pk" PRIMARY KEY("instrument_id","report_date")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"jpy_per_unit" double precision NOT NULL,
	CONSTRAINT "fx_rates_currency_date_pk" PRIMARY KEY("currency","date")
);
--> statement-breakpoint
CREATE TABLE "index_memberships" (
	"instrument_id" integer NOT NULL,
	"index_code" text NOT NULL,
	"from_date" date,
	"to_date" date,
	CONSTRAINT "index_memberships_instrument_id_index_code_pk" PRIMARY KEY("instrument_id","index_code")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"provider_symbol" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"market" text NOT NULL,
	"currency" text NOT NULL,
	"sector" text,
	"first_date" date,
	"last_date" date,
	CONSTRAINT "instruments_provider_symbol_unique" UNIQUE("provider_symbol")
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"kind" text NOT NULL,
	"order_id" uuid,
	"instrument_id" integer,
	"side" text,
	"qty" double precision,
	"price" double precision,
	"gross" double precision,
	"fees" double precision,
	"tax" double precision,
	"realized_pnl" double precision,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"instrument_id" integer NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"limit_price" double precision,
	"amount" double precision,
	"fraction" double precision,
	"placed_day" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"scenario_id" uuid NOT NULL,
	"instrument_id" integer NOT NULL,
	"qty" double precision NOT NULL,
	"cost_basis" double precision NOT NULL,
	CONSTRAINT "positions_scenario_id_instrument_id_pk" PRIMARY KEY("scenario_id","instrument_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_instruments" (
	"scenario_id" uuid NOT NULL,
	"instrument_id" integer NOT NULL,
	"base_price_jpy" double precision NOT NULL,
	CONSTRAINT "scenario_instruments_scenario_id_instrument_id_pk" PRIMARY KEY("scenario_id","instrument_id")
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"show_real" boolean DEFAULT false NOT NULL,
	"start_date" date NOT NULL,
	"current_day" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cash" double precision NOT NULL,
	"tax_realized" double precision DEFAULT 0 NOT NULL,
	"tax_paid" double precision DEFAULT 0 NOT NULL,
	"final_value" double precision,
	"benchmark_value" double precision,
	"score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "splits" (
	"instrument_id" integer NOT NULL,
	"date" date NOT NULL,
	"numerator" double precision NOT NULL,
	"denominator" double precision NOT NULL,
	CONSTRAINT "splits_instrument_id_date_pk" PRIMARY KEY("instrument_id","date")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"nickname" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_bars" ADD CONSTRAINT "daily_bars_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_history" ADD CONSTRAINT "equity_history_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundamentals" ADD CONSTRAINT "fundamentals_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_memberships" ADD CONSTRAINT "index_memberships_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_instruments" ADD CONSTRAINT "scenario_instruments_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_instruments" ADD CONSTRAINT "scenario_instruments_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_bars_date_idx" ON "daily_bars" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ledger_scenario_idx" ON "ledger" USING btree ("scenario_id","day");--> statement-breakpoint
CREATE INDEX "orders_scenario_idx" ON "orders" USING btree ("scenario_id","status");--> statement-breakpoint
CREATE INDEX "scenarios_user_idx" ON "scenarios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scenarios_ranking_idx" ON "scenarios" USING btree ("mode","status","finished_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scenarios_one_active_ranked" ON "scenarios" USING btree ("user_id") WHERE "scenarios"."mode" = 'ranked' and "scenarios"."status" = 'active';