/**
 * 市場データの一括取り込み。再実行すると、各銘柄の最終日以降だけを取りに行く。
 *   npm run import:data                         # 全銘柄
 *   npm run import:data -- --symbols AAPL,7203.T,BTC-USD
 *   npm run import:data -- --from 2015-01-01 --limit 20
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../../src/lib/db";
import { addDays, toIso } from "../../src/lib/engine/calendar";
import type { DataProvider } from "./provider";
import { YahooProvider } from "./providers/yahoo";
import type { UniverseEntry } from "./universe/types";

const { values: args } = parseArgs({
  options: {
    symbols: { type: "string" },
    from: { type: "string", default: "2005-01-01" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "3" },
  },
});

const provider: DataProvider = new YahooProvider();
const today = toIso(Date.now());
const BATCH = 2000;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 4) throw e;
      const wait = 2000 * 2 ** attempt;
      console.warn(`  ${label}: ${(e as Error).message.slice(0, 120)} → ${wait / 1000}s 後に再試行`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function importFx() {
  for (const currency of ["USD", "EUR"] as const) {
    const [{ last }] = await db
      .select({ last: sql<string | null>`max(${schema.fxRates.date})` })
      .from(schema.fxRates)
      .where(eq(schema.fxRates.currency, currency));
    const from = last ? addDays(last, -7) : args.from!;
    const rows = await withRetry(`FX ${currency}`, () => provider.fetchFx(currency, from, today));
    for (let i = 0; i < rows.length; i += BATCH) {
      await db
        .insert(schema.fxRates)
        .values(rows.slice(i, i + BATCH).map((r) => ({ currency, date: r.date, jpyPerUnit: r.value })))
        .onConflictDoUpdate({
          target: [schema.fxRates.currency, schema.fxRates.date],
          set: { jpyPerUnit: sql`excluded.jpy_per_unit` },
        });
    }
    console.log(`FX ${currency}: ${rows.length} 行`);
  }
}

async function importInstrument(e: UniverseEntry) {
  const [inst] = await db
    .insert(schema.instruments)
    .values({
      symbol: e.symbol,
      providerSymbol: e.providerSymbol,
      name: e.name,
      kind: e.kind,
      market: e.market,
      currency: e.currency,
      sector: e.sector,
    })
    .onConflictDoUpdate({
      target: schema.instruments.providerSymbol,
      set: { symbol: e.symbol, name: e.name, sector: e.sector },
    })
    .returning();
  for (const code of e.indexes) {
    await db.insert(schema.indexMemberships).values({ instrumentId: inst.id, indexCode: code }).onConflictDoNothing();
  }

  // 直近の足は取り込み時点で未確定のことがあるので、最終日の1週間前から取り直して上書きする
  const from = inst.lastDate ? addDays(inst.lastDate, -7) : args.from!;
  const data = await withRetry(e.providerSymbol, () => provider.fetchDaily(e.providerSymbol, from, today));
  if (data.currency && data.currency !== e.currency) {
    console.warn(`  ${e.providerSymbol}: 通貨が ${data.currency}（想定 ${e.currency}）のためスキップ`);
    return 0;
  }
  for (let i = 0; i < data.bars.length; i += BATCH) {
    await db
      .insert(schema.dailyBars)
      .values(data.bars.slice(i, i + BATCH).map((b) => ({ instrumentId: inst.id, ...b })))
      .onConflictDoUpdate({
        target: [schema.dailyBars.instrumentId, schema.dailyBars.date],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
        },
      });
  }
  if (data.dividends.length) {
    await db
      .insert(schema.dividends)
      .values(data.dividends.map((d) => ({ instrumentId: inst.id, ...d })))
      .onConflictDoNothing();
  }
  if (data.splits.length) {
    await db
      .insert(schema.splits)
      .values(data.splits.map((s) => ({ instrumentId: inst.id, ...s })))
      .onConflictDoNothing();
  }
  if (provider.fetchFundamentals) {
    const reports = await provider.fetchFundamentals(e.providerSymbol);
    if (reports.length) {
      await db
        .insert(schema.fundamentals)
        .values(reports.map((r) => ({ instrumentId: inst.id, ...r })))
        .onConflictDoNothing();
    }
  }
  await db
    .update(schema.instruments)
    .set({
      firstDate: sql`(select min(date) from ${schema.dailyBars} where instrument_id = ${inst.id})`,
      lastDate: sql`(select max(date) from ${schema.dailyBars} where instrument_id = ${inst.id})`,
    })
    .where(and(eq(schema.instruments.id, inst.id)));
  return data.bars.length;
}

const universe: UniverseEntry[] = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "universe", "universe.json"), "utf8"),
);
let targets = universe;
if (args.symbols) {
  const want = new Set(args.symbols.split(","));
  targets = universe.filter((e) => want.has(e.providerSymbol) || want.has(e.symbol));
}
if (args.limit) targets = targets.slice(0, Number(args.limit));

console.log(`データ源: ${provider.name} / 対象 ${targets.length} 銘柄 / 開始 ${args.from}`);
await importFx();

let done = 0;
let failed = 0;
const queue = [...targets];
await Promise.all(
  Array.from({ length: Number(args.concurrency) }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      try {
        const n = await importInstrument(e);
        done++;
        console.log(`[${done + failed}/${targets.length}] ${e.providerSymbol}: ${n} 行`);
      } catch (err) {
        failed++;
        console.error(`[${done + failed}/${targets.length}] ${e.providerSymbol}: 失敗 ${(err as Error).message.slice(0, 160)}`);
      }
    }
  }),
);
console.log(`完了 ${done} / 失敗 ${failed}`);
process.exit(failed > 0 && done === 0 ? 1 : 0);
