import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import type { ProjectMap } from "@/protocol/map";
import {
  EDGE_DIRS,
  type FrontierLayout,
  hexKey,
  layoutFrontier,
  neighbors,
  overlaps,
  PAD_RINGS,
  placeLabels,
  ringOf,
  toPixel,
  WEDGE_SLOTS,
  wedgeOf,
} from "./hex";

const NOW = Date.parse("2026-10-29T12:00:00+09:00");
const maps: [string, ProjectMap][] = [
  ["web-shop", buildDemoMap(NOW)],
  ["star-atlas", buildBigDemoMap(NOW)],
];

/** 칸 묶음이 이웃 칸으로 모두 이어져 있는가 */
function connected(cells: { q: number; r: number }[]): boolean {
  if (cells.length === 0) return true;
  const keys = new Set(cells.map(hexKey));
  const first = cells[0];
  if (!first) return true;
  const seen = new Set([hexKey(first)]);
  const queue = [first];
  while (queue.length > 0) {
    const h = queue.shift();
    if (!h) break;
    for (const n of neighbors(h)) {
      const k = hexKey(n);
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen.size === keys.size;
}

const allCells = (l: FrontierLayout) =>
  new Map(
    l.leaves.flatMap((x) => x.cells.map((h) => [hexKey(h), x.region.id])),
  );

describe("육각 기본 계산", () => {
  it("변 너머 방향은 이웃 여섯 칸을 한 번씩 가리킨다", () => {
    const keys = new Set(EDGE_DIRS.map(hexKey));
    expect(keys.size).toBe(6);
    for (const d of EDGE_DIRS) expect(ringOf(d)).toBe(1);
    // i번째 변은 60i+30도 쪽 이웃과 맞닿는다
    for (const [i, d] of EDGE_DIRS.entries()) {
      const p = toPixel(d);
      const a = (Math.atan2(p.y, p.x) * 180) / Math.PI;
      expect(Math.abs(((a + 360) % 360) - (60 * i + 30))).toBeLessThan(0.5);
    }
  });

  it("고리 n에서 부채꼴 하나는 칸 n개를 가진다", () => {
    for (let n = 2; n <= 6; n++) {
      const count = new Map<number, number>();
      for (let q = -n; q <= n; q++)
        for (let r = -n; r <= n; r++) {
          const h = { q, r };
          if (ringOf(h) !== n) continue;
          const w = wedgeOf(h);
          count.set(w, (count.get(w) ?? 0) + 1);
        }
      expect([...count.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
      for (const c of count.values()) expect(c).toBe(n);
    }
  });

  it("지역 부채꼴 차례는 여섯 부채꼴을 한 번씩 쓴다", () => {
    expect(new Set(WEDGE_SLOTS).size).toBe(6);
  });
});

describe.each(maps)("%s 배치", (_name, map) => {
  const layout = layoutFrontier(map);
  const kids = new Set(
    map.regions.flatMap((r) => (r.parent ? [r.parent] : [])),
  );

  it("자식 없는 구역은 모두 size만큼 칸을 받는다", () => {
    const leafIds = map.regions.filter((r) => !kids.has(r.id));
    expect(layout.leaves.map((l) => l.region.id).sort()).toEqual(
      leafIds.map((r) => r.id).sort(),
    );
    for (const l of layout.leaves)
      expect(l.cells.length, l.region.id).toBe(l.region.size);
  });

  it("칸이 겹치지 않고 착륙장 밖에 있다", () => {
    const keys = layout.leaves.flatMap((l) => l.cells.map(hexKey));
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of layout.leaves)
      for (const h of l.cells) expect(ringOf(h)).toBeGreaterThan(PAD_RINGS);
  });

  it("구역 하나의 칸은 서로 이어져 있다", () => {
    for (const l of layout.leaves)
      expect(connected(l.cells), l.region.id).toBe(true);
  });

  it("2단 구역 덩어리도 이어져 있다", () => {
    for (const r of map.regions) {
      if (layout.depthOf.get(r.id) !== 2) continue;
      expect(connected(layout.cellsOf.get(r.id) ?? []), r.id).toBe(true);
    }
  });

  it("지역은 자기 부채꼴 안에만 있다", () => {
    const wedge = new Map(
      layout.territories.map((t) => [t.region.id, t.wedge]),
    );
    for (const l of layout.leaves)
      for (const h of l.cells) expect(wedgeOf(h)).toBe(wedge.get(l.territory));
  });

  it("처음 계획 구역은 발견 구역보다 안쪽부터 찬다", () => {
    for (const t of layout.territories) {
      const ls = layout.leaves.filter((l) => l.territory === t.region.id);
      const inner = (planned: boolean) =>
        ls
          .filter((l) => (l.region.found === undefined) === planned)
          .flatMap((l) =>
            l.cells.map((h) => Math.hypot(...Object.values(toPixel(h)))),
          );
      const plan = inner(true);
      const found = inner(false);
      if (plan.length === 0 || found.length === 0) continue;
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(avg(plan)).toBeLessThan(avg(found));
    }
  });

  it("구역을 하나 더해도 이미 놓인 칸은 움직이지 않는다", () => {
    const before = allCells(layout);
    for (const t of layout.territories) {
      const grown: ProjectMap = {
        ...map,
        regions: [
          ...map.regions,
          {
            id: `new-${t.region.id}`,
            title: "새로 찾은 구역",
            parent: t.region.id,
            status: "fog",
            size: 3,
            found: "2026-10-29",
          },
        ],
      };
      const after = allCells(layoutFrontier(grown));
      for (const [k, id] of before) expect(after.get(k), k).toBe(id);
      expect(
        [...after.values()].filter((id) => id === `new-${t.region.id}`),
      ).toHaveLength(3);
    }
  });

  it("맨 위 구역을 하나 더해도 이미 놓인 칸은 움직이지 않는다", () => {
    if (layout.territories.length >= 6) return;
    const before = allCells(layout);
    const grown: ProjectMap = {
      ...map,
      regions: [
        ...map.regions,
        { id: "far", title: "먼 땅", status: "fog", size: 4 },
      ],
    };
    const after = allCells(layoutFrontier(grown));
    for (const [k, id] of before) expect(after.get(k)).toBe(id);
  });
});

describe("이름표 자리", () => {
  it("겹치지 않게 놓고 자리가 없으면 뺀다", () => {
    const asks = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      anchor: { x: 100 + (i % 5) * 20, y: 100 + Math.floor(i / 5) * 10 },
      w: 60,
      h: 16,
    }));
    const placed = placeLabels(asks, { x: 0, y: 0, w: 400, h: 300 });
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.length).toBeLessThan(asks.length);
    for (const a of placed)
      for (const b of placed) if (a !== b) expect(overlaps(a, b)).toBe(false);
  });
});
