import type { IsoDate, RawBar } from "../../src/lib/engine/calendar";
import type { FundamentalReport } from "../../src/lib/engine/fundamentals";
import type { Currency } from "../../src/lib/engine/instruments";

export type DailyData = {
  currency: string;
  /** 分割補正済み・日付昇順 */
  bars: RawBar[];
  /** 1株あたり・分割補正済み */
  dividends: { exDate: IsoDate; amount: number }[];
  splits: { date: IsoDate; numerator: number; denominator: number }[];
};

/**
 * 市場データの取り込み口。無料源（Yahoo）から再配布可の有料源へ切り替えるときは、
 * これを実装したクラスを providers/ に追加して run.ts の選択を変えるだけにする。
 */
export interface DataProvider {
  readonly name: string;
  fetchDaily(providerSymbol: string, from: IsoDate, to: IsoDate): Promise<DailyData>;
  /** 1通貨単位あたりの円 */
  fetchFx(currency: Exclude<Currency, "JPY">, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; value: number }[]>;
  /** 過去時点の決算（発表日付き）。提供していないデータ源は実装しない */
  fetchFundamentals?(providerSymbol: string): Promise<FundamentalReport[]>;
}
