/**
 * 架空の相場を生成して DB に入れる（既存の架空データは消して作り直す）。
 *   npm run generate:synthetic
 *   npm run generate:synthetic -- --seed 2024 --force   # 架空データのシナリオがあっても消して作り直す
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { count, eq } from "drizzle-orm";
import { SYNTHETIC_EPOCH, SYNTHETIC_YEARS } from "../../src/config/game";
import { db, schema } from "../../src/lib/db";
import { refreshDateRange, upsertInstrument, writeBars, writeDividends, writeFx } from "../import/writer";
import { generateWorld } from "./model";

const { values: args } = parseArgs({
  options: {
    seed: { type: "string", default: "20010101" },
    years: { type: "string", default: String(SYNTHETIC_YEARS) },
    force: { type: "boolean", default: false },
  },
});

const [{ n }] = await db
  .select({ n: count() })
  .from(schema.scenarios)
  .where(eq(schema.scenarios.dataset, "synthetic"));
if (n > 0 && !args.force) {
  console.error(`架空データのシナリオが ${n} 件あります。作り直すとそれらも消えるので、--force を付けて実行してください。`);
  process.exit(1);
}

console.log(`生成中: シード ${args.seed}・${args.years} 年分`);
const world = generateWorld({ seed: Number(args.seed), start: SYNTHETIC_EPOCH, years: Number(args.years) });

await db.delete(schema.scenarios).where(eq(schema.scenarios.dataset, "synthetic"));
await db.delete(schema.instruments).where(eq(schema.instruments.dataset, "synthetic"));
await db.delete(schema.fxRates).where(eq(schema.fxRates.dataset, "synthetic"));

await writeFx("synthetic", "USD", world.fx.USD);
await writeFx("synthetic", "EUR", world.fx.EUR);

let rows = 0;
for (const inst of world.instruments) {
  const row = await upsertInstrument({
    dataset: "synthetic",
    providerSymbol: inst.providerSymbol,
    symbol: inst.symbol,
    name: inst.name,
    kind: inst.kind,
    market: inst.market,
    currency: inst.currency,
    sector: inst.sector,
  });
  await writeBars(row.id, inst.bars);
  await writeDividends(row.id, inst.dividends);
  await refreshDateRange(row.id);
  rows += inst.bars.length;
}
console.log(`完了: ${world.instruments.length} 銘柄・${rows} 行`);
process.exit(0);
