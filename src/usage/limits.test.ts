import { describe, expect, it } from "vitest";
import { demoLimits, nextTwoAm } from "@/demo/limits";
import type { UsageLimitsResponse } from "@/protocol/limits";
import {
  agoText,
  feedShares,
  isExpired,
  isStale,
  keepLastGood,
  levelOf,
  resetShort,
  resetText,
  splitUsed,
  untilText,
} from "./limits";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("splitUsed", () => {
  it("추정 비용 비율로 쓴 몫을 나눈다", () => {
    const r = splitUsed(50, {
      work: { cost: 30, output: 1 },
      personal: { cost: 10, output: 1000 },
      other: { cost: 10, output: 0 },
    });
    expect(r.basis).toBe("cost");
    expect(r.parts).toEqual({ work: 30, personal: 10, other: 10 });
  });

  it("비용을 셀 수 없으면 출력 토큰으로 나눈다", () => {
    const r = splitUsed(40, {
      work: { cost: 0, output: 300 },
      personal: { cost: 0, output: 100 },
      other: { cost: 0, output: 0 },
    });
    expect(r.basis).toBe("output");
    expect(r.parts).toEqual({ work: 30, personal: 10, other: 0 });
  });

  it("기록이 없으면 모두 기타", () => {
    const zero = { cost: 0, output: 0 };
    const r = splitUsed(20, { work: zero, personal: zero, other: zero });
    expect(r.basis).toBe("none");
    expect(r.parts).toEqual({ work: 0, personal: 0, other: 20 });
  });

  it("나눈 몫의 합은 쓴 몫과 같다", () => {
    const r = splitUsed(73, {
      work: { cost: 1.7, output: 0 },
      personal: { cost: 2.9, output: 0 },
      other: { cost: 0.3, output: 0 },
    });
    expect(r.parts.work + r.parts.personal + r.parts.other).toBeCloseTo(73);
  });
});

describe("feedShares", () => {
  it("쓴 몫을 합이 1인 비율로 바꾼다", () => {
    const r = feedShares({ work: 30, personal: 15, other: 5 });
    expect(r.work).toBeCloseTo(0.6);
    expect(r.personal).toBeCloseTo(0.3);
    expect(r.other).toBeCloseTo(0.1);
  });
  it("쓴 것이 없으면 모두 0", () => {
    expect(feedShares({ work: 0, personal: 0, other: 0 })).toEqual({
      work: 0,
      personal: 0,
      other: 0,
    });
  });
});

describe("untilText", () => {
  const now = Date.UTC(2026, 10, 3, 10, 0);
  it.each([
    [30 * 1000, "곧"],
    [35 * MIN, "35분 뒤"],
    [2 * HOUR + 20 * MIN, "2시간 20분 뒤"],
    [7 * HOUR + 20 * MIN, "7시간 뒤"],
    [24 * HOUR, "1일 뒤"],
    [51 * HOUR, "2일 3시간 뒤"],
    [-5 * MIN, "곧"],
  ])("%d ms 뒤 → %s", (d, text) => {
    expect(untilText(now + d, now)).toBe(text);
  });
});

describe("오래된 값·지난 리셋", () => {
  const now = Date.UTC(2026, 10, 3, 10, 0);
  it("30분 넘게 지난 값은 오래된 값", () => {
    expect(isStale(now - 29 * MIN, now)).toBe(false);
    expect(isStale(now - 31 * MIN, now)).toBe(true);
    expect(isStale(undefined, now)).toBe(true);
  });
  it("리셋 시각이 지났으면 지난 것", () => {
    expect(isExpired(now - 1, now)).toBe(true);
    expect(isExpired(now + 1, now)).toBe(false);
    expect(isExpired(undefined, now)).toBe(false);
  });
  it("값이 얼마나 지났는지", () => {
    expect(agoText(now - 10 * 1000, now)).toBe("방금");
    expect(agoText(now - 42 * MIN, now)).toBe("42분 전");
    expect(agoText(now - 3 * HOUR, now)).toBe("3시간 전");
  });
});

describe("resetText·levelOf", () => {
  it("한국 시각으로 날짜·요일·시각을 적는다", () => {
    // 2026-11-03T17:00Z = 11월 4일(수) 02:00 KST
    expect(resetText(Date.UTC(2026, 10, 3, 17, 0), "Asia/Seoul")).toBe(
      "11월 4일(수) 02:00",
    );
  });
  it("짧은 리셋 시각: 6일 안이면 요일과 시각만", () => {
    const reset = Date.UTC(2026, 10, 3, 17, 0); // 11월 4일(수) 02:00 KST
    expect(resetShort(reset, reset - 6 * HOUR, "Asia/Seoul")).toBe("수 02:00");
    expect(resetShort(reset, reset - 6 * 24 * HOUR, "Asia/Seoul")).toBe(
      "11월 4일(수) 02:00",
    );
  });
  it("80% 넘으면 주황, 95% 넘으면 빨강", () => {
    expect(levelOf(80)).toBe("ok");
    expect(levelOf(81)).toBe("warn");
    expect(levelOf(95)).toBe("warn");
    expect(levelOf(96)).toBe("danger");
  });
});

describe("데모 한도", () => {
  it("주간은 다음 02:00에, 5시간은 그보다 일찍 리셋", () => {
    const now = new Date(2026, 10, 3, 19, 0).getTime();
    const d = demoLimits(now);
    const week = d.limits.find((l) => l.id === "week");
    expect(week?.resetsAt).toBe(new Date(2026, 10, 4, 2, 0).getTime());
    expect(nextTwoAm(new Date(2026, 10, 3, 1, 0).getTime())).toBe(
      new Date(2026, 10, 3, 2, 0).getTime(),
    );
    const five = d.limits.find((l) => l.id === "five-hour");
    expect(five?.resetsAt).toBeGreaterThan(now);
  });
});

describe("본부가 잠깐 실패할 때(keepLastGood)", () => {
  const AT = new Date(2026, 10, 3, 19, 0).getTime();
  const good: UsageLimitsResponse = {
    ok: true,
    source: "remote",
    at: AT,
    limits: [{ id: "week", usedPct: 42, resetsAt: AT + 6 * HOUR }],
  };
  const fail: UsageLimitsResponse = {
    ok: false,
    source: "remote",
    limits: [],
    note: "본부 502",
  };
  it("마지막 성공값을 stale로, at은 그대로, 까닭은 note에", () => {
    expect(keepLastGood(fail, good)).toEqual({
      ...good,
      stale: true,
      note: "본부 502",
    });
  });
  it("받은 적이 없으면 실패 그대로", () => {
    expect(keepLastGood(fail, undefined)).toBe(fail);
  });
  it("성공 응답은 건드리지 않는다", () => {
    expect(keepLastGood(good, good)).toBe(good);
  });
});
