import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "./bodies";
import type { SkyCatalog } from "./catalog";
import { makeStarDestinations, starField, starPositionLy } from "./sky3d";
import { angularDistanceDeg, matchVertex, parseHip2 } from "./skyData";
import {
  absoluteMag,
  apparentMag,
  DEPART_BLEND,
  departureObserver,
  discRadiusPx,
  distanceFromParallax,
  estimateRadiusSun,
  FAR_LY,
  farFade,
  PC_LY,
  parallaxToLy,
  SURFACE_REF_K,
  seenFrom,
  starSceneRadius,
  surfacePeak,
  travelArcDim,
} from "./stars3d";
import { STAR_LY, STAR_RADIUS_SUN } from "./telemetry";

const sky = JSON.parse(
  readFileSync(join(__dirname, "../../public/sky/sky.json"), "utf8"),
) as SkyCatalog;

describe("시차 → 거리", () => {
  it("1000mas는 1파섹, 100mas는 10파섹", () => {
    expect(parallaxToLy(1000)).toBeCloseTo(PC_LY, 6);
    expect(parallaxToLy(100)).toBeCloseTo(10 * PC_LY, 6);
  });

  it("시리우스(379.21 ± 1.58mas)는 8.6광년", () => {
    const d = distanceFromParallax(379.21, 1.58);
    expect(d.kind).toBe("measured");
    expect(d.ly).toBeCloseTo(8.6, 1);
  });

  it("시차가 오차의 5배 미만이면 불확실, 0 이하면 거리를 모른다", () => {
    // 알닐람(오리온 허리 가운데): 1.65 ± 0.45mas
    expect(distanceFromParallax(1.65, 0.45).kind).toBe("uncertain");
    expect(distanceFromParallax(-0.5, 0.9)).toEqual({
      kind: "unknown",
      ly: null,
    });
    expect(distanceFromParallax(0, 0).kind).toBe("unknown");
  });

  it("아주 작은 시차는 3,262광년(1mas)으로 자른다", () => {
    expect(distanceFromParallax(0.2, 0.01).ly).toBeCloseTo(1000 * PC_LY, 3);
  });
});

