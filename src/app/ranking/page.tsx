import Link from "next/link";
import { MIN_SCENARIOS_FOR_RANKING } from "@/config/game";
import { auth } from "@/auth";
import { points, tone } from "@/lib/format";
import { currentSeason, isSeason, seasonRanking } from "@/lib/game/ranking";
import { ja } from "@/lib/i18n/ja";

function shiftSeason(season: string, delta: number): string {
  const [y, m] = season.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function RankingPage({ searchParams }: PageProps<"/ranking">) {
  const q = (await searchParams).season;
  const season = typeof q === "string" && isSeason(q) ? q : currentSeason();
  const [rows, session] = await Promise.all([seasonRanking(season), auth()]);
  const me = session?.user?.id;
  const isCurrent = season === currentSeason();

  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{ja.ranking.title}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/ranking?season=${shiftSeason(season, -1)}`} className="btn">
            ←
          </Link>
          <span className="font-semibold">{season}</span>
          {!isCurrent && (
            <Link href={`/ranking?season=${shiftSeason(season, 1)}`} className="btn">
              →
            </Link>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{ja.ranking.lead(MIN_SCENARIOS_FOR_RANKING)}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{ja.ranking.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th className="num">{ja.ranking.rank}</th>
                <th>{ja.ranking.player}</th>
                <th className="num">{ja.ranking.count}</th>
                <th className="num">{ja.ranking.avg}</th>
                <th className="num">{ja.ranking.best}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className={r.userId === me ? "bg-panel-2 font-semibold" : ""}>
                  <td className="num">{r.rank}</td>
                  <td>{r.name}</td>
                  <td className="num">{r.scenarios}</td>
                  <td className={`num ${tone(r.avgScore)}`}>{points(r.avgScore)}</td>
                  <td className={`num ${tone(r.bestScore)}`}>{points(r.bestScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
