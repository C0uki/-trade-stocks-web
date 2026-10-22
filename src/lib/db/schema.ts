import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────── 認証（Auth.js の Drizzle アダプタ形式） ───────────── */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  /** ランキングに表示する名前 */
  nickname: text("nickname"),
  /** 招待コードで認められた身内。実データで遊べる */
  isInsider: boolean("is_insider").notNull().default(false),
});

/** 身内を招待するコード。使えるのは1回だけ */
export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ───────────── 市場データ（取込スクリプトが書き込む） ───────────── */

/** real＝実データ（身内のみ）、synthetic＝数式モデルで生成した架空のデータ（誰でも） */
export const DATASETS = ["real", "synthetic"] as const;
export type Dataset = (typeof DATASETS)[number];

export const instruments = pgTable("instruments", {
  id: serial("id").primaryKey(),
  dataset: text("dataset", { enum: DATASETS }).notNull().default("real"),
  /** 表示用のティッカー（例: 7203, AAPL, SAP, BTC） */
  symbol: text("symbol").notNull(),
  /** データ源でのシンボル（例: 7203.T, SAP.DE, BTC-USD） */
  providerSymbol: text("provider_symbol").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["stock", "etf", "crypto", "future"] }).notNull(),
  market: text("market", { enum: ["JP", "US", "EU", "CRYPTO"] }).notNull(),
  currency: text("currency", { enum: ["JPY", "USD", "EUR"] }).notNull(),
  sector: text("sector"),
  /** 取込済みの最初と最後の日付（シナリオの除外判定に使う） */
  firstDate: date("first_date"),
  lastDate: date("last_date"),
});

/** 指数の構成銘柄だった期間。当面は現在の構成のみ（toDate=null）を入れる */
export const indexMemberships = pgTable(
  "index_memberships",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    indexCode: text("index_code").notNull(),
    fromDate: date("from_date"),
    toDate: date("to_date"),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.indexCode] })],
);

/** 日足（現地通貨・分割補正済み） */
export const dailyBars = pgTable(
  "daily_bars",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.date] }), index("daily_bars_date_idx").on(t.date)],
);

/** 1通貨単位あたりの円 */
export const fxRates = pgTable(
  "fx_rates",
  {
    dataset: text("dataset", { enum: DATASETS }).notNull().default("real"),
    currency: text("currency").notNull(),
    date: date("date").notNull(),
    jpyPerUnit: doublePrecision("jpy_per_unit").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dataset, t.currency, t.date] })],
);

/** 配当（1株あたり・現地通貨・分割補正済み） */
export const dividends = pgTable(
  "dividends",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    exDate: date("ex_date").notNull(),
    amount: doublePrecision("amount").notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.exDate] })],
);

export const splits = pgTable(
  "splits",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    numerator: doublePrecision("numerator").notNull(),
    denominator: doublePrecision("denominator").notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.date] })],
);

/** 決算データ。reportDate（発表日）より前には見せない */
export const fundamentals = pgTable(
  "fundamentals",
  {
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    epsTtm: doublePrecision("eps_ttm"),
    bps: doublePrecision("bps"),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.reportDate] })],
);

/* ───────────── ゲーム ───────────── */

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["ranked", "practice"] }).notNull(),
    dataset: text("dataset", { enum: DATASETS }).notNull().default("real"),
    /** 練習モードで実価格・実日付を表示するか */
    showReal: boolean("show_real").notNull().default(false),
    /** カレンダー0日目（開始日）の実日付。ランク戦では終了までクライアントに出さない */
    startDate: date("start_date").notNull(),
    currentDay: integer("current_day").notNull().default(0),
    status: text("status", { enum: ["active", "finished", "abandoned"] }).notNull().default("active"),
    cash: doublePrecision("cash").notNull(),
    taxRealized: doublePrecision("tax_realized").notNull().default(0),
    taxPaid: doublePrecision("tax_paid").notNull().default(0),
    finalValue: doublePrecision("final_value"),
    benchmarkValue: doublePrecision("benchmark_value"),
    score: doublePrecision("score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("scenarios_user_idx").on(t.userId),
    index("scenarios_ranking_idx").on(t.dataset, t.mode, t.status, t.finishedAt),
    // ランク戦はデータごとに同時に1本まで
    uniqueIndex("scenarios_one_active_ranked")
      .on(t.userId, t.dataset)
      .where(sql`${t.mode} = 'ranked' and ${t.status} = 'active'`),
  ],
);

/** シナリオに含まれる銘柄と、指数化の基準値（開始日の円換算終値） */
export const scenarioInstruments = pgTable(
  "scenario_instruments",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    instrumentId: integer("instrument_id")
      .notNull()
      .references(() => instruments.id),
    basePriceJpy: doublePrecision("base_price_jpy").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.instrumentId] })],
);

export const positions = pgTable(
  "positions",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    instrumentId: integer("instrument_id").notNull(),
    qty: doublePrecision("qty").notNull(),
    costBasis: doublePrecision("cost_basis").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.instrumentId] })],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    instrumentId: integer("instrument_id").notNull(),
    side: text("side", { enum: ["buy", "sell"] }).notNull(),
    type: text("type", { enum: ["market", "limit"] }).notNull(),
    limitPrice: doublePrecision("limit_price"),
    amount: doublePrecision("amount"),
    fraction: doublePrecision("fraction"),
    placedDay: integer("placed_day").notNull(),
    status: text("status", { enum: ["open", "filled", "cancelled"] }).notNull().default("open"),
    closedDay: integer("closed_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_scenario_idx").on(t.scenarioId, t.status)],
);

/** 約定・配当・税・取消の記録 */
export const ledger = pgTable(
  "ledger",
  {
    id: serial("id").primaryKey(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    kind: text("kind", { enum: ["trade", "dividend", "tax", "cancel"] }).notNull(),
    orderId: uuid("order_id"),
    instrumentId: integer("instrument_id"),
    side: text("side"),
    qty: doublePrecision("qty"),
    price: doublePrecision("price"),
    gross: doublePrecision("gross"),
    fees: doublePrecision("fees"),
    tax: doublePrecision("tax"),
    realizedPnl: doublePrecision("realized_pnl"),
    note: text("note"),
  },
  (t) => [index("ledger_scenario_idx").on(t.scenarioId, t.day)],
);

/** 日ごとの資産推移（時価評価） */
export const equityHistory = pgTable(
  "equity_history",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    equity: doublePrecision("equity").notNull(),
    /** ベンチマークの時価評価（終了時にまとめて書き込む） */
    benchmarkEquity: doublePrecision("benchmark_equity"),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.day] })],
);
