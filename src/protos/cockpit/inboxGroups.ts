// 조종석 결재함: 내 차례(할 일)를 승무원별로 묶는다. 맥락이 같은 것끼리 한 번에 처리하려고(2026-11-02 사용자 결정).
// 화면은 Inbox.tsx. 설계: docs/cockpit-inbox.md.
import type { Crew, Task } from "@/protocol/v1";

/** 승무원 없이 온 일(감시·알림·리뷰 등)을 모으는 묶음 열쇠 */
export const LOOSE_KEY = "__loose__";

/** 이만큼 넘게 기다린 일은 "묵음"으로 표시한다 */
export const STALE_MS = 48 * 3600_000;

export type InboxGroup = {
  /** 승무원 id, 승무원이 없으면 LOOSE_KEY */
  key: string;
  crew?: Crew;
  /** 본부가 준 순서(우선순위) 그대로 */
  tasks: Task[];
  /** 가장 오래 기다린 일의 시작 시각 */
  oldest: number;
  /** STALE_MS 넘게 기다린 일 수 */
  stale: number;
};

/**
 * 할 일을 승무원별로 묶는다. 묶음 순서: 가장 오래 기다린 일이 있는 승무원부터, 승무원 없는 일은 맨 뒤.
 * 승무원 목록에 없는 crewId도 그 id로 묶는다(이름은 id로 보인다).
 */
export function inboxGroups(
  tasks: readonly Task[],
  crewById: ReadonlyMap<string, Crew>,
  now: number,
): InboxGroup[] {
  const by = new Map<string, InboxGroup>();
  for (const t of tasks) {
    const key = t.crewId ?? LOOSE_KEY;
    let g = by.get(key);
    if (!g) {
      g = {
        key,
        crew: t.crewId ? crewById.get(t.crewId) : undefined,
        tasks: [],
        oldest: t.since,
        stale: 0,
      };
      by.set(key, g);
    }
    g.tasks.push(t);
    g.oldest = Math.min(g.oldest, t.since);
    if (now - t.since > STALE_MS) g.stale++;
  }
  return [...by.values()].sort(
    (a, b) =>
      Number(a.key === LOOSE_KEY) - Number(b.key === LOOSE_KEY) ||
      a.oldest - b.oldest,
  );
}

/** 고른 묶음이 사라졌으면(다 처리했으면) 첫 묶음으로 */
export function pickGroup(
  groups: readonly InboxGroup[],
  selected: string | null,
): InboxGroup | undefined {
  return groups.find((g) => g.key === selected) ?? groups[0];
}
