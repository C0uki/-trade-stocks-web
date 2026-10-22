/**
 * 取引対象の種類。第2段階で "future"（先物：証拠金・レバレッジ・ショート）を実装する。
 * エンジンは kind ごとにコストと約定ルールを切り替えられる形にしてある。
 */
export type AssetKind = "stock" | "etf" | "crypto" | "future";

export type Currency = "JPY" | "USD" | "EUR";

export type Market = "JP" | "US" | "EU" | "CRYPTO";

export type Instrument = {
  id: number;
  symbol: string;
  name: string;
  kind: AssetKind;
  market: Market;
  currency: Currency;
  sector: string | null;
};

export const CURRENCIES: readonly Currency[] = ["JPY", "USD", "EUR"];
