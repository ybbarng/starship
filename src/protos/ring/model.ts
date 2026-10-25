// 고리 칸 배치 계산. 조종석의 작은 고리 표시기와 전경의 큰 고리가 같은 규칙을 쓴다.
// 각도는 화면 좌표(y 아래쪽) 기준: π/2가 화면 아래 한가운데(내게 가장 가까운 자리).
import type { Crew, Task } from "@/protocol/v1";

export type Pod = {
  key: string;
  crew?: Crew;
  /** 나를 기다리는 순서(0 = 가장 오래). 기다리지 않으면 undefined */
  rank?: number;
  /** 가장 오래 기다린 할 일 */
  top?: Task;
  /** 기다리기 시작한 때 */
  waitSince?: number;
};

export type RingPlan = {
  slots: number;
  waiting: Pod[];
  free: Pod[];
  /** 한 칸의 각도 */
  step: number;
  /** 기다리는 칸 rank → 아래 한가운데에서 몇 칸 떨어졌나 */
  waitOffset: (rank: number) => number;
  /** 나머지 칸이 도는 호의 시작 각도와 길이 */
  arcStart: number;
  arcLength: number;
};

export const BOTTOM = Math.PI / 2;
export const MIN_SLOTS = 24;

/** 0, -1, +1, -2, +2 … (가장 오래 기다린 칸이 한가운데, 다음은 오른쪽·왼쪽 번갈아) */
function centerOut(rank: number): number {
  if (rank === 0) return 0;
  const k = Math.ceil(rank / 2);
  return rank % 2 === 1 ? -k : k;
}

export function planRing(
  crew: Crew[],
  tasksByCrew: Map<string, Task[]>,
): RingPlan {
  const slots = Math.max(MIN_SLOTS, crew.length);
  const step = (Math.PI * 2) / slots;

  const waiting: Pod[] = crew
    .filter((c) => c.status === "needs-you")
    .map((c) => {
      const tasks = tasksByCrew.get(c.id) ?? [];
      const top = [...tasks].sort((a, b) => a.since - b.since)[0];
      return {
        key: c.id,
        crew: c,
        top,
        waitSince: top?.since ?? c.since ?? Date.now(),
      };
    })
    .sort((a, b) => (a.waitSince ?? 0) - (b.waitSince ?? 0))
    .map((p, i) => ({ ...p, rank: i }));

  const rest = crew.filter((c) => c.status !== "needs-you");
  const empties = slots - crew.length;
  // 빈 칸을 고르게 섞는다(한쪽에 몰리지 않게)
  const free: Pod[] = [];
  const total = rest.length + empties;
  let placedEmpty = 0;
  let ri = 0;
  for (let i = 0; i < total; i++) {
    const wantEmpty = Math.round(((i + 1) * empties) / total) > placedEmpty;
    if ((wantEmpty && placedEmpty < empties) || ri >= rest.length) {
      free.push({ key: `empty-${placedEmpty}` });
      placedEmpty++;
    } else {
      const c = rest[ri++] as Crew;
      free.push({ key: c.id, crew: c, top: tasksByCrew.get(c.id)?.[0] });
    }
  }

  const offsets = waiting.map((_, r) => centerOut(r));
  const kmin = Math.min(0, ...offsets);
  const kmax = Math.max(0, ...offsets);
  const W = waiting.length;
  const arcStart = W ? BOTTOM + (kmax + 1) * step : BOTTOM;
  const arcLength = W ? Math.PI * 2 - (kmax - kmin + 2) * step : Math.PI * 2;

  return {
    slots,
    waiting,
    free,
    step,
    waitOffset: centerOut,
    arcStart,
    arcLength,
  };
}

/** 나머지 칸 i의 호 위 위치(0..arcLength), phase만큼 돌아간 상태 */
export function freeU(plan: RingPlan, i: number, phase: number): number {
  const M = plan.free.length || 1;
  const spacing = plan.arcLength / M;
  const u = (i + 0.5) * spacing + phase;
  return ((u % plan.arcLength) + plan.arcLength) % plan.arcLength;
}

export function waitAngle(plan: RingPlan, rank: number): number {
  return BOTTOM + plan.waitOffset(rank) * plan.step;
}

export function wrapAngle(a: number): number {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x <= -Math.PI) x += Math.PI * 2;
  return x;
}
