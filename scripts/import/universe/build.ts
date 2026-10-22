/**
 * 指数構成銘柄の一覧を Wikipedia から作り、universe.json に書き出す。
 * 生成物はリポジトリにコミットして手動管理する（構成変更時に再実行して差分を確認）。
 *   npm run import:universe
 */
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import { sectorJa } from "./sectors";
import type { UniverseEntry } from "./types";

const UA = "Mozilla/5.0 (trade-stocks-web universe builder)";

async function page(title: string) {
  const res = await fetch(`https://en.wikipedia.org/wiki/${title}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

const clean = (s: string) => s.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();

async function sp500(): Promise<UniverseEntry[]> {
  const $ = await page("List_of_S%26P_500_companies");
  const out: UniverseEntry[] = [];
  $("table#constituents tbody tr").each((_, tr) => {
    const td = $(tr).find("td");
    if (td.length < 3) return;
    const symbol = clean(td.eq(0).text());
    out.push({
      providerSymbol: symbol.replace(/\./g, "-"),
      symbol,
      name: clean(td.eq(1).text()),
      kind: "stock",
      market: "US",
      currency: "USD",
      sector: sectorJa(clean(td.eq(2).text())),
      indexes: ["SP500"],
    });
  });
  return out;
}

async function nikkei225(): Promise<UniverseEntry[]> {
  const $ = await page("Nikkei_225");
  const out: UniverseEntry[] = [];
  let section = "";
  $("h2, h3, h4, li").each((_, el) => {
    if (el.tagName !== "li") {
      section = clean($(el).text());
      return;
    }
    const m = clean($(el).text()).match(/^(.*?)\s*\(TYO:\s*([0-9A-Z]{4})\)(?:\s*\(.*\))?$/);
    if (!m) return;
    const code = m[2];
    out.push({
      providerSymbol: `${code}.T`,
      symbol: code,
      name: m[1].trim(),
      kind: "stock",
      market: "JP",
      currency: "JPY",
      sector: sectorJa(section),
      indexes: ["NIKKEI225"],
    });
  });
  return out;
}

async function eurostoxx50(): Promise<UniverseEntry[]> {
  const $ = await page("EURO_STOXX_50");
  const out: UniverseEntry[] = [];
  $("table.wikitable").each((_, t) => {
    const header = clean($(t).find("tr").first().text());
    if (!header.startsWith("Ticker")) return;
    $(t)
      .find("tr")
      .slice(1)
      .each((_, tr) => {
        const td = $(tr).find("td");
        if (td.length < 5) return;
        const ticker = clean(td.eq(0).text());
        out.push({
          providerSymbol: ticker,
          symbol: ticker.split(".")[0],
          name: clean(td.eq(2).text()),
          kind: "stock",
          market: "EU",
          currency: "EUR",
          sector: sectorJa(clean(td.eq(5).text())),
          indexes: ["EUROSTOXX50"],
        });
      });
  });
  return out;
}

/** 暗号資産（USD建てで取得し、円換算する）と各指数の連動ETF */
const EXTRA: UniverseEntry[] = [
  ...(
    [
      ["BTC", "ビットコイン"],
      ["ETH", "イーサリアム"],
      ["XRP", "XRP"],
      ["BNB", "BNB"],
      ["SOL", "ソラナ"],
      ["DOGE", "ドージコイン"],
      ["ADA", "カルダノ"],
      ["LTC", "ライトコイン"],
    ] as const
  ).map(
    ([sym, name]): UniverseEntry => ({
      providerSymbol: `${sym}-USD`,
      symbol: sym,
      name,
      kind: "crypto",
      market: "CRYPTO",
      currency: "USD",
      sector: "暗号資産",
      indexes: ["CRYPTO"],
    }),
  ),
  {
    providerSymbol: "1321.T",
    symbol: "1321",
    name: "日経225連動型上場投資信託",
    kind: "etf",
    market: "JP",
    currency: "JPY",
    sector: "ETF",
    indexes: ["ETF"],
  },
  {
    providerSymbol: "SPY",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    kind: "etf",
    market: "US",
    currency: "USD",
    sector: "ETF",
    indexes: ["ETF"],
  },
  {
    providerSymbol: "EXW1.DE",
    symbol: "EXW1",
    name: "iShares Core EURO STOXX 50 UCITS ETF (DE)",
    kind: "etf",
    market: "EU",
    currency: "EUR",
    sector: "ETF",
    indexes: ["ETF"],
  },
];

const all = [...(await nikkei225()), ...(await sp500()), ...(await eurostoxx50()), ...EXTRA];
const counts = all.reduce<Record<string, number>>((m, e) => ((m[e.indexes[0]] = (m[e.indexes[0]] ?? 0) + 1), m), {});
console.log(counts);
const out = path.join(import.meta.dirname, "universe.json");
fs.writeFileSync(out, JSON.stringify(all, null, 1) + "\n");
console.log(`wrote ${all.length} entries to ${out}`);
