"use client";

import { useState } from "react";
import { ja } from "@/lib/i18n/ja";
import { StartButton } from "./StartButton";

export function PracticeForm({ min, max }: { min: string; max: string }) {
  const [random, setRandom] = useState(false);
  const [date, setDate] = useState(max.slice(0, 4) >= "2020" ? "2020-01-02" : min);
  const [showReal, setShowReal] = useState(true);
  return (
    <div className="mt-5 space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
        {ja.practice.random}
      </label>
      {!random && (
        <label className="block text-sm text-muted">
          {ja.practice.startDate}
          <input
            type="date"
            className="input mt-1"
            min={min}
            max={max}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <span className="mt-1 block text-xs">{ja.practice.range(min, max)}</span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showReal} onChange={(e) => setShowReal(e.target.checked)} />
        {ja.practice.showReal}
      </label>
      <StartButton
        label={ja.practice.start}
        body={{ mode: "practice", startDate: random ? undefined : date, showReal }}
      />
    </div>
  );
}
