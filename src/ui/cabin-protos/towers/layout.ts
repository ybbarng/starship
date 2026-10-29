// 함께 쌓는 탑: 맨 위 구역마다 탑 하나를 세우고, 그 아래 구역을 블록으로 쌓는 자리 계산.
// 그리기와 떼어 둔 순수 함수다. 좌표는 모두 여기서 나오고, 화면 쪽은 받은 사각형을 그리기만 한다.
//
// 규칙
// - 블록 높이 = 크기(size) × unit. 모든 탑이 같은 unit을 써서 탑끼리 높이를 견줄 수 있다.
// - 자식이 있는 구역은 자기 size 대신 자식 크기의 합으로 센다(mapProgress와 같은 규칙).
// - 탑 안에서는 아래부터 완공(since 오래된 순) → 공사중 → 막힘 → 안개 순으로 쌓는다.
//   안개는 아직 올리지 않은 블록이라 탑 위쪽에 흐린 윤곽으로 놓인다. 그래서 탑 꼭대기가 곧 목표 높이다.
// - 3단이 있는 구역은 "묶음 블록(module)" 하나로 두고, 그 안을 손자 구역의 가로 띠(band)로 나눈다.
//   띠도 같은 순서로 아래부터 쌓는다. 묶음 블록 왼쪽에는 이름을 세로로 적는 좁은 판이 붙는다.
// - 버린 구역은 탑에서 빼고, showDropped일 때만 탑 옆 폐자재 통(chips)에 작게 놓는다.
import {
  childrenOf,
  droppedIds,
  type ProjectMap,
  type Region,
  type RegionStatus,
} from "@/protocol/map";

export type LiveStatus = Exclude<RegionStatus, "dropped">;

/** 아래부터 쌓는 순서 */
export const STACK_RANK: Record<LiveStatus, number> = {
  done: 0,
  building: 1,
  blocked: 2,
  fog: 3,
};

export type Rect = { x: number; y: number; w: number; h: number };

export type Piece = Rect & {
  region: Region;
  /** block: 한 덩어리 블록, module: 3단을 품은 묶음 블록(틀), band: 묶음 안 띠 */
  kind: "block" | "module" | "band";
  status: LiveStatus;
  /** 센 크기(자식이 있으면 자식 합) */
  units: number;
  towerId: string;
  /** band면 감싸는 묶음 블록 id */
  moduleId?: string;
};

export type Chip = Rect & { region: Region };

export type Crane = {
  mastX: number;
  /** 지붕(크레인 팔) 높이 */
  jibY: number;
  jibX1: number;
  jibX2: number;
  /** 탑 꼭대기. 기둥이 여기서 선다 */
  baseY: number;
  /** 줄이 내려가는 x와 닿는 곳 */
  cableX: number;
  hookY: number;
  /** 크레인에 매달린 구역 */
  targetId: string;
  /** 매단 구역이 막힘이면 멈춘 크레인 */
  stopped: boolean;
};

export type Tower = {
  region: Region;
  /** 탑이 차지하는 세로줄 전체 */
  col: Rect;
  /** 블록이 쌓이는 몸통 */
  body: Rect;
  /** 몸통 오른쪽 여백: 깃발·발견 괄호·폐자재 통 */
  gutter: Rect;
  groundY: number;
  /** 버림을 뺀 전체 크기 = 목표 높이 */
  total: number;
  /** 완공 크기 */
  done: number;
  /** 처음 계획에 있던 크기(발견을 뺀 것) */
  baseline: number;
  /** 목표 높이 y(탑 꼭대기) */
  topY: number;
  /** 처음 계획 높이 y */
  baselineY: number;
  pieces: Piece[];
  chips: Chip[];
  /** 폐자재 통에 다 못 넣은 수 */
  moreChips: number;
  crane: Crane | null;
  /** 탑 아래 이름판 */
  plate: Rect;
};

export type TowerLayout = {
  towers: Tower[];
  unit: number;
  /** here 크레인에 앉힐 동물 너비 */
  animal: number;
  rows: number;
};

export type TowerOptions = {
  showDropped: boolean;
  /** 지금 여기 구역 id. 크레인이 이 구역을 매단다 */
  here?: string;
  /** 한 줄에 세울 탑 수. 넘치면 줄을 늘린다 */
  perRow?: number;
  /** 블록 한 칸의 최대 높이 */
  maxUnit?: number;
};

const PLATE_H = 22;
const GROUND_H = 6;
const LEFT_PAD = 8;
const MODULE_STRIP = 16;
const CHIP_H = 15;
const MAX_CHIPS = 4;

