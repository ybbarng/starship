import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMap, summarizeMap } from "./map";

describe("starship 자기 지도(map.json)", () => {
  it("형식 검사를 통과한다", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../../map.json", import.meta.url), "utf8"),
    );
    const parsed = parseMap(raw);
    expect(parsed.problems).toEqual([]);
    expect(parsed.map && summarizeMap(parsed.map).regions).toBeGreaterThan(20);
  });
});
