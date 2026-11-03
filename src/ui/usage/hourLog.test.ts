import { describe, expect, it } from "vitest";
import { dayRows } from "./FuelRoom";

/** 오늘 h시 정각(로컬) */
const at = (h: number) => {
  const d = new Date(2026, 10, 4, h);
  return d.getTime();
};

describe("시간별 속도 기록 칸", () => {
  it("자정 직후 0시 한 칸만 와도 하루 24칸을 그린다", () => {
    const rows = dayRows([{ at: at(0), work: 0, personal: 6000, other: 0 }]);
    expect(rows).toHaveLength(24);
    expect(rows[0]?.personal).toBe(100);
    expect(rows.slice(1).every((r) => r.personal === 0)).toBe(true);
    expect(new Date(rows[23]?.at ?? 0).getHours()).toBe(23);
  });

  it("어제 칸이 섞여 와도 오늘 것만 시각에 맞춰 둔다", () => {
    const yesterday = new Date(2026, 10, 3, 22).getTime();
    const rows = dayRows([
      { at: yesterday, work: 600, personal: 0, other: 0 },
      { at: at(13), work: 1200, personal: 0, other: 0 },
    ]);
    expect(rows[22]?.work).toBe(0);
    expect(rows[13]?.work).toBe(20);
  });
});
