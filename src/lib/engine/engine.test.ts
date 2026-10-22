import { describe, expect, it } from "vitest";
import type { AlignedBar } from "./calendar";
import type { CostRates } from "./costs";
import {
  advanceDay,
  initialState,
  liquidationValue,
  markToMarket,
  type DayMarket,
  type EngineContext,
  type PortfolioState,
} from "./engine";
import type { Order } from "./orders";
import { excessReturnScore, simulateBenchmark } from "./score";

const RATE = 0.20315;
const FREE: CostRates = { commission: 0, spread: 0, fxFee: 0 };
const ctx = (rates: CostRates = FREE): EngineContext => ({ rates: () => rates, taxRate: RATE });

const b = (open: number, high = open, low = open, close = open, tradable = true): AlignedBar => ({
  open,
  high,
  low,
  close,
  volume: 1,
  tradable,
});
const day = (entries: [number, AlignedBar, number?][]): DayMarket =>
  new Map(entries.map(([id, bar, dividend]) => [id, { bar, dividend: dividend ?? 0 }]));

let seq = 0;
const order = (o: Partial<Order> & Pick<Order, "side">): Order => ({
  id: `o${++seq}`,
  instrumentId: 1,
  type: "market",
  limitPrice: null,
  amount: null,
  fraction: null,
  placedDay: 0,
  ...o,
});

describe("成行注文", () => {
  it("翌日の始値で、手数料込みの金額分を買う", () => {
    const rates = { commission: 0.001, spread: 0.0005, fxFee: 0.0025 };
    const s0 = { ...initialState(1_000_000), orders: [order({ side: "buy", amount: 100_000 })] };
    const { state, events } = advanceDay(s0, day([[1, b(100, 110, 90, 105)]]), ctx(rates));
    const price = 100 * 1.0005;
    const qty = 100_000 / (price * 1.0035);
    expect(state.cash).toBeCloseTo(900_000, 6);
    expect(state.positions[1].qty).toBeCloseTo(qty, 9);
    expect(state.positions[1].costBasis).toBeCloseTo(100_000, 6);
    expect(events[0]).toMatchObject({ kind: "trade", side: "buy", price });
    expect(state.orders).toHaveLength(0);
  });

  it("休場日の注文は約定せず残る", () => {
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", amount: 500 })] };
    const { state } = advanceDay(s0, day([[1, b(100, 100, 100, 100, false)]]), ctx());
    expect(state.orders).toHaveLength(1);
    expect(state.cash).toBe(1000);
  });

  it("現金が足りなければ残高まで、残高がなければ取消", () => {
    const s0 = { ...initialState(300), orders: [order({ side: "buy", amount: 500 }), order({ side: "buy", amount: 500 })] };
    const { state, events } = advanceDay(s0, day([[1, b(100)]]), ctx());
    expect(state.positions[1].qty).toBeCloseTo(3);
    expect(state.cash).toBeCloseTo(0);
    expect(events.at(-1)).toMatchObject({ kind: "cancel", reason: "no_cash" });
  });

  it("売りを買いより先に処理して現金を作る", () => {
    const s0 = {
      ...initialState(0),
      positions: { 2: { qty: 10, costBasis: 1000 } },
      orders: [order({ side: "buy", amount: 1000 }), order({ side: "sell", instrumentId: 2, fraction: 1 })],
    };
    const { state } = advanceDay(s0, day([[1, b(100)], [2, b(100)]]), ctx());
    expect(state.positions[1].qty).toBeCloseTo(10);
    expect(state.positions[2]).toBeUndefined();
  });
});

describe("指値注文", () => {
  it("指値買い：安値がちょうど指値なら指値で約定", () => {
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", type: "limit", limitPrice: 95, amount: 950 })] };
    const { state, events } = advanceDay(s0, day([[1, b(100, 101, 95, 99)]]), ctx());
    expect(events[0]).toMatchObject({ kind: "trade", price: 95 });
    expect(state.positions[1].qty).toBeCloseTo(10);
  });

  it("指値買い：届かなければ残る", () => {
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", type: "limit", limitPrice: 94.99, amount: 950 })] };
    expect(advanceDay(s0, day([[1, b(100, 101, 95, 99)]]), ctx()).state.orders).toHaveLength(1);
  });

  it("指値買い：窓を開けて下に寄ったら始値で約定", () => {
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", type: "limit", limitPrice: 95, amount: 900 })] };
    const { events } = advanceDay(s0, day([[1, b(90, 92, 88, 91)]]), ctx());
    expect(events[0]).toMatchObject({ price: 90 });
  });

  it("指値はスプレッド込みの約定値で判定する", () => {
    const rates = { commission: 0, spread: 0.01, fxFee: 0 };
    // 安値95でも、スプレッド込みの買い値は95.95なので95の指値は約定しない
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", type: "limit", limitPrice: 95, amount: 950 })] };
    expect(advanceDay(s0, day([[1, b(100, 101, 95, 99)]]), ctx(rates)).state.orders).toHaveLength(1);
  });

  it("指値売り：高値が指値以上なら、始値と指値の高い方で約定", () => {
    const s0 = {
      ...initialState(0),
      positions: { 1: { qty: 10, costBasis: 1000 } },
      orders: [order({ side: "sell", type: "limit", limitPrice: 105, fraction: 0.5 })],
    };
    const { state, events } = advanceDay(s0, day([[1, b(100, 106, 99, 104)]]), ctx());
    expect(events[0]).toMatchObject({ kind: "trade", side: "sell", price: 105, qty: 5 });
    expect(state.positions[1].qty).toBeCloseTo(5);
  });
});

