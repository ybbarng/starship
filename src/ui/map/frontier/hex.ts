// 육각 개척지 배치: 착륙선(가운데) 둘레로 구역마다 육각 칸 size개를 붙여 나간다.
// 모두 순수 함수다. 화면 크기와 상관없이 칸 좌표(axial q, r)만 정하고, 픽셀은 그리는 쪽이 곱한다.
//
// 규칙
// - 칸은 위아래가 납작한 육각형(flat-top). 가운데 칸과 그 둘레 첫 고리(7칸)는 착륙장이다.
// - 둘레를 여섯 부채꼴로 나눈다. 고리 n에서 부채꼴 하나는 칸 n개를 가진다(고리를 따라 도는 변 하나).
// - 맨 위 구역(지역)은 지도에 적힌 차례대로 부채꼴을 하나씩 맡는다: 왼쪽, 오른쪽, 오른쪽 위, 왼쪽 아래, 왼쪽 위, 오른쪽 아래.
//   마주 보는 쪽부터 채워 지역이 적어도 한쪽으로 쏠리지 않고, 지역을 더해도 앞 지역의 부채꼴은 그대로다.
// - 지역 안에서는 처음 계획한 구역(found 없음)을 지도 차례대로, 그다음 발견 구역을 발견한 날 차례대로 놓는다.
//   앞 구역부터 착륙장에 가까운 칸을 차지하니 계획은 안쪽, 발견은 바깥에 붙는다.
//   새 구역은 늘 맨 뒤에 오므로 이미 놓인 칸은 움직이지 않는다.
// - 칸을 받는 것은 자식이 없는 구역(잎)뿐이다. 자식이 있는 구역은 자손 칸을 모은 덩어리로 본다.
// - 버린 구역도 칸을 받는다(그리는 쪽이 숨긴다). 그래야 "버린 구역 보기"를 켜고 꺼도 다른 칸이 그대로다.
// 맨 위 구역이 일곱 개를 넘으면 부채꼴을 나눠 쓰고, 이때는 앞 지역이 커질 때 뒤 지역이 밀릴 수 있다.
import { childrenOf, type ProjectMap, type Region } from "@/protocol/map";

export type Hex = { q: number; r: number };

export const hexKey = (h: Hex) => `${h.q},${h.r}`;

/** 이웃 여섯 방향(axial) */
export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export function neighbors(h: Hex): Hex[] {
  return DIRS.map((d) => add(h, d));
}

/** 가운데에서 몇 번째 고리인가 */
export function ringOf(h: Hex): number {
  return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(h.q + h.r)) / 2;
}

/** 칸 가운데 픽셀(칸 반지름 s). flat-top */
export function toPixel(h: Hex, s = 1): { x: number; y: number } {
  return { x: s * 1.5 * h.q, y: s * Math.sqrt(3) * (h.r + h.q / 2) };
}

/** 칸 꼭짓점 여섯 개. i번째 변은 꼭짓점 i와 i+1 사이 */
export function corners(
  cx: number,
  cy: number,
  s: number,
): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return { x: cx + s * Math.cos(a), y: cy + s * Math.sin(a) };
  });
}

/** i번째 변 너머 이웃 방향. 변 가운데 각도(60i+30도) 쪽 칸이다 */
export const EDGE_DIRS: readonly Hex[] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i + Math.PI / 6;
  const x = Math.sqrt(3) * Math.cos(a);
  const y = Math.sqrt(3) * Math.sin(a);
  const q = Math.round((2 / 3) * x);
  const r = Math.round(-x / 3 + y / Math.sqrt(3));
  return { q, r };
});

/** 착륙장 고리(가운데 + 첫 고리) */
export const PAD_RINGS = 1;
/** 부채꼴을 미리 펼쳐 둘 고리 수. 칸 합이 수천이 되어도 넉넉하다 */
const MAX_RING = 48;

/** 고리 n을 도는 칸들. side는 고리의 몇 번째 변인가(= 부채꼴 번호) */
function ringCells(n: number): { hex: Hex; side: number }[] {
  const out: { hex: Hex; side: number }[] = [];
  let cur: Hex = { q: (DIRS[4]?.q ?? 0) * n, r: (DIRS[4]?.r ?? 0) * n };
  for (let side = 0; side < 6; side++) {
    for (let j = 0; j < n; j++) {
      out.push({ hex: cur, side });
      cur = add(cur, DIRS[side] ?? { q: 0, r: 0 });
    }
  }
  return out;
}

