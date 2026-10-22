import Link from "next/link";
import { auth } from "@/auth";
import { StartButton } from "@/components/StartButton";
import { points, tone } from "@/lib/format";
import { currentSeason, mySeasonProgress, seasonRanking } from "@/lib/game/ranking";
import { myScenarios } from "@/lib/game/views";
import { ja } from "@/lib/i18n/ja";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;
  const season = currentSeason();
  const [scenarios, top, progress] = await Promise.all([
    userId ? myScenarios(userId) : Promise.resolve([]),
    seasonRanking(season),
    userId ? mySeasonProgress(userId, season) : Promise.resolve(null),
  ]);
  const activeRanked = scenarios.find((s) => s.mode === "ranked" && s.status === "active");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel p-6">
        <p className="text-sm font-semibold text-accent">{ja.app.tagline}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{ja.app.name}</h1>
        <p className="mt-3 text-muted">{ja.home.lead}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {ja.home.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-accent">●</span>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-start gap-3">
          {!userId ? (
            <Link href="/login" className="btn btn-primary">
              {ja.home.loginToPlay}
            </Link>
          ) : activeRanked ? (
            <Link href={`/play/${activeRanked.id}`} className="btn btn-primary">
              {ja.home.continueRanked}（{ja.home.dayN(activeRanked.currentDay)}）
            </Link>
          ) : (
            <StartButton label={ja.home.startRanked} body={{ mode: "ranked" }} />
          )}
          <Link href="/practice" className="btn">
            {ja.home.practice}
          </Link>
        </div>
        {progress && <p className="mt-3 text-sm text-muted">{ja.home.progress(progress.count, progress.required)}</p>}

        {userId && (
          <div className="mt-8">
            <h2 className="mb-2 font-semibold">{ja.home.myScenarios}</h2>
            {scenarios.length === 0 ? (
              <p className="text-sm text-muted">{ja.home.noScenarios}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{ja.home.cols.mode}</th>
                      <th>{ja.home.cols.status}</th>
                      <th>{ja.home.cols.period}</th>
                      <th className="num">{ja.home.cols.day}</th>
                      <th className="num">{ja.home.cols.score}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr key={s.id}>
                        <td>{s.mode === "ranked" ? ja.scenario.ranked : ja.scenario.practice}</td>
                        <td>{ja.scenario.status[s.status]}</td>
                        <td className="text-muted">
                          {s.period ? `${s.period.start} 〜 ${s.period.end}` : ja.scenario.hiddenPeriod}
                        </td>
                        <td className="num">{ja.home.dayN(s.currentDay)}</td>
                        <td className={`num ${tone(s.score)}`}>{points(s.score)}</td>
                        <td>
                          <Link
                            href={s.status === "active" ? `/play/${s.id}` : `/result/${s.id}`}
                            className="text-accent hover:underline"
                          >
                            {s.status === "active" ? ja.scenario.open : ja.scenario.result}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="panel h-fit p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{ja.home.seasonTop}</h2>
          <span className="text-xs text-muted">{season}</span>
        </div>
        {top.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{ja.ranking.empty}</p>
        ) : (
          <ol className="mt-3 space-y-1.5 text-sm">
            {top.slice(0, 10).map((r) => (
              <li key={r.userId} className="flex justify-between gap-2">
                <span>
                  <span className="mr-2 inline-block w-5 text-right text-muted">{r.rank}</span>
                  {r.name}
                </span>
                <span className={tone(r.avgScore)}>{points(r.avgScore)}</span>
              </li>
            ))}
          </ol>
        )}
        <Link href="/ranking" className="mt-4 inline-block text-sm text-accent hover:underline">
          {ja.ranking.title} →
        </Link>
      </aside>
    </div>
  );
}
