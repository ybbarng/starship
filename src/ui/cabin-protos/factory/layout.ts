// 컨베이어 조립 공장 배치. 맨 위 구역 하나가 컨베이어 한 줄이고, 그 아래 끝 구역(잎)이 상자다.
// 상태가 곧 자리라서 상자는 상태 칸(입구 · 작업대 · 멈춤 · 출하장)에 들어간다.
// 칸 폭은 줄마다 다르게 두지 않고 모든 줄에서 가장 많이 든 크기에 맞춰, 칸 경계가 같은 세로선에 선다.
// 화면에 그리는 일과 떨어진 순수 함수라 테스트로 확인한다(layout.test.ts).
import {
  childrenOf,
  droppedIds,
  mapProgress,
  type ProjectMap,
  type Region,
} from "@/protocol/map";

export type Column = "fog" | "building" | "blocked" | "done";

/** 흐름 순서. 왼쪽 입구에서 오른쪽 출하장으로 간다. */
export const COLUMNS: Column[] = ["fog", "building", "blocked", "done"];

export type Rect = { x: number; y: number; w: number; h: number };

/** 컨베이어 위 상자 하나 = 끝 구역 하나 */
export type Box = Rect & {
  region: Region;
  /** 맨 위 구역 id(이 상자가 놓인 줄) */
  row: string;
  column: Column;
  /** 칸 안 몇째 벨트(0부터) */
  lane: number;
  /** 3단 상자면 감싸는 2단 구역 id. 같은 묶음끼리 같은 색 띠를 단다 */
  group?: string;
};

/** 줄 머리에 붙는 묶음표: 자식을 품은 2단 구역 */
export type Group = { region: Region; color: string };

export type Row = {
  region: Region;
  /** 줄 머리(이름표) */
  head: Rect;
  /** 벨트들이 놓인 곳 */
  belt: Rect;
  /** 폐기 통. 버린 구역을 보일 때만, 버린 것이 있을 때만 */
  bin?: Rect & { items: (Rect & { region: Region })[] };
  groups: Group[];
  /** 이 줄 자체가 버림(맨 위 구역이 버림) */
  dropped: boolean;
};

export type FactoryLayout = {
  columns: ({ key: Column } & Pick<Rect, "x" | "w">)[];
  /** 칸 이름 줄 */
  header: Rect;
  rows: Row[];
  boxes: Box[];
  /** 벨트 한 줄의 높이 */
  laneH: number;
  lanes: number;
  /** 출하장 끝 목표 화물 상자. fill은 진행률(0..1) */
  crate: Rect & { fill: number };
};

export type FactoryOptions = {
  showDropped: boolean;
};

/** 묶음 색. 줄 안에서 차례로 고른다. */
const GROUP_COLORS = ["#7ce0ff", "#c79bff", "#ff9fd0", "#9ff0c8", "#ffb86c"];

const HEADER_H = 18;
const ROW_HEAD_H = 18;
const BIN_H = 22;
const ROW_GAP = 8;
const MIN_LANE_H = 30;
const MAX_LANE_H = 58;
const BOX_GAP = 4;
const CELL_PAD = 4;
const MIN_COL_W = 44;

/** 상태 → 칸. 버림은 칸에 들지 않고 폐기 통으로 간다. */
export function columnOf(status: Region["status"]): Column | null {
  return status === "dropped" ? null : status;
}

type Piece = { region: Region; row: string; group?: string; order: number };

/**
 * 지도를 공장 바닥에 놓는다. area는 가운데 영역 전체(px).
 * 상자 크기는 size에 비례하고, 칸 안에서 벨트 1~3줄로 나눠 놓는다(가장 넓게 그려지는 수를 고른다).
 */
