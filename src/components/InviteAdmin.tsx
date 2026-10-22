"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ja } from "@/lib/i18n/ja";

type Row = { code: string; createdAt: string; status: "open" | "used" | "revoked"; user: string | null };

export function InviteAdmin({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <button
        className="btn btn-primary"
        onClick={() =>
          act(async () => {
            const { code } = await api<{ code: string }>("/api/admin/invites", { method: "POST" });
            setIssued(code);
          })
        }
      >
        {ja.admin.issue}
      </button>
      {issued && (
        <p className="rounded-lg bg-panel-2 p-3 font-mono text-lg" data-testid="issued-code">
          {issued}
        </p>
      )}
      {error && <p className="text-sm text-down">{error}</p>}
      {initial.length === 0 ? (
        <p className="text-sm text-muted">{ja.admin.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>{ja.admin.cols.code}</th>
                <th>{ja.admin.cols.created}</th>
                <th>{ja.admin.cols.status}</th>
                <th>{ja.admin.cols.user}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {initial.map((r) => (
                <tr key={r.code}>
                  <td className="font-mono">{r.code}</td>
                  <td className="text-muted">{r.createdAt.slice(0, 10)}</td>
                  <td>{ja.admin.status[r.status]}</td>
                  <td>{r.user ?? ""}</td>
                  <td>
                    {r.status === "open" && (
                      <button
                        className="text-sm text-down hover:underline"
                        onClick={() =>
                          act(() => api(`/api/admin/invites/${encodeURIComponent(r.code)}`, { method: "DELETE" }))
                        }
                      >
                        {ja.admin.revoke}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
