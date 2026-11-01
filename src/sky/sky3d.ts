// 하늘 자료(sky.json)를 3D 별 목록으로 바꾸고, 이름 있는 별을 목적지로 더한다.
// 관측자 자리(skyObserver)는 CameraRig가 매 프레임 채우고, 하늘 셰이더·이름표가 읽는다.
import { bvToRgb, LY_AU, raDecToEcliptic, toThree, type Vec3 } from "./astro";
import { addDestinations, DESTINATIONS, type Destination } from "./bodies";
import { loadCatalog, type SkyCatalog } from "./catalog";
import {
  absoluteMag,
  distanceFromParallax,
  estimateRadiusSun,
  FAR_LY,
  type StarDistance,
  starSceneRadius,
} from "./stars3d";
import { STAR_LY } from "./telemetry";

/** 하늘 방향(three.js 축 단위 벡터) */
export function skyDirection(ra: number, dec: number): Vec3 {
  return toThree(raDecToEcliptic(ra, dec));
}

/** 실제 위치(태양 중심 황도, AU) → 하늘 계산 좌표(광년, three.js 축) */
export function auToSkyLy(au: Vec3): Vec3 {
  const [x, y, z] = toThree(au);
  return [x / LY_AU, y / LY_AU, z / LY_AU];
}

export type StarField = {
  count: number;
  /** 태양 중심 위치(광년, three.js 축). 거리를 모르면 방향 × FAR_LY */
  pos: Float32Array;
  /** 지구에서 본 등급 */
  mag: Float32Array;
  bv: Float32Array;
  /** 1이면 거리를 모른다(먼 천구) */
  far: Uint8Array;
  distance: StarDistance[];
  /** HIP → 위 배열의 자리 */
  index: Map<number, number>;
};

const fieldCache = new WeakMap<SkyCatalog, StarField>();

/** 정적 목적지(유명한 별 13개)의 HIP → 문헌 거리(광년). 시차보다 이 값을 먼저 쓴다. */
function literatureLy(): Map<number, number> {
  const out = new Map<number, number>();
  for (const d of DESTINATIONS) {
    const hip = d.star?.hip;
    const ly = STAR_LY[d.id];
    if (hip && ly) out.set(hip, ly);
  }
  return out;
}

export function starField(catalog: SkyCatalog): StarField {
  const hit = fieldCache.get(catalog);
  if (hit) return hit;
  const n = catalog.stars.length;
  const pos = new Float32Array(n * 3);
  const mag = new Float32Array(n);
  const bv = new Float32Array(n);
  const far = new Uint8Array(n);
  const distance: StarDistance[] = [];
  const index = new Map<number, number>();
  const lit = literatureLy();
  catalog.stars.forEach(([ra, dec, m, b, hip, plx, ePlx], i) => {
    const litLy = lit.get(hip);
    const dist: StarDistance = litLy
      ? { kind: "measured", ly: litLy }
      : distanceFromParallax(plx, ePlx);
    const [x, y, z] = skyDirection(ra, dec);
    const r = dist.ly ?? FAR_LY;
    pos.set([x * r, y * r, z * r], i * 3);
    mag[i] = m;
    bv[i] = b;
    far[i] = dist.ly === null ? 1 : 0;
    distance.push(dist);
    index.set(hip, i);
  });
  const field = { count: n, pos, mag, bv, far, distance, index };
  fieldCache.set(catalog, field);
  return field;
}

/** 별의 태양 중심 위치(광년). 거리를 모르면 null */
export function starPositionLy(field: StarField, hip: number): Vec3 | null {
  const i = field.index.get(hip);
  if (i === undefined || field.far[i]) return null;
  return [
    field.pos[i * 3] ?? 0,
    field.pos[i * 3 + 1] ?? 0,
    field.pos[i * 3 + 2] ?? 0,
  ];
}

