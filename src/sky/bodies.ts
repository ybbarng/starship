// 화면에 그리는 천체와 여행 목적지. 크기는 실제 반지름으로, 거리는 실제 궤도로 계산한 뒤
// SCENE_SCALE 규칙(astro.ts, docs/scale.md)으로 줄인다.
import {
  compress,
  type Elements,
  halleyAt,
  heliocentric,
  moonOrbitRadii,
  SCENE_SCALE,
  sceneRadius,
  sunShare,
  toThree,
  type Vec3,
} from "./astro";

/** 실제 반지름(km) */
export const REAL_RADIUS_KM: Record<string, number> = {
  sun: 696_340,
  mercury: 2_439.7,
  venus: 6_051.8,
  earth: 6_371,
  moon: 1_737.4,
  mars: 3_389.5,
  phobos: 11.3,
  ceres: 469.7,
  vesta: 262.7,
  jupiter: 69_911,
  io: 1_821.6,
  europa: 1_560.8,
  ganymede: 2_634.1,
  callisto: 2_410.3,
  saturn: 58_232,
  enceladus: 252.1,
  titan: 2_574.7,
  uranus: 25_362,
  neptune: 24_622,
  triton: 1_353.4,
  pluto: 1_188.3,
};

/** 위성의 실제 궤도 반지름(km) */
export const MOON_DISTANCE_KM: Record<string, number> = {
  moon: 384_400,
  phobos: 9_376,
  io: 421_700,
  europa: 671_034,
  ganymede: 1_070_412,
  callisto: 1_882_709,
  enceladus: 238_042,
  titan: 1_221_870,
  triton: 354_759,
};

const size = (id: string) => sceneRadius(REAL_RADIUS_KM[id] ?? 0);

/** 위성의 화면 궤도 반지름: 모행성 반지름 단위로 줄인 뒤 화면 반지름을 곱한다. */
function moonDistance(id: string, parentId: string): number {
  const parentKm = REAL_RADIUS_KM[parentId] ?? 1;
  const radii = (MOON_DISTANCE_KM[id] ?? parentKm * 4) / parentKm;
  return moonOrbitRadii(radii) * size(parentId);
}

/** 실제보다 키워 그린 천체(너무 작아 보이지 않는 것) */
export function isEnlarged(id: string): boolean {
  const km = REAL_RADIUS_KM[id];
  return (
    km !== undefined && (SCENE_SCALE.earth * km) / 6_371 < SCENE_SCALE.minRadius
  );
}

export type Surface =
  | { type: "star"; color: string }
  | { type: "rocky"; colors: [string, string, string]; craters?: boolean }
  | {
      type: "earth";
      ocean: string;
      land: string;
      ice: string;
      cloud: string;
    }
  | {
      type: "gas";
      colors: [string, string, string];
      bands: number;
      storm?: boolean;
    }
  | { type: "ice"; colors: [string, string, string] }
  | { type: "volcanic"; colors: [string, string, string] }
  | { type: "cracked"; colors: [string, string, string] };

export type BodyDef = {
  id: string;
  ko: string;
  /** 화면 반지름(장면 단위) */
  radius: number;
  surface: Surface;
  /** 궤도 요소 키(sky.json orbits) — 태양을 도는 천체 */
  orbit?: string;
  /** 위성이면 모행성과 화면 거리, 공전 주기(일) */
  parent?: { id: string; distance: number; periodDays: number; phase: number };
  atmosphere?: string;
  ring?: { inner: number; outer: number; color: string };
  tilt?: number;
  /** 자전 주기(시간), 화면에서는 아주 느리게 */
  spinHours?: number;
};

