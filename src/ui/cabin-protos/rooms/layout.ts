// 선원 작업실 단면도 배치. 우주선을 옆으로 자른 그림이라 맨 위 구역 하나가 갑판 한 층이다.
// 층은 위에서 아래로 지도에 적힌 순서대로 쌓고, 층 안의 방(2단)은 왼쪽부터 줄 세운다.
// 방 너비는 무게(size, 칸막이가 있으면 칸막이 무게의 합)에 비례하되 이름이 읽힐 만큼은 남긴다.
// 방이 너무 많아 한 줄에 들지 않으면 그 층을 두 줄(위아래 두 칸)로 늘린다.
// 3단은 방 안을 세로 칸막이로 나눈 작은 칸이다. 좌표를 손으로 적지 않는다.
import {
  childrenOf,
  droppedIds,
  type ProjectMap,
  type Region,
} from "@/protocol/map";

export type Rect = { x: number; y: number; w: number; h: number };

export type Cell = Rect & {
  region: Region;
  /** 1 = 층(갑판), 2 = 방, 3 = 칸막이 안 작은 칸 */
  depth: 1 | 2 | 3;
  /**
   * deck: 층 띠 전체(왼쪽 명판 + 방들). room: 방 하나(칸막이가 있으면 안을 감싼다).
   * 칸막이가 없는 층은 deck 하나와 그 띠를 채우는 room 하나가 함께 나온다.
   */
  kind: "deck" | "room";
  /** 안을 칸막이(자식 칸)로 나눈 방 */
  container: boolean;
  /** 버린 구역(자신이나 조상이 버림) */
  dropped: boolean;
};

export type RoomsLayoutOptions = {
  showDropped: boolean;
  /** 층 왼쪽 명판 너비 */
  label?: number;
  /** 층과 층 사이(바닥 판) */
  slab?: number;
  /** 방 사이 벽 두께 */
  wall?: number;
  /** 칸막이가 있는 방의 이름 띠 높이 */
  header?: number;
  /** 방 하나의 가장 좁은 너비 */
  minRoom?: number;
  /** 칸막이 안 작은 칸의 가장 좁은 너비 */
  minNook?: number;
  /** 층 한 줄의 가장 큰 높이. 구역이 적어도 방이 지나치게 커지지 않게 */
  maxRow?: number;
};

type Node = {
  region: Region;
  weight: number;
  kids: Node[];
};

const DEFAULTS = {
  label: 84,
  slab: 8,
  wall: 4,
  header: 18,
  minRoom: 78,
  minNook: 54,
  maxRow: 200,
};

/** 방(또는 칸)이 차지할 가장 좁은 너비. 칸막이가 있으면 칸들의 합 */
function minWidth(n: Node, o: typeof DEFAULTS): number {
  if (n.kids.length === 0) return o.minRoom;
  const inner =
    n.kids.length * o.minNook + (n.kids.length - 1) * o.wall + o.wall * 2;
  return Math.max(o.minRoom, inner);
}

/**
 * 너비 total을 무게에 비례해 나눈다. 비례 몫이 가장 좁은 너비보다 작은 것은 그 너비로 묶고
 * 남은 너비를 나머지에 다시 나눈다(물 채우기). 모두 묶어도 모자라면 가장 좁은 너비 비율로 줄인다.
 */
export function shareWidths(
  items: { weight: number; min: number }[],
  total: number,
): number[] {
  const n = items.length;
  if (n === 0) return [];
  const minSum = items.reduce((s, it) => s + it.min, 0);
  if (minSum >= total) return items.map((it) => (it.min / minSum) * total);
  const fixed = new Array<boolean>(n).fill(false);
  const out = new Array<number>(n).fill(0);
  for (let round = 0; round < n; round++) {
    let rest = total;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      if (!it) continue;
      if (fixed[i]) rest -= it.min;
      else w += it.weight;
    }
    let changed = false;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      if (!it || fixed[i]) continue;
      const share = w > 0 ? (it.weight / w) * rest : rest;
      if (share < it.min) {
        fixed[i] = true;
        changed = true;
      }
      out[i] = share;
    }
    if (!changed) break;
  }
  return out.map((v, i) => (fixed[i] ? (items[i]?.min ?? v) : v));
}

