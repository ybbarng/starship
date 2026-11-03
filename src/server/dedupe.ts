// 본부가 준 스냅숏에서 같은 id가 겹친 승무원·할 일을 하나로 합친다(2026-11-03).
// 본부가 같은 승무원을 꺼진 것(off)과 일하는 것으로 두 번 보낸 일이 있었다. 그러면 결재함에 같은 서류가 두 장 생기고,
// React key가 겹쳐 처리한 서류가 새로 고칠 때까지 화면에 남았다. 원인은 본부에서 고치고, 화면은 여기서 막는다.
import type { Snapshot } from "@/protocol/v1";

type Crew = Snapshot["crew"][number];

/** 같은 id의 승무원 둘 중 남길 것: 꺼지지 않은 쪽, 둘 다 같으면 뒤에 온 쪽 */
function better(a: Crew, b: Crew): Crew {
  if (a.status === "off" && b.status !== "off") return b;
  if (b.status === "off" && a.status !== "off") return a;
  return b;
}

/** 승무원은 id마다 하나(처음 나온 자리에), 할 일도 id마다 하나(처음 것)만 남긴다. 겹침이 없으면 그대로 돌려준다. */
export function dedupeSnapshot(snap: Snapshot): Snapshot {
  const crew = new Map<string, Crew>();
  for (const c of snap.crew) {
    const prev = crew.get(c.id);
    crew.set(c.id, prev ? better(prev, c) : c);
  }
  const seen = new Set<string>();
  const tasks = snap.tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  if (crew.size === snap.crew.length && tasks.length === snap.tasks.length)
    return snap;
  return { ...snap, crew: [...crew.values()], tasks };
}
