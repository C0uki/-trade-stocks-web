"use client";

import { ColorType, createChart, LineSeries, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { dayLabel, yen } from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

const BASE = Date.UTC(2000, 0, 3) / 1000;
const toTime = (k: number) => (BASE + k * 86400) as UTCTimestamp;
const toDay = (t: Time) => Math.round(((t as number) - BASE) / 86400);

type Point = { day: number; equity: number; benchmark: number | null };

export function EquityChart({ points }: { points: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || points.length === 0) return;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: css("--muted"), fontSize: 11 },
      grid: { vertLines: { color: css("--border") }, horzLines: { color: css("--border") } },
      timeScale: { tickMarkFormatter: (t: Time) => String(toDay(t)) },
      localization: { timeFormatter: (t: Time) => dayLabel(toDay(t)), priceFormatter: (p: number) => yen(p), locale: "ja-JP" },
    });
    const you = chart.addSeries(LineSeries, { color: css("--accent"), lineWidth: 2, title: ja.result.you });
    you.setData(points.map((p) => ({ time: toTime(p.day), value: p.equity })));
    const bench = chart.addSeries(LineSeries, { color: css("--muted"), lineWidth: 1, title: ja.result.bench });
    bench.setData(points.flatMap((p) => (p.benchmark == null ? [] : [{ time: toTime(p.day), value: p.benchmark }])));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);
  return <div ref={ref} className="h-[300px] w-full" />;
}
