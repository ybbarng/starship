// 땅 장식을 어디에 몇 개 놓을지 정하는 순수 함수(그림은 FrontierView의 CellDecor·Rig·Crane).
// 설계: docs/frontier.md "땅 모습".

/** 칸 좌표로 정하는 작은 씨앗. 같은 칸은 늘 같은 모습(고랑 기울기·흙더미·말뚝)이다 */
export function cellSeed(q: number, r: number): number {
  return ((q * 73_856_093) ^ (r * 19_349_663)) >>> 0;
}

/** 공사 장비 수: 3칸마다 하나, 적어도 하나 */
export function rigCount(cells: number): number {
  return Math.max(1, Math.floor(cells / 3));
}

/** 이 칸 수 이상인 공사 땅에는 장비 하나를 크레인으로 세운다 */
export const CRANE_CELLS = 6;

/** list에서 n개를 고르게 띄워 고른다(앞에서부터, 차례 그대로). n이 길이보다 크면 전부 */
export function spread<T>(list: readonly T[], n: number): T[] {
  if (n <= 0 || list.length === 0) return [];
  if (n >= list.length) return [...list];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const x = list[Math.floor((i * list.length) / n)];
    if (x !== undefined) out.push(x);
  }
  return out;
}

/** 공사 칸 한 칸의 장식: 고랑 수(2~3), 기울기(도), 흙더미·말뚝을 둘지 */
export function dugOf(seed: number): {
  furrows: 2 | 3;
  tilt: number;
  mound: boolean;
  stake: boolean;
} {
  return {
    furrows: seed % 2 === 0 ? 3 : 2,
    tilt: ((seed >>> 3) % 3) * 6 - 6,
    mound: (seed >>> 5) % 2 === 0,
    stake: (seed >>> 7) % 3 === 0,
  };
}
