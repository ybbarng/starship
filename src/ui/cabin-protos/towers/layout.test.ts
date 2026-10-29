import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import { droppedIds, mapProgress, type ProjectMap } from "@/protocol/map";
import { layoutTowers, type Rect, STACK_RANK } from "./layout";

const NOW = Date.parse("2026-10-29T12:00:00+09:00");
const SIZES = [
  { w: 1000, h: 760 },
  { w: 730, h: 590 },
];
const MAPS: [string, ProjectMap][] = [
  ["web-shop", buildDemoMap(NOW)],
  ["star-atlas", buildBigDemoMap(NOW)],
];

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - 0.01 &&
  b.x < a.x + a.w - 0.01 &&
  a.y < b.y + b.h - 0.01 &&
  b.y < a.y + a.h - 0.01;

const inside = (a: Rect, box: { w: number; h: number }) =>
  a.x >= -0.01 &&
  a.y >= -0.01 &&
  a.x + a.w <= box.w + 0.01 &&
  a.y + a.h <= box.h + 0.01;

describe.each(MAPS)("함께 쌓는 탑 배치: %s", (_name, map) => {
  const dropped = droppedIds(map);

  it.each(SIZES)("버리지 않은 구역이 모두 한 번씩 놓인다 (%o)", (box) => {
    const { towers } = layoutTowers(map, box, { showDropped: false });
    const placed = towers.flatMap((t) => [
      t.region.id,
      ...t.pieces.map((p) => p.region.id),
    ]);
    const live = map.regions.filter((r) => !dropped.has(r.id)).map((r) => r.id);
    expect(new Set(placed)).toEqual(new Set(live));
    // 맨 위 구역이 블록이기도 한 탑(자식 없음)만 두 번 나온다
    const pieceIds = towers.flatMap((t) => t.pieces.map((p) => p.region.id));
    expect(new Set(pieceIds).size).toBe(pieceIds.length);
  });

  it.each(SIZES)("블록끼리 겹치지 않고 가운데 영역 안에 든다 (%o)", (box) => {
    const { towers } = layoutTowers(map, box, {
      showDropped: true,
      here: map.here,
    });
    const flat = towers.flatMap((t) => [
      ...t.pieces.filter((p) => p.kind !== "module"),
      ...t.chips,
    ]);
    for (const [i, a] of flat.entries()) {
      expect(inside(a, box)).toBe(true);
      for (const b of flat.slice(i + 1)) expect(overlap(a, b)).toBe(false);
    }
    // 띠는 자기 묶음 블록 안에 든다
    for (const t of towers) {
      for (const p of t.pieces.filter((q) => q.kind === "band")) {
        const m = t.pieces.find((q) => q.region.id === p.moduleId);
        expect(m).toBeDefined();
        if (!m) continue;
        expect(p.y).toBeGreaterThanOrEqual(m.y);
        expect(p.y + p.h).toBeLessThanOrEqual(m.y + m.h + 0.01);
      }
    }
    // 탑끼리 세로줄이 겹치지 않는다
    for (const [i, a] of towers.entries())
      for (const b of towers.slice(i + 1))
        expect(overlap(a.col, b.col)).toBe(false);
    // 크레인 꼭대기와 이름판도 영역 안
    for (const t of towers) {
      expect(inside(t.plate, box)).toBe(true);
      if (t.crane) expect(t.crane.jibY).toBeGreaterThanOrEqual(0);
    }
  });

  it("탑 안에서 아래부터 완공 → 공사중 → 막힘 → 안개 순으로 쌓인다", () => {
    const { towers } = layoutTowers(map, SIZES[0] as Rect, {
      showDropped: false,
    });
    for (const t of towers) {
      const groups = [
        t.pieces.filter((p) => p.kind !== "band"),
        ...t.pieces
          .filter((p) => p.kind === "module")
          .map((m) => t.pieces.filter((p) => p.moduleId === m.region.id)),
      ];
      for (const g of groups) {
        const bottomUp = [...g].sort((a, b) => b.y - a.y);
        const ranks = bottomUp.map((p) => STACK_RANK[p.status]);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      }
    }
  });

  it("목표 높이는 버림을 뺀 크기 합이고, 모든 탑을 더하면 진행률의 전체와 같다", () => {
    const { towers, unit } = layoutTowers(map, SIZES[0] as Rect, {
      showDropped: false,
    });
    const p = mapProgress(map);
    expect(towers.reduce((s, t) => s + t.total, 0)).toBe(p.total);
    expect(towers.reduce((s, t) => s + t.done, 0)).toBe(p.done);
    for (const t of towers) {
      expect(t.groundY - t.topY).toBeCloseTo(t.total * unit);
      // 맨 위 블록의 윗변이 목표 높이에 닿는다
      const top = Math.min(...t.pieces.map((q) => q.y));
      expect(top).toBeCloseTo(t.topY + 1);
      expect(t.baseline).toBeLessThanOrEqual(t.total);
    }
  });

  it("버린 구역은 기본으로 빠지고, 보기를 켜면 폐자재 통에 놓인다", () => {
    const off = layoutTowers(map, SIZES[0] as Rect, { showDropped: false });
    const on = layoutTowers(map, SIZES[0] as Rect, { showDropped: true });
    expect(off.towers.flatMap((t) => t.chips)).toHaveLength(0);
    const chips = on.towers.flatMap((t) => t.chips.map((c) => c.region.id));
    expect(chips.length).toBeGreaterThan(0);
    for (const id of chips) expect(dropped.has(id)).toBe(true);
    for (const t of on.towers)
      for (const q of t.pieces) expect(dropped.has(q.region.id)).toBe(false);
  });

  it("크레인은 지금 여기 구역을 매단다", () => {
    const { towers } = layoutTowers(map, SIZES[0] as Rect, {
      showDropped: false,
      here: map.here,
    });
    const cranes = towers.flatMap((t) => (t.crane ? [t.crane] : []));
    const here = cranes.find((c) => c.targetId === map.here);
    expect(here).toBeDefined();
    const piece = towers
      .flatMap((t) => t.pieces)
      .find((q) => q.region.id === map.here);
    expect(here?.hookY).toBe(piece?.y);
  });
});

