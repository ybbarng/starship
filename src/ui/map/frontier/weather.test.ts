import { describe, expect, it } from "vitest";
import type { Crew } from "@/protocol/v1";
import { weatherOf } from "./weather";

function crew(over: Partial<Crew>): Crew {
  return {
    id: "web-shop",
    name: "web-shop",
    context: "work",
    status: "working",
    onDeck: true,
    actions: ["focus"],
    ...over,
  };
}

const map = {
  progress: 0.4,
  regions: 12,
  found: 2,
  forksForMe: 1,
  stale: false,
};

describe("weatherOf: 승무원 상태 → 날씨", () => {
  it("일하는 중이고 지도가 새것이면 맑은 낮", () => {
    expect(weatherOf(crew({ map }))).toEqual({ night: false, storm: false });
  });
  it("세션이 꺼져 있으면 밤", () => {
    expect(weatherOf(crew({ status: "off" })).night).toBe(true);
  });
  it("쉬는 중(idle)은 아직 낮", () => {
    expect(weatherOf(crew({ status: "idle" })).night).toBe(false);
  });
  it("지도가 일보다 뒤처졌으면 모래 폭풍", () => {
    expect(weatherOf(crew({ map: { ...map, stale: true } })).storm).toBe(true);
  });
  it("승무원 정보가 아직 없으면 맑은 낮", () => {
    expect(weatherOf(undefined)).toEqual({ night: false, storm: false });
  });
});
