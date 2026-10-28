import { describe, expect, it } from "vitest";
import { buildDemoMap } from "@/demo/map";
import { layoutMap, type Rect, squarify } from "./layout";

const area = (r: Rect) => r.w * r.h;
const inside = (a: Rect, b: Rect) =>
  a.x >= b.x - 1e-6 &&
  a.y >= b.y - 1e-6 &&
  a.x + a.w <= b.x + b.w + 1e-6 &&
  a.y + a.h <= b.y + b.h + 1e-6;
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - 1e-6 &&
  b.x < a.x + a.w - 1e-6 &&
  a.y < b.y + b.h - 1e-6 &&
  b.y < a.y + a.h - 1e-6;

describe("squarify", () => {
  const rect = { x: 0, y: 0, w: 600, h: 400 };

  it("논문의 예시 값: 넓이가 값에 비례하고 빈틈없이 채운다", () => {
    const items = [6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ id: i, value }));
    const out = squarify(items, rect);
    expect(out).toHaveLength(7);
    const total = out.reduce((s, r) => s + area(r), 0);
    expect(total).toBeCloseTo(area(rect));
    for (const r of out) {
      expect(area(r)).toBeCloseTo((r.value / 24) * area(rect));
      expect(inside(r, rect)).toBe(true);
    }
    for (const a of out)
      for (const b of out) if (a !== b) expect(overlap(a, b)).toBe(false);
  });

  it("값이 0 이하인 것은 빠진다", () => {
    expect(squarify([{ value: 0 }, { value: 2 }], rect)).toHaveLength(1);
    expect(squarify([], rect)).toEqual([]);
  });
});

describe("layoutMap", () => {
  const map = buildDemoMap(Date.parse("2026-10-29T12:00:00+09:00"));
  const rect = { x: 0, y: 0, w: 1000, h: 640 };

  it("버린 구역은 기본으로 빠지고, 켜면 들어온다", () => {
    const hidden = layoutMap(map, rect);
    const shown = layoutMap(map, rect, { showDropped: true });
    expect(hidden.some((t) => t.region.status === "dropped")).toBe(false);
    expect(shown.length).toBe(hidden.length + 1);
    expect(shown.find((t) => t.region.status === "dropped")?.dropped).toBe(
      true,
    );
  });

  it("자식은 부모 안에, 형제끼리는 겹치지 않는다", () => {
    const tiles = layoutMap(map, rect);
    const byId = new Map(tiles.map((t) => [t.region.id, t]));
    for (const t of tiles) {
      expect(inside(t, rect)).toBe(true);
      const parent = t.region.parent ? byId.get(t.region.parent) : undefined;
      if (parent) {
        expect(parent.container).toBe(true);
        expect(t.depth).toBe(parent.depth + 1);
        expect(inside(t, parent)).toBe(true);
      }
      for (const u of tiles)
        if (u !== t && u.region.parent === t.region.parent)
          expect(overlap(t, u)).toBe(false);
    }
  });

  it("부모가 자식보다 먼저 나온다", () => {
    const tiles = layoutMap(map, rect);
    const order = new Map(tiles.map((t, i) => [t.region.id, i]));
    for (const t of tiles)
      if (t.region.parent)
        expect(order.get(t.region.parent)).toBeLessThan(
          order.get(t.region.id) ?? -1,
        );
  });
});
