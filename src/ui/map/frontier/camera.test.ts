import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import {
  arrowFor,
  boxOf,
  type Camera,
  clampCamera,
  edgePoint,
  fitCamera,
  fitScale,
  isOnScreen,
  lerpCamera,
  MAX_CELL_PX,
  MIN_ZOOM,
  panBy,
  parseCamera,
  placeEdgeTags,
  revealCamera,
  stageOf,
  toScreen,
  toWorld,
  type Viewport,
  zoomAt,
  zoomRange,
} from "./camera";
import { layoutFrontier, toPixel } from "./hex";

const NOW = Date.parse("2026-10-29T12:00:00+09:00");
/** 선실 지도 자리: 1372×872 화면과 1100×700 화면에서 가운데 그림 크기 */
const viewports: [string, Viewport][] = [
  ["1372×872", { w: 1008, h: 732, top: 6, bottom: 30, side: 20 }],
  ["1100×700", { w: 736, h: 560, top: 6, bottom: 30, side: 20 }],
];
const maps = [
  ["web-shop", buildDemoMap(NOW)],
  ["star-atlas", buildBigDemoMap(NOW)],
] as const;

const centersOf = (name: (typeof maps)[number][1]) =>
  layoutFrontier(name).leaves.flatMap((l) => l.cells.map((h) => toPixel(h)));

describe.each(maps)("%s 맞춤", (_name, map) => {
  const centers = centersOf(map);
  const box = boxOf(centers);
  it.each(viewports)("%s: 모든 칸이 화면 안에 든다", (_v, vp) => {
    const s0 = fitScale(box, vp);
    const cam = fitCamera(box);
    for (const c of centers) {
      const p = toScreen(cam, s0, vp, c);
      expect(
        isOnScreen(p, { x: 0, y: 0, w: vp.w, h: vp.h - vp.bottom }, s0),
      ).toBe(true);
    }
  });
});

