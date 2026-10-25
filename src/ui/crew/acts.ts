// 동물 선원의 "짧은 동작" 목록과 일정.
// 뜻이 있는 동작(부름)은 모든 동물이 같고 세기만 다르다.
// 뜻이 없는 동작(일함·쉼·서 있기)은 동물마다 성격대로 섞고, 순서·간격은 이름 씨앗으로 정한다.

export type AnimalKindName =
  | "cat"
  | "dog"
  | "otter"
  | "penguin"
  | "owl"
  | "rabbit"
  | "fox"
  | "bear"
  | "hamster"
  | "raccoon";

type PoseName = "work" | "wave" | "sleep" | "walk" | "stand" | "off";

/** 자세마다 쓸 수 있는 동작. 확인판에서 하나씩 되풀이해 볼 때도 쓴다. */
export const ACTS = {
  work: ["look", "chin", "sip", "stretch", "yawn", "ear"],
  sleep: ["nodoff", "toss", "peek", "ear", "tail"],
  stand: ["glance", "tilt", "ear", "tail"],
  wave: ["tilt", "raise", "beckon", "hop"],
  walk: [],
  off: [],
} as const satisfies Record<PoseName, readonly string[]>;

export type Act = (typeof ACTS)[keyof typeof ACTS][number];

const DURATION: Record<Act, number> = {
  look: 2800,
  chin: 5200,
  sip: 4400,
  stretch: 3000,
  yawn: 2600,
  ear: 900,
  nodoff: 3400,
  toss: 3600,
  peek: 2200,
  tail: 1600,
  glance: 2600,
  tilt: 2600,
  raise: 2600,
  beckon: 2400,
  hop: 1800,
};

/** 성격: 동물마다 즐겨 하는 동작에 무게를 더 준다. */
const LIKES: Record<AnimalKindName, Partial<Record<Act, number>>> = {
  cat: { stretch: 3, ear: 2, yawn: 1.5, toss: 2 },
  dog: { look: 2, tail: 3, tilt: 2 },
  otter: { sip: 3, toss: 2 },
  penguin: { look: 2, glance: 2 },
  owl: { look: 3, chin: 2, peek: 3, tilt: 2 },
  rabbit: { ear: 3, glance: 2 },
  fox: { ear: 2, chin: 2, tail: 2 },
  bear: { sip: 3, yawn: 2.5, nodoff: 2 },
  hamster: { sip: 2, ear: 2, nodoff: 2 },
  raccoon: { chin: 2.5, look: 2, tail: 2 },
};

export interface Traits {
  kind: AnimalKindName;
  hasEars: boolean;
  hasTail: boolean;
  furniture: boolean;
}

/** 이름 씨앗 → 32비트 정수 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 씨앗이 같으면 늘 같은 순서를 내는 의사 난수(mulberry32). */
export function makeRandom(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function usable(act: Act, t: Traits): boolean {
  if (act === "ear") return t.hasEars;
  if (act === "tail") return t.hasTail;
  if (act === "sip") return t.furniture;
  return true;
}

/** 부름의 세기에 따른 동작 무게. 덜 급하면 갸웃, 급하면 손짓과 깡충. */
function callWeight(act: Act, u: number): number {
  switch (act) {
    case "tilt":
      return (1 - u) * 3;
    case "raise":
      return (1 - Math.abs(u - 0.45) * 2) * 2.5 + 0.2;
    case "beckon":
      return u * 4;
    case "hop":
      return Math.max(0, u - 0.6) * 9;
    default:
      return 0;
  }
}

export interface Plan {
  act: Act;
  ms: number;
}

export function pickAct(
  pose: PoseName,
  t: Traits,
  u: number,
  rnd: () => number,
  last: Act | null,
): Plan | null {
  const pool = (ACTS[pose] as readonly Act[]).filter((a) => usable(a, t));
  if (pool.length === 0) return null;
  const weights = pool.map((a) => {
    const w = pose === "wave" ? callWeight(a, u) : (LIKES[t.kind][a] ?? 1) * 1;
    // 같은 동작이 연달아 나오면 덜 자연스럽다.
    return a === last && pool.length > 1 ? w * 0.25 : w;
  });
  const sum = weights.reduce((x, y) => x + y, 0);
  let r = rnd() * sum;
  let act = pool[pool.length - 1] as Act;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) {
      act = pool[i] as Act;
      break;
    }
  }
  let ms = DURATION[act];
  if (pose === "wave" && (act === "beckon" || act === "hop")) {
    ms *= lerp(1.15, 0.8, u);
  }
  return { act, ms: Math.round(ms) };
}

export function durationOf(act: Act): number {
  return DURATION[act];
}

/** 동작 사이 쉬는 시간(ms). 부름은 급할수록 짧다. */
export function gapFor(
  pose: PoseName,
  u: number,
  tempo: number,
  rnd: () => number,
): number {
  const jitter = 0.6 + rnd() * 0.8;
  switch (pose) {
    case "wave":
      return lerp(4200, 350, u) * jitter;
    case "work":
      return lerp(2600, 8500, rnd()) * tempo;
    case "sleep":
      return lerp(3500, 10000, rnd()) * tempo;
    default:
      return lerp(2500, 7000, rnd()) * tempo;
  }
}
