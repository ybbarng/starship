// 3D 별하늘 계산: 시차를 거리로, 다른 자리에서 본 방향과 밝기, 표시용 반지름 추정.
// 셰이더(shaders.ts의 sky3dVertex·constellation3dVertex)도 같은 식을 쓴다. 규칙은 docs/sky-3d.md.
import type { Vec3 } from "./astro";

/** 1파섹 = 3.2616광년 */
export const PC_LY = 3.261_563_777;
/** 시차가 오차의 이 배수 이상이면 "잰 거리"로 본다. 목적지가 될 수 있다. */
export const MIN_PARALLAX_RATIO = 5;
/** 시차가 1mas보다 작으면(3,262광년보다 멀면) 이 거리로 자른다. */
export const MAX_STAR_LY = 1000 * PC_LY;
/** 거리를 모르는 별은 이만큼 멀리 둔다. 어디로 가도 방향과 밝기가 그대로다. */
export const FAR_LY = 1e9;
/** 관측자에서 이보다 가까운 별은 하늘의 점 대신 장면의 별(StarTargets)이 그린다. */
export const NEAR_HIDE_LY = 0.5;
/** 거리를 모르는 별(6~8등급 등)이 흐려지는 정도: 태양에서 이 거리(광년)마다 e배씩 흐린 쪽으로 */
export const FAR_FADE_LY = 100;
/** 멀리 가도 거리를 모르는 별은 이만큼은 남긴다(배경 질감). */
export const FAR_FADE_MIN = 0.35;

/** 시차(밀리각초) → 광년 */
export function parallaxToLy(mas: number): number {
  return (1000 / mas) * PC_LY;
}

export type StarDistance =
  /** 시차 ≥ 오차 × 5: 1/시차 */
  | { kind: "measured"; ly: number }
  /** 0 < 시차 < 오차 × 5: 1/시차를 쓰되 목적지는 되지 않는다 */
  | { kind: "uncertain"; ly: number }
  /** 시차가 0 이하이거나 없다: 먼 천구에 둔다 */
  | { kind: "unknown"; ly: null };

/** 시차와 오차로 거리를 정한다. 규칙은 docs/sky-3d.md "믿기 어려운 시차". */
export function distanceFromParallax(plx: number, ePlx: number): StarDistance {
  if (!(plx > 0)) return { kind: "unknown", ly: null };
  const ly = Math.min(MAX_STAR_LY, parallaxToLy(plx));
  if (ePlx > 0 && plx / ePlx >= MIN_PARALLAX_RATIO)
    return { kind: "measured", ly };
  return { kind: "uncertain", ly };
}

/** 거리 fromLy에서 mag등급인 별을 거리 toLy에서 보면 몇 등급인가 */
export function apparentMag(mag: number, fromLy: number, toLy: number): number {
  return mag + 5 * Math.log10(toLy / fromLy);
}

/** 겉보기 등급과 거리 → 절대 등급(10파섹에서 본 등급) */
export function absoluteMag(mag: number, ly: number): number {
  return apparentMag(mag, ly, 10 * PC_LY);
}

/**
 * 태양에서 pos(광년)에 있고 지구에서 mag등급인 별을, observer(광년)에서 본 방향·거리·등급.
 * far면(거리 모름) 방향과 등급이 그대로다.
 */
export function seenFrom(
  pos: Vec3,
  mag: number,
  observer: Vec3,
  far = false,
): { dir: Vec3; dist: number; mag: number } {
  const d0 = Math.hypot(pos[0], pos[1], pos[2]) || 1;
  if (far)
    return {
      dir: [pos[0] / d0, pos[1] / d0, pos[2] / d0],
      dist: Number.POSITIVE_INFINITY,
      mag,
    };
  const rel: Vec3 = [
    pos[0] - observer[0],
    pos[1] - observer[1],
    pos[2] - observer[2],
  ];
  const d = Math.hypot(rel[0], rel[1], rel[2]) || 1e-9;
  return {
    dir: [rel[0] / d, rel[1] / d, rel[2] / d],
    dist: d,
    mag: apparentMag(mag, d0, d),
  };
}

/** 거리를 모르는 별의 밝기 배율. 태양계 안에서는 1, 멀리 갈수록 FAR_FADE_MIN으로. */
export function farFade(observerLy: number): number {
  return (
    FAR_FADE_MIN + (1 - FAR_FADE_MIN) * Math.exp(-observerLy / FAR_FADE_LY)
  );
}

/** B-V → 표면 온도(K). Ballesteros(2012) 식. astro.ts bvToRgb와 같다. */
export function bvToKelvin(bv: number): number {
  const b = Math.min(2, Math.max(-0.4, bv));
  return 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
}

/** 복사 보정(V등급 → 모든 파장의 밝기). Flower(1996)를 Reed(1998)가 온도 다항식으로 맞춘 근사. */
export function bolometricCorrection(kelvin: number): number {
  const x = Math.log10(kelvin) - 4;
  return -8.499 * x ** 4 + 13.421 * x ** 3 - 8.131 * x ** 2 - 3.901 * x - 0.438;
}

/**
 * 절대 등급과 색으로 반지름(태양 = 1)을 어림한다. 밝기 L = 10^(−0.4(Mbol − 4.74)),
 * 반지름 = √L × (5772K / T)². 측정값이 아닌 어림이라 화면 크기·표면 거리에만 쓴다.
 */
export function estimateRadiusSun(absMagV: number, bv: number): number {
  const t = bvToKelvin(bv);
  const mbol = absMagV + bolometricCorrection(t);
  const lum = 10 ** (-0.4 * (mbol - 4.74));
  return Math.sqrt(lum) * (5772 / t) ** 2;
}

/** 가시광(550nm)에서 같은 넓이가 내는 빛(플랑크 식, 상수는 비율이라 뺀다). */
function visibleSurfaceBrightness(kelvin: number): number {
  return 1 / Math.expm1(26_160 / kelvin);
}

/** 표면 밝기의 기준 온도. 안타레스(약 3,500K)를 지금 화면(가운데 1배)으로 둔다. */
export const SURFACE_REF_K = 3500;

/**
 * 표면 온도 → 원반 가운데 밝기 배율(셰이더 uPeak). 가까이서 본 원반의 눈부심은 거리와 상관없이
 * 표면 온도로 정해진다(같은 넓이의 가시광, 태양 = 1이면 안타레스 약 1/16, 시리우스 약 7배, 스피카 약 50배).
 * 그대로 쓰면 뜨거운 별은 하얗게 타고 붉은 별은 너무 어두워, 네제곱근으로 차이를 줄인다.
 * 기준(3,500K)이 1이라 안타레스는 2026-11-01에 정한 밝기 그대로다.
 */
export function surfacePeak(kelvin: number): number {
  const ratio =
    visibleSurfaceBrightness(kelvin) / visibleSurfaceBrightness(SURFACE_REF_K);
  return Math.min(6, Math.max(0.6, ratio ** 0.25));
}

/**
 * 실제 반지름(태양 = 1) → 화면 반지름. 손으로 정한 유명한 별 13개(알파 센타우리 2.4 … 베텔게우스 14)의
 * 크기 차이를 따라가도록 반지름의 0.27제곱으로 줄인다.
 */
export function starSceneRadius(radiusSun: number): number {
  return Math.min(14, Math.max(1.6, 2.3 * radiusSun ** 0.27));
}
