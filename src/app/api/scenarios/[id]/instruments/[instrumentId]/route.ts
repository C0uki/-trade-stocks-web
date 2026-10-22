import { requireUserId, route } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { instrumentView } from "@/lib/game/views";

export const GET = route(async (_req, ctx: RouteContext<"/api/scenarios/[id]/instruments/[instrumentId]">) => {
  const { id, instrumentId } = await ctx.params;
  const iid = Number(instrumentId);
  if (!Number.isInteger(iid)) throw new GameError(400, "銘柄IDが正しくありません");
  return instrumentView(id, await requireUserId(), iid);
});
