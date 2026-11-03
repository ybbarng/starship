import { describe, expect, it } from "vitest";
import type { Telemetry } from "./telemetry";
import {
  copyTelemetry,
  periodDue,
  sameTelemetry,
  samplePeriod,
  shallowSame,
} from "./telemetrySnap";

/** 지구 근처에 머무는 모습(SpaceView가 채우는 모양) */
const cruise = (): Telemetry => ({
  position: [0.98, 0.17, 0],
  earthKm: 412.3,
  altitudeKm: 412.3,
  targetKm: 412.3,
  speedKmS: 0,
  remainingKm: 0,
  traveling: false,
  progress: 1,
  view: { ra: 120.5, dec: -10.2, lon: 118, lat: -30 },
  cursor: null,
});

describe("언제 옮겨 오나", () => {
  it("주기 칸이 바뀔 때만", () => {
    expect(periodDue(10_100, 10_900, 1000)).toBe(false);
    expect(periodDue(10_900, 11_050, 1000)).toBe(true);
  });
  it("같은 주기의 계기는 같은 순간(칸 경계)에 함께 바뀐다", () => {
    // 하나는 10.2초, 하나는 10.7초에 마지막으로 바뀌었어도 11초를 넘긴 박자에 둘 다 바뀐다
    expect(periodDue(10_200, 11_020, 1000)).toBe(true);
    expect(periodDue(10_700, 11_020, 1000)).toBe(true);
  });
  it("이동 중이면 hz, 머물면 idleHz(hz보다 잦지 않게)", () => {
    expect(samplePeriod(true, 4, 1)).toBe(250);
    expect(samplePeriod(false, 4, 1)).toBe(1000);
    expect(samplePeriod(false, 2, 6)).toBe(500);
  });
});

describe("값이 그대로인가", () => {
  it("telemetry 전체: 모두 같으면 같다, 하나만 달라도 다르다", () => {
    const a = cruise();
    expect(sameTelemetry(a, copyTelemetry(a))).toBe(true);
    expect(sameTelemetry(a, { ...a, earthKm: 412.4 })).toBe(false);
    expect(sameTelemetry(a, { ...a, view: { ...a.view, ra: 120.6 } })).toBe(
      false,
    );
    expect(
      sameTelemetry(a, { ...a, cursor: { ra: 1, dec: 2, lon: 3, lat: 4 } }),
    ).toBe(false);
    expect(sameTelemetry(a, { ...a, position: [0.98, 0.17, 0.01] })).toBe(
      false,
    );
  });
  it("복사본은 모듈 값과 객체를 나누지 않는다", () => {
    const a = cruise();
    const c = copyTelemetry(a);
    expect(c.view).not.toBe(a.view);
    expect(c.position).not.toBe(a.position);
  });
  it("고른 값(얕은 비교)", () => {
    const pick = { traveling: false, speed: "0 km/s", progress: 1 };
    expect(shallowSame(pick, { ...pick })).toBe(true);
    expect(shallowSame(pick, { ...pick, progress: 0.5 })).toBe(false);
    expect(shallowSame({ a: null }, { a: null })).toBe(true);
  });
});
