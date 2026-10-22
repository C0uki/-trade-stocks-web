"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { ja } from "@/lib/i18n/ja";

export function NicknameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/me", { method: "PATCH", body: { nickname: name } });
          setMsg({ ok: true, text: ja.settings.saved });
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        }
      }}
    >
      <label className="block text-sm text-muted">
        {ja.settings.nickname}
        <input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn btn-primary">{ja.settings.save}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
    </form>
  );
}
