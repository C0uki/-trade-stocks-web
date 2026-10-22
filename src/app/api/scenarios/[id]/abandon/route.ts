import { requireUserId, route } from "@/lib/api";
import { abandonScenario } from "@/lib/game/service";

export const POST = route(async (_req, ctx: RouteContext<"/api/scenarios/[id]/abandon">) => {
  const { id } = await ctx.params;
  await abandonScenario(id, await requireUserId());
});
