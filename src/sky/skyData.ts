// 하늘 자료를 만드는 순수 함수. 빌드 스크립트(scripts/build-sky.mjs, Node가 .ts를 그대로 읽는다)와
// 시험이 함께 쓴다. Node가 바로 읽어야 하므로 다른 모듈을 import하지 않고 지울 수 있는 타입 문법만 쓴다.

/** HIP 번호 → [시차(mas), 시차 오차(mas)] */
export type ParallaxTable = Map<number, [number, number]>;

/**
 * Hipparcos 새 처리판(van Leeuwen 2007, CDS I/311) `hip2.dat`을 읽는다.
 * 줄마다 공백으로 나눈 칸: 0 HIP, 1 Sn, 2 So, 3 Nc, 4 RArad, 5 DErad, 6 Plx, 7 pmRA, 8 pmDE,
 * 9 e_RArad, 10 e_DErad, 11 e_Plx … (원자료 ReadMe의 바이트 정의와 같은 순서)
 */
export function parseHip2(text: string): ParallaxTable {
  const out: ParallaxTable = new Map();
  for (const line of text.split("\n")) {
    const f = line.trim().split(/\s+/);
    if (f.length < 12) continue;
    const hip = Number(f[0]);
    const plx = Number(f[6]);
    const ePlx = Number(f[11]);
    if (
      !Number.isInteger(hip) ||
      !Number.isFinite(plx) ||
      !Number.isFinite(ePlx)
    )
      continue;
    out.set(hip, [plx, ePlx]);
  }
  return out;
}

const DEG = Math.PI / 180;

/** 두 하늘 방향(적경·적위, 도) 사이의 각거리(도) */
export function angularDistanceDeg(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const a = Math.sin(dec1 * DEG) * Math.sin(dec2 * DEG);
  const b =
    Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.cos((ra1 - ra2) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, a + b))) / DEG;
}

export type SkyPoint = { hip: number; ra: number; dec: number };

/**
 * 별자리 선 꼭짓점(좌표)을 별(HIP)과 맞춘다. 원자료의 선은 별 번호 없이 좌표만 있어서,
 * maxDeg 안에서 가장 가까운 별을 고른다. 여러 후보 목록을 앞에서부터 찾고(맨눈 별 먼저, 그다음 흐린 별),
 * 어디서도 못 찾으면 0.
 */
export function matchVertex(
  ra: number,
  dec: number,
  candidates: SkyPoint[][],
  maxDeg: number,
): number {
  for (const list of candidates) {
    let best = 0;
    let bestD = maxDeg;
    for (const s of list) {
      // 적위만으로 먼저 거른다(각거리는 적위 차보다 작을 수 없다).
      if (Math.abs(s.dec - dec) > bestD) continue;
      const d = angularDistanceDeg(ra, dec, s.ra, s.dec);
      if (d <= bestD) {
        bestD = d;
        best = s.hip;
      }
    }
    if (best) return best;
  }
  return 0;
}