let wedgeCache: Map<string, number> | null = null;
/** 칸 → 부채꼴 번호(0..5). 착륙장은 -1 */
export function wedgeOf(h: Hex): number {
  if (!wedgeCache) {
    wedgeCache = new Map();
    for (let n = 1; n <= MAX_RING; n++)
      for (const c of ringCells(n)) wedgeCache.set(hexKey(c.hex), c.side);
  }
  if (ringOf(h) <= PAD_RINGS) return -1;
  return wedgeCache.get(hexKey(h)) ?? -1;
}

/** 부채꼴 가운데 방향(화면 좌표, y 아래로). 도 단위 -180..180 */
export function wedgeAngle(side: number): number {
  const cells = ringCells(1);
  const a = cells[side]?.hex ?? { q: 0, r: 0 };
  const b = cells[(side + 1) % 6]?.hex ?? { q: 0, r: 0 };
  const pa = toPixel(a);
  const pb = toPixel(b);
  return (Math.atan2(pa.y + pb.y, pa.x + pb.x) * 180) / Math.PI;
}

/** 맨 위 구역이 맡을 부채꼴 차례: 왼쪽, 오른쪽, 오른쪽 위, 왼쪽 아래, 왼쪽 위, 오른쪽 아래 */
const SLOT_ANGLES = [180, 0, -60, 120, -120, 60];
export const WEDGE_SLOTS: readonly number[] = SLOT_ANGLES.map((want) => {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let side = 0; side < 6; side++) {
    let d = Math.abs(wedgeAngle(side) - want);
    if (d > 180) d = 360 - d;
    if (d < bestD) {
      bestD = d;
      best = side;
    }
  }
  return best;
});

/* ───────────── 배치 ───────────── */

export type FrontierLeaf = {
  region: Region;
  /** 맨 위 구역 id(지역) */
  territory: string;
  /** 2단 조상 id. 2단 이하 잎이면 자기 자신 */
  group: string;
  depth: number;
  cells: Hex[];
};

export type FrontierTerritory = {
  region: Region;
  /** 지도에 적힌 차례(색을 고를 때 쓴다) */
  index: number;
  wedge: number;
};

export type FrontierLayout = {
  leaves: FrontierLeaf[];
  territories: FrontierTerritory[];
  /** 칸 key → 잎 id */
  owner: Map<string, string>;
  /** 구역 id → 그 구역(자손 포함)의 칸 */
  cellsOf: Map<string, Hex[]>;
  /** 구역 id → 단(맨 위가 1) */
  depthOf: Map<string, number>;
  /** 가장 바깥 칸의 고리 */
  maxRing: number;
};

