import { requireUserId, route } from "@/lib/api";
import { scenarioView } from "@/lib/game/views";

export const GET = route(async (_req, ctx: RouteContext<"/api/scenarios/[id]">) => {
  const { id } = await ctx.params;
  return scenarioView(id, await requireUserId());
});
