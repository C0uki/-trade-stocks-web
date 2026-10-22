import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NicknameForm } from "@/components/NicknameForm";
import { db, schema } from "@/lib/db";
import { ja } from "@/lib/i18n/ja";

export default async function SettingsPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  return (
    <div className="panel mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">{ja.settings.title}</h1>
      <NicknameForm initial={user?.nickname ?? user?.name ?? ""} />
    </div>
  );
}
