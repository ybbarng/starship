// 개척지 카메라: 끌고 확대해 다니기. 모두 순수 함수다(설계: docs/frontier.md "카메라").
//
// 좌표 두 가지
// - 땅 좌표: hex.ts toPixel(h, 1)의 단위. 칸 반지름이 1이다. 지도가 그대로면 늘 같다.
// - 화면 좌표: 지도 그림(svg) 안의 px.
// 카메라는 "화면 가운데에 놓인 땅 좌표"와 "맞춤 배율에 곱할 배율(zoom)"만 가진다.
// 화면 크기가 바뀌어도 맞춤 배율(s0)만 다시 구하면 되니, 브라우저에 기억해 두기도 쉽다.

export type P = { x: number; y: number };
/** 땅 좌표 사각형 */
export type Box = { minX: number; maxX: number; minY: number; maxY: number };
/** 화면 좌표 사각형 */
export type Rect = { x: number; y: number; w: number; h: number };
/** 지도 그림 크기. top·bottom·side는 맞출 때 비워 둘 여백(아래쪽 목표 글 등) */
export type Viewport = {
  w: number;
  h: number;
  top: number;
  bottom: number;
  side: number;
};
export type Camera = { zoom: number; x: number; y: number };

/** 맞춤에서 칸 반지름 상한(px). 구역이 적어도 칸이 지나치게 커지지 않게 */
export const FIT_MAX_S = 44;
/** 맞출 때 둘레에 남길 지역 이름표 띠(땅 좌표) */
export const FIT_BAND = 1.7;
/** 가장 멀리: 맞춤의 0.8배 */
export const MIN_ZOOM = 0.8;
/** 가장 가까이: 칸 지름 120px */
export const MAX_CELL_PX = 120;
/** 끌기로 볼 문턱(px). 이보다 짧게 움직이면 누르기다 */
export const DRAG_THRESHOLD = 4;
/** 날아가는 시간(ms) */
export const FLY_MS = 350;

/** 칸 가운데(땅 좌표)들을 감싸는 사각형. 착륙장은 늘 들어간다 */
export function boxOf(centers: P[]): Box {
  let minX = -2.8;
  let maxX = 2.8;
  let minY = -2.6;
  let maxY = 2.6;
  for (const p of centers) {
    minX = Math.min(minX, p.x - 1);
    maxX = Math.max(maxX, p.x + 1);
    minY = Math.min(minY, p.y - 0.9);
    maxY = Math.max(maxY, p.y + 0.9);
  }
  return { minX, maxX, minY, maxY };
}

/** 맞출 자리(여백을 뺀 화면) */
export function contentRect(vp: Viewport): Rect {
  return {
    x: vp.side,
    y: vp.top,
    w: Math.max(1, vp.w - 2 * vp.side),
    h: Math.max(1, vp.h - vp.top - vp.bottom),
  };
}

/** 화면에서 카메라가 바라보는 점 */
export function viewCenter(vp: Viewport): P {
  const r = contentRect(vp);
  return { x: vp.w / 2, y: r.y + r.h / 2 };
}

/** 맞춤 배율: 개척지 전체(이름표 띠 포함)가 맞춤 자리에 드는 칸 반지름(px) */
export function fitScale(box: Box, vp: Viewport): number {
  const r = contentRect(vp);
  return Math.max(
    2,
    Math.min(
      FIT_MAX_S,
      r.w / (box.maxX - box.minX + 2 * FIT_BAND),
      r.h / (box.maxY - box.minY + 2 * FIT_BAND),
    ),
  );
}

/** 처음 모습: 전체가 들어오는 카메라 */
export function fitCamera(box: Box): Camera {
  return {
    zoom: 1,
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  };
}

export function zoomRange(s0: number): { min: number; max: number } {
  return { min: MIN_ZOOM, max: Math.max(1, MAX_CELL_PX / 2 / s0) };
}

export function toScreen(cam: Camera, s0: number, vp: Viewport, p: P): P {
  const c = viewCenter(vp);
  const s = s0 * cam.zoom;
  return { x: c.x + (p.x - cam.x) * s, y: c.y + (p.y - cam.y) * s };
}

export function toWorld(cam: Camera, s0: number, vp: Viewport, p: P): P {
  const c = viewCenter(vp);
  const s = s0 * cam.zoom;
  return { x: cam.x + (p.x - c.x) / s, y: cam.y + (p.y - c.y) / s };
}

