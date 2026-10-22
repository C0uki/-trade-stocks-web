"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ja } from "@/lib/i18n/ja";

export function InviteForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/invites/redeem", { body: { code } });
          setMsg({ ok: true, text: ja.settings.redeemed });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="input min-w-0 flex-1"
        aria-label={ja.settings.invite}
        placeholder="XXXX-XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button className="btn btn-primary" disabled={busy || !code.trim()}>
        {ja.settings.redeem}
      </button>
      {msg && <p className={`w-full text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
    </form>
  );
}
