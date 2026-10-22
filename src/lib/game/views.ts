import "server-only";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { INITIAL_CASH, SCENARIO_DAYS, TAX_RATE } from "@/config/game";
import { db, schema } from "@/lib/db";
import { addDays } from "@/lib/engine/calendar";
import { markToMarket } from "@/lib/engine/engine";
import { trailingDividendYield, valuationRatios } from "@/lib/engine/fundamentals";
import { indexToJpy } from "@/lib/engine/pricing";
import { GameError } from "./errors";
import { costRates, loadScenarioMarket, loadSeries } from "./market";
import { getScenarioRow, isInsider, isRevealed } from "./service";
import { dateOfDay, fictionalYear, FIRST_DAY, scenarioCalendar } from "./timeline";

/**
 * クライアントに返すデータはここで組み立てる。
 * 日付は「k 日目」、価格は指数で返し、isRevealed のときだけ実日付・実価格を付ける。
 */

export async function scenarioView(scenarioId: string, userId: string) {
  const s = await getScenarioRow(scenarioId, userId);
  const revealed = isRevealed(s);
  const cal = scenarioCalendar(s.startDate);
  const m = await loadScenarioMarket(s.id, cal, s.dataset);
  const [pos, openOrders, recent, equity] = await Promise.all([
    db.select().from(schema.positions).where(eq(schema.positions.scenarioId, s.id)),
    db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.scenarioId, s.id), eq(schema.orders.status, "open")))
      .orderBy(asc(schema.orders.createdAt)),
    db
      .select()
      .from(schema.ledger)
      .where(eq(schema.ledger.scenarioId, s.id))
      .orderBy(desc(schema.ledger.id))
      .limit(100),
    db
      .select()
      .from(schema.equityHistory)
      .where(eq(schema.equityHistory.scenarioId, s.id))
      .orderBy(asc(schema.equityHistory.day)),
  ]);
  const series = await loadSeries(
    m,
    pos.map((p) => p.instrumentId),
    s.currentDay,
    s.currentDay,
  );
  const close = (id: number) => series.get(id)?.bars[0]?.close;
  const state = {
    cash: s.cash,
    tax: { realized: s.taxRealized, paid: s.taxPaid },
    positions: Object.fromEntries(pos.map((p) => [p.instrumentId, p])),
    orders: [],
  };
  const name = (id: number | null) => (id ? (m.instruments.get(id)?.name ?? "") : "");
  const symbol = (id: number | null) => (id ? (m.instruments.get(id)?.symbol ?? "") : "");
  const realPrice = (id: number | null, indexPrice: number | null) => {
    if (!revealed || !id || indexPrice == null) return null;
    const inst = m.instruments.get(id);
    return inst ? indexToJpy(indexPrice, inst.basePriceJpy) : null;
  };

  return {
    id: s.id,
    mode: s.mode,
    dataset: s.dataset,
    status: s.status,
    currentDay: s.currentDay,
    totalDays: SCENARIO_DAYS,
    revealed,
    period: revealed ? { start: dateOfDay(cal, 0), end: dateOfDay(cal, SCENARIO_DAYS) } : null,
    fictionalPeriod: fictionalPeriod(s, cal),
    currentDate: revealed ? dateOfDay(cal, s.currentDay) : null,
    initialCash: INITIAL_CASH,
    cash: s.cash,
    equity: markToMarket(state, close),
    taxRate: TAX_RATE,
    tax: { realized: s.taxRealized, paid: s.taxPaid },
    result:
      s.status === "active"
        ? null
        : { finalValue: s.finalValue, benchmarkValue: s.benchmarkValue, score: s.score },
    instrumentCount: m.instruments.size,
    positions: pos.map((p) => {
      const price = close(p.instrumentId) ?? 0;
      return {
        instrumentId: p.instrumentId,
        symbol: symbol(p.instrumentId),
        name: name(p.instrumentId),
        qty: p.qty,
        avgCost: p.costBasis / p.qty,
        price,
        value: p.qty * price,
        pnl: p.qty * price - p.costBasis,
        realPrice: realPrice(p.instrumentId, price),
      };
    }),
    orders: openOrders.map((o) => ({
      id: o.id,
      instrumentId: o.instrumentId,
      symbol: symbol(o.instrumentId),
      name: name(o.instrumentId),
      side: o.side,
      type: o.type,
      limitPrice: o.limitPrice,
      amount: o.amount,
      fraction: o.fraction,
      placedDay: o.placedDay,
    })),
    ledger: recent.map((l) => ({
      id: l.id,
      day: l.day,
      date: revealed ? dateOfDay(cal, l.day) : null,
      kind: l.kind,
      instrumentId: l.instrumentId,
      symbol: symbol(l.instrumentId),
      name: name(l.instrumentId),
      side: l.side,
      qty: l.qty,
      price: l.price,
      realPrice: realPrice(l.instrumentId, l.price),
      gross: l.gross,
      fees: l.fees,
      tax: l.tax,
      realizedPnl: l.realizedPnl,
      note: l.note,
    })),
    equityHistory: equity.map((e) => ({ day: e.day, equity: e.equity, benchmark: e.benchmarkEquity })),
  };
}

