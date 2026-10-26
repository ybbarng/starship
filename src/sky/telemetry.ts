// 계기판에 보이는 "진짜 값": 지금 어디에 있고, 지구에서 얼마나 멀고, 빛이 오가는 데 얼마나 걸리고,
// 얼마나 빨리 가고 있고, 어느 방향을 보고 있나. 화면 거리는 줄여 그렸지만 이 값들은 실제 궤도로 계산한다.
import {
  AU_KM,
  type Elements,
  HALLEY,
  halleyAt,
  heliocentric,
  LIGHT_KM_S,
  LY_AU,
  type Vec3,
} from "./astro";
import {
  BODY_BY_ID,
  type Destination,
  MOON_DISTANCE_KM,
  probePositionAU,
} from "./bodies";

export { REAL_RADIUS_KM } from "./bodies";

/** 유명한 별까지 거리(광년) */
export const STAR_LY: Record<string, number> = {
  "alpha-cen": 4.37,
  sirius: 8.6,
  vega: 25,
  polaris: 433,
  betelgeuse: 548,
  antares: 550,
};

const EPOCH = Date.UTC(2000, 0, 1, 12);

/** 목적지의 실제 태양 중심 황도 좌표(AU). 전망은 태양계 위 높은 곳. */
export function realPositionAU(
  dest: Destination,
  orbits: Record<string, Elements>,
  ms: number,
): Vec3 {
  if (dest.view === "overview") return [0, 0, 60];
  if (dest.view === "inner") return [0, 0, 6];
  if (dest.id === "halley")
    return halleyAt(HALLEY.perihelion + 10 * 86_400_000);
  if (dest.probe) return probePositionAU(dest.probe, ms);
  if (dest.star) {
    const ly = STAR_LY[dest.id] ?? 10;
    const ra = (dest.star.ra * Math.PI) / 180;
    const dec = (dest.star.dec * Math.PI) / 180;
    // 적도 → 황도
    const x = Math.cos(dec) * Math.cos(ra);
    const y = Math.cos(dec) * Math.sin(ra);
    const z = Math.sin(dec);
    const e = (23.43928 * Math.PI) / 180;
    const d = ly * LY_AU;
    return [
      x * d,
      (y * Math.cos(e) + z * Math.sin(e)) * d,
      (-y * Math.sin(e) + z * Math.cos(e)) * d,
    ];
  }
  const body = dest.body ? BODY_BY_ID.get(dest.body) : undefined;
  if (!body || body.id === "sun") return [0, 0, 0];
  if (body.orbit) {
    const el = orbits[body.orbit];
    return el ? heliocentric(el, ms) : [0, 0, 0];
  }
  if (body.parent) {
    const parentDest = { ...dest, body: body.parent.id };
    const [px, py, pz] = realPositionAU(parentDest, orbits, ms);
    const days = (ms - EPOCH) / 86_400_000;
    const ang =
      2 * Math.PI * (days / body.parent.periodDays + body.parent.phase);
    const r = (MOON_DISTANCE_KM[body.id] ?? 400_000) / AU_KM;
    // 화면과 같은 각도로(장면 좌표 x, z = 황도 x, -y)
    return [px + r * Math.cos(ang), py - r * Math.sin(ang), pz];
  }
  return [0, 0, 0];
}

export function distanceKm(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * AU_KM;
}

// ── 글로 바꾸기 ──────────────────────────────────────

export function formatDistance(km: number): string {
  const ly = km / AU_KM / LY_AU;
  if (ly >= 0.1)
    return `${ly.toLocaleString("ko-KR", { maximumFractionDigits: ly < 10 ? 2 : 0 })}광년`;
  const au = km / AU_KM;
  if (au >= 0.1)
    return `${au.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} AU`;
  if (km >= 10_000)
    return `${Math.round(km / 1000).toLocaleString("ko-KR")}천 km`;
  return `${Math.round(km).toLocaleString("ko-KR")} km`;
}

/** 빛이 그 거리를 가는 데 걸리는 시간 */
export function formatLightTime(km: number): string {
  const s = km / LIGHT_KM_S;
  if (s < 1) return `${(s * 1000).toFixed(0)}밀리초`;
  if (s < 60) return `${s.toFixed(1)}초`;
  // 먼저 반올림한 뒤 나눠야 "4분 60초" 같은 글이 나오지 않는다.
  if (s < 3600) {
    const t = Math.round(s);
    return `${Math.floor(t / 60)}분 ${t % 60}초`;
  }
  if (s < 86_400) {
    const t = Math.round(s / 60);
    return `${Math.floor(t / 60)}시간 ${t % 60}분`;
  }
  const y = s / 31_557_600;
  if (y >= 1)
    return `${y.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}년`;
  return `${(s / 86_400).toFixed(1)}일`;
}

export function formatSpeed(kmPerS: number): string {
  const c = kmPerS / LIGHT_KM_S;
  if (c >= 0.5)
    return `광속의 ${c.toLocaleString("ko-KR", { maximumFractionDigits: c < 10 ? 1 : 0 })}배`;
  return `${Math.round(kmPerS).toLocaleString("ko-KR")} km/s`;
}

/** 15.25 → "15h 15m", 적경을 시·분으로 */
export function formatRA(deg: number): string {
  const h = deg / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round(((h - hh) * 60 - mm) * 60);
  return `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

export function formatDec(deg: number): string {
  const s = deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  return `${s}${d}° ${String(m).padStart(2, "0")}′`;
}

// ── 매 프레임 갱신하는 값(SpaceView가 채운다) ─────────────────

export type Telemetry = {
  /** 지금 목적지 또는 이동 중 위치의 실제 좌표(AU) */
  position: Vec3;
  /** 지구까지 거리(km). 지구에 있으면 고도. */
  earthKm: number;
  /** 지금 목적지 천체 표면에서 고도(km), 천체가 없으면 null */
  altitudeKm: number | null;
  /** 이동 중 속도(km/s), 순항 중 0 */
  speedKmS: number;
  /** 남은 거리(km), 순항 중 0 */
  remainingKm: number;
  traveling: boolean;
  progress: number;
  /** 화면 가운데가 가리키는 하늘 */
  view: { ra: number; dec: number; lon: number; lat: number };
  /** 마우스가 가리키는 하늘(창 밖이면 null) */
  cursor: { ra: number; dec: number; lon: number; lat: number } | null;
};

export const telemetry: Telemetry = {
  position: [1, 0, 0],
  earthKm: 0,
  altitudeKm: null,
  speedKmS: 0,
  remainingKm: 0,
  traveling: false,
  progress: 1,
  view: { ra: 0, dec: 0, lon: 0, lat: 0 },
  cursor: null,
};
