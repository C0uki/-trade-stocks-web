import { requireAdmin, route } from "@/lib/api";
import { createInvite, listInvites } from "@/lib/game/invites";

export const GET = route(async () => {
  await requireAdmin();
  return listInvites();
});

export const POST = route(async () => {
  const adminId = await requireAdmin();
  return { code: await createInvite(adminId) };
});