describe("발견과 처음 계획", () => {
  it("발견 구역만큼 처음 계획 높이가 목표보다 낮다", () => {
    const map = buildDemoMap(NOW);
    const { towers } = layoutTowers(
      map,
      { w: 1000, h: 760 },
      { showDropped: false },
    );
    const server = towers.find((t) => t.region.id === "server");
    // 환불(2)과 중복 쿠폰 계산(2)이 발견이다
    expect(server?.total).toBe(11);
    expect(server?.baseline).toBe(7);
    const launch = towers.find((t) => t.region.id === "launch");
    expect(launch?.baseline).toBe(1);
  });

  it("자식이 없는 맨 위 구역은 블록 하나짜리 탑이 된다", () => {
    const map: ProjectMap = {
      map: "starship-map/1",
      title: "작은 지도",
      regions: [
        { id: "a", title: "가", status: "done", size: 3 },
        { id: "b", title: "나", status: "fog", size: 2 },
      ],
    };
    const { towers } = layoutTowers(
      map,
      { w: 400, h: 400 },
      {
        showDropped: false,
      },
    );
    expect(towers.map((t) => t.pieces.map((p) => p.region.id))).toEqual([
      ["a"],
      ["b"],
    ]);
    expect(towers[1]?.crane).toBeNull();
  });

  it("맨 위 구역이 여덟 개를 넘으면 두 줄로 세운다", () => {
    const map: ProjectMap = {
      map: "starship-map/1",
      title: "넓은 지도",
      regions: Array.from({ length: 12 }, (_, i) => ({
        id: `r${i}`,
        title: `구역 ${i}`,
        status: "building" as const,
        size: 2,
      })),
    };
    const box = { w: 900, h: 700 };
    const { towers, rows } = layoutTowers(map, box, { showDropped: false });
    expect(rows).toBe(2);
    for (const t of towers) expect(inside(t.col, box)).toBe(true);
  });
});
