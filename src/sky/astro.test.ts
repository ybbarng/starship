import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bvToRgb,
  directionToCoords,
  type Elements,
  earthBasis,
  galacticToEquatorial,
  gmstDeg,
  halleyAt,
  heliocentric,
  raDecToEcliptic,
  toThree,
} from "./astro";

const sky = JSON.parse(
  readFileSync(new URL("../../public/sky/sky.json", import.meta.url), "utf8"),
) as { orbits: Record<string, Elements> };

const lonDeg = ([x, y]: number[]) =>
  ((Math.atan2(y ?? 0, x ?? 0) * 180) / Math.PI + 360) % 360;

describe("행성 위치", () => {
  const t = Date.UTC(2026, 9, 25);

  it("10월 25일 지구 황경은 약 32도(태양 황경 212도의 반대)", () => {
    const earth = heliocentric(sky.orbits.ter as Elements, t);
    expect(Math.hypot(...earth)).toBeCloseTo(0.994, 1);
    expect(lonDeg(earth)).toBeGreaterThan(29);
    expect(lonDeg(earth)).toBeLessThan(35);
  });

  it("궤도 반지름이 알려진 범위에 있다", () => {
    const r = (id: string) =>
      Math.hypot(...heliocentric(sky.orbits[id] as Elements, t));
    expect(r("mar")).toBeGreaterThan(1.38);
    expect(r("mar")).toBeLessThan(1.67);
    expect(r("jup")).toBeGreaterThan(4.95);
    expect(r("jup")).toBeLessThan(5.46);
    expect(r("cer")).toBeGreaterThan(2.5);
    expect(r("cer")).toBeLessThan(3.0);
  });

  it("핼리 혜성은 1986년 근일점에서 0.59 AU", () => {
    expect(Math.hypot(...halleyAt(Date.UTC(1986, 1, 9, 12)))).toBeCloseTo(
      0.586,
      2,
    );
  });
});

describe("좌표와 색", () => {
  it("은하 중심(l=0,b=0)은 궁수자리 쪽 적경 266.4도, 적위 -28.9도", () => {
    const [x, y, z] = galacticToEquatorial(0, 0);
    expect(lonDeg([x, y])).toBeCloseTo(266.4, 0);
    expect((Math.asin(z) * 180) / Math.PI).toBeCloseTo(-28.94, 1);
  });

  it("푸른 별은 파랑이, 붉은 별은 빨강이 세다", () => {
    const [r1, , b1] = bvToRgb(-0.2);
    const [r2, , b2] = bvToRgb(1.8);
    expect(b1).toBeGreaterThan(r1 - 0.01);
    expect(r2).toBeGreaterThan(b2);
  });
});

describe("지구 자전과 좌표", () => {
  it("J2000.0 정오의 그리니치 항성시는 280.46도", () => {
    expect(gmstDeg(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(280.46, 1);
  });

  it("방향 → 좌표는 적경·적위 → 방향의 역", () => {
    const [x, y, z] = toThree(raDecToEcliptic(101.29, -16.72));
    const c = directionToCoords([x, y, z]);
    expect(c.ra).toBeCloseTo(101.29, 3);
    expect(c.dec).toBeCloseTo(-16.72, 3);
  });

  it("북극은 적위 +90도", () => {
    const { north } = earthBasis(Date.UTC(2026, 9, 25));
    expect(directionToCoords(north).dec).toBeCloseTo(90, 3);
  });
});

describe("서울의 낮과 밤", () => {
  const seoulFacesSun = (ms: number) => {
    const earth = toThree(heliocentric(sky.orbits.ter as Elements, ms));
    const toSun = earth.map((v) => -v);
    const { greenwich: g, north: n, east: e } = earthBasis(ms);
    const lat = (37.57 * Math.PI) / 180;
    const lon = (126.98 * Math.PI) / 180;
    const p = [0, 1, 2].map(
      (i) =>
        Math.cos(lat) *
          (Math.cos(lon) * (g[i] ?? 0) + Math.sin(lon) * (e[i] ?? 0)) +
        Math.sin(lat) * (n[i] ?? 0),
    );
    return p.reduce((s, v, i) => s + v * (toSun[i] ?? 0), 0) > 0;
  };

  it("한국 시각 오후 3시 반이면 낮", () => {
    expect(seoulFacesSun(Date.UTC(2026, 9, 25, 6, 30))).toBe(true);
  });

  it("한국 시각 새벽 3시면 밤", () => {
    expect(seoulFacesSun(Date.UTC(2026, 9, 24, 18, 0))).toBe(false);
  });
});