/** 발견한 날. 자기 found가 없으면 조상 것을 따른다. 처음 계획이면 undefined */
function foundAt(
  r: Region,
  byId: Map<string, Region>,
  guard = 0,
): number | undefined {
  if (r.found !== undefined) {
    const t = Date.parse(r.found);
    return Number.isNaN(t) ? undefined : t;
  }
  const up = r.parent !== undefined ? byId.get(r.parent) : undefined;
  return up && guard < 8 ? foundAt(up, byId, guard + 1) : undefined;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function layoutFrontier(map: ProjectMap): FrontierLayout {
  const kids = childrenOf(map);
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const order = new Map(map.regions.map((r, i) => [r.id, i]));
  const tops = kids.get("") ?? [];

  const depthOf = new Map<string, number>();
  const walk = (r: Region, depth: number, top: string, group: string) => {
    depthOf.set(r.id, depth);
    const ch = kids.get(r.id) ?? [];
    if (ch.length === 0) leavesByTop.get(top)?.push({ r, depth, group });
    for (const c of ch) walk(c, depth + 1, top, depth + 1 === 2 ? c.id : group);
  };
  const leavesByTop = new Map<
    string,
    { r: Region; depth: number; group: string }[]
  >();
  for (const t of tops) {
    leavesByTop.set(t.id, []);
    walk(t, 1, t.id, t.id);
  }

  const occupied = new Set<string>();
  const owner = new Map<string, string>();
  const leaves: FrontierLeaf[] = [];
  const territories: FrontierTerritory[] = [];
  const isFree = (h: Hex, wedge: number) =>
    !occupied.has(hexKey(h)) && wedgeOf(h) === wedge && ringOf(h) <= MAX_RING;

  tops.forEach((top, index) => {
    const wedge = WEDGE_SLOTS[index % 6] ?? 0;
    territories.push({ region: top, index, wedge });
    const list = [...(leavesByTop.get(top.id) ?? [])].sort((a, b) => {
      const fa = foundAt(a.r, byId);
      const fb = foundAt(b.r, byId);
      if ((fa === undefined) !== (fb === undefined))
        return fa === undefined ? -1 : 1;
      if (fa !== undefined && fb !== undefined && fa !== fb) return fa - fb;
      return (order.get(a.r.id) ?? 0) - (order.get(b.r.id) ?? 0);
    });
    // 이 부채꼴에서 이미 땅이 된 칸(앞 지역 것도). 새 덩어리는 여기나 착륙장에 붙는다.
    const groupCells = new Map<string, Hex[]>();
    const wedgeTaken: Hex[] = [];

    for (const { r, depth, group } of list) {
      const size = Math.max(1, Math.round(r.size));
      const mine = groupCells.get(group) ?? [];
      const touches = (h: Hex, set: Hex[]) => {
        const keys = new Set(set.map(hexKey));
        return neighbors(h).some((n) => keys.has(hexKey(n)));
      };
      // 처음 칸 후보: 땅(또는 착륙장)에 닿은 빈 칸
      const frontierOf = (base: Hex[]) => {
        const seen = new Set<string>();
        const out: Hex[] = [];
        for (const b of base)
          for (const n of neighbors(b)) {
            const k = hexKey(n);
            if (seen.has(k) || !isFree(n, wedge)) continue;
            seen.add(k);
            out.push(n);
          }
        return out;
      };
      const padEdge = ringCells(PAD_RINGS).map((c) => c.hex);
      const fits = (start: Hex) => {
        // 빈 칸을 따라 size칸까지 닿는가(막힌 주머니에 들어가지 않게)
        const seen = new Set([hexKey(start)]);
        const queue = [start];
        while (queue.length > 0 && seen.size < size) {
          const h = queue.shift() as Hex;
          for (const n of neighbors(h)) {
            const k = hexKey(n);
            if (seen.has(k) || !isFree(n, wedge)) continue;
            seen.add(k);
            queue.push(n);
          }
        }
        return seen.size >= size;
      };
      const startCost = (h: Hex) => {
        const p = toPixel(h);
        const a = (Math.atan2(p.y, p.x) * 180) / Math.PI;
        let dev = Math.abs(a - wedgeAngle(wedge));
        if (dev > 180) dev = 360 - dev;
        return Math.hypot(p.x, p.y) + dev * 0.004;
      };
      const pick = (cands: Hex[], cost: (h: Hex) => number) =>
        cands
          .filter(fits)
          .sort(
            (a, b) => cost(a) - cost(b) || hexKey(a).localeCompare(hexKey(b)),
          )[0];

      let start: Hex | undefined;
      if (mine.length > 0) start = pick(frontierOf(mine), startCost);
      if (!start)
        start = pick(frontierOf([...wedgeTaken, ...padEdge]), startCost);
      if (!start) {
        // 둘레가 모두 막혔다: 부채꼴에서 가장 가까운 빈 칸
        for (let n = PAD_RINGS + 1; n <= MAX_RING && !start; n++)
          start = pick(
            ringCells(n)
              .filter((c) => c.side === wedge)
              .map((c) => c.hex),
            startCost,
          );
      }
      if (!start) continue;

      const cells: Hex[] = [start];
      occupied.add(hexKey(start));
      while (cells.length < size) {
        const c = {
          x: cells.reduce((s, h) => s + toPixel(h).x, 0) / cells.length,
          y: cells.reduce((s, h) => s + toPixel(h).y, 0) / cells.length,
        };
        const growCost = (h: Hex) => {
          const p = toPixel(h);
          const hugs = neighbors(h).filter((n) =>
            cells.some((x) => x.q === n.q && x.r === n.r),
          ).length;
          const nearGroup = mine.length > 0 && touches(h, mine) ? 0.3 : 0;
          return (
            dist(p, c) + Math.hypot(p.x, p.y) * 0.45 - hugs * 0.2 - nearGroup
          );
        };
        const next = frontierOf(cells).sort(
          (a, b) =>
            growCost(a) - growCost(b) || hexKey(a).localeCompare(hexKey(b)),
        )[0];
        if (!next) break;
        cells.push(next);
        occupied.add(hexKey(next));
      }
      for (const h of cells) owner.set(hexKey(h), r.id);
      wedgeTaken.push(...cells);
      groupCells.set(group, [...mine, ...cells]);
      leaves.push({ region: r, territory: top.id, group, depth, cells });
    }
  });

  // 구역마다 자손 칸을 모은다
  const cellsOf = new Map<string, Hex[]>();
  for (const leaf of leaves) {
    let cur: Region | undefined = leaf.region;
    for (let i = 0; cur && i < 8; i++) {
      cellsOf.set(cur.id, [...(cellsOf.get(cur.id) ?? []), ...leaf.cells]);
      cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
    }
  }
  let maxRing = PAD_RINGS;
  for (const l of leaves)
    for (const h of l.cells) maxRing = Math.max(maxRing, ringOf(h));

  return { leaves, territories, owner, cellsOf, depthOf, maxRing };
}

/* ───────────── 이름표 자리 ───────────── */

export type Rect = { x: number; y: number; w: number; h: number };

export const overlaps = (a: Rect, b: Rect, pad = 0) =>
  a.x < b.x + b.w + pad &&
  b.x < a.x + a.w + pad &&
  a.y < b.y + b.h + pad &&
  b.y < a.y + a.h + pad;

/** 글자 폭 어림: 한글·전각은 글자 크기만큼, 나머지는 0.6배 */
export function textWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    w += c >= 0x1100 ? fontSize * 0.98 : fontSize * 0.6;
  }
  return w;
}