function hex([r, g, b]: Vec3): string {
  const c = (v: number) =>
    Math.round(Math.min(1, v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** 광년 → "8.6광년", "약 550광년", "약 1,400광년" */
export function formatLy(ly: number): string {
  if (ly < 100) return `${Math.round(ly * 10) / 10}광년`;
  return `약 ${(Math.round(ly / 10) * 10).toLocaleString("ko-KR")}광년`;
}

/** 정적 별 목적지에서 이보다 가까운 이름 별은 같은 무리로 보고 따로 더하지 않는다(알파 센타우리 B). */
const SAME_SYSTEM_LY = 1;

/**
 * 이름 있는 별(sky.json named) 가운데 거리를 잰 별을 목적지로 만든다. 정적 목적지(유명한 별)와 같은 별·같은 무리는 뺀다.
 * id는 "hip-<번호>".
 */
export function makeStarDestinations(
  catalog: SkyCatalog,
  field: StarField,
): Destination[] {
  const conKo = new Map(catalog.constellations.map((c) => [c.id, c.ko]));
  const statics = DESTINATIONS.filter((d) => d.star?.hip);
  const staticHips = new Set(statics.map((d) => d.star?.hip));
  const staticPos = statics
    .map((d) => starPositionLy(field, d.star?.hip ?? 0))
    .filter((p): p is Vec3 => p !== null);
  const out: Destination[] = [];
  for (const s of catalog.named) {
    if (staticHips.has(s.hip)) continue;
    const i = field.index.get(s.hip);
    if (i === undefined) continue;
    const dist = field.distance[i];
    if (dist?.kind !== "measured") continue;
    const p = starPositionLy(field, s.hip);
    if (!p) continue;
    if (
      staticPos.some(
        (q) =>
          Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < SAME_SYSTEM_LY,
      )
    )
      continue;
    const bv = field.bv[i] ?? 0.6;
    const absMag = absoluteMag(s.mag, dist.ly);
    const radiusSun = estimateRadiusSun(absMag, bv);
    // 표면 셰이더가 색을 더 짙게 칠하므로 흰빛을 조금 섞는다.
    const [r, g, b] = bvToRgb(bv);
    const color = hex([0.3 + 0.7 * r, 0.3 + 0.7 * g, 0.3 + 0.7 * b]);
    const lum = 10 ** (-0.4 * (absMag - 4.83));
    const con = conKo.get(s.con);
    out.push({
      id: `hip-${s.hip}`,
      ko: s.ko,
      en: s.en,
      group: "이름 있는 별",
      distance: formatLy(dist.ly),
      fact: `${con ? `${con}의 별. ` : ""}지구에서 ${s.mag.toFixed(1)}등급. 태양의 약 ${roundNice(lum)}배 밝다(가시광).`,
      star: {
        hip: s.hip,
        ra: s.ra,
        dec: s.dec,
        color,
        radius: starSceneRadius(radiusSun),
        ly: dist.ly,
        radiusSun,
      },
    });
  }
  return out;
}

/** 0.0123 → "0.012", 3.4 → "3.4", 1234 → "1,200" */
function roundNice(x: number): string {
  if (x < 1) return x.toPrecision(2);
  if (x < 10) return (Math.round(x * 10) / 10).toString();
  const p = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  return (Math.round(x / p) * p).toLocaleString("ko-KR");
}

let prepared: SkyCatalog | null = null;

/**
 * 하늘 자료가 오면 한 번: 정적 별 목적지의 방향을 카탈로그 값에 맞추고(별자리 선 끝이 별 한가운데에 닿게),
 * 이름 있는 별을 목적지로 더한다.
 */
export function prepareSky(catalog: SkyCatalog): StarField {
  const field = starField(catalog);
  if (prepared === catalog) return field;
  prepared = catalog;
  for (const d of DESTINATIONS) {
    const s = d.star;
    const i = s?.hip ? field.index.get(s.hip) : undefined;
    const row = i === undefined ? undefined : catalog.stars[i];
    if (s && row) {
      s.ra = row[0];
      s.dec = row[1];
    }
  }
  addDestinations(makeStarDestinations(catalog, field));
  return field;
}

/** 하늘 자료를 받아 준비한다. 여러 번 불러도 한 번만 받는다. */
export async function loadSky(): Promise<{
  catalog: SkyCatalog;
  field: StarField;
}> {
  const catalog = await loadCatalog();
  return { catalog, field: prepareSky(catalog) };
}

/**
 * 하늘을 보는 자리(태양 중심, 광년, three.js 축). 태양계 안에서는 실제 위치(거의 0)라 하늘이 지구에서 본 그대로다.
 * CameraRig가 매 프레임 채운다.
 */
export const skyObserver: { ly: Vec3; fromSun: number } = {
  ly: [0, 0, 0],
  fromSun: 0,
};
