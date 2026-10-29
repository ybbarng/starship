import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import { droppedIds, type ProjectMap, type Region } from "@/protocol/map";
import { type Cell, layoutRooms, shareWidths, splitRows } from "./layout";

const NOW = Date.parse("2026-10-29T12:00:00+09:00");
const SIZES = [
  { x: 0, y: 0, w: 960, h: 700 },
  { x: 0, y: 0, w: 700, h: 520 },
];

const rooms = (cells: Cell[]) => cells.filter((c) => c.kind === "room");
const overlap = (a: Cell, b: Cell) =>
  a.x < b.x + b.w - 0.01 &&
  b.x < a.x + a.w - 0.01 &&
  a.y < b.y + b.h - 0.01 &&
  b.y < a.y + a.h - 0.01;

/** 같은 부모 아래 같은 단의 방끼리 */
function siblingGroups(cells: Cell[]): Cell[][] {
  const groups = new Map<string, Cell[]>();
  for (const c of rooms(cells)) {
    const key = `${c.depth}|${c.region.parent ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.values()];
}

describe("layoutRooms", () => {
  for (const [name, map] of [
    ["web-shop", buildDemoMap(NOW)],
    ["star-atlas", buildBigDemoMap(NOW)],
  ] as const) {
    for (const rect of SIZES) {
      it(`${name} ${rect.w}×${rect.h}: 버리지 않은 구역은 모두 한 번씩 놓인다`, () => {
        const cells = layoutRooms(map, rect, { showDropped: false });
        const dropped = droppedIds(map);
        const live = map.regions.filter((r) => !dropped.has(r.id));
        const placed = new Set(cells.map((c) => c.region.id));
        for (const r of live) expect(placed.has(r.id)).toBe(true);
        for (const id of placed) expect(dropped.has(id)).toBe(false);
        // 방은 구역마다 하나
        const roomIds = rooms(cells).map((c) => c.region.id);
        expect(new Set(roomIds).size).toBe(roomIds.length);
      });

      it(`${name} ${rect.w}×${rect.h}: 형제끼리 겹치지 않고 틀 밖으로 나가지 않는다`, () => {
        const cells = layoutRooms(map, rect, { showDropped: true });
        for (const group of siblingGroups(cells)) {
          for (let i = 0; i < group.length; i++)
            for (let j = i + 1; j < group.length; j++) {
              const a = group[i];
              const b = group[j];
              if (a && b) expect(overlap(a, b)).toBe(false);
            }
        }
        const decks = cells.filter((c) => c.kind === "deck");
        for (let i = 1; i < decks.length; i++) {
          const a = decks[i - 1];
          const b = decks[i];
          if (a && b) expect(b.y).toBeGreaterThanOrEqual(a.y + a.h);
        }
        for (const c of cells) {
          expect(c.w).toBeGreaterThan(0);
          expect(c.h).toBeGreaterThan(0);
          expect(c.x).toBeGreaterThanOrEqual(rect.x - 0.01);
          expect(c.y).toBeGreaterThanOrEqual(rect.y - 0.01);
          expect(c.x + c.w).toBeLessThanOrEqual(rect.x + rect.w + 0.01);
          expect(c.y + c.h).toBeLessThanOrEqual(rect.y + rect.h + 0.01);
        }
      });

      it(`${name} ${rect.w}×${rect.h}: 작은 칸은 자기 방 안에 든다`, () => {
        const cells = layoutRooms(map, rect, { showDropped: true });
        const byId = new Map(rooms(cells).map((c) => [c.region.id, c]));
        for (const c of cells.filter((c) => c.depth === 3)) {
          const p = byId.get(c.region.parent ?? "");
          expect(p).toBeDefined();
          if (!p) continue;
          expect(c.x).toBeGreaterThanOrEqual(p.x);
          expect(c.x + c.w).toBeLessThanOrEqual(p.x + p.w + 0.01);
          expect(c.y).toBeGreaterThanOrEqual(p.y);
          expect(c.y + c.h).toBeLessThanOrEqual(p.y + p.h + 0.01);
        }
      });
    }
  }

  it("층은 위에서 아래로, 방은 지도에 적힌 순서대로 왼쪽부터", () => {
    const map = buildDemoMap(NOW);
    const cells = layoutRooms(map, SIZES[0] ?? { x: 0, y: 0, w: 1, h: 1 }, {
      showDropped: false,
    });
    const decks = cells.filter((c) => c.kind === "deck");
    expect(decks.map((d) => d.region.id)).toEqual(
      map.regions.filter((r) => !r.parent).map((r) => r.id),
    );
    const server = rooms(cells).filter((c) => c.region.parent === "server");
    const xs = server.map((c) => c.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("방 너비는 무게에 비례한다(가장 좁은 너비보다 넓을 때)", () => {
    const map = mini([
      ["a", 1],
      ["b", 3],
    ]);
    const cells = rooms(
      layoutRooms(map, { x: 0, y: 0, w: 900, h: 300 }, { showDropped: false }),
    ).filter((c) => c.depth === 2);
    const [a, b] = cells;
    expect(a && b && b.w / a.w).toBeCloseTo(3, 1);
  });

  it("층 끝에 방을 하나 더해도 앞 방의 자리는 크게 흔들리지 않고 다른 층은 그대로다", () => {
    const before = buildBigDemoMap(NOW);
    const after: ProjectMap = {
      ...before,
      regions: [
        ...before.regions,
        {
          id: "data-extra",
          title: "새로 찾은 일",
          parent: "data",
          status: "fog",
          size: 1,
        },
      ],
    };
    const rect = SIZES[0] ?? { x: 0, y: 0, w: 1, h: 1 };
    const a = new Map(
      rooms(layoutRooms(before, rect, { showDropped: false })).map((c) => [
        c.region.id,
        c,
      ]),
    );
    const b = new Map(
      rooms(layoutRooms(after, rect, { showDropped: false })).map((c) => [
        c.region.id,
        c,
      ]),
    );
    for (const [id, c] of a) {
      const d = b.get(id);
      expect(d).toBeDefined();
      if (!d) continue;
      expect(d.y).toBeCloseTo(c.y, 5);
      if (c.region.parent === "data") {
        // 같은 층: 순서는 그대로, 너비는 조금 좁아질 뿐
        expect(d.w).toBeLessThanOrEqual(c.w + 0.01);
        expect(d.w).toBeGreaterThan(c.w * 0.7);
        expect(Math.abs(d.x - c.x)).toBeLessThan(rect.w * 0.2);
      } else if (c.region.id !== "data") {
        expect(d.x).toBeCloseTo(c.x, 5);
        expect(d.w).toBeCloseTo(c.w, 5);
      }
    }
  });

  it("방이 너무 많으면 그 층을 두 줄로 늘린다", () => {
    const many = mini(
      Array.from({ length: 14 }, (_, i) => [`r${i}`, 1] as [string, number]),
    );
    const cells = layoutRooms(
      many,
      { x: 0, y: 0, w: 700, h: 400 },
      { showDropped: false },
    );
    const ys = new Set(
      rooms(cells)
        .filter((c) => c.depth === 2)
        .map((c) => Math.round(c.y)),
    );
    expect(ys.size).toBeGreaterThan(1);
    for (const c of rooms(cells)) expect(c.w).toBeGreaterThanOrEqual(77);
  });

  it("버린 구역은 기본으로 빠지고 showDropped면 나온다", () => {
    const map = buildBigDemoMap(NOW);
    const hidden = layoutRooms(map, SIZES[0] ?? SIZES[1] ?? rectZero(), {
      showDropped: false,
    });
    const shown = layoutRooms(map, SIZES[0] ?? rectZero(), {
      showDropped: true,
    });
    expect(hidden.some((c) => c.region.id === "learn-kids")).toBe(false);
    expect(
      shown.find((c) => c.region.id === "learn-kids" && c.dropped),
    ).toBeDefined();
  });
});

describe("shareWidths · splitRows", () => {
  it("좁은 것은 가장 좁은 너비로 묶고 합은 전체와 같다", () => {
    const w = shareWidths(
      [
        { weight: 1, min: 80 },
        { weight: 10, min: 80 },
      ],
      300,
    );
    expect(w[0]).toBe(80);
    expect((w[0] ?? 0) + (w[1] ?? 0)).toBeCloseTo(300, 5);
  });

  it("줄을 나눠도 순서를 지킨다", () => {
    const rows = splitRows([1, 2, 3, 4, 5], () => 100, 250, 4);
    expect(rows).toEqual([[1, 2], [3, 4], [5]]);
  });
});

function rectZero() {
  return { x: 0, y: 0, w: 1, h: 1 };
}

function mini(list: [string, number][]): ProjectMap {
  const regions: Region[] = [
    { id: "top", title: "층", status: "building", size: 1 },
    ...list.map(
      ([id, size]): Region => ({
        id,
        title: id,
        parent: "top",
        status: "fog",
        size,
      }),
    ),
  ];
  return { map: "starship-map/1", title: "작은 지도", regions };
}
