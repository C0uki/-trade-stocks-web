"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ja } from "@/lib/i18n/ja";

type Props = {
  label: string;
  body: { mode: "ranked" | "practice"; startDate?: string; showReal?: boolean };
  className?: string;
};

export function StartButton({ label, body, className = "btn btn-primary" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { id } = await api<{ id: string }>("/api/scenarios", { body });
            router.push(`/play/${id}`);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? ja.common.preparing : label}
      </button>
      {error && <p className="text-sm text-down">{error}</p>}
    </div>
  );
}
