// 소장 지도 위 작업팀 그림 자리(현장 방식, 2026-11-06). 설계: docs/frontier.md "작업팀".
// 작업팀 책상의 region이 있는 첫 doing 항목의 칸에 선다. 없거나 지도에 없는 id면 착륙선 옆에 선다.
// 같은 자리에 여럿이면 옆으로 비켜 세운다. 화면 좌표는 FrontierView가 곱한다.
import type { Desk } from "@/protocol/desk";
import type { Crew } from "@/protocol/v1";

/** 지도에 세우는 작업팀 그림 수(동시에 넷까지라는 현장 방식 규칙과 같다) */
export const MAX_TEAMS = 4;

/** 이웃 그림 사이(그림 너비 배수) */
export const FAN = 0.8;

export type TeamOnMap = { crew: Crew; desk: Desk | null | undefined };

export type TeamSpot = {
  crew: Crew;
  /** 서는 구역 id. null이면 착륙선 옆 */
  region: string | null;
  /** 같은 자리에서 몇 번째(0부터). 소장 그림이 서 있는 구역이면 소장이 0번이라 1부터 */
  nth: number;
  /** 같은 자리에 선 그림 수(소장 그림 포함) */
  of: number;
  /** 자리 가운데에서 옆으로 비킨 거리(그림 너비 배수, 오른쪽 +) */
  dx: number;
};

/**
 * 작업팀이 서는 구역: region이 있는 첫 doing 항목의 구역. 그 id가 지도에 없으면(has가 false) null.
 * 다음 항목으로 넘어가지 않는다. 첫 일터가 지도에 없으면 착륙선 옆이 맞다(아직 머지되지 않은 구역 등).
 */
export function teamRegion(
  desk: Desk | null | undefined,
  has: (region: string) => boolean,
): string | null {
  const first = desk?.doing.find((d) => d.region);
  return first?.region && has(first.region) ? first.region : null;
}

/**
 * 작업팀마다 자리. 앞에서 MAX_TEAMS개만. here는 소장 그림(지금 여기)이 선 구역이다.
 * 같은 구역에 선 그림끼리 차례(nth)와 수(of)를 매긴다.
 */
export function placeTeams(
  teams: readonly TeamOnMap[],
  has: (region: string) => boolean,
  here?: string | null,
): TeamSpot[] {
  const picked = teams.slice(0, MAX_TEAMS).map((t) => ({
    crew: t.crew,
    region: teamRegion(t.desk, has),
  }));
  const total = new Map<string | null, number>();
  for (const p of picked) total.set(p.region, (total.get(p.region) ?? 0) + 1);
  const seen = new Map<string | null, number>();
  return picked.map((p) => {
    const withBoss = here != null && p.region === here ? 1 : 0;
    const k = seen.get(p.region) ?? 0;
    seen.set(p.region, k + 1);
    const nth = k + withBoss;
    const of = (total.get(p.region) ?? 1) + withBoss;
    // 소장 그림은 구역 가운데에 그대로 서 있으니 작업팀이 그 오른쪽으로 줄을 선다
    const dx = withBoss ? nth * FAN : fanOffset(nth, of);
    return { ...p, nth, of, dx };
  });
}

/** 같은 자리에서 옆으로 비킨 거리(그림 너비 배수). 가운데를 0으로 좌우 고르게 편다 */
export function fanOffset(nth: number, of: number): number {
  return (nth - (of - 1) / 2) * FAN;
}