export const BODIES: BodyDef[] = [
  {
    id: "sun",
    ko: "태양",
    get radius() {
      return size("sun") * sunShare();
    },
    surface: { type: "star", color: "#ffd27a" },
  },
  {
    id: "mercury",
    ko: "수성",
    get radius() {
      return size("mercury");
    },
    orbit: "mer",
    surface: {
      type: "rocky",
      colors: ["#8a8580", "#b5afa8", "#5e5a56"],
      craters: true,
    },
    spinHours: 1408,
  },
  {
    id: "venus",
    ko: "금성",
    get radius() {
      return size("venus");
    },
    orbit: "ven",
    surface: {
      type: "gas",
      colors: ["#e8d3a2", "#d9b878", "#f3e6c4"],
      bands: 3,
    },
    atmosphere: "#ffe3a8",
    spinHours: 5832,
  },
  {
    id: "earth",
    ko: "지구",
    get radius() {
      return size("earth");
    },
    orbit: "ter",
    surface: {
      type: "earth",
      ocean: "#1d4f91",
      land: "#4f7a3a",
      ice: "#f2f6fa",
      cloud: "#ffffff",
    },
    atmosphere: "#7fb8ff",
    tilt: 23.4,
    spinHours: 24,
  },
  {
    id: "moon",
    ko: "달",
    get radius() {
      return size("moon");
    },
    parent: {
      id: "earth",
      get distance() {
        return moonDistance("moon", "earth");
      },
      periodDays: 27.32,
      phase: 0.3,
    },
    surface: {
      type: "rocky",
      colors: ["#9a9a98", "#c8c7c2", "#6a6a6a"],
      craters: true,
    },
  },
  {
    id: "mars",
    ko: "화성",
    get radius() {
      return size("mars");
    },
    orbit: "mar",
    surface: { type: "rocky", colors: ["#b5562f", "#d98a57", "#7a3a22"] },
    atmosphere: "#f0a77a",
    tilt: 25.2,
    spinHours: 24.6,
  },
  {
    id: "phobos",
    ko: "포보스",
    get radius() {
      return size("phobos");
    },
    parent: {
      id: "mars",
      get distance() {
        return moonDistance("phobos", "mars");
      },
      periodDays: 0.32,
      phase: 0.1,
    },
    surface: {
      type: "rocky",
      colors: ["#6b5e52", "#857565", "#4c4239"],
      craters: true,
    },
  },
  {
    id: "ceres",
    ko: "세레스",
    get radius() {
      return size("ceres");
    },
    orbit: "cer",
    surface: {
      type: "rocky",
      colors: ["#7c7a76", "#9d9a95", "#5a5855"],
      craters: true,
    },
  },
  {
    id: "vesta",
    ko: "베스타",
    get radius() {
      return size("vesta");
    },
    orbit: "ves",
    surface: {
      type: "rocky",
      colors: ["#8d877c", "#b0a898", "#5f5a52"],
      craters: true,
    },
  },
  {
    id: "jupiter",
    ko: "목성",
    get radius() {
      return size("jupiter");
    },
    orbit: "jup",
    surface: {
      type: "gas",
      colors: ["#c9a27e", "#efe3cf", "#a2694a"],
      bands: 14,
      storm: true,
    },
    tilt: 3.1,
    spinHours: 9.9,
  },
  {
    id: "io",
    ko: "이오",
    get radius() {
      return size("io");
    },
    parent: {
      id: "jupiter",
      get distance() {
        return moonDistance("io", "jupiter");
      },
      periodDays: 1.77,
      phase: 0.0,
    },
    surface: { type: "volcanic", colors: ["#e8d36a", "#c98a2f", "#f5efc0"] },
  },
  {
    id: "europa",
    ko: "유로파",
    get radius() {
      return size("europa");
    },
    parent: {
      id: "jupiter",
      get distance() {
        return moonDistance("europa", "jupiter");
      },
      periodDays: 3.55,
      phase: 0.35,
    },
    surface: { type: "cracked", colors: ["#e9e2d4", "#b48a6a", "#f7f3ea"] },
  },
  {
    id: "ganymede",
    ko: "가니메데",
    get radius() {
      return size("ganymede");
    },
    parent: {
      id: "jupiter",
      get distance() {
        return moonDistance("ganymede", "jupiter");
      },
      periodDays: 7.15,
      phase: 0.6,
    },
    surface: {
      type: "rocky",
      colors: ["#8e8679", "#b9b1a3", "#5d574e"],
      craters: true,
    },
  },
  {
    id: "callisto",
    ko: "칼리스토",
    get radius() {
      return size("callisto");
    },
    parent: {
      id: "jupiter",
      get distance() {
        return moonDistance("callisto", "jupiter");
      },
      periodDays: 16.69,
      phase: 0.85,
    },
    surface: {
      type: "rocky",
      colors: ["#5d564c", "#7d7468", "#3c3731"],
      craters: true,
    },
  },
  {
    id: "saturn",
    ko: "토성",
    get radius() {
      return size("saturn");
    },
    orbit: "sat",
    surface: {
      type: "gas",
      colors: ["#d8c290", "#f0e2bc", "#b89a62"],
      bands: 10,
    },
    ring: { inner: 1.25, outer: 2.3, color: "#e5d3a8" },
    tilt: 26.7,
    spinHours: 10.7,
  },
  {
    id: "enceladus",
    ko: "엔켈라두스",
    get radius() {
      return size("enceladus");
    },
    parent: {
      id: "saturn",
      get distance() {
        return moonDistance("enceladus", "saturn");
      },
      periodDays: 1.37,
      phase: 0.2,
    },
    surface: { type: "ice", colors: ["#f7fbff", "#dce9f5", "#ffffff"] },
  },
  {
    id: "titan",
    ko: "타이탄",
    get radius() {
      return size("titan");
    },
    parent: {
      id: "saturn",
      get distance() {
        return moonDistance("titan", "saturn");
      },
      periodDays: 15.95,
      phase: 0.55,
    },
    surface: {
      type: "gas",
      colors: ["#d9a85a", "#e8c07a", "#b8863e"],
      bands: 2,
    },
    atmosphere: "#e0a64a",
  },
  {
    id: "uranus",
    ko: "천왕성",
    get radius() {
      return size("uranus");
    },
    orbit: "ura",
    surface: { type: "ice", colors: ["#9fd9e0", "#c4eef0", "#7cc4cf"] },
    ring: { inner: 1.5, outer: 1.75, color: "#9ab" },
    tilt: 97.8,
    spinHours: 17.2,
  },
  {
    id: "neptune",
    ko: "해왕성",
    get radius() {
      return size("neptune");
    },
    orbit: "nep",
    surface: {
      type: "gas",
      colors: ["#3d63d6", "#5f86ef", "#2a46a8"],
      bands: 5,
      storm: true,
    },
    tilt: 28.3,
    spinHours: 16.1,
  },
  {
    id: "triton",
    ko: "트리톤",
    get radius() {
      return size("triton");
    },
    parent: {
      id: "neptune",
      get distance() {
        return moonDistance("triton", "neptune");
      },
      periodDays: -5.88,
      phase: 0.4,
    },
    surface: { type: "ice", colors: ["#e7d9d3", "#c9b2a8", "#f6efe9"] },
  },
  {
    id: "pluto",
    ko: "명왕성",
    get radius() {
      return size("pluto");
    },
    orbit: "plu",
    surface: { type: "ice", colors: ["#d7bfa3", "#f1e6d6", "#8b6c55"] },
  },
];

