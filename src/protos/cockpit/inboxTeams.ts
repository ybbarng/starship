// 결재함 목차의 작업팀 묶기(현장 방식, 2026-11-06). 작업팀(Crew.foreman이 있는 승무원)을 소장 줄 바로 아래로 들인다.
// 작업팀 기다림은 그대로 작업팀 묶음에 남고 건수도 그대로다(docs/crew-views.md "건수"). 목차 줄의 차례만 바꾼다.
// 설계: docs/crew-views.md "작업팀".
import type { Crew } from "@/protocol/v1";
import type { InboxGroup } from "./inboxGroups";

export type InboxRow = {
  /** 줄 열쇠: 소장(또는 작업팀이 없는 승무원·새 일)의 묶음 열쇠 */
  key: string;
  /** 그 승무원 자신의 결재 묶음. 소장이 결재가 없고 작업팀만 결재가 있으면 없다 */
  group?: InboxGroup;
  /** 작업팀을 둔 소장. 작업팀이 하나도 없으면 없다 */
  foreman?: Crew;
  /** 결재가 있는 작업팀 묶음(목차 차례 그대로) */
  teams: InboxGroup[];
  /** 결재가 없는 작업팀(스냅숏 차례) */
  idleTeams: Crew[];
};

/**
 * 소장 id → 그 작업팀들(스냅숏 차례). 소장이 스냅숏에 없으면 그 작업팀은 넣지 않는다(따로 보인다).
 * 소장 자신이 또 작업팀이면 묶지 않는다(한 단만 들인다).
 */
export function teamsByForeman(
  crewById: ReadonlyMap<string, Crew>,
): Map<string, Crew[]> {
  const by = new Map<string, Crew[]>();
  for (const c of crewById.values()) {
    const f = c.foreman;
    if (!f || f === c.id) continue;
    const boss = crewById.get(f);
    if (!boss || boss.foreman) continue;
    const list = by.get(f);
    if (list) list.push(c);
    else by.set(f, [c]);
  }
  return by;
}

/**
 * 목차 줄로 묶는다. 작업팀 묶음은 소장 줄 아래로 옮기고, 소장 줄은 소장·작업팀 가운데 목차에서 가장 앞선 자리에 둔다.
 * 소장도 작업팀도 결재가 없으면 줄을 만들지 않는다(나머지 승무원에 남는다).
 */
export function nestTeams(
  groups: readonly InboxGroup[],
  crewById: ReadonlyMap<string, Crew>,
): InboxRow[] {
  const teams = teamsByForeman(crewById);
  const foremanOf = new Map<string, string>();
  for (const [f, list] of teams) for (const c of list) foremanOf.set(c.id, f);
  const rows = new Map<string, InboxRow>();
  const rowOf = (key: string): InboxRow => {
    let row = rows.get(key);
    if (!row) {
      const list = teams.get(key);
      row = {
        key,
        foreman: list ? crewById.get(key) : undefined,
        teams: [],
        idleTeams: [],
      };
      rows.set(key, row);
    }
    return row;
  };
  for (const g of groups) {
    const f = foremanOf.get(g.key);
    if (f) rowOf(f).teams.push(g);
    else rowOf(g.key).group = g;
  }
  for (const row of rows.values()) {
    const busy = new Set(row.teams.map((g) => g.key));
    row.idleTeams = (teams.get(row.key) ?? []).filter((c) => !busy.has(c.id));
  }
  return [...rows.values()];
}

/** 목차 위에서 아래로 늘어선 묶음: 줄마다 소장 묶음, 그 아래 작업팀 묶음. [ ] 키와 이어 고르기가 이 차례를 쓴다 */
export function rowGroups(rows: readonly InboxRow[]): InboxGroup[] {
  return rows.flatMap((r) => (r.group ? [r.group, ...r.teams] : r.teams));
}

/** 나머지 승무원 칸에서 뺄 승무원: 목차 줄에 든 승무원과, 소장이 스냅숏에 있는 작업팀(소장 단추에 "팀 n"으로 보인다) */
export function nestedCrewIds(
  rows: readonly InboxRow[],
  crewById: ReadonlyMap<string, Crew>,
): Set<string> {
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.key);
    for (const g of r.teams) ids.add(g.key);
  }
  for (const list of teamsByForeman(crewById).values())
    for (const c of list) ids.add(c.id);
  return ids;
}
