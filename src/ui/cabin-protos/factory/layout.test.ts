import { describe, expect, it } from "vitest";
import { buildBigDemoMap, buildDemoMap } from "@/demo/map";
import { childrenOf, droppedIds, mapProgress } from "@/protocol/map";
import { columnOf, layoutFactory, type Rect } from "./layout";

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - 1e-6 &&
  b.x < a.x + a.w - 1e-6 &&
  a.y < b.y + b.h - 1e-6 &&
  b.y < a.y + a.h - 1e-6;

const NOW = Date.parse("2026-10-29T12:00:00+09:00");
const maps = [
  ["web-shop", buildDemoMap(NOW)],
  ["star-atlas", buildBigDemoMap(NOW)],
] as const;
const sizes = [
  { w: 1008, h: 760 },
  { w: 736, h: 590 },
];

/** 끝 구역: 버리지 않았고 살아 있는 자식이 없다 */
function leaves(map: ReturnType<typeof buildDemoMap>) {
  const kids = childrenOf(map);
  const dropped = droppedIds(map);
  return map.regions.filter(
    (r) =>
      !dropped.has(r.id) &&
      !(kids.get(r.id) ?? []).some((k) => !dropped.has(k.id)),
  );
}

describe.each(maps)("layoutFactory · %s", (_name, map) => {
  describe.each(sizes)("$w×$h", (area) => {
    const out = layoutFactory(map, area, { showDropped: false });

    it("끝 구역이 하나도 빠짐없이 한 번씩 상자로 놓인다", () => {
      const want = leaves(map)
        .map((r) => r.id)
        .sort();
      expect(out.boxes.map((b) => b.region.id).sort()).toEqual(want);
    });

    it("상자끼리 겹치지 않는다", () => {
      for (const a of out.boxes)
        for (const b of out.boxes)
          if (a !== b)
            expect(overlap(a, b), `${a.region.id}/${b.region.id}`).toBe(false);
    });

    it("상자는 자기 상태 칸 안, 자기 줄 벨트 안에 있다", () => {
      for (const b of out.boxes) {
        expect(b.column).toBe(columnOf(b.region.status));
        const col = out.columns.find((c) => c.key === b.column);
        expect(col).toBeDefined();
        if (!col) continue;
        expect(b.x).toBeGreaterThanOrEqual(col.x - 1e-6);
        expect(b.x + b.w).toBeLessThanOrEqual(col.x + col.w + 1e-6);
        const row = out.rows.find((r) => r.region.id === b.row);
        expect(row).toBeDefined();
        if (!row) continue;
        expect(b.y).toBeGreaterThanOrEqual(row.belt.y - 1e-6);
        expect(b.y + b.h).toBeLessThanOrEqual(row.belt.y + row.belt.h + 1e-6);
      }
    });

    it("상자 폭이 size에 비례한다", () => {
      const per = out.boxes.map((b) => b.w / b.region.size);
      for (const p of per) expect(p).toBeCloseTo(per[0] ?? 0, 6);
    });

    it("가운데 영역 안에 다 들어간다(스크롤 없음)", () => {
      for (const b of [...out.boxes, out.crate]) {
        expect(b.x).toBeGreaterThanOrEqual(-1e-6);
        expect(b.y).toBeGreaterThanOrEqual(-1e-6);
        expect(b.x + b.w).toBeLessThanOrEqual(area.w + 1e-6);
        expect(b.y + b.h).toBeLessThanOrEqual(area.h + 1e-6);
      }
      for (const b of out.boxes)
        expect(b.x + b.w).toBeLessThanOrEqual(out.crate.x);
    });

    it("칸 경계가 모든 줄에서 같은 세로선이고 칸이 흐름 순서로 붙어 있다", () => {
      expect(out.columns.map((c) => c.key)).toEqual([
        "fog",
        "building",
        "blocked",
        "done",
      ]);
      for (let i = 1; i < out.columns.length; i++) {
        const a = out.columns[i - 1];
        const b = out.columns[i];
        if (a && b) expect(b.x).toBeCloseTo(a.x + a.w, 6);
      }
    });

    it("목표 화물 상자는 진행률만큼 찬다", () => {
      expect(out.crate.fill).toBe(mapProgress(map).ratio);
    });

    it("버린 구역은 기본으로 숨긴다", () => {
      const dropped = droppedIds(map);
      expect(out.boxes.some((b) => dropped.has(b.region.id))).toBe(false);
      expect(out.rows.some((r) => r.bin)).toBe(false);
    });
  });

  it("버린 구역 보기를 켜면 폐기 통에 모두 담긴다", () => {
    const out = layoutFactory(map, sizes[1] ?? { w: 736, h: 590 }, {
      showDropped: true,
    });
    const binned = out.rows
      .flatMap((r) => r.bin?.items ?? [])
      .map((i) => i.region.id)
      .sort();
    expect(binned).toEqual([...droppedIds(map)].sort());
    const last = out.rows.at(-1);
    const bottom = last?.bin
      ? last.bin.y + last.bin.h
      : (last?.belt.y ?? 0) + (last?.belt.h ?? 0);
    expect(bottom).toBeLessThanOrEqual((sizes[1]?.h ?? 0) + 1e-6);
  });
});

describe("layoutFactory · 묶음", () => {
  it("3단 상자는 감싸는 2단 구역을 group으로 갖고, 그 구역은 줄 머리 묶음표가 된다", () => {
    const map = buildDemoMap(NOW);
    const out = layoutFactory(map, { w: 1008, h: 760 }, { showDropped: false });
    const stack = out.boxes.find((b) => b.region.id === "coupon-stack");
    expect(stack?.group).toBe("server-coupon");
    expect(stack?.row).toBe("server");
    const server = out.rows.find((r) => r.region.id === "server");
    expect(server?.groups.map((g) => g.region.id)).toEqual(["server-coupon"]);
    expect(out.boxes.find((b) => b.region.id === "server-payment")?.group).toBe(
      undefined,
    );
  });
});