export type ScenarioView = Awaited<ReturnType<typeof scenarioView>>;

const MARKET_ORDER = ["JP", "US", "EU", "CRYPTO"];

/** 銘柄一覧：当日の指数終値と前日比 */
export async function marketView(scenarioId: string, userId: string) {
  const s = await getScenarioRow(scenarioId, userId);
  const revealed = isRevealed(s);
  const m = await loadScenarioMarket(s.id, scenarioCalendar(s.startDate), s.dataset);
  const series = await loadSeries(m, [...m.instruments.keys()], s.currentDay - 1, s.currentDay);
  return [...m.instruments.values()]
    .map((inst) => {
      const sr = series.get(inst.id);
      const today = sr?.bars[1];
      const prev = sr?.bars[0];
      return {
        id: inst.id,
        symbol: inst.symbol,
        name: inst.name,
        kind: inst.kind,
        market: inst.market,
        sector: inst.sector,
        price: today?.close ?? null,
        change: today && prev ? today.close / prev.close - 1 : null,
        tradable: today?.tradable ?? false,
        realPrice: revealed && today ? indexToJpy(today.close, inst.basePriceJpy) : null,
      };
    })
    .sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market) || a.symbol.localeCompare(b.symbol));
}

export type MarketRow = Awaited<ReturnType<typeof marketView>>[number];

/** 銘柄詳細：開始前1年＋当日までの日足と、当日時点の財務指標 */
export async function instrumentView(scenarioId: string, userId: string, instrumentId: number) {
  const s = await getScenarioRow(scenarioId, userId);
  const revealed = isRevealed(s);
  const cal = scenarioCalendar(s.startDate);
  const m = await loadScenarioMarket(s.id, cal, s.dataset);
  const inst = m.instruments.get(instrumentId);
  if (!inst) throw new GameError(404, "銘柄が見つかりません");
  const series = (await loadSeries(m, [instrumentId], FIRST_DAY, s.currentDay)).get(instrumentId)!;
  const asOf = dateOfDay(cal, s.currentDay);
  const localClose = series.localClose[series.localClose.length - 1];
  const [divs, reports] = await Promise.all([
    db
      .select()
      .from(schema.dividends)
      .where(
        and(
          eq(schema.dividends.instrumentId, instrumentId),
          gt(schema.dividends.exDate, addDays(asOf, -366)),
          lte(schema.dividends.exDate, asOf),
        ),
      ),
    db
      .select()
      .from(schema.fundamentals)
      .where(and(eq(schema.fundamentals.instrumentId, instrumentId), lte(schema.fundamentals.reportDate, asOf))),
  ]);
  const ratios = localClose ? valuationRatios(reports, asOf, localClose) : { per: null, pbr: null };
  const rates = costRates(inst);

  const bars = series.bars.flatMap((b, i) => {
    if (!b) return [];
    const day = FIRST_DAY + i;
    return [
      {
        day,
        date: revealed ? cal[i] : null,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        tradable: b.tradable,
      },
    ];
  });
  const last = bars[bars.length - 1];
  return {
    id: inst.id,
    symbol: inst.symbol,
    name: inst.name,
    kind: inst.kind,
    market: inst.market,
    currency: inst.currency,
    sector: inst.sector,
    costs: rates,
    tradableToday: last?.tradable ?? false,
    bars,
    fundamentals: {
      dividendYield: localClose ? trailingDividendYield(divs, asOf, localClose) : null,
      per: ratios.per,
      pbr: ratios.pbr,
    },
    real: revealed && last ? { basePriceJpy: inst.basePriceJpy, closeJpy: indexToJpy(last.close, inst.basePriceJpy) } : null,
  };
}

export type InstrumentView = Awaited<ReturnType<typeof instrumentView>>;

/** 自分のシナリオ一覧 */
export async function myScenarios(userId: string) {
  const rows = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.userId, userId))
    .orderBy(desc(schema.scenarios.createdAt))
    .limit(50);
  const insider = await isInsider(userId);
  return rows
    .filter((s) => s.dataset === "synthetic" || insider)
    .map((s) => {
      const cal = scenarioCalendar(s.startDate);
      const revealed = isRevealed(s);
      return {
        id: s.id,
        mode: s.mode,
        dataset: s.dataset,
        status: s.status,
        currentDay: s.currentDay,
        score: s.score,
        finalValue: s.finalValue,
        createdAt: s.createdAt,
        period: revealed ? { start: dateOfDay(cal, 0), end: dateOfDay(cal, SCENARIO_DAYS) } : null,
        fictionalPeriod: fictionalPeriod(s, cal),
      };
    });
}

/** 架空データの終了後に見せる「架空暦 ○年目〜○年目」 */
function fictionalPeriod(
  s: Pick<typeof schema.scenarios.$inferSelect, "dataset" | "status">,
  cal: readonly string[],
): { startYear: number; endYear: number } | null {
  if (s.dataset !== "synthetic" || s.status === "active") return null;
  return { startYear: fictionalYear(dateOfDay(cal, 0)), endYear: fictionalYear(dateOfDay(cal, SCENARIO_DAYS)) };
}

