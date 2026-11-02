// 데모용 지도 기록: 지금 지도의 날짜(baselineAt, 구역 since·found)로 지나온 모습을 거꾸로 짐작한다.
// 실제 서버는 map.json의 git 기록을 준다(docs/protocol.md "map/history"). 되감기 화면을 데모로도 보이려고 둔다.
import type { ProjectMap, Region, RegionStatus } from "@/protocol/map";
import type { MapFrame } from "@/protocol/v1";

const DAY = 86_400_000;
/** 완공 전에 공사하던 날 수(짐작) */
const BUILD_DAYS = 4;

const dayOf = (s: string | undefined): number | undefined =>
  s ? Date.parse(`${s.slice(0, 10)}T00:00:00+09:00`) : undefined;

/** t 때의 상태. since 전이면 한 단계 앞(완공·막힘 → 공사중, 공사중 → 안개) */
function statusAt(r: Region, t: number): RegionStatus {
  const since = dayOf(r.since);
  if (since === undefined || since <= t) return r.status;
  if (r.status === "done" || r.status === "blocked" || r.status === "dropped")
    return since - BUILD_DAYS * DAY <= t ? "building" : "fog";
  return "fog";
}

export function demoMapHistory(
  map: ProjectMap,
  now: number,
  count = 12,
): MapFrame[] {
  const start = dayOf(map.baselineAt) ?? now - 21 * DAY;
  const frames: MapFrame[] = [];
  for (let k = 0; k < count - 1; k++) {
    const t = start + ((now - start) * k) / (count - 1);
    // 그때 있던 구역: 처음 계획이거나 이미 찾은 것. 부모는 자식이 하나라도 있으면 둔다
    const has = (r: Region) => {
      const f = dayOf(r.found);
      return f === undefined || f <= t;
    };
    const kept = new Set(map.regions.filter(has).map((r) => r.id));
    for (const r of map.regions)
      if (kept.has(r.id) && r.parent) kept.add(r.parent);
    const regions = map.regions
      .filter((r) => kept.has(r.id))
      .map((r): Region => {
        const status = statusAt(r, t);
        return {
          ...r,
          status,
          // 그 상태가 되기 전에는 표지도 아직 없었다
          signs: status === r.status ? r.signs : undefined,
        };
      });
    const parents = new Set(regions.map((r) => r.parent).filter(Boolean));
    const building = regions
      .filter((r) => !parents.has(r.id) && r.status === "building")
      .sort((a, b) => (dayOf(b.since) ?? 0) - (dayOf(a.since) ?? 0));
    // 공사중인 땅이 없으면(아직 아무 일도 시작 전) 지금 여기도 없다
    const here =
      building[0]?.id ??
      (map.here && kept.has(map.here) ? map.here : undefined);
    frames.push({ at: Math.round(t), map: { ...map, regions, here } });
  }
  frames.push({ at: now, map });
  return frames;
}
