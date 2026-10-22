import { describe, expect, it } from "vitest";
import { alignBars, carryForward, weekdayCalendar, type RawBar } from "./calendar";

const bar = (date: string, o: number, h: number, l: number, c: number, v = 1): RawBar => ({
  date,
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

describe("weekdayCalendar", () => {
  it("土日を飛ばす", () => {
    // 2024-03-01 は金曜
    expect(weekdayCalendar("2024-03-01", 3)).toEqual(["2024-03-01", "2024-03-04", "2024-03-05"]);
  });
  it("土曜開始なら次の月曜から", () => {
    expect(weekdayCalendar("2024-03-02", 1)).toEqual(["2024-03-04"]);
  });
});

describe("alignBars", () => {
  const cal = weekdayCalendar("2024-03-01", 3); // 金, 月, 火

  it("休場日は前日終値で据え置き、売買不可", () => {
    const out = alignBars([bar("2024-03-01", 10, 11, 9, 10.5), bar("2024-03-05", 11, 12, 10, 11)], cal);
    expect(out[0]).toMatchObject({ close: 10.5, tradable: true });
    expect(out[1]).toEqual({ open: 10.5, high: 10.5, low: 10.5, close: 10.5, volume: 0, tradable: false });
    expect(out[2]).toMatchObject({ open: 11, close: 11, tradable: true });
  });

  it("暗号資産の土日の値動きは月曜にまとめる", () => {
    const out = alignBars(
      [
        bar("2024-03-01", 100, 101, 99, 100, 5),
        bar("2024-03-02", 100, 120, 98, 110, 5), // 土
        bar("2024-03-03", 110, 112, 90, 95, 5), // 日
        bar("2024-03-04", 95, 99, 93, 97, 5), // 月
      ],
      cal,
    );
    expect(out[1]).toEqual({ open: 100, high: 120, low: 90, close: 97, volume: 15, tradable: true });
  });

  it("最初の足より前は null、範囲前の足は据え置きに使う", () => {
    expect(alignBars([bar("2024-03-04", 1, 1, 1, 1)], cal)[0]).toBeNull();
    const out = alignBars([bar("2024-02-28", 5, 5, 5, 7)], cal);
    expect(out[0]).toMatchObject({ close: 7, tradable: false });
  });
});

describe("carryForward", () => {
  it("その日以前で最新の値を使う", () => {
    const cal = weekdayCalendar("2024-03-01", 3);
    expect(
      carryForward(
        [
          { date: "2024-02-29", value: 150 },
          { date: "2024-03-04", value: 151 },
        ],
        cal,
      ),
    ).toEqual([150, 151, 151]);
  });
});
