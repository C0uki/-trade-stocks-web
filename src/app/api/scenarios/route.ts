import { z } from "zod";
import { json, requireUserId, route } from "@/lib/api";
import { createScenario } from "@/lib/game/service";
import { myScenarios } from "@/lib/game/views";

const CreateBody = z.object({
  mode: z.enum(["ranked", "practice"]),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  showReal: z.boolean().optional(),
});

export const GET = route(async () => myScenarios(await requireUserId()));

export const POST = route(async (req) => {
  const userId = await requireUserId();
  const body = await json(req, CreateBody);
  return { id: await createScenario(userId, body) };
});