const clampTo = (v: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

/**
 * 확대·옮기기 한계. 배율은 zoomRange 안, 가운데는 개척지가 화면 밖으로 다 나가지 않게:
 * 가로·세로마다 개척지 폭(화면보다 크면 화면 폭)의 1/4은 화면에 남는다.
 */
export function clampCamera(
  cam: Camera,
  box: Box,
  vp: Viewport,
  s0: number,
): Camera {
  const { min, max } = zoomRange(s0);
  const zoom = clampTo(Number.isFinite(cam.zoom) ? cam.zoom : 1, min, max);
  const s = s0 * zoom;
  const c = viewCenter(vp);
  // 화면 가운데에서 왼쪽·오른쪽·위·아래 가장자리까지(땅 좌표)
  const left = c.x / s;
  const right = (vp.w - c.x) / s;
  const up = c.y / s;
  const down = (vp.h - c.y) / s;
  const qx = Math.min(box.maxX - box.minX, left + right) / 4;
  const qy = Math.min(box.maxY - box.minY, up + down) / 4;
  const x = Number.isFinite(cam.x) ? cam.x : (box.minX + box.maxX) / 2;
  const y = Number.isFinite(cam.y) ? cam.y : (box.minY + box.maxY) / 2;
  return {
    zoom,
    // 보이는 x 범위 [x-left, x+right]가 [minX, maxX]와 qx 넘게 겹친다
    x: clampTo(x, box.minX + qx - right, box.maxX - qx + left),
    y: clampTo(y, box.minY + qy - down, box.maxY - qy + up),
  };
}

/** 화면 점 at을 중심으로 factor배 확대(1보다 작으면 축소). 그 점 아래 땅은 제자리에 있다 */
export function zoomAt(
  cam: Camera,
  factor: number,
  at: P,
  box: Box,
  vp: Viewport,
  s0: number,
): Camera {
  const { min, max } = zoomRange(s0);
  const zoom = clampTo(cam.zoom * factor, min, max);
  const w = toWorld(cam, s0, vp, at);
  const c = viewCenter(vp);
  const s = s0 * zoom;
  return clampCamera(
    { zoom, x: w.x - (at.x - c.x) / s, y: w.y - (at.y - c.y) / s },
    box,
    vp,
    s0,
  );
}

/** 화면에서 (dx, dy)px만큼 끌었다: 땅이 손을 따라온다 */
export function panBy(
  cam: Camera,
  dx: number,
  dy: number,
  box: Box,
  vp: Viewport,
  s0: number,
): Camera {
  const s = s0 * cam.zoom;
  return clampCamera(
    { ...cam, x: cam.x - dx / s, y: cam.y - dy / s },
    box,
    vp,
    s0,
  );
}

/** 땅 점 p를 화면 가운데로. zoom을 주면 그 배율로 */
export function centerOn(
  cam: Camera,
  p: P,
  box: Box,
  vp: Viewport,
  s0: number,
  zoom = cam.zoom,
): Camera {
  return clampCamera({ zoom, x: p.x, y: p.y }, box, vp, s0);
}

/** 화면 점이 사각형 안에 있는가. margin만큼 안쪽으로 좁혀 본다 */
export function isOnScreen(p: P, r: Rect, margin = 0): boolean {
  return (
    p.x >= r.x + margin &&
    p.x <= r.x + r.w - margin &&
    p.y >= r.y + margin &&
    p.y <= r.y + r.h - margin
  );
}

/** 이미 보이면 그대로, 화면 밖이면 그 점을 가운데로 옮긴 카메라 */
export function revealCamera(
  cam: Camera,
  p: P,
  box: Box,
  vp: Viewport,
  s0: number,
  margin = 40,
): Camera {
  const sp = toScreen(cam, s0, vp, p);
  if (isOnScreen(sp, { x: 0, y: 0, w: vp.w, h: vp.h - vp.bottom }, margin))
    return cam;
  return centerOn(cam, p, box, vp, s0);
}

const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"] as const;

/** 방향(화면 좌표, y 아래로)을 여덟 화살표 가운데 하나로 */
export function arrowFor(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx);
  const i = Math.round(a / (Math.PI / 4));
  return ARROWS[((i % 8) + 8) % 8] ?? "→";
}

/**
 * 화면 밖 점 p를 가리키는 가장자리 자리: 화면 가운데에서 p로 그은 선이
 * 안쪽 사각형 r의 테두리와 만나는 점과, 그 방향 화살표.
 */
export function edgePoint(p: P, r: Rect): P & { arrow: string } {
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : r.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : r.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty, 1);
  return { x: c.x + dx * t, y: c.y + dy * t, arrow: arrowFor(dx, dy) };
}

export type EdgeAsk = { id: string; target: P; w: number; h: number };
export type EdgeTag = EdgeAsk & Rect & { arrow: string };

