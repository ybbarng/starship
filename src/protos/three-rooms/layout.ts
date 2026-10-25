// 세 방의 자리 계산. 모든 값은 갑판 설계 좌표(DECK_W × DECK_H)이고, 화면에서는 통째로 늘이고 줄인다.
// x는 그림의 가운데, y는 발끝.
import type { Crew } from "@/protocol/v1";
import type { QueueEntry, Room, RoomsModel } from "./model";

export const DECK_W = 1340;
export const DECK_H = 560;
export const FLOOR = 548;
export const HEADER = 46;

export const ROOMS: Record<Room, { x: number; w: number }> = {
  work: { x: 0, w: 390 },
  wait: { x: 404, w: 532 },
  lounge: { x: 950, w: 390 },
};

const WAIT = ROOMS.wait;
/** 대기실 안 고정 자리(방 안 좌표) */
export const WAIT_GEO = {
  door: { x: 426, y: 128, w: 84, h: FLOOR - 128 },
  /** 줄어든 조종석이 들어앉는 문 위 창(가로:세로 ≈ 조종석 계기판 비율) */
  porthole: { x: 404, y: 70, w: 128, h: 38 },
  hatch: { x: 0, y: 392, w: 30, h: FLOOR - 392 },
  bench: { y: 304, x0: 26, gap: 48, size: 40, n: 8 },
  front: { x0: 468, gap: 118, size: 72, n: 4 },
};

export type Spot = {
  key: string;
  room: Room;
  x: number;
  y: number;
  size: number;
  /** 줄 순서(0 = 맨 앞). 줄이 아니면 -1 */
  order: number;
  /** 머리 위 말풍선 층(0 아래, 1 위). 없으면 -1 */
  tier: number;
};

export type Figure =
  | (Spot & { who: "crew"; crew: Crew; entry?: QueueEntry })
  | (Spot & { who: "visitor" | "robot"; entry: QueueEntry });

export type Grid = { rows: number[]; size: number };

/** 방 안 격자: 가장 크게 그릴 수 있는 칸 수를 고르고, 아래(바닥)부터 채운다. */
function grid(
  n: number,
  room: Room,
  top: number,
  maxSize: number,
): { pts: { x: number; y: number }[]; size: number; rows: number[] } {
  const { x, w } = ROOMS[room];
  const left = x + 14;
  const width = w - 28;
  const height = FLOOR - top;
  if (n === 0) return { pts: [], size: maxSize, rows: [] };
  const options: { cols: number; rows: number; size: number }[] = [];
  for (let cols = 1; cols <= 8; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(
      (width / cols) * 0.84,
      (height / rows - 18) / 1.25,
      maxSize,
    );
    options.push({ cols, rows, size });
  }
  // 가장 크게 그릴 수 있는 크기의 85% 안이면 줄 수가 적은(바닥에 가까운) 쪽
  const top1 = Math.max(...options.map((o) => o.size));
  const best = options
    .filter((o) => o.size >= top1 * 0.85)
    .sort((a, b) => a.rows - b.rows || b.size - a.size)[0] ?? {
    cols: 1,
    rows: n,
    size: maxSize,
  };
  const { cols, rows } = best;
  const size = Math.floor(best.size);
  const cellH = Math.min(height / rows, size * 1.25 + 34);
  const pts: { x: number; y: number }[] = [];
  const rowYs: number[] = [];
  for (let r = 0; r < rows; r++) rowYs.push(FLOOR - r * cellH);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const cellW = width / cols;
    // 줄이 덜 찼으면 가운데로 모은다
    const start = left + (width - inRow * cellW) / 2;
    const c = i % cols;
    pts.push({ x: start + cellW * (c + 0.5), y: rowYs[r] ?? FLOOR });
  }
  return { pts, size, rows: rowYs };
}

export type DeckLayout = {
  figures: Figure[];
  workRows: number[];
  loungeRows: number[];
  /** 휴게실 소파 자리(쉬는 선원) */
  sofas: { x: number; y: number; size: number }[];
  overflow: number;
};

export function layoutDeck(model: RoomsModel): DeckLayout {
  const figures: Figure[] = [];
  const work = grid(model.work.length, "work", HEADER + 64, 78);
  model.work.forEach((crew, i) => {
    const p = work.pts[i];
    if (!p) return;
    figures.push({
      who: "crew",
      key: crew.id,
      crew,
      room: "work",
      x: p.x,
      y: p.y,
      size: work.size,
      order: -1,
      tier: -1,
    });
  });
  const lounge = grid(model.lounge.length, "lounge", HEADER + 112, 66);
  const sofas: DeckLayout["sofas"] = [];
  model.lounge.forEach((crew, i) => {
    const p = lounge.pts[i];
    if (!p) return;
    if (crew.status !== "off") sofas.push({ ...p, size: lounge.size });
    figures.push({
      who: "crew",
      key: crew.id,
      crew,
      room: "lounge",
      x: p.x,
      y: p.y,
      size: lounge.size,
      order: -1,
      tier: -1,
    });
  });
  const { front, bench } = WAIT_GEO;
  const cap = front.n + bench.n;
  const overflow = Math.max(0, model.queue.length - cap);
  const shown = overflow
    ? model.queue.slice(0, cap - 1)
    : model.queue.slice(0, cap);
  shown.forEach((entry, i) => {
    const isFront = i < front.n;
    const j = i - front.n;
    const spot: Spot = {
      key: entry.key,
      room: "wait",
      x:
        WAIT.x +
        (isFront ? front.x0 - i * front.gap : bench.x0 + j * bench.gap),
      y: isFront ? FLOOR : bench.y,
      size: isFront ? (i === 0 ? front.size + 8 : front.size) : bench.size,
      order: i,
      tier: isFront ? i % 2 : -1,
    };
    if (entry.who === "crew")
      figures.push({ ...spot, who: "crew", crew: entry.crew, entry });
    else figures.push({ ...spot, who: entry.who, entry });
  });
  return {
    figures,
    workRows: work.rows,
    loungeRows: lounge.rows,
    sofas,
    overflow: overflow ? overflow + 1 : 0,
  };
}

/** 줄 밖으로 나가는 방문객이 향하는 도킹 통로 */
export const HATCH_POINT = { x: WAIT.x + 14, y: FLOOR };
