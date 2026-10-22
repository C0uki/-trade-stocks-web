import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL が設定されていません");

// 開発中のホットリロードで接続が増え続けないよう、グローバルに1つだけ持つ
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = g.__pg ?? postgres(url, { max: 10, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
