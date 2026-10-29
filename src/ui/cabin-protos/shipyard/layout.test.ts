import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import { droppedIds, type ProjectMap, type Region } from "@/protocol/map";
import { type Block, hullEdges, layoutShip, splitWithMin } from "./layout";

const box = { x: 0, y: 0, w: 1000, h: 700 };

function overlap(a: Block, b: Block) {
  return (
    a.x < b.x + b.w - 0.01 &&
    b.x < a.x + a.w - 0.01 &&
    a.y < b.y + b.h - 0.01 &&
    b.y < a.y + a.h - 0.01
  );
}

function siblingsOverlap(blocks: Block[]) {
  const groups = new Map<string, Block[]>();
  for (const b of blocks) {
    const key = b.region.parent ?? "";
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  for (const list of groups.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a && b && overlap(a, b)) return [a.region.id, b.region.id];
      }
  return null;
}

const region = (id: string, extra: Partial<Region> = {}): Region => ({
  id,
  title: id,
  status: "fog",
  size: 2,
  ...extra,
});

const small = (): ProjectMap => ({
  map: "starship-map/1",
  title: "작은 배",
  regions: [region("a"), region("b"), region("b1", { parent: "b" })],
});

describe("splitWithMin", () => {
  it("비율대로 나누고 gap을 빼고 합이 맞는다", () => {
    const out = splitWithMin(100, [1, 3], 0, 0);
    expect(out).toEqual([25, 75]);
    const g = splitWithMin(104, [1, 1, 2], 0, 2);
    expect(g.reduce((s, v) => s + v, 0)).toBeCloseTo(100);
  });
  it("작은 몫도 min보다 짧아지지 않는다", () => {
    const out = splitWithMin(200, [1, 20, 20], 30, 0);
    expect(out[0]).toBe(30);
    expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(200);
  });
});

describe.each([
  ["web-shop", buildDemoMap(Date.parse("2026-10-29T10:00:00+09:00"))],
  ["star-atlas", buildBigDemoMap(Date.parse("2026-10-29T10:00:00+09:00"))],
])("%s 지도", (_name, map) => {
  for (const size of [
    { w: 1000, h: 760 },
    { w: 720, h: 590 },
  ]) {
    const ship = layoutShip(
      map,
      { x: 0, y: 0, ...size },
      { showDropped: false },
    );
    it(`${size.w}×${size.h}: 버리지 않은 구역이 모두 한 번씩 놓인다`, () => {
      const dropped = droppedIds(map);
      const live = map.regions
        .filter((r) => !dropped.has(r.id))
        .map((r) => r.id);
      const placed = ship.blocks.map((b) => b.region.id);
      expect(new Set(placed).size).toBe(placed.length);
      expect([...placed].sort()).toEqual([...live].sort());
    });
    it(`${size.w}×${size.h}: 형제끼리 겹치지 않고 자식은 부모 안에 있다`, () => {
      expect(siblingsOverlap(ship.blocks)).toBeNull();
      const byId = new Map(ship.blocks.map((b) => [b.region.id, b]));
      for (const b of ship.blocks) {
        const p = b.region.parent ? byId.get(b.region.parent) : undefined;
        if (!p) continue;
        expect(b.x).toBeGreaterThanOrEqual(p.x - 0.01);
        expect(b.x + b.w).toBeLessThanOrEqual(p.x + p.w + 0.01);
        expect(b.y).toBeGreaterThanOrEqual(p.y - 0.01);
        expect(b.y + b.h).toBeLessThanOrEqual(p.y + p.h + 0.01);
      }
    });
    it(`${size.w}×${size.h}: 배 전체가 가로 영역 안에 들어간다`, () => {
      expect(ship.bowTip.x).toBeGreaterThanOrEqual(0);
      for (const n of ship.nozzles)
        expect(n.x + n.w).toBeLessThanOrEqual(size.w + 0.01);
      expect(ship.floorY).toBeLessThanOrEqual(size.h);
    });
    it(`${size.w}×${size.h}: 글자 칸은 선체 곡선 안쪽이다`, () => {
      for (const b of ship.blocks) {
        const a = hullEdges(ship, b.safe.x);
        const c = hullEdges(ship, b.safe.x + b.safe.w);
        if (b.safe.h === 0) continue;
        expect(b.safe.y).toBeGreaterThanOrEqual(Math.max(a.top, c.top) - 0.01);
        expect(b.safe.y + b.safe.h).toBeLessThanOrEqual(
          Math.min(a.bottom, c.bottom) + 0.01,
        );
      }
    });
  }

  it("버린 구역 보기를 켜면 떼어 낸 블록이 바닥에 놓인다", () => {
    const ship = layoutShip(map, box, { showDropped: true });
    expect(ship.pile.length).toBeGreaterThan(0);
    for (const p of ship.pile) {
      expect(p.region.status).toBe("dropped");
      expect(p.y).toBeGreaterThan(ship.floorY);
    }
  });

  it("발견 구역이 있으면 처음 설계 길이가 지금보다 짧다", () => {
    const ship = layoutShip(map, box, { showDropped: false });
    expect(ship.planUnits).toBeLessThan(ship.units);
    expect(ship.planX).toBeLessThan(ship.x1);
    expect(ship.planX).toBeGreaterThan(ship.x0);
  });
});

describe("배 길이", () => {
  const wide = { x: 0, y: 0, w: 5000, h: 600 };
  it("발견 구역이 늘면 배가 꼬리 쪽으로 길어진다", () => {
    const base = small();
    const grown: ProjectMap = {
      ...base,
      regions: [
        ...base.regions,
        region("c", { found: "2026-10-20" }),
        region("b2", { parent: "b", found: "2026-10-21" }),
      ],
    };
    const a = layoutShip(base, wide, { showDropped: false });
    const b = layoutShip(grown, wide, { showDropped: false });
    expect(b.x1 - b.x0).toBeGreaterThan(a.x1 - a.x0);
    expect(b.units).toBe(a.units + 4);
    expect(b.planUnits).toBe(a.units);
    // 새로 생긴 구획은 꼬리 쪽 끝에 붙는다
    expect(b.columns.at(-1)?.region.id).toBe("c");
    expect(b.blocks.find((x) => x.region.id === "c")?.found).toBe(true);
  });
  it("발견이 없으면 처음 설계 길이와 지금 길이가 같다", () => {
    const a = layoutShip(small(), wide, { showDropped: false });
    expect(a.planX).toBeCloseTo(a.x1);
  });
  it("구역 하나짜리 지도도 배 모양이 나온다", () => {
    const one: ProjectMap = {
      map: "starship-map/1",
      title: "정찰선",
      regions: [region("only", { status: "done" })],
    };
    const s = layoutShip(one, box, { showDropped: false });
    expect(s.blocks).toHaveLength(1);
    expect(s.x1).toBeGreaterThan(s.x0);
  });
});
