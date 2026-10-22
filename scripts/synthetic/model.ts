/**
 * 架空の相場を数式モデルで生成する。実データは一切使わない。
 *
 * - 世界共通の局面（好況・平常・不況・危機）がマルコフ連鎖で切り替わり、ドリフトと値動きの大きさが変わる
 * - 株の日次リターン＝ 地域因子（世界因子に連動）× β ＋ 業種因子 ＋ 個別要因（ボラティリティ・クラスタリング付き）
 *   ＋ 決算での窓開け ＋ まれなジャンプ。権利落ち日には配当分だけ下がる
 * - 市場ごとに架空の祝日があり、その日は足がない（休場）
 * - 暗号資産は毎日動き、独自のブーム・バスト局面を持ち、歴史の途中から上場する
 * - ETF は各地域の構成銘柄の時価総額加重指数
 * - 為替は平均回帰する対数ランダムウォークで、リスクオフ時に円高になる
 */
import { addDays, isWeekday, type IsoDate, type RawBar } from "../../src/lib/engine/calendar";
import type { AssetKind, Currency, Market } from "../../src/lib/engine/instruments";
import { cryptoAssets, japaneseCompanies, SECTORS, westernCompanies, type Sector } from "./names";
import { Rng } from "./random";

export type SynthInstrument = {
  providerSymbol: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  market: Market;
  currency: Currency;
  sector: string;
  bars: RawBar[];
  dividends: { exDate: IsoDate; amount: number }[];
};

export type SynthWorld = {
  instruments: SynthInstrument[];
  fx: Record<"USD" | "EUR", { date: IsoDate; value: number }[]>;
};

export type WorldOptions = {
  seed: number;
  start: IsoDate;
  years: number;
  counts?: { JP: number; US: number; EU: number; CRYPTO: number };
};

const TD = 252;

type Regime = "bull" | "calm" | "bear" | "crisis";
const REGIME: Record<Regime, { mu: number; vol: number; next: [Regime, number][] }> = {
  bull: { mu: 0.16, vol: 0.8, next: [["calm", 0.004], ["bear", 0.001]] },
  calm: { mu: 0.06, vol: 1.0, next: [["bull", 0.003], ["bear", 0.002]] },
  bear: { mu: -0.2, vol: 1.4, next: [["calm", 0.006], ["bull", 0.002], ["crisis", 0.002]] },
  crisis: { mu: -0.7, vol: 2.6, next: [["bear", 0.02], ["calm", 0.012]] },
};

type CryptoRegime = "boom" | "winter" | "chop";
const CRYPTO_REGIME: Record<CryptoRegime, { mu: number; vol: number; next: [CryptoRegime, number][] }> = {
  boom: { mu: 2.0, vol: 1.1, next: [["winter", 0.006], ["chop", 0.004]] },
  winter: { mu: -1.0, vol: 1.0, next: [["chop", 0.005], ["boom", 0.002]] },
  chop: { mu: 0.1, vol: 0.8, next: [["boom", 0.004], ["winter", 0.003]] },
};

function step<R extends string>(rng: Rng, cur: R, table: Record<R, { next: [R, number][] }>): R {
  let u = rng.next();
  for (const [to, p] of table[cur].next) {
    if (u < p) return to;
    u -= p;
  }
  return cur;
}

