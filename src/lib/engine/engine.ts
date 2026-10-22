import type { AlignedBar } from "./calendar";
import { buyForAmount, qtyForNetProceeds, sellPrice, sellQty, type CostRates } from "./costs";
import { matchOrder, type Order } from "./orders";
import { dividendWithholding, emptyTax, settleRealized, type TaxState } from "./tax";

/** 価格はすべて指数（1口＝指数値の円）。costBasis は手数料込みの取得総額 */
export type Position = { qty: number; costBasis: number };

export type PortfolioState = {
  cash: number;
  positions: Record<number, Position>;
  tax: TaxState;
  orders: Order[];
};

/** ある1日の、銘柄ごとの市場データ（指数換算済み） */
export type DayMarket = Map<number, { bar: AlignedBar; dividend: number }>;

export type LedgerEvent =
  | { kind: "dividend"; instrumentId: number; gross: number; tax: number }
  | {
      kind: "trade";
      orderId: string;
      instrumentId: number;
      side: "buy" | "sell";
      qty: number;
      price: number;
      gross: number;
      fees: number;
      realizedPnl: number;
    }
  | { kind: "tax"; amount: number }
  | { kind: "cancel"; orderId: string; reason: "no_cash" | "no_position" };

export type EngineContext = {
  rates: (instrumentId: number) => CostRates;
  taxRate: number;
};

/** 端数口の誤差で残る極小の保有を消すしきい値 */
const DUST_QTY = 1e-9;
/** 1円未満の買い付けは行わない */
const MIN_ORDER_YEN = 1;

export function initialState(cash: number): PortfolioState {
  return { cash, positions: {}, tax: emptyTax(), orders: [] };
}

function clone(s: PortfolioState): PortfolioState {
  return {
    cash: s.cash,
    positions: Object.fromEntries(Object.entries(s.positions).map(([k, p]) => [k, { ...p }])),
    tax: { ...s.tax },
    orders: s.orders.map((o) => ({ ...o })),
  };
}

/**
 * 1営業日進める。順序は
 * 1. 配当（前日終値時点の保有に対して、源泉徴収後に入金）
 * 2. 売り注文 → 買い注文（それぞれ発注順）。売却ごとに譲渡益税を精算
 * 約定しなかった注文（休場・指値未達）は残る。
 */
export function advanceDay(
  prev: PortfolioState,
  market: DayMarket,
  ctx: EngineContext,
): { state: PortfolioState; events: LedgerEvent[] } {
  const s = clone(prev);
  const events: LedgerEvent[] = [];

  for (const [idStr, pos] of Object.entries(s.positions)) {
    const id = Number(idStr);
    const dividend = market.get(id)?.dividend ?? 0;
    if (dividend <= 0 || pos.qty <= 0) continue;
    const gross = dividend * pos.qty;
    const tax = dividendWithholding(gross, ctx.taxRate);
    s.cash += gross - tax;
    events.push({ kind: "dividend", instrumentId: id, gross, tax });
  }

  const ordered = [...s.orders.filter((o) => o.side === "sell"), ...s.orders.filter((o) => o.side === "buy")];
  const remaining: Order[] = [];
  for (const order of ordered) {
    const day = market.get(order.instrumentId);
    if (!day) {
      remaining.push(order);
      continue;
    }
    const rates = ctx.rates(order.instrumentId);
    const price = matchOrder(order, day.bar, rates);
    if (price === null) {
      remaining.push(order);
      continue;
    }
    if (order.side === "buy") {
      const want = order.amount ?? 0;
      const spend = Math.min(want, s.cash);
      if (spend < MIN_ORDER_YEN) {
        events.push({ kind: "cancel", orderId: order.id, reason: "no_cash" });
        continue;
      }
      const calc = buyForAmount(spend, price, rates);
      s.cash -= calc.total;
      const pos = s.positions[order.instrumentId] ?? { qty: 0, costBasis: 0 };
      pos.qty += calc.qty;
      pos.costBasis += calc.total;
      s.positions[order.instrumentId] = pos;
      events.push({
        kind: "trade",
        orderId: order.id,
        instrumentId: order.instrumentId,
        side: "buy",
        qty: calc.qty,
        price,
        gross: calc.gross,
        fees: calc.fees,
        realizedPnl: 0,
      });
    } else {
      const pos = s.positions[order.instrumentId];
      if (!pos || pos.qty <= DUST_QTY) {
        events.push({ kind: "cancel", orderId: order.id, reason: "no_position" });
        continue;
      }
      let qty =
        order.fraction !== null ? pos.qty * order.fraction : qtyForNetProceeds(order.amount ?? 0, price, rates);
      qty = Math.min(qty, pos.qty);
      const calc = sellQty(qty, price, rates);
      const basis = pos.costBasis * (qty / pos.qty);
      const pnl = calc.net - basis;
      pos.qty -= qty;
      pos.costBasis -= basis;
      if (pos.qty <= DUST_QTY) delete s.positions[order.instrumentId];
      s.cash += calc.net;
      events.push({
        kind: "trade",
        orderId: order.id,
        instrumentId: order.instrumentId,
        side: "sell",
        qty,
        price,
        gross: calc.gross,
        fees: calc.fees,
        realizedPnl: pnl,
      });
      const settled = settleRealized(s.tax, pnl, ctx.taxRate);
      s.tax = settled.state;
      if (settled.delta !== 0) {
        s.cash -= settled.delta;
        events.push({ kind: "tax", amount: settled.delta });
      }
    }
  }
  // 発注順を保つ
  const keep = new Set(remaining.map((o) => o.id));
  s.orders = s.orders.filter((o) => keep.has(o.id));
  return { state: s, events };
}

/** 終値での時価評価（コスト・税は考慮しない） */
export function markToMarket(s: PortfolioState, closes: (id: number) => number | undefined): number {
  let v = s.cash;
  for (const [id, pos] of Object.entries(s.positions)) {
    v += pos.qty * (closes(Number(id)) ?? 0);
  }
  return v;
}

/**
 * 終了時の評価額。最終日の終値で全保有を売却したとみなし（スプレッド・手数料あり）、
 * 含み損益も含めて税を精算した後の資産額を返す。
 */
export function liquidationValue(
  s: PortfolioState,
  closes: (id: number) => number | undefined,
  ctx: EngineContext,
): number {
  let cash = s.cash;
  let pnl = 0;
  for (const [idStr, pos] of Object.entries(s.positions)) {
    const id = Number(idStr);
    const rates = ctx.rates(id);
    const price = sellPrice(closes(id) ?? 0, rates);
    const calc = sellQty(pos.qty, price, rates);
    cash += calc.net;
    pnl += calc.net - pos.costBasis;
  }
  const settled = settleRealized(s.tax, pnl, ctx.taxRate);
  return cash - settled.delta;
}