export const BODY_BY_ID = new Map(BODIES.map((b) => [b.id, b]));

/** 위성 화면 위치를 계산할 때 쓰는 기준 시각 */
const EPOCH = Date.UTC(2000, 0, 1, 12);

/** 천체의 장면 좌표(three.js) */
export function bodyPosition(
  body: BodyDef,
  orbits: Record<string, Elements>,
  ms: number,
): Vec3 {
  if (body.id === "sun") return [0, 0, 0];
  if (body.orbit) {
    const el = orbits[body.orbit];
    if (!el) return [0, 0, 0];
    return toThree(compress(heliocentric(el, ms)));
  }
  if (body.parent) {
    const parent = BODY_BY_ID.get(body.parent.id);
    if (!parent) return [0, 0, 0];
    const [px, py, pz] = bodyPosition(parent, orbits, ms);
    const days = (ms - EPOCH) / 86_400_000;
    const ang =
      2 * Math.PI * (days / body.parent.periodDays + body.parent.phase);
    const d = body.parent.distance;
    // 모행성 적도면 대신 황도면에 살짝 기울여 둔다.
    return [
      px + d * Math.cos(ang),
      py + d * 0.08 * Math.sin(ang),
      pz + d * Math.sin(ang),
    ];
  }
  return [0, 0, 0];
}

