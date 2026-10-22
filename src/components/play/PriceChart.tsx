"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { dayLabel } from "@/lib/format";
import { macd, rsi, sma } from "@/lib/indicators";
import type { InstrumentView } from "@/lib/game/views";
import { ja } from "@/lib/i18n/ja";

/** 横軸は「k 日目」。チャートライブラリには k 日を1日刻みの仮の時刻として渡す */
const BASE = Date.UTC(2000, 0, 3) / 1000;
const toTime = (k: number) => (BASE + k * 86400) as UTCTimestamp;
const toDay = (t: Time) => Math.round(((t as number) - BASE) / 86400);

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PriceChart({ bars }: { bars: InstrumentView["bars"] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || bars.length === 0) return;
    const fg = cssVar("--muted");
    const border = cssVar("--border");
    const up = cssVar("--up");
    const down = cssVar("--down");
    const dateOf = new Map(bars.map((b) => [b.day, b.date]));
    const label = (t: Time) => {
      const k = toDay(t);
      const d = dateOf.get(k);
      return d ? `${dayLabel(k)}（${d}）` : dayLabel(k);
    };

    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: fg,
        fontSize: 11,
        panes: { separatorColor: border },
      },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border },
      timeScale: {
        borderColor: border,
        tickMarkFormatter: (t: Time) => {
          const k = toDay(t);
          return k === 0 ? ja.play.chart.start : String(k);
        },
      },
      localization: { timeFormatter: label, locale: "ja-JP" },
      crosshair: { mode: 0 },
    });

    const closes = bars.map((b) => b.close);
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    candles.setData(bars.map((b) => ({ time: toTime(b.day), open: b.open, high: b.high, low: b.low, close: b.close })));

    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      bars.map((b) => ({
        time: toTime(b.day),
        value: b.volume,
        color: (b.close >= b.open ? up : down) + "55",
      })),
    );

    const line = (values: (number | null)[], color: string, pane = 0, width: 1 | 2 = 1) => {
      const s = chart.addSeries(
        LineSeries,
        { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false },
        pane,
      );
      s.setData(bars.flatMap((b, i) => (values[i] == null ? [] : [{ time: toTime(b.day), value: values[i]! }])));
      return s;
    };
    line(sma(closes, 25), "#e2a03f");
    line(sma(closes, 75), "#7c6cf2");

    const r = rsi(closes, 14);
    const rsiSeries = line(r, "#3fa7e2", 1);
    rsiSeries.createPriceLine({ price: 70, color: border, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
    rsiSeries.createPriceLine({ price: 30, color: border, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

    const m = macd(closes);
    const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 2);
    hist.setData(
      bars.flatMap((b, i) =>
        m.histogram[i] == null
          ? []
          : [{ time: toTime(b.day), value: m.histogram[i]!, color: m.histogram[i]! >= 0 ? up + "88" : down + "88" }],
      ),
    );
    line(m.macd, "#3fa7e2", 2);
    line(m.signal, "#e2a03f", 2);

    const panes = chart.panes();
    panes[0]?.setStretchFactor(3);
    panes[1]?.setStretchFactor(1);
    panes[2]?.setStretchFactor(1);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 160), to: bars.length + 3 });

    return () => chart.remove();
  }, [bars]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-3 text-xs text-muted">
        <span>
          <span style={{ color: "#e2a03f" }}>━</span> {ja.play.chart.sma25}
        </span>
        <span>
          <span style={{ color: "#7c6cf2" }}>━</span> {ja.play.chart.sma75}
        </span>
        <span>{ja.play.chart.rsi}</span>
        <span>{ja.play.chart.macd}</span>
      </div>
      <div ref={ref} className="h-[420px] w-full sm:h-[480px]" />
    </div>
  );
}
