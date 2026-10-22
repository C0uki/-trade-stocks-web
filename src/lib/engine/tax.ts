/**
 * 特定口座（源泉徴収あり）風の税計算。
 * - 譲渡損益は平均取得単価（手数料込み）で計算し、シナリオ（1年）内で通算する
 * - 売却のたびに「年初来の実現益 × 税率」との差額を徴収、または還付する
 * - 配当は受取時に一律で源泉徴収する（譲渡損失との通算はしない）
 */

export type TaxState = {
  /** シナリオ開始からの実現損益の合計 */
  realized: number;
  /** 譲渡益について徴収済みの税額（還付後の正味） */
  paid: number;
};

export const emptyTax = (): TaxState => ({ realized: 0, paid: 0 });

/** 実現損益を加え、追加で徴収（正）または還付（負）する税額を返す */
export function settleRealized(state: TaxState, pnl: number, rate: number): { state: TaxState; delta: number } {
  const realized = state.realized + pnl;
  const target = Math.max(0, realized) * rate;
  const delta = target - state.paid;
  return { state: { realized, paid: target }, delta };
}

export function dividendWithholding(gross: number, rate: number): number {
  return gross * rate;
}
