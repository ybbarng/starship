// 본부가 준 스냅숏에서 같은 id가 겹친 승무원·할 일·교신을 하나로 합친다(2026-11-03).
// 본부가 같은 승무원을 꺼진 것(off)과 일하는 것으로 두 번 보낸 일이 있었다. 그러면 결재함에 같은 서류가 두 장 생기고,
// React key가 겹쳐 처리한 서류가 새로 고칠 때까지 화면에 남았다. 원인은 본부에서 고치고, 화면은 여기서 막는다.
// 책상의 답해 둔 것(answers)도 id를 React key로 쓰니 같은 까닭으로 합친다.
import type { Desk } from "@/protocol/desk";
import type { Snapshot } from "@/protocol/v1";

type Crew = Snapshot["crew"][number];

/** 같은 id의 승무원 둘 중 남길 것: 꺼지지 않은 쪽, 둘 다 같으면 뒤에 온 쪽 */
function better(a: Crew, b: Crew): Crew {
  if (a.status === "off" && b.status !== "off") return b;
  if (b.status === "off" && a.status !== "off") return a;
  return b;
}

/** id마다 처음 것만 남긴다 */
function firstById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

/**
 * 승무원은 id마다 하나(처음 나온 자리에), 할 일·교신도 id마다 하나(처음 것)만 남긴다.
 * 겹침이 없으면 그대로 돌려준다.
 */
export function dedupeSnapshot(snap: Snapshot): Snapshot {
  const crew = new Map<string, Crew>();
  for (const c of snap.crew) {
    const prev = crew.get(c.id);
    crew.set(c.id, prev ? better(prev, c) : c);
  }
  const tasks = firstById(snap.tasks);
  const hails = firstById(snap.hails);
  if (
    crew.size === snap.crew.length &&
    tasks.length === snap.tasks.length &&
    hails.length === snap.hails.length
  )
    return snap;
  return { ...snap, crew: [...crew.values()], tasks, hails };
}

/**
 * 책상의 답해 둔 것을 id마다 하나로. 세션이 같은 답을 고쳐 다시 적었을 수 있으니
 * 답한 때(at)가 늦은 쪽을 처음 나온 자리에 남긴다. 겹침이 없으면 그대로 돌려준다.
 */
export function dedupeDesk(desk: Desk): Desk {
  const list = desk.answers;
  if (!list) return desk;
  const byId = new Map<string, NonNullable<Desk["answers"]>[number]>();
  for (const a of list) {
    const prev = byId.get(a.id);
    byId.set(a.id, prev && Date.parse(prev.at) > Date.parse(a.at) ? prev : a);
  }
  if (byId.size === list.length) return desk;
  return { ...desk, answers: [...byId.values()] };
}