describe("겉보기 등급 다시 셈", () => {
  it("거리가 10배면 5등급 흐려지고, 같으면 그대로", () => {
    expect(apparentMag(1, 10, 100)).toBeCloseTo(6, 9);
    expect(apparentMag(1, 10, 1)).toBeCloseTo(-4, 9);
    expect(apparentMag(2.5, 42, 42)).toBe(2.5);
  });

  it("태양을 10파섹에서 보면 4.83등급(절대 등급)", () => {
    // 지구에서 -26.74등급, 1 AU = 1/63241 광년
    expect(absoluteMag(-26.74, 1 / 63_241.077)).toBeCloseTo(4.83, 1);
  });

  it("관측자 자리에서 본 방향·거리·등급", () => {
    const seen = seenFrom([10, 0, 0], 1, [0, 0, 0]);
    expect(seen.dir).toEqual([1, 0, 0]);
    expect(seen.mag).toBeCloseTo(1, 9);
    // 그 별 쪽으로 9광년 가면 1광년 앞: 5등급 밝아진다.
    const near = seenFrom([10, 0, 0], 1, [9, 0, 0]);
    expect(near.dist).toBeCloseTo(1, 9);
    expect(near.mag).toBeCloseTo(-4, 9);
    // 옆으로 비켜 서면 방향이 바뀐다(시차).
    const side = seenFrom([10, 0, 0], 1, [0, 10, 0]);
    expect(side.dir[0]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(side.dir[1]).toBeCloseTo(-Math.SQRT1_2, 9);
  });

  it("거리를 모르는 별은 어디서 봐도 방향·등급이 그대로", () => {
    const seen = seenFrom([FAR_LY, 0, 0], 7, [500, 300, 0], true);
    expect(seen.dir).toEqual([1, 0, 0]);
    expect(seen.mag).toBe(7);
  });

  it("거리를 모르는 별은 태양계 안에서는 그대로, 멀리 가면 흐려진다", () => {
    expect(farFade(0)).toBe(1);
    expect(farFade(1e-4)).toBeCloseTo(1, 5);
    expect(farFade(550)).toBeLessThan(0.4);
    expect(farFade(550)).toBeGreaterThanOrEqual(0.35);
  });
});

describe("반지름 어림", () => {
  it("태양(4.83등급, B-V 0.65)은 반지름 1 언저리", () => {
    expect(estimateRadiusSun(4.83, 0.65)).toBeGreaterThan(0.8);
    expect(estimateRadiusSun(4.83, 0.65)).toBeLessThan(1.25);
  });

  it("손으로 정한 유명한 별 반지름과 두 배 넘게 어긋나지 않는다", () => {
    const field = starField(sky);
    for (const d of DESTINATIONS.filter((x) => x.star?.hip)) {
      const i = field.index.get(d.star?.hip ?? 0);
      expect(i, d.id).toBeDefined();
      if (i === undefined) continue;
      const row = sky.stars[i];
      if (!row) continue;
      // 밝기·색이 쌍성 합으로 잡히는 별과 변광 초거성은 뺀다.
      if (
        ["alpha-cen", "sirius", "procyon", "betelgeuse", "polaris"].includes(
          d.id,
        )
      )
        continue;
      const r = estimateRadiusSun(
        absoluteMag(row[2], STAR_LY[d.id] ?? 1),
        row[3],
      );
      const real = STAR_RADIUS_SUN[d.id] ?? 1;
      expect(r / real, d.id).toBeGreaterThan(0.5);
      expect(r / real, d.id).toBeLessThan(2);
    }
  });

  it("화면 반지름은 1.6~14 안에서 실제 반지름과 같은 순서", () => {
    expect(starSceneRadius(0.1)).toBe(1.6);
    expect(starSceneRadius(1e5)).toBe(14);
    expect(starSceneRadius(700)).toBeGreaterThan(starSceneRadius(40));
  });
});

describe("표면 온도 → 원반 밝기", () => {
  const peakOf = (id: string) => {
    const t = DESTINATIONS.find((d) => d.id === id)?.star?.tempK;
    if (t === undefined) throw new Error(`${id} 온도 없음`);
    return surfacePeak(t);
  };

  it("안타레스(기준 온도)는 정한 밝기 그대로 1배", () => {
    expect(surfacePeak(SURFACE_REF_K)).toBe(1);
    expect(peakOf("antares")).toBe(1);
  });

  it("뜨거울수록 밝고, 태양보다 뜨거운 별은 태양 온도보다 밝다", () => {
    const sun = surfacePeak(5772);
    expect(peakOf("aldebaran")).toBeGreaterThan(1);
    expect(peakOf("arcturus")).toBeGreaterThan(peakOf("aldebaran"));
    expect(peakOf("sirius")).toBeGreaterThan(sun);
    expect(peakOf("rigel")).toBeGreaterThan(peakOf("sirius"));
  });

  it("실제 비율(가시광 같은 넓이)의 네제곱근으로 줄여 담는다", () => {
    // 플랑크 식으로 시리우스(9,940K)는 안타레스(3,500K)의 약 136배 → 네제곱근 약 3.4
    expect(peakOf("sirius")).toBeCloseTo(3.4, 1);
  });

  it("아주 뜨겁거나 차가운 별도 정한 범위 안", () => {
    expect(surfacePeak(40_000)).toBe(6);
    expect(surfacePeak(2_000)).toBe(0.6);
  });

  it("유명한 별은 모두 온도가 있다", () => {
    const famous = DESTINATIONS.filter((d) => d.group === "유명한 별");
    for (const d of famous) expect(d.star?.tempK, d.id).toBeGreaterThan(0);
  });
});

describe("별자리 선 맞추기", () => {
  const pts = [
    { hip: 1, ra: 10, dec: 20 },
    { hip: 2, ra: 10.03, dec: 20 },
    { hip: 3, ra: 200, dec: -40 },
  ];

  it("허용 각 안에서 가장 가까운 별을 고른다", () => {
    expect(matchVertex(10.02, 20, [pts], 0.05)).toBe(2);
    expect(matchVertex(200, -40.01, [pts], 0.05)).toBe(3);
  });

  it("앞 목록에 없으면 다음 목록(흐린 별)에서, 어디에도 없으면 0", () => {
    const faint = [{ hip: 9, ra: 50, dec: 5 }];
    expect(matchVertex(50, 5.01, [pts, faint], 0.05)).toBe(9);
    expect(matchVertex(120, 0, [pts, faint], 0.05)).toBe(0);
  });

  it("적경 0도와 360도 경계를 넘어도 맞춘다", () => {
    expect(angularDistanceDeg(359.99, 0, 0.01, 0)).toBeCloseTo(0.02, 6);
    expect(matchVertex(359.99, 0, [[{ hip: 7, ra: 0.01, dec: 0 }]], 0.05)).toBe(
      7,
    );
  });

  it("hip2.dat 한 줄을 HIP·시차·오차로 읽는다", () => {
    const line =
      " 32349 0 0 1  1.7677953616 -0.2917512612  379.21  -546.01 -1223.07   1.40   1.28   1.58   1.66   1.21  98  0.90  0    0.0    0 -1.0876 0.0021 0.022 0  0.009 0.006 -0.020  -0.05  -0.17   1.00  -0.19  -0.07   0.07   0.35  -0.26  -0.12   0.09  -0.18  -0.17   0.08  -0.03   1.00";
    expect(parseHip2(line).get(32349)).toEqual([379.21, 1.58]);
  });

  it("sky.json의 별자리 꼭짓점은 모두 별과 맞았고, 그 별은 하늘 자료에 있다", () => {
    const field = starField(sky);
    let n = 0;
    for (const c of sky.constellations) {
      expect(c.hips?.length, c.id).toBe(c.lines.length);
      c.lines.forEach((line, li) => {
        const hips = c.hips?.[li] ?? [];
        expect(hips.length).toBe(line.length);
        line.forEach(([ra, dec], k) => {
          const hip = hips[k] ?? 0;
          expect(hip, `${c.id} 꼭짓점`).toBeGreaterThan(0);
          const i = field.index.get(hip);
          expect(i, `${c.id} HIP ${hip}`).toBeDefined();
          const row = sky.stars[i ?? 0];
          expect(
            angularDistanceDeg(ra, dec, row?.[0] ?? 0, row?.[1] ?? 0),
          ).toBeLessThan(0.05);
          n++;
        });
      });
    }
    expect(n).toBeGreaterThan(800);
  });
});

describe("하늘 자료와 목적지", () => {
  it("유명한 별 13개의 3D 위치는 계기판 거리(STAR_LY)와 같다", () => {
    const field = starField(sky);
    for (const d of DESTINATIONS.filter((x) => x.group === "유명한 별")) {
      const p = starPositionLy(field, d.star?.hip ?? 0);
      expect(p, d.id).not.toBeNull();
      expect(Math.hypot(...(p ?? [0, 0, 0])), d.id).toBeCloseTo(
        STAR_LY[d.id] ?? 0,
        1,
      );
    }
  });

  it("이름 있는 별 목적지: 거리를 잰 별만, 유명한 별과 겹치지 않게", () => {
    const list = makeStarDestinations(sky, starField(sky));
    expect(list.length).toBeGreaterThan(120);
    const ids = new Set(list.map((d) => d.id));
    expect(ids.size).toBe(list.length);
    for (const d of list) {
      expect(d.id).toMatch(/^hip-\d+$/);
      expect(d.star?.ly).toBeGreaterThan(0);
      expect(d.en).toBeTruthy();
    }
    const hips = new Set(list.map((d) => d.star?.hip));
    // 안타레스(유명한 별)는 빠지고, 알닐람(시차 불확실)도 빠진다. 스피카는 있다.
    expect(hips.has(80763)).toBe(false);
    expect(list.some((d) => d.en === "Alnilam")).toBe(false);
    expect(list.some((d) => d.en === "Spica")).toBe(true);
    // 알파 센타우리 B는 A(유명한 별)와 같은 무리라 따로 두지 않는다.
    expect(hips.has(71681)).toBe(false);
  });
});

describe("별을 떠날 때 하늘 관측자 자리", () => {
  // 베텔게우스에서 지구로 돌아오는 길: 실제 위치는 별에서 태양으로 곧게 줄어든다.
  const ly = STAR_LY.betelgeuse ?? 548;
  const star: [number, number, number] = [0, 0, ly];
  // 카메라에 맞춘 자리: 도착 거리에서는 별에서 0.05광년 비켜 서 있다.
  const near: [number, number, number] = [0.03, 0.01, ly - 0.04];
  const realAt = (e: number): [number, number, number] => [0, 0, ly * (1 - e)];
  const fromStar = (p: [number, number, number]) =>
    Math.hypot(p[0] - star[0], p[1] - star[1], p[2] - star[2]);

  it("처음에는 카메라에 맞춘 자리 그대로라 떠나온 별이 0.5광년 안에 남는다", () => {
    for (const e of [0, 0.003, 0.05, DEPART_BLEND[0]]) {
      const p = departureObserver(near, realAt(e), e);
      expect(p).toEqual(near);
      expect(fromStar(p)).toBeLessThan(0.5);
    }
    // 실제 위치만 쓰면 진행 0.1%에서 이미 0.5광년을 넘는다(예전 버그).
    expect(fromStar(realAt(0.001))).toBeGreaterThan(0.5);
  });

  it("구간이 끝나면 실제 위치 자리와 같다", () => {
    for (const e of [DEPART_BLEND[1], 0.8, 1]) {
      const p = departureObserver(near, realAt(e), e);
      const r = realAt(e);
      for (let i = 0; i < 3; i++) expect(p[i]).toBeCloseTo(r[i] ?? 0, 9);
    }
  });

  it("그 사이에서는 별에서 멀어지는 쪽으로만 움직인다(되돌아가며 깜빡이지 않는다)", () => {
    let last = 0;
    for (let k = 0; k <= 100; k++) {
      const e = k / 100;
      const d = fromStar(departureObserver(near, realAt(e), e));
      expect(d).toBeGreaterThanOrEqual(last - 1e-9);
      last = d;
    }
  });
});

describe("이동 중 긴 별자리 호 흐리게", () => {
  it("머무는 동안·출발·도착 때는 흐리게 하지 않는다", () => {
    expect(travelArcDim(false, 1, 550)).toBe(0);
    expect(travelArcDim(true, 0, 550)).toBe(0);
    expect(travelArcDim(true, 1, 0.05)).toBeCloseTo(0, 9);
  });

  it("태양계 안 이동(지구 → 화성)은 하늘이 그대로다", () => {
    expect(travelArcDim(true, 0.5, 1.6e-5)).toBe(0);
  });

  it("별들 사이를 지나는 동안 가장 세고, 출발·도착 가까이서 약해진다", () => {
    expect(travelArcDim(true, 0.5, 300)).toBeCloseTo(1, 9);
    expect(travelArcDim(true, 0.2, 300)).toBeCloseTo(1, 9);
    expect(travelArcDim(true, 0.05, 300)).toBeLessThan(0.5);
    expect(travelArcDim(true, 0.95, 300)).toBeLessThan(0.5);
  });
});

describe("구의 화면 반지름", () => {
  // 하늘 화면: 세로 화각 55°, 캔버스 높이 583px(/lab/sky 1372×872)
  it("도착 거리(반지름 × 12)에서는 크게, 태양계 거리(6,000)에서는 2픽셀 아래로", () => {
    const r = 14; // 베텔게우스의 화면 반지름
    expect(discRadiusPx(r, r * 12, 55, 583)).toBeGreaterThan(40);
    expect(discRadiusPx(r, 6000, 55, 583)).toBeLessThan(2);
  });

  it("거리가 두 배면 반지름은 절반", () => {
    expect(discRadiusPx(2, 400, 55, 800)).toBeCloseTo(
      discRadiusPx(2, 200, 55, 800) / 2,
      9,
    );
  });
});
