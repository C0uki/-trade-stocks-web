import { requireUserId, route } from "@/lib/api";
import { marketView } from "@/lib/game/views";

export const GET = route(async (_req, ctx: RouteContext<"/api/scenarios/[id]/market">) => {
  const { id } = await ctx.params;
  return marketView(id, await requireUserId());
});