/** 市場ごとの架空の祝日（月日）。毎年同じ日に休場する */
function holidays(rng: Rng, market: "JP" | "US" | "EU"): Set<string> {
  const fixed = market === "JP" ? ["01-01", "01-02", "01-03", "05-03", "05-04", "05-05", "12-31"] : ["01-01", "12-25"];
  const extra = market === "JP" ? 9 : market === "US" ? 7 : 6;
  const days = new Set(fixed);
  while (days.size < fixed.length + extra) {
    const m = rng.int(1, 12);
    const d = rng.int(1, 28);
    days.add(`${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

/** 当日の値動き（対数リターン）から OHLC を作る */
function makeBar(rng: Rng, date: IsoDate, prevClose: number, r: number, dailyVol: number, baseVolume: number): RawBar {
  const gap = r * rng.uniform(0.2, 0.5) + rng.normal() * dailyVol * 0.15;
  const open = prevClose * Math.exp(gap);
  const close = prevClose * Math.exp(r);
  const high = Math.max(open, close) * Math.exp(Math.abs(rng.normal()) * dailyVol * 0.45);
  const low = Math.min(open, close) * Math.exp(-Math.abs(rng.normal()) * dailyVol * 0.45);
  const volume = Math.round(baseVolume * Math.exp(rng.normal() * 0.3) * (1 + 8 * Math.abs(r)));
  return { date, open, high, low, close, volume };
}

type Stock = {
  info: { name: string; symbol: string; sector: Sector };
  market: "JP" | "US" | "EU";
  beta: number;
  sectorLoad: number;
  alpha: number;
  idioVar: number;
  idioTarget: number;
  earningsOffset: number;
  listedFrom: number;
  shares: number;
  yieldRate: number;
  divMonths: number[];
  price: number;
  baseVolume: number;
  inst: SynthInstrument;
};

const CURRENCY: Record<"JP" | "US" | "EU", Currency> = { JP: "JPY", US: "USD", EU: "EUR" };
const PRICE_RANGE: Record<"JP" | "US" | "EU", [number, number]> = { JP: [400, 6000], US: [15, 300], EU: [10, 150] };
const DIV_MONTHS: Record<"JP" | "US" | "EU", number[][]> = {
  JP: [[3, 9]],
  US: [[2, 5, 8, 11], [3, 6, 9, 12]],
  EU: [[5], [4, 10]],
};

export function generateWorld(opts: WorldOptions): SynthWorld {
  const rng = new Rng(opts.seed);
  const counts = opts.counts ?? { JP: 30, US: 34, EU: 24, CRYPTO: 7 };
  const totalDays = Math.round(opts.years * 365.25);
  const weekdayCount = Math.round(totalDays * (5 / 7));

  const companies = {
    JP: japaneseCompanies(rng, counts.JP),
    US: westernCompanies(rng, counts.US, "US"),
    EU: westernCompanies(rng, counts.EU, "EU"),
  };
  const holi = { JP: holidays(rng, "JP"), US: holidays(rng, "US"), EU: holidays(rng, "EU") };

  const stocks: Stock[] = [];
  for (const market of ["JP", "US", "EU"] as const) {
    for (const info of companies[market]) {
      const [lo, hi] = PRICE_RANGE[market];
      const idioVol = rng.uniform(0.15, 0.4);
      // 15% の会社は歴史の途中で上場する
      const listedFrom = rng.chance(0.15) ? rng.int(TD * 3, Math.floor(weekdayCount * 0.6)) : 0;
      stocks.push({
        info,
        market,
        beta: rng.uniform(0.6, 1.4),
        sectorLoad: rng.uniform(0.5, 1.2),
        alpha: rng.uniform(-0.06, 0.08),
        idioVar: (idioVol * idioVol) / TD,
        idioTarget: (idioVol * idioVol) / TD,
        earningsOffset: rng.int(0, 62),
        listedFrom,
        shares: Math.exp(rng.uniform(Math.log(1e8), Math.log(5e9))),
        yieldRate: rng.chance(0.15) ? 0 : rng.uniform(0.005, 0.045),
        divMonths: rng.pick(DIV_MONTHS[market]),
        price: Math.exp(rng.uniform(Math.log(lo), Math.log(hi))),
        baseVolume: Math.exp(rng.uniform(Math.log(2e5), Math.log(2e7))),
        inst: {
          providerSymbol: `SYN-${market}-${info.symbol}`,
          symbol: info.symbol,
          name: info.name,
          kind: "stock",
          market,
          currency: CURRENCY[market],
          sector: info.sector,
          bars: [],
          dividends: [],
        },
      });
    }
  }

  const etfs = (["JP", "US", "EU"] as const).map((market) => ({
    market,
    level: 100,
    inst: {
      providerSymbol: `SYN-${market}-ETF`,
      symbol: market === "JP" ? "1300" : market === "US" ? "SYNX" : "SXEF",
      name: market === "JP" ? "架空日本株インデックスETF" : market === "US" ? "架空米国株インデックスETF" : "架空欧州株インデックスETF",
      kind: "etf" as const,
      market,
      currency: CURRENCY[market],
      sector: "ETF",
      bars: [] as RawBar[],
      dividends: [] as { exDate: IsoDate; amount: number }[],
    },
  }));

  const cryptos = cryptoAssets(counts.CRYPTO).map((c) => ({
    beta: rng.uniform(0.6, 1.4),
    idioVol: rng.uniform(0.4, 0.9),
    listedFromDay: rng.int(Math.floor(totalDays * 0.25), Math.floor(totalDays * 0.6)),
    price: Math.exp(rng.uniform(Math.log(0.05), Math.log(50))),
    baseVolume: Math.exp(rng.uniform(Math.log(1e6), Math.log(1e9))),
    inst: {
      providerSymbol: `SYN-CRYPTO-${c.symbol}`,
      symbol: c.symbol,
      name: c.name,
      kind: "crypto" as const,
      market: "CRYPTO" as const,
      currency: "USD" as const,
      sector: "暗号資産",
      bars: [] as RawBar[],
      dividends: [] as { exDate: IsoDate; amount: number }[],
    },
  }));

  const fx = { USD: [] as { date: IsoDate; value: number }[], EUR: [] as { date: IsoDate; value: number }[] };
  let usd = Math.log(rng.uniform(95, 130));
  let eur = Math.log(rng.uniform(110, 150));
  const usdMean = usd;
  const eurMean = eur;

  let regime: Regime = "calm";
  let cryptoRegime: CryptoRegime = "chop";
  let weekdayIndex = -1;
  let lastGlobal = 0;

  for (let day = 0; day < totalDays; day++) {
    const date = addDays(opts.start, day);
    const md = date.slice(5);
    const month = Number(date.slice(5, 7));

    // 暗号資産は毎日動く。株式市場の世界因子とは週末を挟んで弱く連動
    cryptoRegime = step(rng, cryptoRegime, CRYPTO_REGIME);
    const cr = CRYPTO_REGIME[cryptoRegime];
    const cryptoFactor = cr.mu / 365 + rng.normal() * (0.6 / Math.sqrt(365)) * cr.vol + 0.3 * lastGlobal;
    for (const c of cryptos) {
      if (day < c.listedFromDay) continue;
      const vol = c.idioVol / Math.sqrt(365);
      let r = c.beta * cryptoFactor + rng.normal() * vol;
      if (rng.chance(0.004)) r += rng.normal() * 0.2;
      const prev = c.price;
      c.price = prev * Math.exp(r);
      c.inst.bars.push(makeBar(rng, date, prev, r, Math.sqrt(vol * vol + 0.0004), c.baseVolume));
    }

    if (!isWeekday(date)) continue;
    weekdayIndex++;

    regime = step(rng, regime, REGIME);
    const rg = REGIME[regime];
    let global = rg.mu / TD + rng.normal() * (0.12 / Math.sqrt(TD)) * rg.vol;
    if (regime === "crisis" && rng.chance(0.03)) global -= rng.uniform(0.04, 0.1);
    lastGlobal = global;

    const regional = {
      JP: 0.9 * global + rng.normal() * (0.09 / Math.sqrt(TD)),
      US: 1.0 * global + rng.normal() * (0.07 / Math.sqrt(TD)),
      EU: 0.95 * global + rng.normal() * (0.08 / Math.sqrt(TD)),
    };
    const sectorFactor = Object.fromEntries(
      SECTORS.map((s) => [s, rng.normal() * (0.1 / Math.sqrt(TD)) * rg.vol]),
    ) as Record<Sector, number>;

    // 為替：平均回帰＋リスクオフで円高（世界因子が下がると USD/JPY・EUR/JPY が下がる）
    usd += 0.002 * (usdMean - usd) + rng.normal() * (0.09 / Math.sqrt(TD)) + 0.3 * global;
    eur += 0.002 * (eurMean - eur) + rng.normal() * (0.1 / Math.sqrt(TD)) + 0.35 * global;
    fx.USD.push({ date, value: Math.exp(usd) });
    fx.EUR.push({ date, value: Math.exp(eur) });

    const capBefore = { JP: 0, US: 0, EU: 0 };
    const capAfter = { JP: 0, US: 0, EU: 0 };
    const open = { JP: !holi.JP.has(md), US: !holi.US.has(md), EU: !holi.EU.has(md) };

    for (const s of stocks) {
      if (weekdayIndex < s.listedFrom || !open[s.market]) continue;
      const prev = s.price;
      // GARCH(1,1) 風に個別の分散を更新
      const z = rng.normal();
      let r = s.alpha / TD + s.beta * regional[s.market] + s.sectorLoad * sectorFactor[s.info.sector];
      let idio = Math.sqrt(s.idioVar) * z;
      if ((weekdayIndex + s.earningsOffset) % 63 === 0) idio += rng.normal() * 0.05;
      if (rng.chance(0.0015)) idio += rng.normal() * 0.12;
      r += idio;
      s.idioVar = 0.05 * s.idioTarget + 0.08 * idio * idio + 0.87 * s.idioVar;

      // 権利落ち：配当月の最初の取引日（その月の前の取引日が前月）に、配当分だけ下がる
      const prevBar = s.inst.bars[s.inst.bars.length - 1];
      const firstDayOfMonth = !prevBar || Number(prevBar.date.slice(5, 7)) !== month;
      if (s.yieldRate > 0 && firstDayOfMonth && s.divMonths.includes(month) && prevBar) {
        const amount = (prev * s.yieldRate) / s.divMonths.length;
        s.inst.dividends.push({ exDate: date, amount });
        r += Math.log(1 - amount / prev);
      }

      const vol = Math.sqrt(s.idioVar + (0.15 * 0.15) / TD);
      s.price = prev * Math.exp(r);
      s.inst.bars.push(makeBar(rng, date, prev, r, vol, s.baseVolume));
      capBefore[s.market] += prev * s.shares;
      capAfter[s.market] += s.price * s.shares;
    }

    for (const e of etfs) {
      if (!open[e.market] || capBefore[e.market] === 0) continue;
      const prev = e.level;
      const r = Math.log(capAfter[e.market] / capBefore[e.market]);
      e.level = prev * Math.exp(r);
      e.inst.bars.push(makeBar(rng, date, prev, r, 0.012, 5e6));
    }
  }

  return {
    instruments: [...stocks.map((s) => s.inst), ...etfs.map((e) => e.inst), ...cryptos.map((c) => c.inst)],
    fx,
  };
}

