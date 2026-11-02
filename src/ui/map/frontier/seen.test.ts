import { describe, expect, it } from "vitest";
import { buildDemoMap } from "@/demo/map";
import type { ProjectMap } from "@/protocol/map";
import { diffSeen, seenOf } from "./seen";

const NOW = Date.parse("2026-11-02T12:00:00+09:00");
const base = buildDemoMap(NOW);

/** 세션이 지도를 고친 모양: 지금 여기를 옮기고 구역 하나를 완공으로 */
function after(map: ProjectMap, here: string, doneId: string): ProjectMap {
  return {
    ...map,
    here,
    regions: map.regions.map((r) =>
      r.id === doneId ? { ...r, status: "done" } : r,
    ),
  };
}

describe("diffSeen: 지난번 본 지도와 달라진 것", () => {
  it("처음 보는 지도면 걷지도 축하하지도 않는다", () => {
    expect(diffSeen(undefined, base)).toEqual({ newlyDone: [] });
  });

  it("그대로면 아무것도 없다", () => {
    expect(diffSeen(seenOf(base), base)).toEqual({
      walkFrom: undefined,
      newlyDone: [],
    });
  });

  it("지금 여기가 바뀌면 원래 땅에서 걸어오고, 새로 완공된 땅은 축하한다", () => {
    const next = after(base, "server-payment", "coupon-stack");
    const diff = diffSeen(seenOf(base), next);
    expect(diff.walkFrom).toBe("coupon-stack");
    expect(diff.newlyDone).toEqual(["coupon-stack"]);
  });

  it("원래 땅이 지도에서 사라졌으면 걷지 않는다(바로 새 자리에)", () => {
    const prev = { ...seenOf(base), here: "gone-region" };
    expect(diffSeen(prev, base).walkFrom).toBeUndefined();
  });
});