/** 탑 크기 계산에 쓰는 구역 정보 */
type Node = {
  region: Region;
  units: number;
  status: LiveStatus;
  kids: Node[];
};

function sinceOf(r: Region): number {
  const t = r.since ? Date.parse(r.since) : Number.NaN;
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** 아래부터 쌓는 순서로 정렬한다. 완공끼리는 오래된 것이 아래. 나머지는 지도에 적힌 순서. */
export function stackOrder<T extends { status: LiveStatus; region: Region }>(
  list: T[],
): T[] {
  return list
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      const r = STACK_RANK[a.n.status] - STACK_RANK[b.n.status];
      if (r !== 0) return r;
      if (a.n.status === "done") {
        const s = sinceOf(a.n.region) - sinceOf(b.n.region);
        if (s !== 0 && Number.isFinite(s)) return s;
      }
      return a.i - b.i;
    })
    .map(({ n }) => n);
}

/** 자식들의 상태로 묶음의 상태를 정한다. 모두 완공이면 완공, 모두 안개면 안개, 하나라도 막히면 막힘. */
function groupStatus(own: RegionStatus, kids: Node[]): LiveStatus {
  if (own === "blocked") return "blocked";
  if (kids.every((k) => k.status === "done")) return "done";
  if (kids.every((k) => k.status === "fog")) return "fog";
  if (kids.some((k) => k.status === "blocked")) return "blocked";
  return "building";
}

function buildNode(
  r: Region,
  kids: Map<string, Region[]>,
  dropped: Set<string>,
): Node {
  const live = (kids.get(r.id) ?? [])
    .filter((k) => !dropped.has(k.id))
    .map((k) => buildNode(k, kids, dropped));
  if (live.length === 0) {
    const own = r.status === "dropped" ? "fog" : r.status;
    return { region: r, units: r.size, status: own, kids: [] };
  }
  return {
    region: r,
    units: live.reduce((s, k) => s + k.units, 0),
    status: groupStatus(r.status, live),
    kids: live,
  };
}

/** 발견된 구역(자신이나 조상에 found가 있다)의 크기 합 */
function foundUnits(n: Node, inherited: boolean): number {
  const found = inherited || n.region.found !== undefined;
  if (n.kids.length === 0) return found ? n.units : 0;
  return n.kids.reduce((s, k) => s + foundUnits(k, found), 0);
}

function doneUnits(n: Node): number {
  if (n.kids.length === 0) return n.status === "done" ? n.units : 0;
  return n.kids.reduce((s, k) => s + doneUnits(k), 0);
}

