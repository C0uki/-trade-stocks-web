import type { AssetKind, Currency, Market } from "../../../src/lib/engine/instruments";

export type UniverseEntry = {
  providerSymbol: string;
  symbol: string;
  name: string;
  kind: AssetKind;
  market: Market;
  currency: Currency;
  sector: string | null;
  indexes: string[];
};
