import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InviteForm } from "@/components/InviteForm";
import { NicknameForm } from "@/components/NicknameForm";
import { db, schema } from "@/lib/db";
import { ja } from "@/lib/i18n/ja";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  return (
    <div className="panel mx-auto max-w-md space-y-8 p-6">
      <section>
        <h1 className="text-xl font-bold">{ja.settings.title}</h1>
        <NicknameForm initial={user?.nickname ?? user?.name ?? ""} />
      </section>
      <section className="border-t border-line pt-6">
        <h2 className="font-semibold">{ja.settings.invite}</h2>
        {user?.isInsider ? (
          <p className="mt-2 text-sm text-up" data-testid="insider">
            {ja.settings.insider}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{ja.settings.inviteLead}</p>
            <InviteForm />
          </>
        )}
      </section>
      {session.user.isAdmin && (
        <Link href="/admin/invites" className="btn">
          {ja.settings.admin}
        </Link>
      )}
    </div>
  );
}
