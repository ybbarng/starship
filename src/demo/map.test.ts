import { describe, expect, it } from "vitest";
import { isNewFound, parseMap, summarizeMap } from "@/protocol/map";
import { CrewMapResponse } from "@/protocol/v1";
import { buildBigDemoMap, buildDemoMap, DEMO_MAP_CREW } from "./map";
import { buildSnapshot, createDemoState } from "./scenario";

describe("데모 지도", () => {
  const now = Date.parse("2026-10-29T12:00:00+09:00");
  const map = buildDemoMap(now);

  it("형식과 짜임 검사를 통과한다", () => {
    expect(parseMap(JSON.parse(JSON.stringify(map)))).toMatchObject({
      ok: true,
      problems: [],
    });
    expect(() => CrewMapResponse.parse({ map })).not.toThrow();
  });

  it("15~20개 구역에 상태와 표지가 골고루 섞인다", () => {
    expect(map.regions.length).toBeGreaterThanOrEqual(15);
    expect(map.regions.length).toBeLessThanOrEqual(20);
    const statuses = new Set(map.regions.map((r) => r.status));
    expect([...statuses].sort()).toEqual(
      ["blocked", "building", "done", "dropped", "fog"].sort(),
    );
    const signs = new Set(
      map.regions.flatMap((r) => r.signs ?? []).map((s) => s.type),
    );
    expect([...signs].sort()).toEqual(["fork", "risk", "talk"]);
    expect(
      map.regions.filter((r) => isNewFound(r, now)).length,
    ).toBeGreaterThan(0);
  });

  it("스냅샷의 승무원 요약과 같은 값이다", () => {
    const snap = buildSnapshot(createDemoState(now), "default", now);
    const crew = snap.crew.find((c) => c.id === DEMO_MAP_CREW);
    expect(crew?.map).toEqual({ ...summarizeMap(map), stale: false });
    expect(snap.crew.filter((c) => c.map).length).toBe(2);
  });

  it("큰 데모 지도는 40구역, 3단, 긴 이름, 절반 넘게 발견", () => {
    const big = buildBigDemoMap(now);
    expect(parseMap(JSON.parse(JSON.stringify(big))).ok).toBe(true);
    expect(big.regions).toHaveLength(40);
    expect(big.regions.some((r) => r.title.length >= 18)).toBe(true);
    expect(big.regions.filter((r) => r.found).length).toBeGreaterThan(20);
  });
});
