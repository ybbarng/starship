// 조선소 시안의 배치 계산. 지도 한 장을 건조대 위 우주선 한 척(옆모습)으로 놓는다.
// 맨 위 구역은 뱃머리부터 꼬리 쪽으로 이어지는 선체 구획(세로 칸), 그 아래 구역은 구획 안 블록(위아래 나눔),
// 3단은 블록 안 격벽이다. 칸 너비와 블록 높이는 size 합에 비례하고, 너무 좁아지지 않게 최소 길이를 둔다.
// 화면 그리기와 떼어 두어 순수 함수로만 계산한다(테스트로 확인).
import {
  childrenOf,
  droppedIds,
  type ProjectMap,
  type Region,
} from "@/protocol/map";

export type Rect = { x: number; y: number; w: number; h: number };

export type Block = Rect & {
  region: Region;
  /** 1 = 선체 구획, 2 = 블록, 3 = 격벽 안 칸 */
  depth: number;
  /** 안에 더 나눈 칸이 없으면 true */
  leaf: boolean;
  /** 처음 계획에 없다가 생긴 구역(자신이나 조상이 found) */
  found: boolean;
  /** 선체 곡선에 잘리지 않는 안쪽. 글과 단추는 여기에 둔다 */
  safe: Rect;
  /** 안에 칸을 품은 블록의 이름 띠 높이 */
  header: number;
};

export type Pt = { x: number; y: number };

export type ShipLayout = {
  /** 선체 몸통(블록이 놓이는 곳) 윤곽. clipPath로 쓴다 */
  bodyPath: string;
  /** 뾰족한 뱃머리 */
  bowPath: string;
  bowTip: Pt;
  /** 뱃머리 위 조종실 창 */
  bridgePath: string;
  /** 꼬리 엔진실과 분사구 */
  enginePath: string;
  nozzles: { x: number; y: number; w: number; h: number }[];
  /** 몸통 앞(x0)·뒤(x1) 끝과 위·아래 */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** 뱃머리 길이 */
  bowLen: number;
  /** 몸통 위 이름표 줄의 y */
  plateY: number;
  plateH: number;
  /** 건조대 크레인 들보 */
  beamY: number;
  /** 바닥(건조대 받침이 닿는 곳) */
  floorY: number;
  /** 받침대 x 위치들 */
  cradles: { x: number; top: number }[];
  /** 길이 눈금 줄 */
  rulerY: number;
  /** 처음 설계대로라면 몸통이 끝났을 x */
  planX: number;
  /** 몸통 길이를 size 단위로 센 값 */
  units: number;
  planUnits: number;
  /** 선체 구획(1단) */
  columns: Block[];
  /** 모든 블록(구획 포함), 그리는 순서(바깥 → 안) */
  blocks: Block[];
  /** 떼어 낸 블록(버림). showDropped일 때만 */
  pile: Block[];
  pileY: number;
};

export type ShipOptions = {
  showDropped: boolean;
  /** size 1이 차지할 수 있는 가장 긴 가로 길이. 작은 지도는 배가 짧아진다 */
  maxUnit?: number;
};

const SIDE = 14;
const BEAM_H = 10;
const PLATE_H = 20;
const TOP = BEAM_H + 10 + PLATE_H + 8;
const CRADLE = 18;
const RULER = 34;
const PILE_H = 44;
/** 몸통 길이 ÷ 높이의 아래 한계. 배가 네모로 보이지 않게 */
const ASPECT = 1.5;
const BOW = 0.34;
const ENGINE = 0.27;
const MIN_COL = 34;
const COL_GAP = 5;
const MIN_BLOCK = 18;
const BLOCK_GAP = 3;
const HEADER = 16;

/**
 * 길이 total을 weights 비율로 나눈다. 각 몫은 min보다 짧아지지 않고, 사이에 gap을 둔다.
 * 모두 min을 줄 수 없을 만큼 좁으면 똑같이 나눈다.
 */
