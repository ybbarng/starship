import { describe, expect, it } from "vitest";
import { CRANE_CELLS, cellSeed, dugOf, rigCount, spread } from "./decor";

describe("rigCount", () => {
  it("3칸마다 장비 하나, 작은 땅에도 하나는 둔다", () => {
    expect(rigCount(1)).toBe(1);
    expect(rigCount(2)).toBe(1);
    expect(rigCount(3)).toBe(1);
    expect(rigCount(5)).toBe(1);
    expect(rigCount(6)).toBe(2);
    expect(rigCount(10)).toBe(3);
  });
  it("크레인이 서는 큰 땅에는 장비가 둘 이상이다", () => {
    expect(rigCount(CRANE_CELLS)).toBeGreaterThanOrEqual(2);
  });
});

describe("spread", () => {
  it("고르게 띄워 고르고 차례를 지킨다", () => {
    expect(spread([0, 1, 2, 3, 4, 5], 2)).toEqual([0, 3]);
    expect(spread([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([0, 3, 6]);
  });
  it("모자라면 있는 만큼, 0이면 없음", () => {
    expect(spread([1, 2], 5)).toEqual([1, 2]);
    expect(spread([1, 2], 0)).toEqual([]);
    expect(spread([], 3)).toEqual([]);
  });
});

describe("dugOf", () => {
  it("같은 칸은 늘 같은 모습이다", () => {
    expect(dugOf(cellSeed(3, -2))).toEqual(dugOf(cellSeed(3, -2)));
  });
  it("고랑은 2~3개, 기울기는 수평에 가깝다(사선 줄무늬로 읽히지 않게)", () => {
    for (let q = -6; q <= 6; q++)
      for (let r = -6; r <= 6; r++) {
        const d = dugOf(cellSeed(q, r));
        expect([2, 3]).toContain(d.furrows);
        expect(Math.abs(d.tilt)).toBeLessThanOrEqual(6);
      }
  });
  it("칸마다 모습이 달라진다(흙더미·말뚝이 다 같지 않다)", () => {
    const all = [];
    for (let q = -4; q <= 4; q++)
      for (let r = -4; r <= 4; r++) all.push(dugOf(cellSeed(q, r)));
    expect(new Set(all.map((d) => d.mound)).size).toBe(2);
    expect(new Set(all.map((d) => d.stake)).size).toBe(2);
    expect(new Set(all.map((d) => d.tilt)).size).toBeGreaterThan(1);
  });
});
