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
  /** 책상에 답해 둔 것(안 읽은 답) 수. 결재는 아니지만 놓치지 않게 목차에 둔다 */
  answers: number;
};

/**
 * 결재가 아닌 소식: 세션이 차례를 마칠 때마다 본부가 마지막 답변으로 만드는 것(reply).
 * 사용자가 그 세션에 다음 말을 입력해야 풀려서, 터미널에서 읽고 둔 대화가 결재처럼 남았다(2026-11-02 사용자 지적).
 * 진짜 기다림은 세션이 책상에 적는다.
 */
export function isNews(t: Task): boolean {
  return t.kind === "reply";
}

/** 승무원마다 마지막 답변(소식) 하나. 결재 서류 맨 아래에 접어 둔다. */
export function lastReplies(tasks: readonly Task[]): Map<string, Task> {
  const by = new Map<string, Task>();
  for (const t of tasks) {
    if (!isNews(t) || !t.crewId) continue;
    const prev = by.get(t.crewId);
    if (!prev || t.since > prev.since) by.set(t.crewId, t);
  }
  return by;
}

/**
 * 할 일을 승무원별로 묶는다. 소식(isNews)은 빼고 결재만. 묶음 순서: 가장 오래 기다린 일이 있는 승무원부터,
 * 그다음 답해 둔 것만 있는 승무원(crew.desk.answers), 승무원 없는 일은 맨 뒤.
 * 승무원 목록에 없는 crewId도 그 id로 묶는다(이름은 id로 보인다).
 */
export function inboxGroups(
  tasks: readonly Task[],
  crewById: ReadonlyMap<string, Crew>,
  now: number,
): InboxGroup[] {
  const by = new Map<string, InboxGroup>();
  for (const t of tasks) {
    if (isNews(t)) continue;
    const key = t.crewId ?? LOOSE_KEY;
    let g = by.get(key);
    if (!g) {
      g = {
        key,
        crew: t.crewId ? crewById.get(t.crewId) : undefined,
        tasks: [],
        oldest: t.since,
        stale: 0,
        answers: 0,
      };
      by.set(key, g);
    }
    g.tasks.push(t);
    g.oldest = Math.min(g.oldest, t.since);
    if (now - t.since > STALE_MS) g.stale++;
  }
  // 결재는 없고 답해 둔 것만 있는 승무원도 묶음으로(결재 묶음 뒤, 새 일 앞)
  for (const c of crewById.values()) {
    const n = c.desk?.answers ?? 0;
    if (!n) continue;
    const g = by.get(c.id);
    if (g) g.answers = n;
    else
      by.set(c.id, {
        key: c.id,
        crew: c,
        tasks: [],
        oldest: now,
        stale: 0,
        answers: n,
      });
  }
  const rank = (g: InboxGroup) =>
    g.key === LOOSE_KEY ? 2 : g.tasks.length ? 0 : 1;
  return [...by.values()].sort(
    (a, b) => rank(a) - rank(b) || a.oldest - b.oldest,
  );
}

/** 고른 묶음이 사라졌으면(다 처리했으면) 첫 묶음으로 */
export function pickGroup(
  groups: readonly InboxGroup[],
  selected: string | null,
): InboxGroup | undefined {
  return groups.find((g) => g.key === selected) ?? groups[0];
}

/* ───────────── 코드 리뷰 칸(2026-11-03 사용자 결정) ───────────── */

/** 코드 리뷰가 이만큼 넘게 기다리면 리뷰 칸 머리를 경고 색으로, 경고등에 한 줄 */
export const REVIEW_LATE_MS = 12 * 3600_000;

/** 리뷰 칸에서 고른 서류 하나의 묶음 열쇠 앞머리. 뒤에 Task id가 붙는다 */
export const REVIEW_PREFIX = "review:";

/** 코드 리뷰 칸에 들어갈 결재: 출처가 코드 리뷰이고 소식이 아닌 것(승무원 상관없이) */
export function isCodeReview(t: Task): boolean {
  return t.source.kind === "review" && !isNews(t);
}

export type ReviewLane = {
  /** 오래 기다린 것부터 */
  tasks: Task[];
  /** REVIEW_LATE_MS 넘게 기다린 리뷰 수 */
  late: number;
};

