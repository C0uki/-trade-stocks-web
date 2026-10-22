import "server-only";
import { sql } from "drizzle-orm";
import { MIN_SCENARIOS_FOR_RANKING } from "@/config/game";
import { db, schema } from "@/lib/db";
import type { Dataset } from "@/lib/db/schema";

/** "YYYY-MM"（日本時間） */
export function currentSeason(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7);
}

export function isSeason(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export type RankingRow = {
  rank: number;
  userId: string;
  name: string;
  scenarios: number;
  avgScore: number;
  bestScore: number;
};

/**
 * 月間ランキング：その月（日本時間）に完了・放棄したランク戦の平均スコア。
 * 規定回数に満たないプレイヤーは載らない。
 */
export async function seasonRanking(season: string, dataset: Dataset): Promise<RankingRow[]> {
  const s = schema.scenarios;
  const u = schema.users;
  const rows = await db.execute<{
    user_id: string;
    name: string | null;
    n: number;
    avg: number;
    best: number;
  }>(sql`
    select ${s.userId} as user_id, coalesce(${u.nickname}, ${u.name}, '名無し') as name,
           count(*)::int as n, avg(${s.score}) as avg, max(${s.score}) as best
    from ${s} join ${u} on ${u.id} = ${s.userId}
    where ${s.dataset} = ${dataset} and ${s.mode} = 'ranked' and ${s.status} in ('finished', 'abandoned')
      and ${s.score} is not null
      and to_char(${s.finishedAt} at time zone 'Asia/Tokyo', 'YYYY-MM') = ${season}
    group by ${s.userId}, ${u.nickname}, ${u.name}
    having count(*) >= ${MIN_SCENARIOS_FOR_RANKING}
    order by avg desc
    limit 100
  `);
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    name: r.name ?? "名無し",
    scenarios: Number(r.n),
    avgScore: Number(r.avg),
    bestScore: Number(r.best),
  }));
}

/** 自分の今月の進捗（ランキング入りまであと何回か） */
export async function mySeasonProgress(userId: string, season: string, dataset: Dataset) {
  const s = schema.scenarios;
  const [r] = await db.execute<{ n: number; avg: number | null }>(sql`
    select count(*)::int as n, avg(${s.score}) as avg from ${s}
    where ${s.userId} = ${userId} and ${s.dataset} = ${dataset} and ${s.mode} = 'ranked'
      and ${s.status} in ('finished', 'abandoned')
      and ${s.score} is not null
      and to_char(${s.finishedAt} at time zone 'Asia/Tokyo', 'YYYY-MM') = ${season}
  `);
  return { count: Number(r?.n ?? 0), avgScore: r?.avg == null ? null : Number(r.avg), required: MIN_SCENARIOS_FOR_RANKING };
}
