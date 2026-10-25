// 천문 계산: 궤도 요소로 오늘 행성 위치, 적도·황도·은하 좌표 변환, 별 색.
// 화면용이라 정밀도는 분 단위 각도면 충분하다.

const DEG = Math.PI / 180;
/** J2000 황도 경사각 */
const OBLIQUITY = 23.43928 * DEG;

export type Vec3 = [number, number, number];

export function julianDay(ms: number): number {
  return ms / 86_400_000 + 2_440_587.5;
}

/** JPL 근사 궤도 요소(L·W 형식, 세기당 변화율) */
type ElementsL = {
  a: number;
  e: number;
  i: number;
  L: number;
  W: number;
  N: number;
  da: number;
  de: number;
  di: number;
  dL: number;
  dW: number;
  dN: number;
  ep: string;
};
/** 소천체 궤도 요소(M·w 형식, 하루당 평균 운동) */
type ElementsM = {
  a: number;
  e: number;
  i: number;
  M: number;
  w: number;
  N: number;
  n: number;
  ep: string;
};
export type Elements = ElementsL | ElementsM;

function solveKepler(M: number, e: number): number {
  if (e >= 0.8) {
    // 이심률이 크면 뉴턴법이 흔들려 이분법으로 푼다(E - e·sinE는 단조 증가).
    let lo = -Math.PI;
    let hi = Math.PI;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (mid - e * Math.sin(mid) < M) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  let E = M;
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

function orbitalToEcliptic(
  a: number,
  e: number,
  iDeg: number,
  nodeDeg: number,
  periDeg: number,
  Mrad: number,
): Vec3 {
  const E = solveKepler(Mrad, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const i = iDeg * DEG;
  const N = nodeDeg * DEG;
  const w = periDeg * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cN = Math.cos(N);
  const sN = Math.sin(N);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  return [
    (cw * cN - sw * sN * ci) * xp + (-sw * cN - cw * sN * ci) * yp,
    (cw * sN + sw * cN * ci) * xp + (-sw * sN + cw * cN * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

function wrapRad(deg: number): number {
  const r = (deg % 360) * DEG;
  return r > Math.PI ? r - 2 * Math.PI : r < -Math.PI ? r + 2 * Math.PI : r;
}

/** 태양 중심 황도 좌표(AU) */
export function heliocentric(el: Elements, ms: number): Vec3 {
  const jd = julianDay(ms);
  if ("L" in el) {
    const T = (jd - 2_451_545) / 36_525;
    const a = el.a + el.da * T;
    const e = el.e + el.de * T;
    const i = el.i + el.di * T;
    const L = el.L + el.dL * T;
    const W = el.W + el.dW * T;
    const N = el.N + el.dN * T;
    return orbitalToEcliptic(a, e, i, N, W - N, wrapRad(L - W));
  }
  const jdEp = julianDay(Date.parse(`${el.ep}T00:00:00Z`));
  const M = el.M + el.n * (jd - jdEp);
  return orbitalToEcliptic(el.a, el.e, el.i, el.N, el.w, wrapRad(M));
}

/** 궤도 한 바퀴를 점 n개로(궤도선 그리기용) */
export function orbitPath(el: Elements, ms: number, n = 256): Vec3[] {
  const jd = julianDay(ms);
  let a: number;
  let e: number;
  let i: number;
  let N: number;
  let w: number;
  if ("L" in el) {
    const T = (jd - 2_451_545) / 36_525;
    a = el.a + el.da * T;
    e = el.e + el.de * T;
    i = el.i + el.di * T;
    N = el.N + el.dN * T;
    w = el.W + el.dW * T - N;
  } else {
    ({ a, e, i, N, w } = el);
  }
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) {
    out.push(orbitalToEcliptic(a, e, i, N, w, (k / n) * 2 * Math.PI - Math.PI));
  }
  return out;
}

/** 핼리 혜성(1P) 궤도 요소. 근일점 1986-02-09. */
export const HALLEY = {
  a: 17.834,
  e: 0.96714,
  i: 162.26,
  N: 58.42,
  w: 111.33,
  perihelion: Date.UTC(1986, 1, 9, 12),
};

export function halleyAt(ms: number): Vec3 {
  const n = 0.985_607_7 / HALLEY.a ** 1.5; // 하루당 평균 운동(도)
  const days = (ms - HALLEY.perihelion) / 86_400_000;
  return orbitalToEcliptic(
    HALLEY.a,
    HALLEY.e,
    HALLEY.i,
    HALLEY.N,
    HALLEY.w,
    wrapRad(n * days),
  );
}

export function halleyPath(n = 400): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) {
    // 근일점 근처를 촘촘히: 이심 근점 이각으로 고르게 나눈다.
    const E = (k / n) * 2 * Math.PI - Math.PI;
    const M = E - HALLEY.e * Math.sin(E);
    out.push(
      orbitalToEcliptic(HALLEY.a, HALLEY.e, HALLEY.i, HALLEY.N, HALLEY.w, M),
    );
  }
  return out;
}

/** 적경·적위(도) → 적도 좌표 단위 벡터 */
export function equatorialUnit(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
}

/** 적도 좌표 → 황도 좌표 */
export function equatorialToEcliptic([x, y, z]: Vec3): Vec3 {
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  return [x, y * c + z * s, -y * s + z * c];
}

/** 적경·적위 → 황도 단위 벡터 */
export function raDecToEcliptic(raDeg: number, decDeg: number): Vec3 {
  return equatorialToEcliptic(equatorialUnit(raDeg, decDeg));
}

/** 은하 경도·위도(도) → 적도 단위 벡터(J2000) */
export function galacticToEquatorial(lDeg: number, bDeg: number): Vec3 {
  const l = lDeg * DEG;
  const b = bDeg * DEG;
  const g: Vec3 = [
    Math.cos(b) * Math.cos(l),
    Math.cos(b) * Math.sin(l),
    Math.sin(b),
  ];
  // 적도→은하 행렬의 전치
  const T = [
    [-0.054_875_560_4, -0.873_437_090_2, -0.483_835_015_5],
    [0.494_109_427_9, -0.444_829_63, 0.746_982_244_5],
    [-0.867_666_149, -0.198_076_373_4, 0.455_983_776_2],
  ] as const;
  return [
    T[0][0] * g[0] + T[1][0] * g[1] + T[2][0] * g[2],
    T[0][1] * g[0] + T[1][1] * g[1] + T[2][1] * g[2],
    T[0][2] * g[0] + T[1][2] * g[1] + T[2][2] * g[2],
  ];
}

/** B-V 색지수 → RGB(0..1) */
export function bvToRgb(bv: number): Vec3 {
  const b = Math.min(2, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const k = t / 100;
  let r: number;
  let g: number;
  let bl: number;
  if (k <= 66) {
    r = 255;
    g = 99.47 * Math.log(k) - 161.12;
    bl = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04;
  } else {
    r = 329.7 * (k - 60) ** -0.1332;
    g = 288.12 * (k - 60) ** -0.0755;
    bl = 255;
  }
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(bl)];
}

/** 화면에 담으려고 태양에서의 거리를 줄인다. 방향은 그대로다. */
export const SCENE_SCALE = { k: 18, p: 0.55 };

export function compress([x, y, z]: Vec3): Vec3 {
  const r = Math.hypot(x, y, z);
  if (r === 0) return [0, 0, 0];
  const s = (SCENE_SCALE.k * r ** SCENE_SCALE.p) / r;
  return [x * s, y * s, z * s];
}

/** 황도 좌표(x,y,z 북쪽) → three.js 좌표(y가 위) */
export function toThree([x, y, z]: Vec3): Vec3 {
  return [x, z, -y];
}
