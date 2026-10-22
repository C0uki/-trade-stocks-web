import type { AssetKind, Currency } from "@/lib/engine/instruments";

/** 初期資金（円） */
export const INITIAL_CASH = 10_000_000;

/** シナリオの営業日数（約1年） */
export const SCENARIO_DAYS = 250;

/** 開始前に見せる過去チャートの営業日数（約1年） */
export const PRE_HISTORY_DAYS = 250;

/** 譲渡益・配当にかかる税率（所得税15.315%＋住民税5%） */
export const TAX_RATE = 0.20315;

/** 月間ランキングに載るのに必要な完了シナリオ数 */
export const MIN_SCENARIOS_FOR_RANKING = 3;

export type CostSchedule = {
  /** 約定金額に対する手数料率 */
  commission: number;
  /** 片道スプレッド（買いは上乗せ、売りは差し引き） */
  spread: number;
};

/** 資産クラス・市場ごとの取引コスト */
export const COSTS: Record<"JP" | "US" | "EU" | "CRYPTO", CostSchedule> = {
  JP: { commission: 0.001, spread: 0.0005 },
  US: { commission: 0.0045, spread: 0.0005 },
  EU: { commission: 0.0045, spread: 0.0005 },
  CRYPTO: { commission: 0.001, spread: 0.005 },
};

/** 外貨建ての資産を売買するときの為替手数料（片道） */
export const FX_FEE = 0.0025;

export function costScheduleFor(kind: AssetKind, market: string): CostSchedule {
  if (kind === "crypto") return COSTS.CRYPTO;
  if (market === "JP" || market === "US" || market === "EU") return COSTS[market];
  return COSTS.US;
}

/** 暗号資産は国内取引所の円建て取引を想定し、為替手数料はかけない */
export function fxFeeFor(kind: AssetKind, currency: Currency): number {
  if (kind === "crypto" || currency === "JPY") return 0;
  return FX_FEE;
}
