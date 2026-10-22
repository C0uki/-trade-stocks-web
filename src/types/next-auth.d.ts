import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; isInsider: boolean; isAdmin: boolean } & DefaultSession["user"];
  }
}
