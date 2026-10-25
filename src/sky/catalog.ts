// public/sky/sky.json(별·이름·별자리·궤도 요소)을 한 번만 읽어 둔다.
import type { Elements } from "./astro";

export type SkyCatalog = {
  /** [적경, 적위, 등급, B-V] */
  stars: [number, number, number, number][];
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
  }[];
  orbits: Record<string, Elements>;
};

let cache: Promise<SkyCatalog> | null = null;

export function loadCatalog(): Promise<SkyCatalog> {
  cache ??= fetch("/sky/sky.json").then((r) => {
    if (!r.ok) throw new Error(`sky.json ${r.status}`);
    return r.json() as Promise<SkyCatalog>;
  });
  return cache;
}
