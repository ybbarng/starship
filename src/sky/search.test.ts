import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "./bodies";
import type { SkyCatalog } from "./catalog";
import { normalizeName, searchDestinations } from "./search";
import { makeStarDestinations, starField } from "./sky3d";

// 실제 화면과 같은 목록: 정적 목적지 + sky.json에서 만든 이름 있는 별
const sky = JSON.parse(
  readFileSync(join(__dirname, "../../public/sky/sky.json"), "utf8"),
) as SkyCatalog;
const all = [...DESTINATIONS, ...makeStarDestinations(sky, starField(sky))];
const ids = (q: string) => searchDestinations(q, all).map((d) => d.id);

describe("목적지 검색", () => {
  it("한국어 이름: 정확히 맞으면 먼저", () => {
    expect(ids("토성")[0]).toBe("saturn");
    expect(ids("안타레스")[0]).toBe("antares");
    expect(ids("스피카")[0]).toMatch(/^hip-\d+$/);
  });

  it("영어 이름은 대소문자·띄어쓰기와 상관없이", () => {
    expect(ids("saturn")[0]).toBe("saturn");
    expect(ids("VOYAGER1")[0]).toBe("voyager1");
    expect(ids("voyager")).toEqual(["voyager1", "voyager2"]);
    expect(ids("canopus")[0]).toBe("canopus");
  });

  it("앞부분만 쳐도 찾고, 낱말 가운데서도 찾는다", () => {
    expect(ids("베텔")[0]).toBe("betelgeuse");
    expect(ids("centauri")).toContain("alpha-cen");
    expect(ids("comet")).toEqual(["halley"]);
  });

  it("빈 검색어와 없는 이름은 빈 목록", () => {
    expect(ids("  ")).toEqual([]);
    expect(ids("없는별이름")).toEqual([]);
  });

  it("결과는 최대 limit개", () => {
    expect(searchDestinations("a", all, 5)).toHaveLength(5);
  });

  it("이름 고르기 규칙", () => {
    expect(normalizeName("Halley's Comet")).toBe("halleyscomet");
    expect(normalizeName("알파 센타우리")).toBe("알파센타우리");
  });
});
