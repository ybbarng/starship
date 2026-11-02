import { describe, expect, it } from "vitest";
import { checkMap } from "@/protocol/map";
import { buildDemoMap } from "./map";
import { demoMapHistory } from "./mapHistory";

const NOW = Date.parse("2026-11-02T12:00:00+09:00");
const map = buildDemoMap(NOW);
const frames = demoMapHistory(map, NOW);

describe("demoMapHistory: 데모 지도가 지나온 모습", () => {
  it("오래된 것부터, 마지막 장은 지금 지도 그대로", () => {
    expect(frames).toHaveLength(12);
    const ats = frames.map((f) => f.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(frames.at(-1)?.map).toBe(map);
  });

  it("처음에는 땅이 적고 완공도 적다가 갈수록 는다", () => {
    const first = frames[0]?.map;
    const done = (m: typeof map) =>
      m.regions.filter((r) => r.status === "done").length;
    expect(first?.regions.length).toBeLessThan(map.regions.length);
    expect(done(first ?? map)).toBeLessThan(done(map));
  });

  it("장마다 지도 형식 검사를 통과한다(없는 parent·here 없음)", () => {
    for (const f of frames) expect(checkMap(f.map)).toEqual([]);
  });
});