/**
 * 결재함 맨 위 "코드 리뷰" 칸. 같은 할 일이 아래 승무원 묶음에도 그대로 있으니 건수에 더하지 않는다.
 * 사용자가 리뷰를 다른 결재 사이에서 계속 놓쳐서 따로 모은다(docs/cockpit-inbox.md).
 */
export function reviewLane(tasks: readonly Task[], now: number): ReviewLane {
  const list = tasks.filter(isCodeReview).sort((a, b) => a.since - b.since);
  return {
    tasks: list,
    late: list.filter((t) => now - t.since > REVIEW_LATE_MS).length,
  };
}

/** 리뷰 칸에서 고른 서류 하나를 묶음처럼 연다. 고른 것이 리뷰 줄이 아니거나 처리해서 사라졌으면 undefined */
export function pickReview(
  lane: ReviewLane,
  selected: string | null,
  crewById: ReadonlyMap<string, Crew>,
  now: number,
): InboxGroup | undefined {
  if (!selected?.startsWith(REVIEW_PREFIX)) return undefined;
  const id = selected.slice(REVIEW_PREFIX.length);
  const t = lane.tasks.find((x) => x.id === id);
  if (!t) return undefined;
  return {
    key: selected,
    crew: t.crewId ? crewById.get(t.crewId) : undefined,
    tasks: [t],
    oldest: t.since,
    stale: now - t.since > STALE_MS ? 1 : 0,
    answers: 0,
  };
}

/* ───────────── 고른 것 이어 가기(2026-11-03) ───────────── */

/** 목차 위에서 아래로 늘어선 열쇠: 리뷰 칸 줄(REVIEW_PREFIX + id) 다음 승무원 묶음. [ ] 키도 이 순서로 옮긴다 */
export function inboxOrder(
  lane: ReviewLane,
  groups: readonly InboxGroup[],
): string[] {
  return [
    ...lane.tasks.map((t) => `${REVIEW_PREFIX}${t.id}`),
    ...groups.map((g) => g.key),
  ];
}

/**
 * 고른 열쇠가 목록에서 사라졌을 때(다 처리했을 때) 이어서 볼 열쇠.
 * 고른 것이 아직 있으면 그대로, 고른 것이 없으면(null) 그대로 null(첫 묶음).
 * - 리뷰 줄이 사라지면 리뷰 칸에서 그다음 줄, 없으면 첫 승무원 묶음
 * - 승무원 묶음이 사라지면 같은 자리(지난 순서에서 뒤에 있던 것), 없으면 앞 묶음
 * - 지난 순서에도 없던 열쇠(승무원 정보에서 결재 없는 승무원을 고른 것 등)는 첫 묶음으로 바꾼다.
 *   옛 열쇠가 남아 있으면 그 승무원에게 결재가 오는 순간 저절로 다시 열렸다.
 * 묶음이 하나도 없으면 null.
 */
export function repick(
  prev: readonly string[],
  next: readonly string[],
  picked: string | null,
): string | null {
  if (picked === null || next.includes(picked)) return picked;
  const has = new Set(next);
  const isReview = (k: string) => k.startsWith(REVIEW_PREFIX);
  const firstGroup = next.find((k) => !isReview(k)) ?? next[0] ?? null;
  const i = prev.indexOf(picked);
  if (i < 0) return firstGroup;
  if (isReview(picked)) {
    const after = prev.slice(i + 1).find((k) => isReview(k) && has.has(k));
    return after ?? firstGroup;
  }
  const after = prev.slice(i + 1).find((k) => !isReview(k) && has.has(k));
  if (after) return after;
  const before = prev
    .slice(0, i)
    .reverse()
    .find((k) => !isReview(k) && has.has(k));
  return before ?? firstGroup;
}

/** [ ] 키: 목차 순서에서 지금 것의 앞(-1)·뒤(+1). 끝에서는 멈춘다. 지금 것이 없으면 맨 앞 */
export function stepKey(
  order: readonly string[],
  current: string | undefined,
  d: -1 | 1,
): string | undefined {
  if (!order.length) return undefined;
  const i = current === undefined ? -1 : order.indexOf(current);
  if (i < 0) return order[0];
  return order[Math.max(0, Math.min(order.length - 1, i + d))];
}
