import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { InviteAdmin } from "@/components/InviteAdmin";
import { listInvites } from "@/lib/game/invites";
import { ja } from "@/lib/i18n/ja";

export default async function AdminInvitesPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();
  const invites = await listInvites();
  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-bold">{ja.admin.title}</h1>
      <p className="mt-2 text-sm text-muted">{ja.admin.lead}</p>
      <InviteAdmin
        initial={invites.map((i) => ({
          code: i.code,
          createdAt: i.createdAt.toISOString(),
          status: i.revokedAt ? "revoked" : i.usedAt ? "used" : "open",
          user: i.usedBy ?? i.usedByName ?? null,
        }))}
      />
    </div>
  );
}