export function halleyPosition(ms: number): Vec3 {
  return toThree(compress(halleyAt(ms)));
}

// ── 탐사선 ──────────────────────────────────────────────

export type Probe = {
  id: string;
  ko: string;
  /** 기준 시각(UTC ms) */
  epoch: number;
  /** 기준 시각의 태양 중심 황도(J2000) 위치(AU) */
  pos: Vec3;
  /** 속도(AU/일). 행성 중력에서 벗어나 거의 곧게 가므로 직선으로 늘린다. */
  vel: Vec3;
};

// 출처: NASA JPL Horizons 천문력(2026-01-01 00:00 TDB, 태양 중심, 황도 J2000, 벡터 표).
// 1년 사이 속도 변화가 0.1%도 안 되어 앞뒤 몇 년은 직선 외삽으로 충분하다.
const PROBE_EPOCH = Date.UTC(2026, 0, 1);
export const PROBES: Probe[] = [
  {
    id: "voyager1",
    ko: "보이저 1호",
    epoch: PROBE_EPOCH,
    pos: [-31.836_413_96, -134.678_484_9, 97.444_806_2],
    vel: [-1.197_151_94e-3, -7.861_077_92e-3, 5.680_005_85e-3],
  },
  {
    id: "voyager2",
    ko: "보이저 2호",
    epoch: PROBE_EPOCH,
    pos: [39.227_532_01, -103.991_549_7, -87.918_658_08],
    vel: [2.427_683_34e-3, -5.395_071_89e-3, -6.538_419_57e-3],
  },
];

export const PROBE_BY_ID = new Map(PROBES.map((p) => [p.id, p]));

/** 탐사선의 실제 위치(AU) */
export function probePositionAU(id: string, ms: number): Vec3 {
  const p = PROBE_BY_ID.get(id);
  if (!p) return [0, 0, 0];
  const days = (ms - p.epoch) / 86_400_000;
  return [0, 1, 2].map((i) => (p.pos[i] ?? 0) + (p.vel[i] ?? 0) * days) as Vec3;
}

/** 탐사선의 장면 좌표 */
export function probePosition(id: string, ms: number): Vec3 {
  return toThree(compress(probePositionAU(id, ms)));
}

/** 탐사선은 실제 크기로는 보이지 않아 이만큼으로 그린다(접시 반지름, 장면 단위). */
export const PROBE_SIZE = 0.04;

// ── 목적지 ──────────────────────────────────────────────

export type DestinationGroup =
  | "전망"
  | "태양과 행성"
  | "위성"
  | "작은 천체"
  | "혜성"
  | "탐사선"
  | "유명한 별";

export type StarTarget = {
  ra: number;
  dec: number;
  color: string;
  /** 화면 반지름 */
  radius: number;
  /** 동반성 */
  companion?: { color: string; radius: number; offset: number };
};