/** 넘치면 말줄임 */
export function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}

export type LabelAsk = {
  id: string;
  /** 이름표가 가리킬 점 */
  anchor: { x: number; y: number };
  w: number;
  h: number;
  /** 이 이름표만 피할 곳(다른 구역 칸 가운데 등) */
  avoid?: Rect[];
};

export type PlacedLabel = LabelAsk &
  Rect & { side: "up" | "down" | "right" | "left" };

/**
 * 차례대로(앞이 먼저) 이름표 자리를 고른다. 점 위·아래·오른쪽·왼쪽 중 다른 이름표·장애물과
 * 겹치지 않고 화면 안에 드는 첫 자리. 자리가 없으면 그 이름표는 빠진다.
 */
export function placeLabels(
  asks: LabelAsk[],
  bounds: Rect,
  obstacles: Rect[] = [],
  gap = 6,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const inside = (r: Rect) =>
    r.x >= bounds.x &&
    r.y >= bounds.y &&
    r.x + r.w <= bounds.x + bounds.w &&
    r.y + r.h <= bounds.y + bounds.h;
  for (const a of asks) {
    const { x, y } = a.anchor;
    const tries: PlacedLabel[] = [
      { ...a, side: "up", x: x - a.w / 2, y: y - gap - a.h, w: a.w, h: a.h },
      { ...a, side: "down", x: x - a.w / 2, y: y + gap, w: a.w, h: a.h },
      { ...a, side: "right", x: x + gap, y: y - a.h / 2, w: a.w, h: a.h },
      { ...a, side: "left", x: x - gap - a.w, y: y - a.h / 2, w: a.w, h: a.h },
    ];
    const ok = tries.find(
      (t) =>
        inside(t) &&
        !placed.some((p) => overlaps(p, t, 2)) &&
        !obstacles.some((o) => overlaps(o, t)) &&
        !(a.avoid ?? []).some((o) => overlaps(o, t)),
    );
    if (ok) placed.push(ok);
  }
  return placed;
}
