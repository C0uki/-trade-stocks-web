import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PlayClient } from "@/components/play/PlayClient";
import { GameError } from "@/lib/game/errors";
import { marketView, scenarioView } from "@/lib/game/views";

export default async function PlayPage({ params }: PageProps<"/play/[id]">) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const [view, market] = await Promise.all([scenarioView(id, userId), marketView(id, userId)]).catch((e) => {
    if (e instanceof GameError && e.status === 404) notFound();
    throw e;
  });
  return <PlayClient id={id} initial={view} initialMarket={market} />;
}
