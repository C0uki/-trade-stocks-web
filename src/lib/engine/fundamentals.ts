import { addDays, type IsoDate } from "./calendar";

/**
 * 財務指標は「その日までに分かっていた情報」だけで計算する。
 * 比率なので価格水準（＝時期の手がかり）は出ない。
 */

export type DividendEvent = { exDate: IsoDate; amount: number };
export type FundamentalReport = { reportDate: IsoDate; epsTtm: number | null; bps: number | null };

/** 実績配当利回り：直近1年の権利落ち配当の合計 ÷ 終値（どちらも現地通貨） */
export function trailingDividendYield(
  dividends: readonly DividendEvent[],
  asOf: IsoDate,
  closeLocal: number,
): number | null {
  if (closeLocal <= 0) return null;
  const from = addDays(asOf, -365);
  let sum = 0;
  for (const d of dividends) if (d.exDate > from && d.exDate <= asOf) sum += d.amount;
  return sum / closeLocal;
}

/** 決算発表日が asOf 以前の最新レポートを使う（発表前の数字は見せない） */
export function latestReport(reports: readonly FundamentalReport[], asOf: IsoDate): FundamentalReport | null {
  let best: FundamentalReport | null = null;
  for (const r of reports) if (r.reportDate <= asOf && (!best || r.reportDate > best.reportDate)) best = r;
  return best;
}

export function valuationRatios(
  reports: readonly FundamentalReport[],
  asOf: IsoDate,
  closeLocal: number,
): { per: number | null; pbr: number | null } {
  const r = latestReport(reports, asOf);
  return {
    per: r?.epsTtm && r.epsTtm > 0 ? closeLocal / r.epsTtm : null,
    pbr: r?.bps && r.bps > 0 ? closeLocal / r.bps : null,
  };
}
