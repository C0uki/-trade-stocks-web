const yenFmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

export function yen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}¥${yenFmt.format(Math.abs(Math.round(n)))}`;
}

export function signedYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${yen(n)}`;
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
}

/** 符号を付けない割合（利回りなど） */
export function rate(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** スコア（%ポイント） */
export function points(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}pt`;
}

export function indexPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function qty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(1) : n.toFixed(4);
}

export function ratio(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}倍`;
}

export function dayLabel(k: number): string {
  if (k === 0) return "開始日";
  if (k < 0) return `開始${-k}日前`;
  return `${k}日目`;
}

/** 上昇・下落の色（Tailwind クラス） */
export function tone(n: number | null | undefined): string {
  if (n == null || n === 0) return "text-muted";
  return n > 0 ? "text-up" : "text-down";
}