/** 층 안의 방들을 순서를 지키며 줄로 나눈다. 한 줄에 가장 좁은 너비 합이 width를 넘지 않게 */
export function splitRows<T>(
  items: T[],
  min: (t: T) => number,
  width: number,
  gap: number,
): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const it of items) {
    const m = min(it);
    const add = row.length === 0 ? m : used + gap + m;
    if (row.length > 0 && add > width) {
      rows.push(row);
      row = [it];
      used = m;
    } else {
      row.push(it);
      used = add;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** 지도 한 장을 단면도 칸으로 놓는다. 그릴 순서: 층 → 방 → 작은 칸 */
export function layoutRooms(
  map: ProjectMap,
  rect: Rect,
  options: RoomsLayoutOptions,
): Cell[] {
  const o = { ...DEFAULTS, ...options };
  const kids = childrenOf(map);
  const dropped = droppedIds(map);
  const visible = (r: Region) => o.showDropped || !dropped.has(r.id);

  const build = (r: Region, depth: number): Node => {
    const children =
      depth < 3 ? (kids.get(r.id) ?? []).filter(visible) : ([] as Region[]);
    const k = children.map((c) => build(c, depth + 1));
    const weight =
      k.length > 0 ? k.reduce((s, c) => s + c.weight, 0) : Math.max(1, r.size);
    return { region: r, weight, kids: k };
  };
  const decks = (kids.get("") ?? []).filter(visible).map((r) => build(r, 1));
  if (decks.length === 0 || rect.w <= 0 || rect.h <= 0) return [];

  const roomsW = Math.max(0, rect.w - o.label - o.wall);
  // 층마다 방 줄. 방이 없는 층은 층 띠 자체가 방 하나다.
  const deckRows = decks.map((d) =>
    d.kids.length === 0
      ? [[d]]
      : splitRows(d.kids, (n) => minWidth(n, o), roomsW, o.wall),
  );
  const totalRows = deckRows.reduce((s, rows) => s + rows.length, 0);
  const slabs = (decks.length - 1) * o.slab;
  const innerGaps = (totalRows - decks.length) * o.wall;
  const rowH = Math.max(
    0,
    Math.min(o.maxRow, (rect.h - slabs - innerGaps) / totalRows),
  );

  const out: Cell[] = [];
  const flag = (r: Region) => dropped.has(r.id);
  let y = rect.y;
  decks.forEach((d, di) => {
    const rows = deckRows[di] ?? [];
    const deckH = rows.length * rowH + (rows.length - 1) * o.wall;
    out.push({
      region: d.region,
      depth: 1,
      kind: "deck",
      container: d.kids.length > 0,
      dropped: flag(d.region),
      x: rect.x,
      y,
      w: rect.w,
      h: deckH,
    });
    const x0 = rect.x + o.label + o.wall;
    rows.forEach((row, ri) => {
      const ry = y + ri * (rowH + o.wall);
      const avail = roomsW - (row.length - 1) * o.wall;
      const widths = shareWidths(
        row.map((n) => ({ weight: n.weight, min: minWidth(n, o) })),
        avail,
      );
      let x = x0;
      row.forEach((n, i) => {
        const w = widths[i] ?? 0;
        const isDeckRoom = n === d;
        out.push({
          region: n.region,
          depth: isDeckRoom ? 1 : 2,
          kind: "room",
          container: n.kids.length > 0,
          dropped: flag(n.region),
          x,
          y: ry,
          w,
          h: rowH,
        });
        if (n.kids.length > 0) {
          const ix = x + o.wall;
          const iy = ry + o.header;
          const iw = w - o.wall * 2;
          const ih = Math.max(0, rowH - o.header - o.wall);
          const nw = shareWidths(
            n.kids.map((k) => ({ weight: k.weight, min: o.minNook })),
            iw - (n.kids.length - 1) * o.wall,
          );
          let kx = ix;
          n.kids.forEach((k, j) => {
            const kw = nw[j] ?? 0;
            out.push({
              region: k.region,
              depth: 3,
              kind: "room",
              container: false,
              dropped: flag(k.region),
              x: kx,
              y: iy,
              w: kw,
              h: ih,
            });
            kx += kw + o.wall;
          });
        }
        x += w + o.wall;
      });
    });
    y += deckH + o.slab;
  });
  return out;
}
