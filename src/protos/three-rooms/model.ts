// 스냅샷을 "세 방"으로 나눈다. 어느 방에 있느냐가 곧 상태다.
// - 작업실: 일하는 선원
// - 대기실: 나를 기다리는 것들이 줄을 선다. 줄 순서 = 할 일 순서(서버가 급한 순으로 정렬, 같은 종류면 오래 기다린 순).
//   줄 맨 앞이 곧 "지금 할 일"이다.
// - 휴게실: 쉬는 선원(소파), 자리 비운 선원(흐리게)
import type { Crew, Task } from "@/protocol/v1";
import { isHail } from "@/ui/kit";

export type Room = "work" | "wait" | "lounge";

export const ROOM_LABEL: Record<Room, string> = {
  work: "작업실",
  wait: "대기실",
  lounge: "휴게실",
};

export const ROOM_HINT: Record<Room, string> = {
  work: "일하는 선원",
  wait: "나를 기다림",
  lounge: "쉼 · 자리 비움",
};

/** 줄에 선 하나. 선원이거나, 다른 배에서 온 방문객이거나, 배의 알림 로봇이다. */
export type QueueEntry =
  | { who: "crew"; key: string; crew: Crew; task?: Task; extra: number }
  | { who: "visitor"; key: string; task: Task }
  | { who: "robot"; key: string; task: Task };

export type RoomsModel = {
  queue: QueueEntry[];
  work: Crew[];
  lounge: Crew[];
};

export function buildRooms(tasks: Task[], crew: Crew[]): RoomsModel {
  const crewById = new Map(crew.map((c) => [c.id, c]));
  const queue: QueueEntry[] = [];
  const inQueue = new Map<string, QueueEntry & { who: "crew" }>();
  for (const t of tasks) {
    if (isHail(t)) {
      queue.push({ who: "visitor", key: `v-${t.id}`, task: t });
      continue;
    }
    const c = t.crewId ? crewById.get(t.crewId) : undefined;
    if (!c) {
      queue.push({ who: "robot", key: `r-${t.id}`, task: t });
      continue;
    }
    const already = inQueue.get(c.id);
    if (already) {
      already.extra += 1;
      continue;
    }
    const entry = {
      who: "crew" as const,
      key: c.id,
      crew: c,
      task: t,
      extra: 0,
    };
    inQueue.set(c.id, entry);
    queue.push(entry);
  }
  // 할 일은 없지만 나를 기다린다고 알려 온 선원은 줄 끝에
  for (const c of crew) {
    if (c.status === "needs-you" && !inQueue.has(c.id)) {
      const entry = { who: "crew" as const, key: c.id, crew: c, extra: 0 };
      inQueue.set(c.id, entry);
      queue.push(entry);
    }
  }
  const work: Crew[] = [];
  const lounge: Crew[] = [];
  for (const c of crew) {
    if (inQueue.has(c.id)) continue;
    if (c.status === "working" || c.status === "needs-you") work.push(c);
    else lounge.push(c);
  }
  // 휴게실: 쉬는 선원 먼저, 자리 비움은 뒤로
  lounge.sort(
    (a, b) => Number(a.status === "off") - Number(b.status === "off"),
  );
  return { queue, work, lounge };
}

/** 줄에 선 것이 누구인지 한 줄로 */
export function entryName(e: QueueEntry): string {
  if (e.who === "crew") return e.crew.name;
  return e.task.from;
}

export function entryTask(e: QueueEntry): Task | undefined {
  return e.task;
}
