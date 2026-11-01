// public/sky/sky.json(별·거리·이름·별자리·궤도 요소)과 faint.json(6~8등급 별)을 한 번만 읽어 둔다.
// 형식은 scripts/build-sky.mjs가 만들고, 뜻은 docs/sky-3d.md에 적었다.
import type { Elements } from "./astro";

/** [적경, 적위, 지구에서 본 등급, B-V, HIP, 시차(mas), 시차 오차(mas)]. 시차가 없으면 0, 0. */
export type StarRow = [number, number, number, number, number, number, number];

export type SkyCatalog = {
  version?: number;
  /** 맨눈 별(6등급까지)과 별자리 꼭짓점인 흐린 별. 밝은 순. */
  stars: StarRow[];
  named: {
    hip: number;
    ra: number;
    dec: number;
    mag: number;
    en: string;
    ko: string;
    con: string;
  }[];
  constellations: {
    id: string;
    en: string;
    ko: string;
    rank: number;
    label: [number, number];
    lines: [number, number][][];
    /** lines와 같은 모양. 꼭짓점마다 맞춘 별의 HIP, 못 맞추면 0. */
    hips?: number[][];
  }[];
  orbits: Record<string, Elements>;
};

/** 6~8등급 별. 평평한 배열 [적경, 적위, 등급, B-V, …] */
export type FaintCatalog = { stars: number[] };

let cache: Promise<SkyCatalog> | null = null;
let faintCache: Promise<FaintCatalog> | null = null;

export function loadCatalog(): Promise<SkyCatalog> {
  cache ??= fetch("/sky/sky.json").then((r) => {
    if (!r.ok) throw new Error(`sky.json ${r.status}`);
    return r.json() as Promise<SkyCatalog>;
  });
  return cache;
}

/** 흐린 별은 첫 화면 뒤에 따로 받는다. */
export function loadFaint(): Promise<FaintCatalog> {
  faintCache ??= fetch("/sky/faint.json").then((r) => {
    if (!r.ok) throw new Error(`faint.json ${r.status}`);
    return r.json() as Promise<FaintCatalog>;
  });
  return faintCache;
}
