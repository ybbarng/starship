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
  wedgeAngle,
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

/** 맨 위 구역 n개, 지역마다 계획 구역 셋(크기 2·3·4)을 가진 지도 */
function territoriesMap(n: number): ProjectMap {
  const regions: ProjectMap["regions"] = [];
  for (let i = 0; i < n; i++) {
    regions.push({ id: `t${i}`, title: `지역 ${i}`, status: "fog", size: 1 });
    for (const [j, size] of [2, 3, 4].entries())
      regions.push({
        id: `t${i}-${j}`,
        title: `구역 ${i}-${j}`,
        parent: `t${i}`,
        status: j === 0 ? "done" : "building",
        size,
      });
  }
  return { map: "starship-map/1", title: "지역 시험", regions };
}

const angleOf = (h: { q: number; r: number }) => {
  const p = toPixel(h);
  return (Math.atan2(p.y, p.x) * 180) / Math.PI;
};
/** 두 각도 사이(도, 0..180) */
const angleGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

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
});

describe("지역 부채꼴: 같은 각도로 나눈다", () => {
  it("첫 지역은 왼쪽, 다음 지역은 시계 방향", () => {
    expect(wedgeAngle(0, 4)).toBe(180);
    // 화면 좌표는 y가 아래라, 왼쪽에서 시계 방향으로 90도 가면 위(-90도)다
    expect(wedgeAngle(1, 4)).toBe(-90);
    expect(wedgeOf({ q: -4, r: 2 }, 4)).toBe(0); // 왼쪽
    expect(wedgeOf({ q: 0, r: -4 }, 4)).toBe(1); // 위
    expect(wedgeOf({ q: 4, r: -2 }, 4)).toBe(2); // 오른쪽
    expect(wedgeOf({ q: 0, r: 4 }, 4)).toBe(3); // 아래
  });

  it("착륙장 칸은 어느 부채꼴에도 들지 않는다", () => {
    expect(wedgeOf({ q: 0, r: 0 }, 3)).toBe(-1);
    for (const d of EDGE_DIRS) expect(wedgeOf(d, 3)).toBe(-1);
  });

  it.each(Array.from({ length: 10 }, (_, i) => i + 1))(
    "지역 %i개: 칸마다 부채꼴 하나, 빈 부채꼴이 없고 넓이가 고르다",
    (n) => {
      const count = new Map<number, number>();
      for (let q = -8; q <= 8; q++)
        for (let r = -8; r <= 8; r++) {
          const h = { q, r };
          const ring = ringOf(h);
          if (ring <= PAD_RINGS || ring > 8) continue;
          const w = wedgeOf(h, n);
          expect(w).toBeGreaterThanOrEqual(0);
          expect(w).toBeLessThan(n);
          // 칸은 자기 부채꼴 가운데에서 반 폭(180/n도) 안에 있다
          expect(angleGap(angleOf(h), wedgeAngle(w, n))).toBeLessThanOrEqual(
            180 / n + 1e-6,
          );
          count.set(w, (count.get(w) ?? 0) + 1);
        }
      expect(count.size).toBe(n);
      const sizes = [...count.values()];
      // 고리 2~8의 칸 210개를 나눠 가진다. 경계 칸 몫 말고는 차이가 크지 않다
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(
        Math.ceil(210 / n / 4) + 4,
      );
    },
  );

  it.each(Array.from({ length: 10 }, (_, i) => i + 1))(
    "지역 %i개 지도: 모든 지역이 땅을 받고 자기 부채꼴 안에만 있다",
    (n) => {
      const layout = layoutFrontier(territoriesMap(n));
      expect(layout.territories).toHaveLength(n);
      for (const t of layout.territories) {
        expect(t.wedge).toBe(t.index);
        expect(t.angle).toBe(wedgeAngle(t.index, n));
      }
      for (const l of layout.leaves) {
        expect(l.cells.length, l.region.id).toBe(l.region.size);
        expect(connected(l.cells), l.region.id).toBe(true);
        const t = layout.territories.find((x) => x.region.id === l.territory);
        for (const h of l.cells) expect(wedgeOf(h, n)).toBe(t?.wedge);
      }
    },
  );
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
      for (const h of l.cells)
        expect(wedgeOf(h, layout.territories.length)).toBe(
          wedge.get(l.territory),
        );
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

  it("늦은 발견 구역을 더하면 바깥에 붙고 기존 칸은 그대로다", () => {
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

  it("상태·표지·이름이 바뀌어도 칸은 그대로다", () => {
    const statuses = ["fog", "building", "done", "blocked"] as const;
    const changed: ProjectMap = {
      ...map,
      regions: map.regions.map((r, i) => ({
        ...r,
        title: `${r.title} (고침)`,
        status: statuses[i % statuses.length] ?? "fog",
        signs: undefined,
      })),
    };
    expect(allCells(layoutFrontier(changed))).toEqual(allCells(layout));
  });

  it("처음 계획 구역을 뒤늦게 더하면 그 지역 안만 바뀐다", () => {
    const before = allCells(layout);
    const terr = new Map(layout.leaves.map((l) => [l.region.id, l.territory]));
    for (const t of layout.territories) {
      const id = `late-${t.region.id}`;
      const grown: ProjectMap = {
        ...map,
        regions: [
          ...map.regions,
          {
            id,
            title: "뒤늦게 적은 계획",
            parent: t.region.id,
            status: "fog",
            size: 2,
          },
        ],
      };
      const after = allCells(layoutFrontier(grown));
      for (const [k, owner] of before)
        if (terr.get(owner) !== t.region.id)
          expect(after.get(k), k).toBe(owner);
      expect([...after.values()].filter((x) => x === id)).toHaveLength(2);
    }
  });

  it("맨 위 구역을 더하면 모든 지역의 부채꼴이 다시 같은 각도로 나뉜다", () => {
    const grown: ProjectMap = {
      ...map,
      regions: [
        ...map.regions,
        { id: "far", title: "먼 땅", status: "fog", size: 4 },
      ],
    };
    const next = layoutFrontier(grown);
    const n = layout.territories.length + 1;
    expect(next.territories.map((t) => t.angle)).toEqual(
      Array.from({ length: n }, (_, i) => wedgeAngle(i, n)),
    );
    const wedge = new Map(next.territories.map((t) => [t.region.id, t.wedge]));
    for (const l of next.leaves) {
      expect(l.cells.length, l.region.id).toBe(l.region.size);
      for (const h of l.cells)
        expect(wedgeOf(h, n)).toBe(wedge.get(l.territory));
    }
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
