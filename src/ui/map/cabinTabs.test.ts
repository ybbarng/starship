import { describe, expect, it } from "vitest";
import { HQ_CREW_DEFAULT, hqCrewId } from "@/relay/hq";
import { cabinTabs } from "./cabinTabs";

const base = {
  hq: false,
  hasMap: true,
  hasBrief: false,
  waiting: 0,
  picked: null,
};

describe("보통 선실: 지금 그대로", () => {
  it("할 일 · 지도, 브리핑이 있으면 브리핑까지", () => {
    expect(cabinTabs(base).tabs).toEqual(["tasks", "map"]);
    expect(cabinTabs({ ...base, hasBrief: true }).tabs).toEqual([
      "tasks",
      "map",
      "brief",
    ]);
  });

  it("기다리는 것이 있으면 할 일, 없으면 지도로 연다", () => {
    expect(cabinTabs(base).tab).toBe("map");
    expect(cabinTabs({ ...base, waiting: 2 }).tab).toBe("tasks");
  });

  it("나르기·시설 판은 없다(골라도 따르지 않는다)", () => {
    expect(cabinTabs({ ...base, picked: "relays" }).tab).toBe("map");
  });
});

describe("본부 방", () => {
  const hq = { ...base, hq: true };

  it("할 일 · 나르기 · 시설 · 지도", () => {
    expect(cabinTabs(hq).tabs).toEqual(["tasks", "relays", "facility", "map"]);
  });

  it("지도가 없으면 지도 판을 숨긴다", () => {
    expect(cabinTabs({ ...hq, hasMap: false }).tabs).toEqual([
      "tasks",
      "relays",
      "facility",
    ]);
    expect(cabinTabs({ ...hq, hasMap: false, picked: "map" }).tab).toBe(
      "relays",
    );
  });

  it("기다리는 것이 있으면 할 일, 없으면 나르기로 연다", () => {
    expect(cabinTabs(hq).tab).toBe("relays");
    expect(cabinTabs({ ...hq, waiting: 1 }).tab).toBe("tasks");
  });

  it("고른 판을 따른다", () => {
    expect(cabinTabs({ ...hq, waiting: 1, picked: "facility" }).tab).toBe(
      "facility",
    );
  });
});

describe("본부 승무원 id", () => {
  it("기본은 secretary", () => {
    expect(HQ_CREW_DEFAULT).toBe("secretary");
    expect(hqCrewId({})).toBe("secretary");
    expect(hqCrewId({ STARSHIP_HQ_CREW: "  " })).toBe("secretary");
  });

  it("STARSHIP_HQ_CREW로 바꾼다", () => {
    expect(hqCrewId({ STARSHIP_HQ_CREW: "home-base" })).toBe("home-base");
  });
});
