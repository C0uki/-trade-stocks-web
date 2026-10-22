"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { indexPrice, qty, yen } from "@/lib/format";
import type { InstrumentView, ScenarioView } from "@/lib/game/views";
import { ja } from "@/lib/i18n/ja";

type Props = {
  scenarioId: string;
  instrument: InstrumentView;
  position: ScenarioView["positions"][number] | undefined;
  cash: number;
  disabled: boolean;
  onPlaced: () => void;
};

const FRACTIONS = [0.25, 0.5, 1] as const;

export function OrderForm({ scenarioId, instrument, position, cash, disabled, onPlaced }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("1000000");
  const [sellBy, setSellBy] = useState<"fraction" | "amount">("fraction");
  const [fraction, setFraction] = useState<number>(1);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const last = instrument.bars[instrument.bars.length - 1];
  const c = instrument.costs;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/scenarios/${scenarioId}/orders`, {
        body: {
          instrumentId: instrument.id,
          side,
          type,
          limitPrice: type === "limit" ? Number(limit) : null,
          amount: side === "buy" || sellBy === "amount" ? Number(amount) : null,
          fraction: side === "sell" && sellBy === "fraction" ? fraction : null,
        },
      });
      setMsg({ ok: true, text: ja.order.placed });
      onPlaced();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const sellDisabled = side === "sell" && !position;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            className="btn"
            aria-pressed={side === s}
            style={
              side === s
                ? { background: s === "buy" ? "var(--up)" : "var(--down)", color: "#fff", borderColor: "transparent" }
                : undefined
            }
            onClick={() => setSide(s)}
          >
            {s === "buy" ? ja.order.buy : ja.order.sell}
          </button>
        ))}
      </div>
      <div className="flex gap-1" role="tablist">
        {(["market", "limit"] as const).map((t) => (
          <button key={t} role="tab" className="tab" aria-selected={type === t} onClick={() => setType(t)}>
            {t === "market" ? ja.order.market : ja.order.limit}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <label className="block text-sm text-muted">
          {ja.order.limitPrice}
          <input
            className="input mt-1"
            inputMode="decimal"
            placeholder={last ? indexPrice(last.close) : ""}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
      )}

      {side === "buy" ? (
        <label className="block text-sm text-muted">
          {ja.order.amount}
          <input className="input mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="mt-1 flex flex-wrap gap-1">
            {[100_000, 1_000_000, 3_000_000].map((v) => (
              <button key={v} className="tab" onClick={() => setAmount(String(v))}>
                {yen(v)}
              </button>
            ))}
            <button className="tab" onClick={() => setAmount(String(Math.floor(cash)))}>
              {ja.order.allCash}
            </button>
          </div>
        </label>
      ) : position ? (
        <div className="space-y-2 text-sm">
          <div className="text-muted">
            {ja.order.holding(qty(position.qty), yen(position.value))}
          </div>
          <div className="flex gap-1">
            {(["fraction", "amount"] as const).map((b) => (
              <button key={b} className="tab" aria-pressed={sellBy === b} onClick={() => setSellBy(b)}>
                {b === "fraction" ? ja.order.byFraction : ja.order.byAmount}
              </button>
            ))}
          </div>
          {sellBy === "fraction" ? (
            <div className="flex gap-1">
              {FRACTIONS.map((f) => (
                <button key={f} className="tab" aria-pressed={fraction === f} onClick={() => setFraction(f)}>
                  {f === 1 ? ja.order.all : `${f * 100}%`}
                </button>
              ))}
            </div>
          ) : (
            <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{ja.order.notHeld}</p>
      )}

      <button
        className="btn btn-primary w-full"
        disabled={disabled || busy || sellDisabled}
        onClick={submit}
        data-testid="submit-order"
      >
        {ja.order.submit(side)}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
      <p className="text-xs text-muted">{ja.order.note}</p>
      {!instrument.tradableToday && <p className="text-xs text-down">{ja.order.closedToday}</p>}
      <p className="text-xs text-muted">{ja.order.costs(c.commission, c.spread, c.fxFee)}</p>
    </div>
  );
}
