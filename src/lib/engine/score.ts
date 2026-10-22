import {
  advanceDay,
  initialState,
  liquidationValue,
  markToMarket,
  type DayMarket,
  type EngineContext,
} from "./engine";
import type { Order } from "./orders";

/**
 * ベンチマーク：開始日に全収録資産へ均等に成行買いを出し、最後まで持ち続ける。
 * プレイヤーと同じエンジン（コスト・配当・税・休場）で計算するので条件は完全に同じ。
 * days[0] が1営業日目（最初の約定日）。equity[i] は days[i] の終値での時価評価。
 */
export function simulateBenchmark(
  instrumentIds: readonly number[],
  days: readonly DayMarket[],
  initialCash: number,
  ctx: EngineContext,
): { finalValue: number; equity: number[] } {
  if (days.length === 0 || instrumentIds.length === 0) return { finalValue: initialCash, equity: [] };
  let state = initialState(initialCash);
  const each = initialCash / instrumentIds.length;
  state.orders = instrumentIds.map(
    (id): Order => ({
      id: `bench-${id}`,
      instrumentId: id,
      side: "buy",
      type: "market",
      limitPrice: null,
      amount: each,
      fraction: null,
      placedDay: 0,
    }),
  );
  const equity: number[] = [];
  for (const day of days) {
    state = advanceDay(state, day, ctx).state;
    equity.push(markToMarket(state, (id) => day.get(id)?.bar.close));
  }
  const last = days[days.length - 1];
  return { finalValue: liquidationValue(state, (id) => last.get(id)?.bar.close, ctx), equity };
}

export function returnRate(finalValue: number, initialCash: number): number {
  return finalValue / initialCash - 1;
}

/** スコア＝ベンチマーク超過リターン（%ポイント） */
export function excessReturnScore(playerFinal: number, benchmarkFinal: number, initialCash: number): number {
  return (returnRate(playerFinal, initialCash) - returnRate(benchmarkFinal, initialCash)) * 100;
}