describe("税", () => {
  it("利益が出た売却で20.315%を徴収する", () => {
    const s0 = {
      ...initialState(0),
      positions: { 1: { qty: 10, costBasis: 1000 } },
      orders: [order({ side: "sell", fraction: 1 })],
    };
    const { state, events } = advanceDay(s0, day([[1, b(150)]]), ctx());
    expect(events.find((e) => e.kind === "tax")).toMatchObject({ amount: 500 * RATE });
    expect(state.cash).toBeCloseTo(1500 - 500 * RATE);
  });

  it("年内の損失のあとの利益は通算され、損失が出れば還付される", () => {
    let s: PortfolioState = {
      ...initialState(0),
      positions: { 1: { qty: 10, costBasis: 1000 }, 2: { qty: 10, costBasis: 1000 } },
      orders: [order({ side: "sell", instrumentId: 1, fraction: 1 })],
    };
    // 銘柄1で -300（税なし）
    s = advanceDay(s, day([[1, b(70)], [2, b(100)]]), ctx()).state;
    expect(s.tax.paid).toBe(0);
    // 銘柄2で +500 → 通算 +200 にだけ課税
    s = { ...s, orders: [order({ side: "sell", instrumentId: 2, fraction: 1 })] };
    s = advanceDay(s, day([[1, b(70)], [2, b(150)]]), ctx()).state;
    expect(s.tax.paid).toBeCloseTo(200 * RATE);
    expect(s.cash).toBeCloseTo(700 + 1500 - 200 * RATE);
  });

  it("利益確定後の損失で還付", () => {
    let s: PortfolioState = {
      ...initialState(0),
      positions: { 1: { qty: 10, costBasis: 1000 }, 2: { qty: 10, costBasis: 1000 } },
      orders: [order({ side: "sell", instrumentId: 1, fraction: 1 })],
    };
    s = advanceDay(s, day([[1, b(150)], [2, b(100)]]), ctx()).state; // +500
    s = { ...s, orders: [order({ side: "sell", instrumentId: 2, fraction: 1 })] };
    const { state, events } = advanceDay(s, day([[1, b(150)], [2, b(40)]]), ctx()); // -600
    expect(events.find((e) => e.kind === "tax")).toMatchObject({ amount: -500 * RATE });
    expect(state.tax.paid).toBe(0);
  });

  it("平均取得単価で損益を計算する", () => {
    let s: PortfolioState = { ...initialState(2000), orders: [order({ side: "buy", amount: 1000 })] };
    s = advanceDay(s, day([[1, b(100)]]), ctx()).state; // 10口 @100
    s = { ...s, orders: [order({ side: "buy", amount: 1000 })] };
    s = advanceDay(s, day([[1, b(50)]]), ctx()).state; // 20口 @50 → 平均 66.67
    s = { ...s, orders: [order({ side: "sell", fraction: 0.5 })] };
    const { events } = advanceDay(s, day([[1, b(80)]]), ctx());
    const trade = events.find((e) => e.kind === "trade");
    expect(trade).toMatchObject({ qty: 15 });
    expect(trade && trade.kind === "trade" && trade.realizedPnl).toBeCloseTo(15 * 80 - 1000);
  });
});

describe("配当", () => {
  it("権利落ち日の始値より前の保有に支払い、源泉徴収する", () => {
    const s0 = { ...initialState(0), positions: { 1: { qty: 10, costBasis: 1000 } } };
    const { state, events } = advanceDay(s0, day([[1, b(100), 2]]), ctx());
    expect(events[0]).toMatchObject({ kind: "dividend", gross: 20, tax: 20 * RATE });
    expect(state.cash).toBeCloseTo(20 * (1 - RATE));
  });

  it("権利落ち日に買っても配当はもらえない", () => {
    const s0 = { ...initialState(1000), orders: [order({ side: "buy", amount: 1000 })] };
    const { state, events } = advanceDay(s0, day([[1, b(100), 2]]), ctx());
    expect(events.some((e) => e.kind === "dividend")).toBe(false);
    expect(state.cash).toBeCloseTo(0);
  });

  it("権利落ち日に売っても配当はもらえる", () => {
    const s0 = { ...initialState(0), positions: { 1: { qty: 10, costBasis: 1000 } }, orders: [order({ side: "sell", fraction: 1 })] };
    const { events } = advanceDay(s0, day([[1, b(100), 2]]), ctx());
    expect(events[0]).toMatchObject({ kind: "dividend" });
  });
});

describe("評価とスコア", () => {
  it("時価評価と清算評価（含み益にも課税、売却コストあり）", () => {
    const rates = { commission: 0.001, spread: 0.0005, fxFee: 0 };
    const s = { ...initialState(100), positions: { 1: { qty: 10, costBasis: 1000 } } };
    expect(markToMarket(s, () => 120)).toBe(1300);
    const net = 10 * 120 * 0.9995 * 0.999;
    expect(liquidationValue(s, () => 120, ctx(rates))).toBeCloseTo(100 + net - (net - 1000) * RATE);
  });

  it("ベンチマークは均等買い持ち", () => {
    const days = [day([[1, b(100)], [2, b(100)]]), day([[1, b(200)], [2, b(50)]])];
    const { finalValue, equity } = simulateBenchmark([1, 2], days, 1000, ctx());
    // 500円ずつ → 1000 + 250 = 1250、利益250に課税
    expect(finalValue).toBeCloseTo(1250 - 250 * RATE);
    expect(equity).toEqual([1000, 1250]);
    expect(simulateBenchmark([1, 2], [], 1000, ctx()).finalValue).toBe(1000);
    expect(excessReturnScore(1500, 1250, 1000)).toBeCloseTo(25);
  });
});
