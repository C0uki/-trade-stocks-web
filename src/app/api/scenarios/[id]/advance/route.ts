import { z } from "zod";
import { json, requireUserId, route } from "@/lib/api";
import { advanceScenario } from "@/lib/game/service";

const Body = z.object({ steps: z.number().int().min(1).max(5) });

export const POST = route(async (req, ctx: RouteContext<"/api/scenarios/[id]/advance">) => {
  const { id } = await ctx.params;
  const userId = await requireUserId();
  const { steps } = await json(req, Body);
  return advanceScenario(id, userId, steps);
});
