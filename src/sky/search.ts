// 목적지 찾기: 한국어·영어 이름으로 행성·위성·탐사선·별을 찾는다(항법 창 검색 칸).
import type { Destination, DestinationGroup } from "./bodies";

/** 대소문자·공백·붙임표·따옴표·가운뎃점을 지운다. "Voyager 1" = "voyager1", "알파 센타우리" = "알파센타우리" */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-'’·.()]/g, "");
}

/** 같은 점수면 이 무리 순서로(행성이 별보다 먼저) */
const GROUP_ORDER: DestinationGroup[] = [
  "태양과 행성",
  "위성",
  "작은 천체",
  "혜성",
  "탐사선",
  "유명한 별",
  "이름 있는 별",
  "전망",
];

/**
 * 이름이 검색어와 같으면 0, 검색어로 시작하면 1, 영어 낱말 가운데 하나가 검색어로 시작하면 2, 어딘가에 들어 있으면 3.
 * 안 맞으면 null.
 */
function score(d: Destination, q: string): number | null {
  let best: number | null = null;
  const take = (n: number) => {
    if (best === null || n < best) best = n;
  };
  for (const name of [d.ko, d.en]) {
    if (!name) continue;
    const n = normalizeName(name);
    if (n === q) take(0);
    else if (n.startsWith(q)) take(1);
    else if (
      name
        .split(/[\s-]+/)
        .some((w) => w.length > 1 && normalizeName(w).startsWith(q))
    )
      take(2);
    else if (n.includes(q)) take(3);
  }
  return best;
}

export function searchDestinations(
  query: string,
  list: readonly Destination[],
  limit = 8,
): Destination[] {
  const q = normalizeName(query);
  if (!q) return [];
  return list
    .map((d, i) => ({ d, i, s: score(d, q) }))
    .filter((x): x is { d: Destination; i: number; s: number } => x.s !== null)
    .sort(
      (a, b) =>
        a.s - b.s ||
        GROUP_ORDER.indexOf(a.d.group) - GROUP_ORDER.indexOf(b.d.group) ||
        a.i - b.i,
    )
    .slice(0, limit)
    .map((x) => x.d);
}
