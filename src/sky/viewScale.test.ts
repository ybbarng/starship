import { describe, expect, it } from "vitest";
import {
  FIT_FILL,
  halfFovMin,
  MIN_SCALE,
  softCap,
  viewDistance,
} from "./viewScale";

const WIDE = { fov: 55, aspect: 16 / 9 };
const PHONE = { fov: 55, aspect: 9 / 19.5 };

/** 원 반지름이 시야 반각에서 차지하는 몫 */
const fill = (r: number, d: number, frame: typeof WIDE) =>
  Math.asin(r / d) / halfFovMin(frame);

describe("viewDistance", () => {
  it("기준과 같은 크기면 예전 거리 그대로", () => {
    expect(viewDistance(1, 9, 1, WIDE)).toBeCloseTo(9, 6);
  });

  it("목성(지구의 11.2배)은 지구보다 2.5배 넘게 크게, 원은 화면 안에", () => {
    const earth = 1 / viewDistance(1, 9, 1, WIDE);
    const d = viewDistance(11.2, 11.2 * 9, 11.2, WIDE);
    const jupiter = 11.2 / d;
    expect(jupiter / earth).toBeGreaterThan(2.5);
    expect(fill(11.2, d, WIDE)).toBeLessThanOrEqual(FIT_FILL + 1e-9);
    expect(jupiter / earth).toBeLessThan(Math.sqrt(11.2) + 1e-9);
  });

  it("아무리 큰 별도 원 전체가 화면 안에 들어온다", () => {
    for (const frame of [WIDE, PHONE]) {
      const d = viewDistance(14, 14 * 12, 764, frame);
      expect(fill(14, d, frame)).toBeLessThanOrEqual(FIT_FILL + 1e-9);
    }
  });

  it("상한 근처의 큰 별끼리도 크기 순서가 남는다", () => {
    const size = (ratio: number) => 1 / viewDistance(1, 12, ratio, WIDE);
    // 아크투루스 < 리겔 < 데네브 < 베텔게우스
    const sizes = [25.4, 79, 200, 764].map(size);
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i] as number).toBeGreaterThan(sizes[i - 1] as number);
  });

  it("작은 천체는 하한까지만 줄어든다", () => {
    expect(viewDistance(1, 9, 0.0001, WIDE)).toBeCloseTo(9 / MIN_SCALE, 6);
  });

  it("좁은 세로 화면에서는 예전 크기도 넘치면 물러난다", () => {
    const d = viewDistance(1, 1.5, 1, PHONE);
    expect(d).toBeGreaterThan(1.5);
    expect(fill(1, d, PHONE)).toBeLessThanOrEqual(FIT_FILL + 1e-9);
  });
});

describe("softCap", () => {
  it("무릎 아래는 그대로, 위는 상한을 넘지 않는다", () => {
    expect(softCap(1, 5)).toBe(1);
    expect(softCap(100, 5)).toBeLessThanOrEqual(5);
    expect(softCap(6, 5)).toBeLessThan(softCap(7, 5));
  });
});

describe("halfFovMin", () => {
  it("가로 화면은 세로 반각, 세로 화면은 가로 반각", () => {
    expect(halfFovMin(WIDE)).toBeCloseTo((55 * Math.PI) / 360, 6);
    expect(halfFovMin(PHONE)).toBeLessThan((55 * Math.PI) / 360);
  });
});
