"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { dayLabel, indexPrice, qty, signedYen, tone, yen } from "@/lib/format";
import type { ScenarioView } from "@/lib/game/views";
import { ja } from "@/lib/i18n/ja";

const c = ja.play.cols;

type Props = {
  view: ScenarioView;
  onSelect: (id: number) => void;
  onChanged: () => void;
};

export function Portfolio({ view, onSelect, onChanged }: Props) {
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  return (
    <div>
      <div className="flex gap-1" role="tablist">
        {(
          [
            ["positions", `${ja.play.positions}（${view.positions.length}）`],
            ["orders", `${ja.play.orders}（${view.orders.length}）`],
            ["history", ja.play.history],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 overflow-x-auto">
        {tab === "positions" && <Positions view={view} onSelect={onSelect} />}
        {tab === "orders" && <Orders view={view} onChanged={onChanged} />}
        {tab === "history" && <History view={view} />}
      </div>
    </div>
  );
}

function Positions({ view, onSelect }: { view: ScenarioView; onSelect: (id: number) => void }) {
  if (view.positions.length === 0) return <p className="p-2 text-sm text-muted">{ja.play.noPositions}</p>;
  return (
    <table className="data" data-testid="positions">
      <thead>
        <tr>
          <th>{c.instrument}</th>
          <th className="num">{c.qty}</th>
          <th className="num">{c.avgCost}</th>
          <th className="num">{c.price}</th>
          <th className="num">{c.value}</th>
          <th className="num">{c.pnl}</th>
          {view.revealed && <th className="num">{ja.info.realPrice}</th>}
        </tr>
      </thead>
      <tbody>
        {view.positions.map((p) => (
          <tr key={p.instrumentId} className="cursor-pointer hover:bg-panel-2" onClick={() => onSelect(p.instrumentId)}>
            <td>
              {p.name} <span className="text-xs text-muted">{p.symbol}</span>
            </td>
            <td className="num">{qty(p.qty)}</td>
            <td className="num">{indexPrice(p.avgCost)}</td>
            <td className="num">{indexPrice(p.price)}</td>
            <td className="num">{yen(p.value)}</td>
            <td className={`num ${tone(p.pnl)}`}>{signedYen(p.pnl)}</td>
            {view.revealed && <td className="num">{yen(p.realPrice)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Orders({ view, onChanged }: { view: ScenarioView; onChanged: () => void }) {
  if (view.orders.length === 0) return <p className="p-2 text-sm text-muted">{ja.play.noOrders}</p>;
  return (
    <table className="data" data-testid="orders">
      <thead>
        <tr>
          <th>{c.instrument}</th>
          <th>{c.side}</th>
          <th>{c.type}</th>
          <th className="num">{c.size}</th>
          <th>{c.placed}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {view.orders.map((o) => (
          <tr key={o.id}>
            <td>{o.name}</td>
            <td className={o.side === "buy" ? "text-up" : "text-down"}>{o.side === "buy" ? ja.order.buy : ja.order.sell}</td>
            <td>{o.type === "market" ? ja.order.market : `${ja.order.limit} ${indexPrice(o.limitPrice)}`}</td>
            <td className="num">{o.fraction ? `${o.fraction * 100}%` : yen(o.amount)}</td>
            <td className="text-muted">{dayLabel(o.placedDay)}</td>
            <td>
              <button
                className="text-sm text-down hover:underline"
                onClick={async () => {
                  await api(`/api/scenarios/${view.id}/orders/${o.id}`, { method: "DELETE" });
                  onChanged();
                }}
              >
                {ja.play.cancel}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function History({ view }: { view: ScenarioView }) {
  if (view.ledger.length === 0) return <p className="p-2 text-sm text-muted">{ja.play.noHistory}</p>;
  return (
    <table className="data" data-testid="history">
      <thead>
        <tr>
          <th>{c.day}</th>
          <th>{c.what}</th>
          <th>{c.instrument}</th>
          <th className="num">{c.unit}</th>
          {view.revealed && <th className="num">{ja.info.realPrice}</th>}
          <th className="num">{c.amount}</th>
          <th className="num">{c.costs}</th>
          <th className="num">{c.realized}</th>
        </tr>
      </thead>
      <tbody>
        {view.ledger.map((l) => {
          let label: string = l.kind;
          let amount: number | null = l.gross;
          let cost: number | null = l.fees;
          if (l.kind === "trade") label = l.side === "buy" ? ja.ledger.buy : ja.ledger.sell;
          if (l.kind === "dividend") {
            label = ja.ledger.dividend;
            cost = l.tax;
          }
          if (l.kind === "tax") {
            label = (l.tax ?? 0) >= 0 ? ja.ledger.tax : ja.ledger.refund;
            amount = null;
            cost = l.tax;
          }
          if (l.kind === "cancel") label = `${ja.ledger.cancel}（${ja.ledger.cancelReason[l.note ?? ""] ?? ""}）`;
          return (
            <tr key={l.id}>
              <td className="text-muted">
                {dayLabel(l.day)}
                {l.date && <span className="ml-1 text-xs">{l.date}</span>}
              </td>
              <td>{label}</td>
              <td>{l.name}</td>
              <td className="num">{l.price != null ? indexPrice(l.price) : ""}</td>
              {view.revealed && <td className="num">{l.realPrice != null ? yen(l.realPrice) : ""}</td>}
              <td className="num">{amount != null ? yen(amount) : ""}</td>
              <td className="num">{cost != null ? yen(cost) : ""}</td>
              <td className={`num ${tone(l.realizedPnl)}`}>
                {l.kind === "trade" && l.side === "sell" ? signedYen(l.realizedPnl) : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
