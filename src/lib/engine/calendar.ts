/**
 * 平日ベースの共通カレンダー。
 * 1ターン＝月〜金の1日。各市場の生の日足を「前の平日の翌日〜当日」の範囲で集約するので、
 * - 休場日の市場は範囲内に足がなく、前日終値で据え置き・売買不可になる
 * - 暗号資産の土日の値動きは月曜の足にまとめて反映される
 */

/** "YYYY-MM-DD" 形式の日付 */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export function parseIso(d: IsoDate): number {
  return Date.parse(`${d}T00:00:00Z`);
}

export function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return toIso(parseIso(d) + n * DAY_MS);
}

export function isWeekday(d: IsoDate): boolean {
  const dow = new Date(parseIso(d)).getUTCDay();
  return dow !== 0 && dow !== 6;
}

export function nextWeekday(d: IsoDate): IsoDate {
  let x = addDays(d, 1);
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
}

export function previousWeekday(d: IsoDate): IsoDate {
  let x = addDays(d, -1);
  while (!isWeekday(x)) x = addDays(x, -1);
  return x;
}

/** start 以降（start が平日なら start を含む）の平日を count 日分並べる */
export function weekdayCalendar(start: IsoDate, count: number): IsoDate[] {
  const out: IsoDate[] = [];
  let d = isWeekday(start) ? start : nextWeekday(start);
  while (out.length < count) {
    out.push(d);
    d = nextWeekday(d);
  }
  return out;
}

export type RawBar = {
  date: IsoDate;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AlignedBar = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** その日に売買できるか（範囲内に足があったか） */
  tradable: boolean;
};

/**
 * 生の日足（日付昇順）をカレンダーに揃える。
 * カレンダー上の日 d には (前の平日, d] に含まれる足を集約する。
 * 足がない日は直前の終値で据え置き（tradable=false）。最初の足より前は null。
 */
export function alignBars(raw: readonly RawBar[], calendar: readonly IsoDate[]): (AlignedBar | null)[] {
  const out: (AlignedBar | null)[] = [];
  let i = 0;
  let lastClose: number | null = null;
  for (const d of calendar) {
    const from = previousWeekday(d);
    // 範囲より前の足は読み飛ばすが、据え置き用に終値だけ拾っておく
    while (i < raw.length && raw[i].date <= from) {
      lastClose = raw[i].close;
      i++;
    }
    let agg: AlignedBar | null = null;
    while (i < raw.length && raw[i].date <= d) {
      const b = raw[i];
      if (agg === null) {
        agg = { open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, tradable: true };
      } else {
        agg.high = Math.max(agg.high, b.high);
        agg.low = Math.min(agg.low, b.low);
        agg.close = b.close;
        agg.volume += b.volume;
      }
      i++;
    }
    if (agg) {
      lastClose = agg.close;
      out.push(agg);
    } else if (lastClose !== null) {
      out.push({ open: lastClose, high: lastClose, low: lastClose, close: lastClose, volume: 0, tradable: false });
    } else {
      out.push(null);
    }
  }
  return out;
}

/** 為替などの系列を、各日「その日以前で最新の値」で埋める */
export function carryForward(
  raw: readonly { date: IsoDate; value: number }[],
  calendar: readonly IsoDate[],
): (number | null)[] {
  const out: (number | null)[] = [];
  let i = 0;
  let last: number | null = null;
  for (const d of calendar) {
    while (i < raw.length && raw[i].date <= d) {
      last = raw[i].value;
      i++;
    }
    out.push(last);
  }
  return out;
}