export function layoutFactory(
  map: ProjectMap,
  area: { w: number; h: number },
  opts: FactoryOptions,
): FactoryLayout {
  const kids = childrenOf(map);
  const dropped = droppedIds(map);
  const tops = (kids.get("") ?? []).filter(
    (r) => opts.showDropped || !dropped.has(r.id),
  );

  // 줄마다 끝 구역(살아 있는 자식이 없는 구역)을 모은다. mapProgress와 같은 기준이다.
  const pieces = new Map<string, Piece[]>();
  const groups = new Map<string, Group[]>();
  const binOf = new Map<string, Region[]>();
  let order = 0;
  const liveKids = (id: string) =>
    (kids.get(id) ?? []).filter((k) => !dropped.has(k.id));
  for (const top of tops) {
    const list: Piece[] = [];
    const gs: Group[] = [];
    const bin: Region[] = [];
    const walk = (r: Region, depth: number, group: string | undefined) => {
      if (dropped.has(r.id)) {
        bin.push(r);
        for (const k of kids.get(r.id) ?? []) walk(k, depth + 1, group);
        return;
      }
      const live = liveKids(r.id);
      if (live.length === 0) {
        list.push({ region: r, row: top.id, group, order: order++ });
      } else if (depth === 2) {
        gs.push({
          region: r,
          color: GROUP_COLORS[gs.length % GROUP_COLORS.length] ?? "#7ce0ff",
        });
      }
      for (const k of kids.get(r.id) ?? [])
        walk(k, depth + 1, depth === 2 ? r.id : group);
    };
    walk(top, 1, undefined);
    pieces.set(top.id, list);
    groups.set(top.id, gs);
    binOf.set(top.id, opts.showDropped ? bin : []);
  }

  const crateW = Math.round(Math.min(150, Math.max(92, area.w * 0.12)));
  const beltW = Math.max(0, area.w - crateW - 10);
  const R = Math.max(1, tops.length);
  const fixed =
    HEADER_H +
    tops.reduce(
      (s, t) => s + ROW_HEAD_H + ((binOf.get(t.id)?.length ?? 0) ? BIN_H : 0),
      0,
    ) +
    ROW_GAP * (R - 1);
  const laneArea = Math.max(0, (area.h - fixed) / R);

  // 칸마다 벨트 L줄로 나눠 담는다. 큰 상자부터 가장 짧은 벨트에(정렬은 처음 순서대로 되돌린다).
  const pack = (L: number) => {
    const cells = new Map<string, Piece[][]>();
    for (const top of tops) {
      for (const c of COLUMNS) {
        const inCell = (pieces.get(top.id) ?? []).filter(
          (p) => columnOf(p.region.status) === c,
        );
        const lanes: Piece[][] = Array.from({ length: L }, () => []);
        const sum = (l: Piece[]) => l.reduce((s, p) => s + p.region.size, 0);
        const bySize = [...inCell].sort(
          (a, b) => b.region.size - a.region.size || a.order - b.order,
        );
        for (const p of bySize) {
          let best = 0;
          for (let i = 1; i < L; i++)
            if (sum(lanes[i] ?? []) < sum(lanes[best] ?? [])) best = i;
          lanes[best]?.push(p);
        }
        for (const l of lanes) l.sort((a, b) => a.order - b.order);
        cells.set(`${top.id}|${c}`, lanes);
      }
    }
    return cells;
  };

  // 크기 1당 폭(unit)을 정하면 칸 폭이 정해진다. 칸 폭 합이 벨트 폭에 맞는 가장 큰 unit을 찾는다.
  const colWidths = (cells: Map<string, Piece[][]>, unit: number) =>
    COLUMNS.map((c) => {
      let w = MIN_COL_W;
      for (const top of tops)
        for (const lane of cells.get(`${top.id}|${c}`) ?? []) {
          if (lane.length === 0) continue;
          const size = lane.reduce((s, p) => s + p.region.size, 0);
          w = Math.max(
            w,
            size * unit + (lane.length - 1) * BOX_GAP + CELL_PAD * 2,
          );
        }
      return w;
    });
  const fitUnit = (cells: Map<string, Piece[][]>) => {
    let lo = 0;
    let hi = Math.max(1, beltW);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const total = colWidths(cells, mid).reduce((s, w) => s + w, 0);
      if (total <= beltW) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  // 벨트 수는 상자 하나가 얻는 넓이(크기 1당 폭 × 상자 높이)가 가장 큰 쪽으로 고른다.
  // 높이는 글 한 줄과 표지 한 줄이 들어갈 만큼까지만 쳐서, 줄만 늘고 상자가 납작해지는 것을 막는다.
  const score = (u: number, L: number) =>
    u * Math.min(30, Math.min(MAX_LANE_H, laneArea / L) - 8);
  let lanes = 1;
  let cells = pack(1);
  let unit = fitUnit(cells);
  let best = score(unit, 1);
  for (let L = 2; L <= 3; L++) {
    if (laneArea / L < MIN_LANE_H) break;
    const c = pack(L);
    const u = fitUnit(c);
    // 눈에 띄게 나을 때만 벨트를 늘린다(비슷하면 줄이 적은 쪽이 읽기 쉽다).
    if (score(u, L) > best * 1.05) {
      lanes = L;
      cells = c;
      unit = u;
      best = score(u, L);
    }
  }
  const laneH = Math.max(14, Math.min(MAX_LANE_H, laneArea / lanes));

  // 남는 폭은 칸마다 고르게 나눠 벨트를 끝까지 채운다.
  const widths = colWidths(cells, unit);
  const slack = Math.max(0, beltW - widths.reduce((s, w) => s + w, 0));
  let cx = 0;
  const columns = COLUMNS.map((key, i) => {
    const w = (widths[i] ?? MIN_COL_W) + slack / COLUMNS.length;
    const col = { key, x: cx, w };
    cx += w;
    return col;
  });

  // 줄이 적으면 위아래로 퍼지지 않게 가운데에 모은다.
  const used = fixed + R * lanes * laneH;
  let y = HEADER_H + Math.max(0, (area.h - used) / 2);
  const rows: Row[] = [];
  const boxes: Box[] = [];
  for (const top of tops) {
    const head = { x: 0, y, w: beltW, h: ROW_HEAD_H };
    y += ROW_HEAD_H;
    const belt = { x: 0, y, w: beltW, h: lanes * laneH };
    for (const col of columns) {
      const ls = cells.get(`${top.id}|${col.key}`) ?? [];
      ls.forEach((lane, li) => {
        let x = col.x + CELL_PAD;
        for (const p of lane) {
          const w = p.region.size * unit;
          boxes.push({
            region: p.region,
            row: top.id,
            column: col.key,
            lane: li,
            group: p.group,
            x,
            y: y + li * laneH + 2,
            w,
            h: laneH - 8,
          });
          x += w + BOX_GAP;
        }
      });
    }
    y += lanes * laneH;
    const binRegions = binOf.get(top.id) ?? [];
    let bin: Row["bin"];
    if (binRegions.length > 0) {
      const label = 64;
      const iw = Math.min(150, (beltW - label) / binRegions.length);
      bin = {
        x: 0,
        y,
        w: beltW,
        h: BIN_H,
        items: binRegions.map((region, i) => ({
          region,
          x: label + i * iw,
          y: y + 3,
          w: iw - 4,
          h: BIN_H - 6,
        })),
      };
      y += BIN_H;
    }
    rows.push({
      region: top,
      head,
      belt,
      bin,
      groups: groups.get(top.id) ?? [],
      dropped: dropped.has(top.id),
    });
    y += ROW_GAP;
  }

  const top0 = rows[0]?.head.y ?? HEADER_H;
  const bottom = rows.length
    ? Math.max(
        ...rows.map((r) => (r.bin ? r.bin.y + r.bin.h : r.belt.y + r.belt.h)),
      )
    : area.h;
  return {
    columns,
    header: { x: 0, y: Math.max(0, top0 - HEADER_H), w: beltW, h: HEADER_H },
    rows,
    boxes,
    laneH,
    lanes,
    crate: {
      x: area.w - crateW,
      y: top0,
      w: crateW,
      h: Math.max(60, bottom - top0),
      fill: mapProgress(map).ratio,
    },
  };
}