export function layoutTowers(
  map: ProjectMap,
  box: { w: number; h: number },
  opts: TowerOptions,
): TowerLayout {
  const kids = childrenOf(map);
  const dropped = droppedIds(map);
  const tops = kids.get("") ?? [];
  const shownTops = tops.filter((t) => opts.showDropped || !dropped.has(t.id));
  if (shownTops.length === 0 || box.w <= 0 || box.h <= 0)
    return { towers: [], unit: 0, animal: 0, rows: 0 };

  const perRow = Math.max(1, opts.perRow ?? 8);
  const rows = Math.ceil(shownTops.length / perRow);
  const inRow = Math.ceil(shownTops.length / rows);
  const colW = box.w / inRow;
  const rowH = box.h / rows;
  const gutterW = Math.round(Math.min(64, Math.max(34, colW * 0.3)));
  const bodyW = Math.max(24, colW - LEFT_PAD - gutterW);
  const animal = Math.round(Math.min(44, Math.max(24, bodyW * 0.36)));
  const craneH = Math.round(animal * 1.25) + 12;

  const nodes = shownTops.map((t) =>
    dropped.has(t.id)
      ? ({ region: t, units: 0, status: "fog", kids: [] } satisfies Node)
      : buildNode(t, kids, dropped),
  );
  const maxTotal = Math.max(1, ...nodes.map((n) => n.units));
  const stackRoom = rowH - PLATE_H - GROUND_H - craneH - 8;
  const unit = Math.max(
    4,
    Math.min(opts.maxUnit ?? 60, Math.floor((stackRoom / maxTotal) * 10) / 10),
  );

  // 버린 구역을 탑마다 모은다(맨 위 조상 기준)
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const topOf = (r: Region): string => {
    let cur = r;
    for (let i = 0; i <= map.regions.length && cur.parent !== undefined; i++) {
      const up = byId.get(cur.parent);
      if (!up) break;
      cur = up;
    }
    return cur.id;
  };
  const droppedByTop = new Map<string, Region[]>();
  if (opts.showDropped) {
    for (const r of map.regions) {
      if (!dropped.has(r.id)) continue;
      const top = topOf(r);
      if (top === r.id) continue; // 맨 위 구역이 버림이면 탑 자체가 흐린 이름판으로 남는다
      // 버린 구역 아래의 구역은 따로 늘어놓지 않는다
      const parent = r.parent !== undefined ? byId.get(r.parent) : undefined;
      if (parent && dropped.has(parent.id) && parent.id !== top) continue;
      droppedByTop.set(top, [...(droppedByTop.get(top) ?? []), r]);
    }
  }

  const towers: Tower[] = nodes.map((node, i) => {
    const row = Math.floor(i / inRow);
    const colX = (i % inRow) * colW;
    const rowTop = row * rowH;
    const col = { x: colX, y: rowTop, w: colW, h: rowH };
    const body = { x: colX + LEFT_PAD, y: rowTop, w: bodyW, h: rowH };
    const gutter = { x: body.x + bodyW, y: rowTop, w: gutterW, h: rowH };
    const groundY = rowTop + rowH - PLATE_H - GROUND_H;
    const towerId = node.region.id;

    const pieces: Piece[] = [];
    let cursor = groundY;
    const stacked = node.kids.length > 0 ? stackOrder(node.kids) : [node];
    if (!dropped.has(towerId)) {
      for (const n of stacked) {
        const slotTop = cursor - n.units * unit;
        const rect = {
          x: body.x,
          y: slotTop + 1,
          w: bodyW,
          h: n.units * unit - 2,
        };
        if (n.kids.length === 0 || n === node) {
          pieces.push({
            ...rect,
            region: n.region,
            kind: "block",
            status: n.status,
            units: n.units,
            towerId,
          });
        } else {
          pieces.push({
            ...rect,
            region: n.region,
            kind: "module",
            status: n.status,
            units: n.units,
            towerId,
          });
          // 띠: 틀 안쪽을 크기 비율로 나눠 아래부터 쌓는다
          const innerTop = rect.y + 2;
          const innerH = rect.h - 4;
          const per = innerH / n.units;
          let c = innerTop + innerH;
          for (const k of stackOrder(n.kids)) {
            const h = k.units * per;
            pieces.push({
              x: rect.x + MODULE_STRIP,
              y: c - h + 0.75,
              w: bodyW - MODULE_STRIP - 2,
              h: h - 1.5,
              region: k.region,
              kind: "band",
              status: k.status,
              units: k.units,
              towerId,
              moduleId: n.region.id,
            });
            c -= h;
          }
        }
        cursor = slotTop;
      }
    }

    const total = dropped.has(towerId) ? 0 : node.units;
    const baseline =
      total - (dropped.has(towerId) ? 0 : foundUnits(node, false));
    const topY = groundY - total * unit;

    // 폐자재 통: 바닥에서 위로 작은 조각을 쌓는다
    const droppedHere = droppedByTop.get(towerId) ?? [];
    const chips: Chip[] = droppedHere.slice(0, MAX_CHIPS).map((r, k) => ({
      region: r,
      x: gutter.x + 3,
      y: groundY - (k + 1) * (CHIP_H + 2),
      w: gutterW - 18,
      h: CHIP_H,
    }));

    // 크레인: 지금 여기 > 가장 높은 공사중 > 가장 높은 막힘 을 매단다
    const pick = (ok: (p: Piece) => boolean) =>
      pieces
        .filter((p) => p.kind !== "module" && ok(p))
        .sort((a, b) => a.y - b.y)[0];
    const target =
      pieces.find((p) => p.region.id === opts.here) ??
      pick((p) => p.status === "building") ??
      pick((p) => p.status === "blocked");
    let crane: Crane | null = null;
    if (target) {
      const mastX = body.x + 5;
      crane = {
        mastX,
        baseY: topY,
        jibY: topY - craneH + 4,
        jibX1: mastX - 3,
        jibX2: body.x + bodyW - 4,
        cableX: body.x + bodyW - 11,
        hookY: target.y,
        targetId: target.region.id,
        stopped: target.status === "blocked",
      };
    }

    return {
      region: node.region,
      col,
      body,
      gutter,
      groundY,
      total,
      done: dropped.has(towerId) ? 0 : doneUnits(node),
      baseline,
      topY,
      baselineY: groundY - baseline * unit,
      pieces,
      chips,
      moreChips: Math.max(0, droppedHere.length - MAX_CHIPS),
      crane,
      plate: {
        x: body.x,
        y: groundY + GROUND_H + 3,
        w: bodyW + gutterW - 6,
        h: PLATE_H - 5,
      },
    };
  });

  return { towers, unit, animal, rows };
}

export const TOWER_CONST = { PLATE_H, GROUND_H, MODULE_STRIP };