export function splitWithMin(
  total: number,
  weights: number[],
  min: number,
  gap: number,
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const space = Math.max(0, total - gap * (n - 1));
  if (min * n >= space) return weights.map(() => space / n);
  const fixed = new Set<number>();
  for (;;) {
    let freeW = 0;
    for (let i = 0; i < n; i++) if (!fixed.has(i)) freeW += weights[i] ?? 0;
    const freeSpace = space - fixed.size * min;
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (fixed.has(i)) continue;
      if ((freeSpace * (weights[i] ?? 0)) / freeW < min) {
        fixed.add(i);
        changed = true;
      }
    }
    if (!changed) {
      return weights.map((w, i) =>
        fixed.has(i) ? min : (freeSpace * w) / freeW,
      );
    }
  }
}

/** 선체 위·아래 가장자리. 뱃머리와 꼬리 쪽에서 안으로 굽는다. */
export function hullEdges(
  g: { x0: number; x1: number; y0: number; y1: number },
  x: number,
): { top: number; bottom: number } {
  const len = g.x1 - g.x0;
  const hs = g.y1 - g.y0;
  const rb = Math.min(0.35 * len, 0.7 * hs);
  const rt = Math.min(0.3 * len, 0.5 * hs);
  const bow = x < g.x0 + rb ? (1 - (x - g.x0) / rb) ** 2 : 0;
  const tail = x > g.x1 - rt ? ((x - (g.x1 - rt)) / rt) ** 2 : 0;
  const cb = Math.min(1, Math.max(0, bow));
  const ct = Math.min(1, Math.max(0, tail));
  return {
    top: g.y0 + hs * (0.1 * cb + 0.14 * ct),
    bottom: g.y1 - hs * (0.06 * cb + 0.08 * ct),
  };
}

/** 가장자리 곡선은 가운데가 평평하고 양 끝으로 갈수록 안으로 들어오니, 구간 양 끝만 보면 된다. */
function safeRect(
  g: { x0: number; x1: number; y0: number; y1: number },
  r: Rect,
): Rect {
  const a = hullEdges(g, r.x);
  const b = hullEdges(g, r.x + r.w);
  const top = Math.max(r.y, a.top, b.top);
  const bottom = Math.min(r.y + r.h, a.bottom, b.bottom);
  return { x: r.x, y: top, w: r.w, h: Math.max(0, bottom - top) };
}

const f = (n: number) => Math.round(n * 10) / 10;

