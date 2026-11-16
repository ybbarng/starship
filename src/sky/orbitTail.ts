// 실제 축척의 궤도 꼬리를 그리는 데 쓰는 순수 계산(docs/scale.md "실제 축척 보기").
// 꼬리는 장노출 사진의 빛 자국처럼 머리 쪽이 가장 밝고 굵고, 끝으로 갈수록 가늘고 옅어진다.

import type { Vec3 } from "./astro";

/** 머리 쪽 굵기(CSS 픽셀). 빛 띠 가운데에서 가장자리까지 부드럽게 옅어지는 폭이다. */
export const TAIL_HEAD_PX = 3.2;
/** 꼬리 끝 굵기(CSS 픽셀) */
export const TAIL_END_PX = 1.1;
/**
 * 카메라에서 본 머리와의 각도가 이만큼(도)이면 꼬리가 다 사라진다.
 * 가까운 행성의 꼬리가 화면을 가로지르지 않고 화면 안에서 끝나게 한다.
 */
export const TAIL_VIEW_DEG = 22;
/** 시야 각도가 이 비율까지는 흐려지지 않는다. 그 뒤로 시야 한계까지 부드럽게 사라진다. */
export const TAIL_VIEW_KEEP = 0.3;

/**
 * 꼬리 위 자리 t(0 머리 → 1 끝)의 밝기. 곡선으로 직선보다 빨리 옅어진다.
 * 머리 바로 앞은 빛점과 겹치므로 조금 줄여, 빛점에서 띠가 자연스럽게 뻗어 나오게 한다.
 */
export function tailGlow(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return (1 - u) ** 1.6 * (0.6 + 0.4 * smoothstep(0, 0.04, u));
}

/** 꼬리 위 자리 t의 굵기(CSS 픽셀) */
export function tailWidth(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return TAIL_HEAD_PX + (TAIL_END_PX - TAIL_HEAD_PX) * u;
}

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** 카메라에서 본 머리와의 각도(도)에 따른 남는 밝기(1 그대로 → 0 사라짐) */
export function viewFade(angleDeg: number, limitDeg = TAIL_VIEW_DEG): number {
  return 1 - smoothstep(limitDeg * TAIL_VIEW_KEEP, limitDeg, angleDeg);
}

/**
 * 꼬리 점마다 카메라에서 본 머리와의 각도로 남는 밝기를 구한다. points[0]이 머리다.
 * 한 번 옅어진 꼬리가 뒤에서 다시 밝아지지 않게, 앞 점보다 밝아지지 않는다.
 */
export function tailViewFades(
  points: readonly Vec3[],
  camera: Vec3,
  limitDeg = TAIL_VIEW_DEG,
  out = new Float32Array(points.length),
): Float32Array {
  const head = points[0];
  if (!head) return out;
  const hx = head[0] - camera[0];
  const hy = head[1] - camera[1];
  const hz = head[2] - camera[2];
  const hl = Math.hypot(hx, hy, hz) || 1;
  let prev = 1;
  points.forEach((p, k) => {
    const x = p[0] - camera[0];
    const y = p[1] - camera[1];
    const z = p[2] - camera[2];
    const l = Math.hypot(x, y, z) || 1;
    const cos = Math.min(
      1,
      Math.max(-1, (x * hx + y * hy + z * hz) / (l * hl)),
    );
    const f = Math.min(
      prev,
      viewFade((Math.acos(cos) * 180) / Math.PI, limitDeg),
    );
    out[k] = f;
    prev = f;
  });
  return out;
}

/** 꼬리 색: 행성 색을 따뜻한 흰빛과 섞어 옅게. 별자리 선의 푸른색과 갈린다. */
export function tailTint(
  rgb: Vec3,
  warm: Vec3 = [1, 0.93, 0.82],
  mix = 0.45,
): Vec3 {
  return [
    rgb[0] * (1 - mix) + warm[0] * mix,
    rgb[1] * (1 - mix) + warm[1] * mix,
    rgb[2] * (1 - mix) + warm[2] * mix,
  ];
}
