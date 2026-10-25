import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AU_KM, type Elements } from "./astro";
import { DESTINATION_BY_ID, type Destination } from "./bodies";
import { distanceKm, formatLightTime, realPositionAU } from "./telemetry";

const sky = JSON.parse(
  readFileSync(new URL("../../public/sky/sky.json", import.meta.url), "utf8"),
) as { orbits: Record<string, Elements> };
const dest = (id: string) => DESTINATION_BY_ID.get(id) as Destination;
const t = Date.UTC(2026, 9, 25);
const fromEarth = (id: string) =>
  distanceKm(
    realPositionAU(dest(id), sky.orbits, t),
    realPositionAU(dest("earth"), sky.orbits, t),
  );

describe("실제 거리", () => {
  it("달은 지구에서 38만 km", () => {
    expect(fromEarth("moon")).toBeCloseTo(384_400, -3);
  });

  it("태양까지 빛은 약 8분 20초", () => {
    expect(fromEarth("sun") / AU_KM).toBeCloseTo(0.994, 1);
    expect(formatLightTime(fromEarth("sun"))).toMatch(/^8분/);
  });

  it("시리우스는 8.6광년", () => {
    expect(formatLightTime(fromEarth("sirius"))).toBe("8.6년");
  });
});

describe("빛 시간 글", () => {
  it("반올림이 자리올림을 넘기지 않는다", () => {
    // 299.9초 → 5분 0초 (4분 60초가 아니다)
    expect(formatLightTime(299.9 * 299_792.458)).toBe("5분 0초");
    // 7199.9초 → 2시간 0분
    expect(formatLightTime(7199.9 * 299_792.458)).toBe("2시간 0분");
  });
});
