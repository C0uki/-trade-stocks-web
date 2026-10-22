import Link from "next/link";
import { auth } from "@/auth";
import { PracticeForm } from "@/components/PracticeForm";
import { StartButton } from "@/components/StartButton";
import { selectableRange } from "@/lib/game/service";
import { ja } from "@/lib/i18n/ja";

export default async function PracticePage() {
  const session = await auth();
  const insider = !!session?.user?.isInsider;
  const realRange = insider ? await selectableRange("real") : null;
  return (
    <div className="panel mx-auto max-w-lg p-6">
      <h1 className="text-xl font-bold">{ja.practice.title}</h1>
      <p className="mt-2 text-sm text-muted">{ja.practice.lead}</p>
      {!session?.user ? (
        <Link href="/login" className="btn btn-primary mt-5">
          {ja.home.loginToPlay}
        </Link>
      ) : (
        <div className="mt-5 space-y-6">
          <section>
            <h2 className="font-semibold">{ja.dataset.syntheticLong}</h2>
            <p className="mt-1 text-sm text-muted">{ja.practice.syntheticNote}</p>
            <div className="mt-3">
              <StartButton label={ja.practice.start} body={{ mode: "practice", dataset: "synthetic" }} />
            </div>
          </section>
          {insider && (
            <section className="border-t border-line pt-5">
              <h2 className="font-semibold">{ja.dataset.realLong}</h2>
              <p className="mt-1 text-sm text-muted">{ja.practice.realNote}</p>
              {realRange ? (
                <PracticeForm min={realRange.min} max={realRange.max} />
              ) : (
                <p className="mt-3 text-sm text-down">{ja.practice.noData}</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