export type Destination = {
  id: string;
  ko: string;
  group: DestinationGroup;
  /** 한 줄 사실 */
  fact: string;
  /** 거리 한 줄(예: "8.6광년") */
  distance?: string;
  body?: string;
  /** PROBES의 id */
  probe?: string;
  star?: StarTarget;
  view?: "overview" | "inner";
};

export const DESTINATIONS: Destination[] = [
  {
    id: "overview",
    ko: "태양계 전경",
    group: "전망",
    view: "overview",
    fact: "위에서 내려다본 오늘의 행성 배치. 어떻게 줄였는지는 창 아래 '축척'에.",
  },
  {
    id: "inner",
    ko: "안쪽 행성",
    group: "전망",
    view: "inner",
    fact: "수성부터 화성, 소행성대까지. 오늘 날짜의 실제 자리.",
  },
  {
    id: "sun",
    ko: "태양",
    group: "태양과 행성",
    body: "sun",
    fact: "빛이 지구까지 오는 데 8분 20초 걸린다.",
  },
  {
    id: "mercury",
    ko: "수성",
    group: "태양과 행성",
    body: "mercury",
    fact: "하루(태양일)가 지구 날로 176일이라 1년보다 길다.",
  },
  {
    id: "venus",
    ko: "금성",
    group: "태양과 행성",
    body: "venus",
    fact: "두꺼운 구름 아래 표면은 460도. 태양계에서 가장 뜨거운 행성.",
  },
  {
    id: "earth",
    ko: "지구",
    group: "태양과 행성",
    body: "earth",
    fact: "우리 집. 지금 이 순간의 태양 방향으로 낮과 밤을 칠했다.",
  },
  {
    id: "mars",
    ko: "화성",
    group: "태양과 행성",
    body: "mars",
    fact: "올림푸스산은 높이 약 22km, 에베레스트의 두 배 반.",
  },
  {
    id: "jupiter",
    ko: "목성",
    group: "태양과 행성",
    body: "jupiter",
    fact: "대적점 폭풍 하나에 지구가 통째로 들어간다.",
  },
  {
    id: "saturn",
    ko: "토성",
    group: "태양과 행성",
    body: "saturn",
    fact: "고리의 두께는 대부분 수십 미터에 불과하다.",
  },
  {
    id: "uranus",
    ko: "천왕성",
    group: "태양과 행성",
    body: "uranus",
    fact: "자전축이 98도 누워 있어 굴러가듯 태양을 돈다.",
  },
  {
    id: "neptune",
    ko: "해왕성",
    group: "태양과 행성",
    body: "neptune",
    fact: "태양계에서 바람이 가장 빠르다. 초속 500m를 넘는다.",
  },
  {
    id: "moon",
    ko: "달",
    group: "위성",
    body: "moon",
    fact: "늘 같은 면만 지구를 본다. 해마다 3.8cm씩 멀어진다.",
  },
  {
    id: "phobos",
    ko: "포보스",
    group: "위성",
    body: "phobos",
    fact: "화성을 하루에 세 번 돈다. 언젠가 부서져 고리가 될 것으로 본다.",
  },
  {
    id: "io",
    ko: "이오",
    group: "위성",
    body: "io",
    fact: "태양계에서 화산 활동이 가장 활발한 천체.",
  },
  {
    id: "europa",
    ko: "유로파",
    group: "위성",
    body: "europa",
    fact: "얼음 껍질 아래 지구 바다보다 많은 물이 있을 것으로 본다.",
  },
  {
    id: "ganymede",
    ko: "가니메데",
    group: "위성",
    body: "ganymede",
    fact: "태양계에서 가장 큰 위성. 수성보다 크다.",
  },
  {
    id: "titan",
    ko: "타이탄",
    group: "위성",
    body: "titan",
    fact: "짙은 대기와 메탄 호수가 있는 위성.",
  },
  {
    id: "enceladus",
    ko: "엔켈라두스",
    group: "위성",
    body: "enceladus",
    fact: "남극에서 얼음 물줄기를 우주로 뿜어 올린다.",
  },
  {
    id: "triton",
    ko: "트리톤",
    group: "위성",
    body: "triton",
    fact: "모행성의 자전과 반대 방향으로 도는 큰 위성.",
  },
  {
    id: "ceres",
    ko: "세레스",
    group: "작은 천체",
    body: "ceres",
    fact: "소행성대에서 가장 큰 천체이자 왜소행성.",
  },
  {
    id: "vesta",
    ko: "베스타",
    group: "작은 천체",
    body: "vesta",
    fact: "남극에 산 높이 약 20km의 거대한 충돌 흔적이 있다.",
  },
  {
    id: "pluto",
    ko: "명왕성",
    group: "작은 천체",
    body: "pluto",
    fact: "하트 모양 얼음 평원(톰보 지역)이 있다.",
  },
  {
    id: "halley",
    ko: "핼리 혜성",
    group: "혜성",
    fact: "76년마다 돌아온다. 1986년 근일점 무렵의 모습. 다음은 2061년.",
  },
  {
    id: "voyager1",
    ko: "보이저 1호",
    group: "탐사선",
    probe: "voyager1",
    fact: "1977년에 떠나 2012년 태양권을 벗어났다. 사람이 만든 것 가운데 가장 멀리 간 물체. 화면에서는 아주 크게 그렸다.",
  },
  {
    id: "voyager2",
    ko: "보이저 2호",
    group: "탐사선",
    probe: "voyager2",
    fact: "목성·토성·천왕성·해왕성을 모두 지나간 유일한 탐사선. 2018년 성간 공간에 들어섰다. 화면에서는 아주 크게 그렸다.",
  },
  {
    id: "alpha-cen",
    ko: "알파 센타우리",
    group: "유명한 별",
    distance: "4.37광년",
    fact: "태양과 가장 가까운 별 무리. 노란 별 둘이 서로 돈다.",
    star: {
      ra: 219.9,
      dec: -60.83,
      color: "#fff1c9",
      radius: 2.4,
      companion: { color: "#ffd9a0", radius: 1.8, offset: 9 },
    },
  },
  {
    id: "sirius",
    ko: "시리우스",
    group: "유명한 별",
    distance: "8.6광년",
    fact: "밤하늘에서 가장 밝은 별. 곁에 작은 백색왜성이 있다.",
    star: {
      ra: 101.29,
      dec: -16.72,
      color: "#cfe0ff",
      radius: 3.2,
      companion: { color: "#ffffff", radius: 0.5, offset: 7 },
    },
  },
  {
    id: "vega",
    ko: "베가",
    group: "유명한 별",
    distance: "25광년",
    fact: "직녀성. 약 1만 2천 년 뒤에는 북극성 자리에 가까워진다.",
    star: { ra: 279.23, dec: 38.78, color: "#dfe8ff", radius: 3.4 },
  },
  {
    id: "polaris",
    ko: "북극성",
    group: "유명한 별",
    distance: "약 430광년",
    fact: "지구 자전축이 거의 가리키는 별. 사실은 세 별의 무리.",
    star: { ra: 37.95, dec: 89.26, color: "#fff4d6", radius: 5 },
  },
  {
    id: "betelgeuse",
    ko: "베텔게우스",
    group: "유명한 별",
    distance: "약 550광년",
    fact: "오리온의 어깨. 태양 자리에 두면 화성 궤도를 넘어 소행성대까지 차는 붉은 초거성.",
    star: { ra: 88.79, dec: 7.41, color: "#ff9a5c", radius: 14 },
  },
  {
    id: "antares",
    ko: "안타레스",
    group: "유명한 별",
    distance: "약 550광년",
    fact: "전갈의 심장. 이름은 '화성의 맞수'라는 뜻.",
    star: { ra: 247.35, dec: -26.43, color: "#ff8a5c", radius: 11 },
  },
];

export const DESTINATION_BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d]));
