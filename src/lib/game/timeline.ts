import { PRE_HISTORY_DAYS, SCENARIO_DAYS, SYNTHETIC_EPOCH } from "@/config/game";
import { nextWeekday, previousWeekday, weekdayCalendar, type IsoDate } from "@/lib/engine/calendar";

/**
 * シナリオの日付は「k 日目」で表す。k=0 が開始日（この日の終値を見て最初の注文を出す）、
 * k=1..SCENARIO_DAYS が取引日、k<0 は開始前の過去チャート。
 * 実日付への対応表はサーバーだけが持つ。
 */
export function scenarioCalendar(day0: IsoDate): IsoDate[] {
  const pre: IsoDate[] = [];
  let d = day0;
  for (let i = 0; i < PRE_HISTORY_DAYS; i++) {
    d = previousWeekday(d);
    pre.unshift(d);
  }
  return [...pre, day0, ...weekdayCalendar(nextWeekday(day0), SCENARIO_DAYS)];
}

export const FIRST_DAY = -PRE_HISTORY_DAYS;

export function calIndex(k: number): number {
  return k + PRE_HISTORY_DAYS;
}

export function dateOfDay(cal: readonly IsoDate[], k: number): IsoDate {
  return cal[calIndex(k)];
}

/** 架空暦の年（起点の年を1年目とする） */
export function fictionalYear(date: IsoDate): number {
  return Number(date.slice(0, 4)) - Number(SYNTHETIC_EPOCH.slice(0, 4)) + 1;
}