export function layoutShip(
  map: ProjectMap,
  box: Rect,
  opts: ShipOptions,
): ShipLayout {
  const dropped = droppedIds(map);
  const kids = childrenOf(map);
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const liveKids = (id: string) =>
    (kids.get(id) ?? []).filter((k) => !dropped.has(k.id));

  const isFound = (r: Region): boolean => {
    let cur: Region | undefined = r;
    for (let i = 0; cur && i <= map.regions.length; i++) {
      if (cur.found !== undefined) return true;
      cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
    }
    return false;
  };
  const unitsOf = (r: Region): number => {
    const ks = liveKids(r.id);
    return ks.length ? ks.reduce((s, k) => s + unitsOf(k), 0) : r.size;
  };
  const planUnitsOf = (r: Region): number => {
    if (r.found !== undefined) return 0;
    const ks = liveKids(r.id);
    if (!ks.length) return r.size;
    return ks.reduce((s, k) => s + planUnitsOf(k), 0) || r.size;
  };

  // 처음 계획한 구획을 앞에, 나중에 생긴 구획을 꼬리 쪽에 둔다(같은 무리 안에서는 지도 순서).
  const tops = liveKids("");
  const cols = [
    ...tops.filter((r) => r.found === undefined),
    ...tops.filter((r) => r.found !== undefined),
  ];
  const colUnits = cols.map(unitsOf);
  const units = colUnits.reduce((s, u) => s + u, 0);
  const planUnits = cols.reduce((s, r) => s + planUnitsOf(r), 0);

  const pileTops = opts.showDropped
    ? map.regions.filter(
        (r) =>
          dropped.has(r.id) &&
          !(r.parent !== undefined && dropped.has(r.parent)),
      )
    : [];

  // 세로: 크레인 들보와 이름표 줄 / 선체 / 받침·눈금·떼어 낸 블록
  const bottomReserve = CRADLE + RULER + (pileTops.length ? PILE_H : 0);
  const availH = Math.max(80, box.h - TOP - bottomReserve);
  const availW = Math.max(160, box.w - 2 * SIDE);
  const hs = Math.max(60, Math.min(availH, availW / (BOW + ENGINE + ASPECT)));
  const bowLen = hs * BOW;
  const engLen = hs * ENGINE;
  const bodyAvail = availW - bowLen - engLen;
  const maxUnit = opts.maxUnit ?? 56;
  const minBody =
    cols.length * MIN_COL + Math.max(0, cols.length - 1) * COL_GAP;
  const bodyLen = Math.min(
    bodyAvail,
    Math.max(minBody, units * maxUnit, hs * 0.8),
  );
  const shipLen = bowLen + bodyLen + engLen;
  const x0 = box.x + SIDE + (availW - shipLen) / 2 + bowLen;
  const x1 = x0 + bodyLen;
  const group = TOP + hs + bottomReserve;
  const y0 = box.y + Math.max(0, (box.h - group) / 2) + TOP;
  const y1 = y0 + hs;
  const g = { x0, x1, y0, y1 };

  // 몸통 윤곽: 위·아래 가장자리를 촘촘히 따라 찍는다.
  const N = 32;
  const topPts: string[] = [];
  const botPts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const x = x0 + (bodyLen * i) / N;
    const e = hullEdges(g, x);
    topPts.push(`${f(x)} ${f(e.top)}`);
    botPts.unshift(`${f(x)} ${f(e.bottom)}`);
  }
  const bodyPath = `M${topPts.join(" L")} L${botPts.join(" L")} Z`;

  const e0 = hullEdges(g, x0);
  const bowTip = { x: x0 - bowLen, y: y0 + hs * 0.6 };
  const bowPath = [
    `M${f(x0 + 1)} ${f(e0.top)}`,
    `C${f(x0 - bowLen * 0.45)} ${f(e0.top)} ${f(bowTip.x + bowLen * 0.12)} ${f(bowTip.y - hs * 0.22)} ${f(bowTip.x)} ${f(bowTip.y)}`,
    `C${f(bowTip.x + bowLen * 0.2)} ${f(bowTip.y + hs * 0.18)} ${f(x0 - bowLen * 0.4)} ${f(e0.bottom)} ${f(x0 + 1)} ${f(e0.bottom)}`,
    "Z",
  ].join(" ");
  const bridgePath = [
    `M${f(x0 - bowLen * 0.12)} ${f(e0.top + hs * 0.07)}`,
    `L${f(x0 - bowLen * 0.55)} ${f(e0.top + hs * 0.12)}`,
    `Q${f(x0 - bowLen * 0.7)} ${f(e0.top + hs * 0.2)} ${f(x0 - bowLen * 0.5)} ${f(e0.top + hs * 0.24)}`,
    `L${f(x0 - bowLen * 0.12)} ${f(e0.top + hs * 0.24)}`,
    "Z",
  ].join(" ");

  const e1 = hullEdges(g, x1);
  const houseW = engLen * 0.38;
  const enginePath = [
    `M${f(x1 - 1)} ${f(e1.top)}`,
    `L${f(x1 + houseW)} ${f(e1.top + hs * 0.05)}`,
    `L${f(x1 + houseW)} ${f(e1.bottom - hs * 0.04)}`,
    `L${f(x1 - 1)} ${f(e1.bottom)}`,
    "Z",
  ].join(" ");
  const houseH = e1.bottom - e1.top - hs * 0.09;
  const nozH = houseH * 0.26;
  const nozzles = [0.28, 0.72].map((t) => ({
    x: x1 + houseW,
    y: e1.top + hs * 0.05 + houseH * t - nozH / 2,
    w: engLen - houseW,
    h: nozH,
  }));

  // 선체 구획과 그 안의 블록
  const blocks: Block[] = [];
  const columns: Block[] = [];
  const widths = splitWithMin(bodyLen, colUnits, MIN_COL, COL_GAP);

  const place = (r: Region, rect: Rect, depth: number) => {
    const ks = depth < 3 ? liveKids(r.id) : [];
    const safe = safeRect(g, rect);
    const header = depth === 2 && ks.length ? HEADER : 0;
    const b: Block = {
      ...rect,
      region: r,
      depth,
      leaf: ks.length === 0,
      found: isFound(r),
      safe,
      header,
    };
    blocks.push(b);
    if (depth === 1) columns.push(b);
    if (!ks.length) return;
    const ws = ks.map(unitsOf);
    if (depth === 1) {
      // 구획 가운데에서 본 선체 높이 안에 블록을 위아래로 쌓는다.
      const e = hullEdges(g, rect.x + rect.w / 2);
      const hs2 = splitWithMin(e.bottom - e.top, ws, MIN_BLOCK, BLOCK_GAP);
      let y = e.top;
      ks.forEach((k, i) => {
        const h = hs2[i] ?? 0;
        place(k, { x: rect.x, y, w: rect.w, h }, 2);
        y += h + BLOCK_GAP;
      });
      return;
    }
    // 블록 안 격벽: 이름 띠 아래를 긴 쪽으로 나눈다.
    const inner = {
      x: rect.x + 3,
      y: Math.max(rect.y, safe.y) + header,
      w: rect.w - 6,
      h:
        Math.min(rect.y + rect.h, safe.y + safe.h) -
        Math.max(rect.y, safe.y) -
        header -
        3,
    };
    const across = inner.w >= inner.h * 1.2;
    const ls = splitWithMin(
      across ? inner.w : inner.h,
      ws,
      across ? MIN_COL - 6 : 14,
      2,
    );
    let at = across ? inner.x : inner.y;
    ks.forEach((k, i) => {
      const l = ls[i] ?? 0;
      place(
        k,
        across
          ? { x: at, y: inner.y, w: l, h: Math.max(0, inner.h) }
          : { x: inner.x, y: at, w: inner.w, h: l },
        3,
      );
      at += l + 2;
    });
  };

  let x = x0;
  cols.forEach((c, i) => {
    const w = widths[i] ?? 0;
    place(c, { x, y: y0, w, h: hs }, 1);
    x += w + COL_GAP;
  });

  const floorY = y1 + CRADLE;
  const nCradle = Math.max(3, Math.round(bodyLen / 150));
  const cradles = Array.from({ length: nCradle }, (_, i) => {
    const cx = x0 + (bodyLen * (i + 0.5)) / nCradle;
    return { x: cx, top: hullEdges(g, cx).bottom };
  });

  const rulerY = floorY + 16;
  const planX = units > 0 ? x0 + (bodyLen * planUnits) / units : x1;

  // 떼어 낸 블록: 건조대 옆 바닥에 꼬리 쪽부터 늘어놓는다.
  const pileY = rulerY + RULER - 6;
  const pile: Block[] = [];
  let px = x1 + engLen;
  for (const r of pileTops) {
    const w = 64 + r.size * 14;
    if (px - w < box.x + SIDE) break;
    px -= w;
    const rect = { x: px, y: pileY, w, h: 26 };
    let depth = 1;
    let cur = r;
    while (cur.parent !== undefined) {
      const up = byId.get(cur.parent);
      if (!up || depth > 3) break;
      depth++;
      cur = up;
    }
    pile.push({
      ...rect,
      region: r,
      depth,
      leaf: true,
      found: isFound(r),
      safe: rect,
      header: 0,
    });
    px -= 8;
  }

  return {
    bodyPath,
    bowPath,
    bowTip,
    bridgePath,
    enginePath,
    nozzles,
    x0,
    x1,
    y0,
    y1,
    bowLen,
    plateY: y0 - 8 - PLATE_H,
    plateH: PLATE_H,
    beamY: y0 - TOP,
    floorY,
    cradles,
    rulerY,
    planX,
    units,
    planUnits,
    columns,
    blocks,
    pile,
    pileY,
  };
}
