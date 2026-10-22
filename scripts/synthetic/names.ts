import type { Rng } from "./random";

/** 業種（表示名は実データ版の GICS 和訳とそろえる） */
export const SECTORS = [
  "情報技術",
  "金融",
  "ヘルスケア",
  "一般消費財",
  "生活必需品",
  "資本財",
  "素材",
  "エネルギー",
  "通信サービス",
  "不動産",
  "公益",
] as const;
export type Sector = (typeof SECTORS)[number];

const JP_PREFIX = [
  "東都", "大和田", "北斗", "瑞穂野", "青葉", "昭栄", "富岳", "白鷺", "新星", "旭光", "千代田", "浪速",
  "若葉", "光輝", "常盤", "菱和", "三栄", "東亜", "日進", "丸和", "朝凪", "雲雀", "紅葉", "銀河",
  "和泉", "高砂", "稲穂", "鳳凰", "清流", "暁",
];
const JP_SUFFIX: Record<Sector, string[]> = {
  情報技術: ["電機", "半導体", "システム", "精機"],
  金融: ["銀行", "証券", "保険", "フィナンシャル"],
  ヘルスケア: ["製薬", "メディカル", "医療機器"],
  一般消費財: ["自動車", "百貨店", "ホールディングス"],
  生活必需品: ["食品", "製菓", "酒造", "商店"],
  資本財: ["重工", "機械", "建設", "商事"],
  素材: ["化学", "製鉄", "製紙"],
  エネルギー: ["石油", "エネルギー"],
  通信サービス: ["通信", "放送", "テレコム"],
  不動産: ["不動産", "地所"],
  公益: ["電力", "ガス"],
};

const EN_PREFIX = [
  "Northbridge", "Silverline", "Bluecrest", "Redwood", "Ironvale", "Harborview", "Summitry", "Crescent",
  "Granite Peak", "Lakeshore", "Pioneerra", "Westfield", "Brightpath", "Clearwater", "Stonegate", "Oakhurst",
  "Riverton", "Starling", "Copperfield", "Evergreen", "Falconridge", "Maple Arc", "Tidewater", "Highline",
  "Quarry Hill", "Sunmark", "Wolverton", "Aldermoor", "Bayport", "Cobalt Bay", "Driftwood", "Elmstead",
  "Foxglove", "Glenhaven",
];
const EN_SUFFIX: Record<Sector, string[]> = {
  情報技術: ["Systems", "Semiconductor", "Software", "Devices"],
  金融: ["Bancorp", "Financial", "Capital", "Insurance"],
  ヘルスケア: ["Pharma", "Health", "Biosciences", "Medical"],
  一般消費財: ["Motors", "Retail", "Brands", "Apparel"],
  生活必需品: ["Foods", "Beverages", "Household"],
  資本財: ["Industries", "Aerospace", "Machinery", "Logistics"],
  素材: ["Chemicals", "Materials", "Steel"],
  エネルギー: ["Energy", "Petroleum", "Resources"],
  通信サービス: ["Networks", "Media", "Telecom"],
  不動産: ["Realty", "Properties"],
  公益: ["Utilities", "Power"],
};

const EU_PREFIX = [
  "Rheinwerk", "Lumière", "Nordhavn", "Alpenhof", "Belvedere", "Costa Verde", "Vltava", "Brabant", "Aurelia",
  "Kastell", "Montclair", "Silvana", "Hohenberg", "Marisol", "Valcourt", "Ostmark", "Liguria", "Danubia",
  "Provenza", "Skagen", "Toscanella", "Bergamon", "Flandria", "Lusitano", "Arcadia", "Calavera",
];
const EU_SUFFIX: Record<Sector, string[]> = {
  情報技術: ["Technologie AG", "Digital SA", "Electronics NV"],
  金融: ["Bank AG", "Assurances SA", "Banca SpA"],
  ヘルスケア: ["Pharma AG", "Santé SA", "Medica NV"],
  一般消費財: ["Automobile AG", "Luxe SA", "Moda SpA"],
  生活必需品: ["Nahrung AG", "Alimentaire SA", "Brouwerij NV"],
  資本財: ["Maschinenbau AG", "Industrie SA", "Engineering NV"],
  素材: ["Chemie AG", "Matériaux SA"],
  エネルギー: ["Energie AG", "Énergies SA", "Energia SpA"],
  通信サービス: ["Telekom AG", "Médias SA"],
  不動産: ["Immobilien AG", "Immobiliare SpA"],
  公益: ["Versorgung AG", "Utilities NV"],
};

const CRYPTO = [
  ["NOVA", "ノヴァコイン"],
  ["LMN", "ルミナ"],
  ["ORB", "オーブ"],
  ["KRT", "クラート"],
  ["SAKU", "サクラトークン"],
  ["VLT", "ボルト"],
  ["ZEN", "ゼニス"],
] as const;

export type NamedCompany = { name: string; symbol: string; sector: Sector };

function uniquePicks(rng: Rng, prefixes: string[], n: number): string[] {
  return rng.shuffle([...prefixes]).slice(0, n);
}

export function japaneseCompanies(rng: Rng, n: number): NamedCompany[] {
  const codes = new Set<number>();
  return uniquePicks(rng, JP_PREFIX, n).map((p, i) => {
    const sector = SECTORS[i % SECTORS.length];
    let code = rng.int(1300, 9999);
    while (codes.has(code)) code = rng.int(1300, 9999);
    codes.add(code);
    return { name: `${p}${rng.pick(JP_SUFFIX[sector])}`, symbol: String(code), sector };
  });
}

function tickerFrom(name: string, used: Set<string>, rng: Rng): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  let t = letters.slice(0, 4);
  while (used.has(t)) t = letters.slice(0, 2) + String.fromCharCode(65 + rng.int(0, 25)) + String.fromCharCode(65 + rng.int(0, 25));
  used.add(t);
  return t;
}

export function westernCompanies(rng: Rng, n: number, region: "US" | "EU"): NamedCompany[] {
  const used = new Set<string>();
  const prefixes = region === "US" ? EN_PREFIX : EU_PREFIX;
  const suffixes = region === "US" ? EN_SUFFIX : EU_SUFFIX;
  return uniquePicks(rng, prefixes, n).map((p, i) => {
    const sector = SECTORS[(i + (region === "US" ? 3 : 7)) % SECTORS.length];
    const name = `${p} ${rng.pick(suffixes[sector])}`;
    return { name, symbol: tickerFrom(p, used, rng), sector };
  });
}

export function cryptoAssets(n: number): { symbol: string; name: string }[] {
  return CRYPTO.slice(0, n).map(([symbol, name]) => ({ symbol, name }));
}
