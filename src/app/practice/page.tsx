import Link from "next/link";
import { auth } from "@/auth";
import { PracticeForm } from "@/components/PracticeForm";
import { selectableRange } from "@/lib/game/service";
import { ja } from "@/lib/i18n/ja";

export default async function PracticePage() {
  const session = await auth();
  const range = await selectableRange();
  return (
    <div className="panel mx-auto max-w-lg p-6">
      <h1 className="text-xl font-bold">{ja.practice.title}</h1>
      <p className="mt-2 text-sm text-muted">{ja.practice.lead}</p>
      {!session?.user ? (
        <Link href="/login" className="btn btn-primary mt-5">
          {ja.home.loginToPlay}
        </Link>
      ) : range ? (
        <PracticeForm min={range.min} max={range.max} />
      ) : (
        <p className="mt-4 text-sm text-down">{ja.practice.noData}</p>
      )}
    </div>
  );
}
