import { describe, expect, it } from "vitest";
import { limitLabel, UsageLimits, UsageLimitsResponse } from "./limits";

const AT = 1_793_000_000_000;

describe("UsageLimits", () => {
  it("본부 응답을 그대로 읽는다", () => {
    const r = UsageLimits.parse({
      protocol: "starship/1",
      at: AT,
      limits: [{ id: "week", label: "주간", usedPct: 50, resetsAt: AT + 1 }],
    });
    expect(r.limits).toEqual([
      { id: "week", label: "주간", usedPct: 50, resetsAt: AT + 1 },
    ]);
  });

  it("모르는 id도 받고, 틀린 항목은 그것만 뺀다", () => {
    const r = UsageLimits.parse({
      at: AT,
      limits: [
        { id: "week-opus", usedPct: 12, resetsAt: AT },
        { id: "", usedPct: 3 },
        { id: "five-hour", usedPct: "많이" },
        "엉뚱한 값",
        { id: "five-hour", usedPct: 30, extra: true },
      ],
    });
    expect(r.limits.map((l) => l.id)).toEqual(["week-opus", "five-hour"]);
  });

  it("usedPct는 0~100으로 자른다", () => {
    const r = UsageLimits.parse({
      at: AT,
      limits: [
        { id: "a", usedPct: 130 },
        { id: "b", usedPct: -5 },
      ],
    });
    expect(r.limits.map((l) => l.usedPct)).toEqual([100, 0]);
  });

  it("초 단위로 온 시각은 밀리초로 바꾼다", () => {
    const r = UsageLimits.parse({
      at: AT / 1000,
      limits: [{ id: "week", usedPct: 1, resetsAt: AT / 1000 }],
    });
    expect(r.at).toBe(AT);
    expect(r.limits[0]?.resetsAt).toBe(AT);
  });

  it("limits가 없거나 배열이 아니면 빈 목록", () => {
    expect(UsageLimits.parse({ at: AT }).limits).toEqual([]);
    expect(UsageLimits.parse({ at: AT, limits: "?" }).limits).toEqual([]);
  });

  it("at이 없으면 받지 않는다", () => {
    expect(UsageLimits.safeParse({ limits: [] }).success).toBe(false);
  });

  it("Starship 응답도 같은 규칙으로 읽는다", () => {
    const r = UsageLimitsResponse.parse({
      ok: false,
      source: "remote",
      limits: [],
    });
    expect(r).toEqual({ ok: false, source: "remote", limits: [] });
  });
});

describe("limitLabel", () => {
  it("label이 있으면 그것, 없으면 아는 id 이름, 모르면 id", () => {
    expect(limitLabel({ id: "week", label: "이번 주" })).toBe("이번 주");
    expect(limitLabel({ id: "five-hour" })).toBe("5시간");
    expect(limitLabel({ id: "week-haiku" })).toBe("week-haiku");
  });
});
