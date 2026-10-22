import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ABANDON_PENALTY_SCORE } from "@/config/game";
import { EquityChart } from "@/components/EquityChart";
import { History } from "@/components/play/Portfolio";
import { StartButton } from "@/components/StartButton";
import { pct, points, tone, yen } from "@/lib/format";
import { GameError } from "@/lib/game/errors";
import { scenarioView } from "@/lib/game/views";
import { ja } from "@/lib/i18n/ja";

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const view = await scenarioView(id, userId).catch((e) => {
    if (e instanceof GameError && e.status === 404) notFound();
    throw e;
  });
  if (view.status === "active" || !view.result) redirect(`/play/${id}`);
  const r = view.result;
  const playerRet = (r.finalValue ?? 0) / view.initialCash - 1;
  const benchRet = (r.benchmarkValue ?? 0) / view.initialCash - 1;

  return (
    <div className="space-y-4">
      <section className="panel p-6">
        <div className="text-sm text-muted">
          {view.mode === "ranked" ? ja.scenario.ranked : ja.scenario.practice} · {ja.dataset[view.dataset]} ·{" "}
          {ja.scenario.status[view.status]}
          {view.status === "abandoned" && `（${ja.home.dayN(view.currentDay)}）`}
        </div>
        <h1 className="mt-1 text-2xl font-bold">{ja.result.title}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-muted">{ja.result.score}</div>
            <div className={`text-3xl font-bold ${tone(r.score)}`} data-testid="score">
              {points(r.score)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted">{ja.result.final}</div>
            <div className="text-xl font-semibold">{yen(r.finalValue)}</div>
            <div className={`text-sm ${tone(playerRet)}`}>{pct(playerRet)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">{ja.result.benchmark}</div>
            <div className="text-xl font-semibold">{yen(r.benchmarkValue)}</div>
            <div className={`text-sm ${tone(benchRet)}`}>{pct(benchRet)}</div>
          </div>
        </div>
        {view.status === "abandoned" && view.mode === "ranked" && (
          <p className="mt-4 text-sm text-down" data-testid="abandon-note">
            {ja.result.abandonNote(ABANDON_PENALTY_SCORE)}
          </p>
        )}
        {view.period && (
          <p className="mt-5 rounded-lg bg-panel-2 p-3 text-sm" data-testid="period">
            {ja.result.period}: <strong>{view.period.start}</strong> 〜 <strong>{view.period.end}</strong>
          </p>
        )}
        {view.fictionalPeriod && (
          <p className="mt-5 rounded-lg bg-panel-2 p-3 text-sm" data-testid="period">
            {ja.result.fictionalPeriod}:{" "}
            <strong>{ja.fictional(view.fictionalPeriod.startYear, view.fictionalPeriod.endYear)}</strong>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {view.mode === "ranked" && (
            <StartButton label={ja.result.again} body={{ mode: "ranked", dataset: view.dataset }} />
          )}
          <Link href="/" className="btn">
            {ja.nav.home}
          </Link>
          <Link href={`/play/${id}`} className="btn">
            {ja.result.review}
          </Link>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">{ja.result.equityChart}</h2>
        <EquityChart points={view.equityHistory} />
      </section>

      <section className="panel overflow-x-auto p-4">
        <h2 className="mb-2 font-semibold">{ja.result.trades}</h2>
        <History view={view} />
      </section>
    </div>
  );
}
