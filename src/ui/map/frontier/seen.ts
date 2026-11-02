// 지난번에 본 지도와 무엇이 달라졌나: 승무원이 걸어갈 곳, 새로 완공된 땅.
// 선실을 다시 열었을 때도(브라우저에 기억), 열어 둔 채 5초마다 지도가 새로 올 때도 같은 규칙으로 고른다.
// 설계: docs/frontier.md "살아 있는 지도".
import type { ProjectMap } from "@/protocol/map";

export type Seen = {
  here?: string;
  /** 완공이었던 구역 id */
  done: string[];
};

export function seenOf(map: ProjectMap): Seen {
  return {
    here: map.here,
    done: map.regions.filter((r) => r.status === "done").map((r) => r.id),
  };
}

export type SeenDiff = {
  /** 승무원이 이 구역에서 지금 여기로 걸어온다 */
  walkFrom?: string;
  /** 지난번 뒤로 완공된 구역 */
  newlyDone: string[];
};

/** 처음 보는 지도면(prev 없음) 아무것도 하지 않는다. 사라진 구역에서는 걷지 않는다. */
export function diffSeen(prev: Seen | undefined, map: ProjectMap): SeenDiff {
  if (!prev) return { newlyDone: [] };
  const ids = new Set(map.regions.map((r) => r.id));
  const walkFrom =
    prev.here && map.here && prev.here !== map.here && ids.has(prev.here)
      ? prev.here
      : undefined;
  const before = new Set(prev.done);
  const newlyDone = map.regions
    .filter((r) => r.status === "done" && !before.has(r.id))
    .map((r) => r.id);
  return { walkFrom, newlyDone };
}

const KEY = (who: string) => `starship.frontier.seen.${who}`;

export function loadSeen(who: string): Seen | undefined {
  try {
    const raw = localStorage.getItem(KEY(who));
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Seen;
    return Array.isArray(v.done) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function saveSeen(who: string, seen: Seen): void {
  try {
    localStorage.setItem(KEY(who), JSON.stringify(seen));
  } catch {
    // 저장소를 못 쓰면 다음에 다시 열 때는 바뀐 것을 보여 주지 못할 뿐이다
  }
}
