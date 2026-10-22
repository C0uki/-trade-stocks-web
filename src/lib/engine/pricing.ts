import type { AlignedBar } from "./calendar";

/**
 * 価格はすべて「円換算 → 開始日の終値=100 の指数」に変換してからエンジンに渡す。
 * エンジン内では 1口 = 指数値（円）の仮想的な株として扱うので、
 * 指数だけで売買・評価・配当・税がすべて計算でき、実価格はクライアントに出ない。
 */

export const INDEX_BASE = 100;

/** 現地通貨の足を、その日の為替（1単位あたり円）で円換算する */
export function toJpy(bar: AlignedBar, jpyPerUnit: number): AlignedBar {
  return {
    ...bar,
    open: bar.open * jpyPerUnit,
    high: bar.high * jpyPerUnit,
    low: bar.low * jpyPerUnit,
    close: bar.close * jpyPerUnit,
  };
}

/** 円換算した足を指数に変換する。basePriceJpy は開始日の円換算終値 */
export function toIndex(bar: AlignedBar, basePriceJpy: number): AlignedBar {
  const k = INDEX_BASE / basePriceJpy;
  return { ...bar, open: bar.open * k, high: bar.high * k, low: bar.low * k, close: bar.close * k };
}

/** 現地通貨の1株あたり金額（配当など）を、指数1口あたりの円に換算する */
export function localAmountToIndex(amountLocal: number, jpyPerUnit: number, basePriceJpy: number): number {
  return (amountLocal * jpyPerUnit * INDEX_BASE) / basePriceJpy;
}

/** 指数価格を実際の円価格に戻す（終了後の公開や練習モード用） */
export function indexToJpy(indexPrice: number, basePriceJpy: number): number {
  return (indexPrice * basePriceJpy) / INDEX_BASE;
}
