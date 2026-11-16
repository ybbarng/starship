import { describe, expect, it } from "vitest";
import type { Vec3 } from "./astro";
import {
  TAIL_END_PX,
  TAIL_HEAD_PX,
  TAIL_VIEW_DEG,
  TAIL_VIEW_KEEP,
  tailGlow,
  tailTint,
  tailViewFades,
  tailWidth,
  viewFade,
} from "./orbitTail";

describe("궤도 꼬리 빛 띠", () => {
  it("머리 쪽이 가장 밝고 끝에서 0이 된다", () => {
    expect(tailGlow(1)).toBe(0);
    expect(tailGlow(0.04)).toBeGreaterThan(tailGlow(0));
    for (let t = 0.05; t < 1; t += 0.05) {
      expect(tailGlow(t + 0.05)).toBeLessThan(tailGlow(t));
    }
  });

  it("곡선이라 가운데에서 직선보다 옅다", () => {
    expect(tailGlow(0.5)).toBeLessThan(0.5);
  });

  it("머리 쪽이 굵고 끝으로 갈수록 가늘다", () => {
    expect(tailWidth(0)).toBe(TAIL_HEAD_PX);
    expect(tailWidth(1)).toBeCloseTo(TAIL_END_PX);
    expect(tailWidth(0.5)).toBeLessThan(TAIL_HEAD_PX);
  });

  it("행성 색에 따뜻한 흰빛을 섞어 별자리 선 푸른색과 갈린다", () => {
    const [r, g, b] = tailTint([0.37, 0.53, 0.94]);
    expect(r).toBeGreaterThan(0.37);
    expect(b).toBeLessThan(0.94);
    expect(g).toBeGreaterThan(0.53);
  });
});

describe("카메라에서 본 각도로 흐려지기", () => {
  it("시야 한계의 일부까지는 그대로, 한계에서 사라진다", () => {
    expect(viewFade(0)).toBe(1);
    expect(viewFade(TAIL_VIEW_DEG * TAIL_VIEW_KEEP)).toBe(1);
    expect(viewFade(TAIL_VIEW_DEG)).toBe(0);
    expect(viewFade(TAIL_VIEW_DEG + 30)).toBe(0);
    const mid = viewFade(TAIL_VIEW_DEG * 0.65);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  // 카메라는 원점, 꼬리는 머리(0, 0, -d)에서 x 쪽으로 뻗는 직선
  const line = (d: number, len: number, n = 41): Vec3[] =>
    Array.from({ length: n }, (_, k) => [(k / (n - 1)) * len, 0, -d] as Vec3);

  it("먼 꼬리는 시야 각도가 작아 끝까지 흐려지지 않는다", () => {
    // 길이 10, 거리 100이면 시야 각도는 약 5.7도
    const f = tailViewFades(line(100, 10), [0, 0, 0]);
    expect(Math.min(...f)).toBe(1);
  });

  it("가까운 꼬리는 시야 한계를 넘는 곳부터 사라진다", () => {
    // 길이 10, 거리 5면 끝은 약 63도
    const pts = line(5, 10);
    const f = tailViewFades(pts, [0, 0, 0]);
    expect(f[0]).toBe(1);
    expect(f[f.length - 1]).toBe(0);
    pts.forEach((p, k) => {
      const deg = (Math.atan2(p[0], 5) * 180) / Math.PI;
      if (deg >= TAIL_VIEW_DEG) expect(f[k]).toBe(0);
    });
  });

  it("한 번 옅어지면 뒤에서 다시 밝아지지 않는다", () => {
    // 카메라 옆을 지나 되돌아오는 꼬리: 각도가 커졌다가 다시 작아진다
    const pts: Vec3[] = [
      [0, 0, -10],
      [5, 0, -5],
      [8, 0, 0],
      [5, 0, -5],
      [0.1, 0, -10],
    ];
    const f = tailViewFades(pts, [0, 0, 0]);
    expect(f[2]).toBe(0);
    expect(f[4]).toBe(0);
    for (let k = 1; k < f.length; k++) {
      expect(f[k]).toBeLessThanOrEqual(f[k - 1] as number);
    }
  });
});