const hit = (a: Rect, b: Rect, pad = 3) =>
  a.x < b.x + b.w + pad &&
  b.x < a.x + a.w + pad &&
  a.y < b.y + b.h + pad &&
  b.y < a.y + a.h + pad;

/**
 * 화면 밖 표 자리. 표마다 가장자리의 방향 점에 붙이고(사각형 안에 들게),
 * 앞서 놓인 표와 겹치면 가장자리를 따라 조금씩 비켜 놓는다. 자리가 없으면 뺀다.
 */
export function placeEdgeTags(
  asks: EdgeAsk[],
  r: Rect,
  obstacles: Rect[] = [],
): EdgeTag[] {
  const out: EdgeTag[] = [];
  for (const a of asks) {
    const e = edgePoint(a.target, r);
    const base = {
      x: clampTo(e.x - a.w / 2, r.x, r.x + r.w - a.w),
      y: clampTo(e.y - a.h / 2, r.y, r.y + r.h - a.h),
    };
    // 왼쪽·오른쪽 가장자리면 위아래로, 위·아래 가장자리면 좌우로 비킨다
    const vertical = base.x <= r.x + 0.5 || base.x >= r.x + r.w - a.w - 0.5;
    const stepX = vertical ? 0 : a.w + 6;
    const stepY = vertical ? a.h + 4 : 0;
    for (let k = 0; k < 13; k++) {
      const n = k === 0 ? 0 : Math.ceil(k / 2) * (k % 2 === 1 ? 1 : -1);
      const cand = {
        ...a,
        arrow: e.arrow,
        x: base.x + n * stepX,
        y: base.y + n * stepY,
        w: a.w,
        h: a.h,
      };
      if (
        cand.x < r.x ||
        cand.y < r.y ||
        cand.x + cand.w > r.x + r.w ||
        cand.y + cand.h > r.y + r.h
      )
        continue;
      if (out.some((o) => hit(o, cand)) || obstacles.some((o) => hit(o, cand)))
        continue;
      out.push(cand);
      break;
    }
  }
  return out;
}

/** 부드럽게: 천천히 출발해 천천히 멈춘다 */
export function ease(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/** 날아가는 중간 카메라(t는 0..1, 이미 ease를 거친 값). 배율은 곱으로 이어 확대가 고르게 보인다 */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  const u = Math.min(1, Math.max(0, t));
  return {
    zoom: a.zoom * (b.zoom / a.zoom) ** u,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
  };
}

/* ───────────── 확대 단계 ───────────── */

export type Stage = "far" | "mid" | "near";

/** 칸 지름(px)으로 정한 확대 단계: 멀리 28 미만, 가운데 28~56, 가까이 56 이상 */
export function stageOf(s: number): Stage {
  const d = 2 * s;
  return d < 28 ? "far" : d < 56 ? "mid" : "near";
}

/** 가까이 단계는 적어도 맞춤의 이만큼 확대했을 때만(맞춤 첫 화면이 빽빽해지지 않게) */
export const NEAR_MIN_ZOOM = 1.25;

/**
 * 화면에 쓸 확대 단계. 칸 지름으로 정하되, 맞춤 근처(배율 1.25 미만)에서는 가운데까지만 쓴다.
 * 구역이 적어 맞춤에서 이미 칸이 크면, 처음 한눈에 모든 이름표·상태 글자가 쏟아지기 때문이다.
 */
export function stageFor(s: number, zoom: number): Stage {
  const st = stageOf(s);
  return st === "near" && zoom < NEAR_MIN_ZOOM ? "mid" : st;
}

/** 단계마다 구역 이름을 몇 글자까지 보이나 */
export const CLIP_BY_STAGE: Record<Stage, number> = {
  far: 8,
  mid: 11,
  near: 22,
};

/* ───────────── 브라우저 기억 ───────────── */

/** 저장해 둔 카메라 글을 읽는다. 모양이 틀리면 undefined */
export function parseCamera(
  text: string | null | undefined,
): Camera | undefined {
  if (!text) return undefined;
  try {
    const v = JSON.parse(text) as Partial<Camera>;
    if (
      typeof v.zoom === "number" &&
      typeof v.x === "number" &&
      typeof v.y === "number" &&
      Number.isFinite(v.zoom) &&
      Number.isFinite(v.x) &&
      Number.isFinite(v.y) &&
      v.zoom > 0
    )
      return { zoom: v.zoom, x: v.x, y: v.y };
  } catch {
    // 깨진 글은 처음 모습으로
  }
  return undefined;
}
