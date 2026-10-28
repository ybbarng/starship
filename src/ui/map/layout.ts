// 지도 배치: squarified treemap(Bruls·Huizing·van Wijk 2000).
// 맨 위 구역이 대륙, 그 안의 구역이 땅이다. 넓이는 size(자식이 있으면 자식 넓이의 합).
// 좌표를 손으로 적지 않으므로 구역이 늘어도 땅이 나뉘기만 한다.
import {
  childrenOf,
  droppedIds,
  type ProjectMap,
  type Region,
} from "@/protocol/map";

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * 값에 비례하는 넓이로 사각형을 나눈다. 가로세로 비가 1에 가깝게 줄 단위로 채운다.
 * 큰 것부터 놓고, 값이 같으면 들어온 순서를 지킨다. 값이 0 이하인 것은 빠진다.
 */
export function squarify<T extends { value: number }>(
  items: T[],
  rect: Rect,
): (T & Rect)[] {
  const nodes = items
    .map((item, i) => ({ item, i }))
    .filter((n) => n.item.value > 0)
    .sort((a, b) => b.item.value - a.item.value || a.i - b.i)
    .map((n) => n.item);
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const out: (T & Rect)[] = [];
  let { x, y, w, h } = rect;
  let row: T[] = [];

  const area = (n: T) => n.value * scale;
  // 짧은 변 side에 row를 한 줄로 놓았을 때 가장 나쁜 가로세로 비
  const worst = (list: T[], side: number) => {
    const areas = list.map(area);
    const s = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max(
      (side * side * max) / (s * s),
      (s * s) / (side * side * min),
    );
  };
  const place = (list: T[]) => {
    const s = list.reduce((a, n) => a + area(n), 0);
    if (w >= h) {
      // 왼쪽에 세로 한 줄
      const thick = s / h;
      let cy = y;
      for (const n of list) {
        const len = area(n) / thick;
        out.push({ ...n, x, y: cy, w: thick, h: len });
        cy += len;
      }
      x += thick;
      w -= thick;
    } else {
      // 위에 가로 한 줄
      const thick = s / w;
      let cx = x;
      for (const n of list) {
        const len = area(n) / thick;
        out.push({ ...n, x: cx, y, w: len, h: thick });
        cx += len;
      }
      y += thick;
      h -= thick;
    }
  };

  for (const n of nodes) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) {
      row.push(n);
    } else {
      place(row);
      row = [n];
    }
  }
  if (row.length > 0) place(row);
  return out;
}

export type Tile = Rect & {
  region: Region;
  /** 1 = 대륙(맨 위) */
  depth: number;
  /** 안에 땅을 품은 구역. 위쪽에 이름 띠를 두고 그 아래에 자식을 놓는다. */
  container: boolean;
  /** 버린 구역(자신이나 조상) */
  dropped: boolean;
};

export type LayoutOptions = {
  /** 버린 구역도 놓을까. 기본 false */
  showDropped?: boolean;
  /** 품은 구역의 이름 띠 높이(px) */
  header?: number;
  /** 구역 사이 틈(px) */
  gap?: number;
};

/** 지도 전체를 rect 안에 놓는다. 부모가 자식보다 먼저 나온다(그리는 순서). */
export function layoutMap(
  map: ProjectMap,
  rect: Rect,
  { showDropped = false, header = 20, gap = 3 }: LayoutOptions = {},
): Tile[] {
  const kids = childrenOf(map);
  const dropped = droppedIds(map);
  const visible = (r: Region) => showDropped || !dropped.has(r.id);
  const valueCache = new Map<string, number>();
  const value = (r: Region, guard = 0): number => {
    const hit = valueCache.get(r.id);
    if (hit !== undefined) return hit;
    const list = (kids.get(r.id) ?? []).filter(visible);
    const v =
      list.length > 0 && guard < 8
        ? list.reduce((s, k) => s + value(k, guard + 1), 0)
        : r.size;
    valueCache.set(r.id, v);
    return v;
  };

  const out: Tile[] = [];
  const lay = (list: Region[], area: Rect, depth: number) => {
    const placed = squarify(
      list.filter(visible).map((region) => ({ region, value: value(region) })),
      area,
    );
    for (const p of placed) {
      const inner: Rect = {
        x: p.x + gap / 2,
        y: p.y + gap / 2,
        w: Math.max(0, p.w - gap),
        h: Math.max(0, p.h - gap),
      };
      const children = (kids.get(p.region.id) ?? []).filter(visible);
      const container = children.length > 0 && depth < 8;
      out.push({
        ...inner,
        region: p.region,
        depth,
        container,
        dropped: dropped.has(p.region.id),
      });
      if (container) {
        lay(
          children,
          {
            x: inner.x + gap,
            y: inner.y + header,
            w: Math.max(0, inner.w - 2 * gap),
            h: Math.max(0, inner.h - header - gap),
          },
          depth + 1,
        );
      }
    }
  };
  lay(kids.get("") ?? [], rect, 1);
  return out;
}
