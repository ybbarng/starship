import { describe, expect, it } from "vitest";
import { stepDeco } from "./deco";

const fresh = () => ({ time: 0, dt: 0, k: 1 });

describe("stepDeco: 장식 움직임 멈추고 다시 움직이기", () => {
  it("초점이 있으면 진짜 시간만큼 흐른다", () => {
    const s = fresh();
    expect(stepDeco(s, 1 / 30, true)).toBe(false);
    expect(s.time).toBeCloseTo(1 / 30);
  });

  it("초점이 없으면 부드럽게 늦추다 멈추고, 멈춘 뒤엔 흐르지 않는다", () => {
    const s = fresh();
    let frames = 0;
    while (stepDeco(s, 1 / 30, false)) frames++;
    // 1초 남짓(30번 안팎)에 걸쳐 멈춘다
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(60);
    expect(s.k).toBe(0);
    const t = s.time;
    stepDeco(s, 1, false);
    expect(s.time).toBe(t);
  });

  it("돌아오면 멈춘 자리에서 다시 흐른다(건너뛰지 않는다)", () => {
    const s = { time: 42, dt: 0, k: 0 };
    // 1초에 1번 그리다 돌아온 첫 프레임: dt가 커도 한 번에 뛰지 않는다
    stepDeco(s, 1, true);
    expect(s.time - 42).toBeLessThan(0.5);
    while (stepDeco(s, 1 / 30, true));
    expect(s.k).toBe(1);
  });
});
