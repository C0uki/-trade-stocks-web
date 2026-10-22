/** 市場データを DB に書き込む処理。実データの取り込みと架空データの生成で共通に使う */
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../../src/lib/db";
import type { Dataset } from "../../src/lib/db/schema";
import type { IsoDate, RawBar } from "../../src/lib/engine/calendar";
import type { AssetKind, Currency, Market } from "../../src/lib/engine/instruments";

const BATCH = 2000;

export type InstrumentInput = {
  dataset: Dataset;
  providerSymbol: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  market: Market;
  currency: Currency;
  sector: string | null;
};

export async function upsertInstrument(e: InstrumentInput) {
  const [inst] = await db
    .insert(schema.instruments)
    .values(e)
    .onConflictDoUpdate({
      target: schema.instruments.providerSymbol,
      set: { symbol: e.symbol, name: e.name, sector: e.sector },
    })
    .returning();
  return inst;
}

/** 日足を書き込む（同じ日付があれば上書き） */
export async function writeBars(instrumentId: number, bars: readonly RawBar[]) {
  for (let i = 0; i < bars.length; i += BATCH) {
    await db
      .insert(schema.dailyBars)
      .values(bars.slice(i, i + BATCH).map((b) => ({ instrumentId, ...b })))
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
}

export async function writeDividends(instrumentId: number, dividends: readonly { exDate: IsoDate; amount: number }[]) {
  for (let i = 0; i < dividends.length; i += BATCH) {
    await db
      .insert(schema.dividends)
      .values(dividends.slice(i, i + BATCH).map((d) => ({ instrumentId, ...d })))
      .onConflictDoNothing();
  }
}

export async function writeFx(dataset: Dataset, currency: Currency, rows: readonly { date: IsoDate; value: number }[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await db
      .insert(schema.fxRates)
      .values(rows.slice(i, i + BATCH).map((r) => ({ dataset, currency, date: r.date, jpyPerUnit: r.value })))
      .onConflictDoUpdate({
        target: [schema.fxRates.dataset, schema.fxRates.currency, schema.fxRates.date],
        set: { jpyPerUnit: sql`excluded.jpy_per_unit` },
      });
  }
}

/** シナリオの対象判定に使う、取り込み済みの最初と最後の日付を更新する */
export async function refreshDateRange(instrumentId: number) {
  await db
    .update(schema.instruments)
    .set({
      firstDate: sql`(select min(date) from ${schema.dailyBars} where instrument_id = ${instrumentId})`,
      lastDate: sql`(select max(date) from ${schema.dailyBars} where instrument_id = ${instrumentId})`,
    })
    .where(and(eq(schema.instruments.id, instrumentId)));
}
