DROP INDEX "daily_bars_date_idx";--> statement-breakpoint
-- 1回の書き直しで済むよう、型変更は1つの ALTER TABLE にまとめる
ALTER TABLE "daily_bars"
  ALTER COLUMN "open" SET DATA TYPE real,
  ALTER COLUMN "high" SET DATA TYPE real,
  ALTER COLUMN "low" SET DATA TYPE real,
  ALTER COLUMN "close" SET DATA TYPE real,
  ALTER COLUMN "volume" SET DATA TYPE real;
