/** 1銘柄の取引コスト。commission と fxFee は約定代金に対する率、spread は片道 */
export type CostRates = {
  commission: number;
  spread: number;
  fxFee: number;
};

export function feeRate(rates: CostRates): number {
  return rates.commission + rates.fxFee;
}

/** スプレッド込みの買い値・売り値 */
export function buyPrice(mid: number, rates: CostRates): number {
  return mid * (1 + rates.spread);
}

export function sellPrice(mid: number, rates: CostRates): number {
  return mid * (1 - rates.spread);
}

export type BuyCalc = { qty: number; gross: number; fees: number; total: number };

/** 手数料込みで amount 円を使い切る買い。price はスプレッド込み */
export function buyForAmount(amount: number, price: number, rates: CostRates): BuyCalc {
  const r = feeRate(rates);
  const qty = amount / (price * (1 + r));
  const gross = qty * price;
  const fees = gross * r;
  return { qty, gross, fees, total: gross + fees };
}

export type SellCalc = { qty: number; gross: number; fees: number; net: number };

export function sellQty(qty: number, price: number, rates: CostRates): SellCalc {
  const gross = qty * price;
  const fees = gross * feeRate(rates);
  return { qty, gross, fees, net: gross - fees };
}

/** 手取り net 円を得るのに必要な売却口数 */
export function qtyForNetProceeds(net: number, price: number, rates: CostRates): number {
  return net / (price * (1 - feeRate(rates)));
}