describe("카메라 움직임", () => {
  const box = boxOf(centersOf(buildBigDemoMap(NOW)));
  const vp = viewports[0]?.[1] as Viewport;
  const s0 = fitScale(box, vp);
  const fit = fitCamera(box);

  it("땅 좌표와 화면 좌표는 서로 되돌아간다", () => {
    const cam: Camera = { zoom: 2.3, x: 1.5, y: -2 };
    const p = { x: 4.2, y: -7.1 };
    const back = toWorld(cam, s0, vp, toScreen(cam, s0, vp, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("마우스 위치를 중심으로 확대하면 그 점 아래 땅이 제자리에 있다", () => {
    const at = { x: 300, y: 200 };
    const under = toWorld(fit, s0, vp, at);
    const cam = zoomAt(fit, 1.4, at, box, vp, s0);
    expect(cam.zoom).toBeCloseTo(1.4);
    const p = toScreen(cam, s0, vp, under);
    expect(p.x).toBeCloseTo(at.x);
    expect(p.y).toBeCloseTo(at.y);
  });

  it("확대는 맞춤의 0.8배에서 칸 지름 120px까지", () => {
    const out = zoomAt(fit, 0.01, { x: 100, y: 100 }, box, vp, s0);
    expect(out.zoom).toBeCloseTo(MIN_ZOOM);
    const inn = zoomAt(fit, 1000, { x: 100, y: 100 }, box, vp, s0);
    expect(2 * s0 * inn.zoom).toBeCloseTo(MAX_CELL_PX);
    // 칸이 이미 커서 맞춤이 한계를 넘어도 맞춤(1배)까지는 된다
    expect(zoomRange(80).max).toBe(1);
  });

  it("옮기기는 개척지가 화면 밖으로 다 나가지 않게 막는다(1/4은 남는다)", () => {
    for (const zoom of [1, 2.5]) {
      for (const [dx, dy] of [
        [1e5, 0],
        [-1e5, 0],
        [0, 1e5],
        [0, -1e5],
      ] as const) {
        const cam = panBy({ ...fit, zoom }, dx, dy, box, vp, s0);
        const a = toScreen(cam, s0, vp, { x: box.minX, y: box.minY });
        const b = toScreen(cam, s0, vp, { x: box.maxX, y: box.maxY });
        const overlapX = Math.min(b.x, vp.w) - Math.max(a.x, 0);
        const overlapY = Math.min(b.y, vp.h) - Math.max(a.y, 0);
        const quarterX = Math.min(b.x - a.x, vp.w) / 4;
        const quarterY = Math.min(b.y - a.y, vp.h) / 4;
        expect(overlapX).toBeGreaterThanOrEqual(quarterX - 1e-6);
        expect(overlapY).toBeGreaterThanOrEqual(quarterY - 1e-6);
      }
    }
  });

  it("한계 안의 카메라는 한계를 거쳐도 그대로다", () => {
    const cam = { zoom: 1.5, x: fit.x + 1, y: fit.y - 1 };
    expect(clampCamera(cam, box, vp, s0)).toEqual(cam);
  });

  it("이미 보이는 점이면 움직이지 않고, 화면 밖이면 가운데로 옮긴다", () => {
    const cam = zoomAt(fit, 3, { x: vp.w / 2, y: vp.h / 2 }, box, vp, s0);
    expect(revealCamera(cam, { x: cam.x, y: cam.y }, box, vp, s0)).toBe(cam);
    const far = { x: box.minX + 1, y: box.minY + 1 };
    const moved = revealCamera(cam, far, box, vp, s0);
    expect(moved.zoom).toBe(cam.zoom);
    const p = toScreen(moved, s0, vp, far);
    expect(isOnScreen(p, { x: 0, y: 0, w: vp.w, h: vp.h }, 40)).toBe(true);
  });

  it("날아가는 중간은 두 카메라 사이, 배율은 곱으로 잇는다", () => {
    const a = { zoom: 1, x: 0, y: 0 };
    const b = { zoom: 4, x: 10, y: -6 };
    expect(lerpCamera(a, b, 0)).toEqual(a);
    expect(lerpCamera(a, b, 1)).toEqual(b);
    const mid = lerpCamera(a, b, 0.5);
    expect(mid.zoom).toBeCloseTo(2);
    expect(mid.x).toBeCloseTo(5);
  });
});

describe("화면 밖 표", () => {
  const r = { x: 10, y: 10, w: 400, h: 300 };

  it("화면 가운데에서 그 점 쪽 가장자리에 붙고, 방향 화살표를 고른다", () => {
    const e = edgePoint({ x: -500, y: 160 }, r);
    expect(e.x).toBeCloseTo(10);
    expect(e.y).toBeCloseTo(160);
    expect(e.arrow).toBe("←");
    expect(edgePoint({ x: 900, y: -900 }, r).arrow).toBe("↗");
    expect(arrowFor(0, 5)).toBe("↓");
  });

  it("여러 표가 같은 쪽에 몰려도 겹치지 않고 화면 안에 든다", () => {
    const asks = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      target: { x: 2000, y: 160 + i },
      w: 120,
      h: 20,
    }));
    const tags = placeEdgeTags(asks, r);
    expect(tags).toHaveLength(5);
    for (const t of tags) {
      expect(t.x + t.w).toBeLessThanOrEqual(r.x + r.w);
      expect(t.x).toBeGreaterThanOrEqual(r.x);
      expect(t.y).toBeGreaterThanOrEqual(r.y);
      expect(t.y + t.h).toBeLessThanOrEqual(r.y + r.h);
      expect(t.arrow).toBe("→");
      for (const o of tags)
        if (o !== t)
          expect(
            t.x < o.x + o.w &&
              o.x < t.x + t.w &&
              t.y < o.y + o.h &&
              o.y < t.y + t.h,
          ).toBe(false);
    }
  });
});

describe("확대 단계와 기억", () => {
  it("칸 지름 28·56px에서 단계가 바뀐다", () => {
    expect(stageOf(13.9)).toBe("far");
    expect(stageOf(14)).toBe("mid");
    expect(stageOf(27.9)).toBe("mid");
    expect(stageOf(28)).toBe("near");
  });

  it("저장한 카메라를 읽고, 깨진 글은 버린다", () => {
    expect(parseCamera(JSON.stringify({ zoom: 2, x: 1, y: -3 }))).toEqual({
      zoom: 2,
      x: 1,
      y: -3,
    });
    expect(parseCamera("{")).toBeUndefined();
    expect(
      parseCamera(JSON.stringify({ zoom: 0, x: 1, y: 1 })),
    ).toBeUndefined();
    expect(parseCamera(null)).toBeUndefined();
  });
});
