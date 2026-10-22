import NextAuth, { type NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * 開発・E2E 用のテストログイン。名前だけでログインできるので、
 * AUTH_DEV_LOGIN=1 かつ Vercel 以外（ローカル・CI）でしか有効にしない。
 */
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "1" && process.env.VERCEL !== "1";

const providers: NextAuthConfig["providers"] = [Google, GitHub];
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "テストログイン",
      credentials: { name: { label: "名前" } },
      async authorize(credentials) {
        const name = String(credentials?.name ?? "").trim();
        if (!/^[\w-]{1,32}$/.test(name)) return null;
        const email = `${name}@dev.local`;
        const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
        if (existing) return existing;
        const [created] = await db.insert(schema.users).values({ name, email, nickname: name }).returning();
        return created;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  // テストログイン（Credentials）と共通にするため JWT セッションにする
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
