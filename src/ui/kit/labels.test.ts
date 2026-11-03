import { describe, expect, it } from "vitest";
import { ago, agoLabel, elapsed } from "./labels";

describe("기다린 시간 글", () => {
  const now = Date.parse("2026-10-29T12:00:00+09:00");
  const MIN = 60_000;

  it("ago는 얼마 전인지", () => {
    expect(ago(now - 10_000, now)).toBe("방금");
    expect(ago(now - 23 * MIN, now)).toBe("23분");
  });

  it("elapsed는 1분 안이어도 '1분째', 그 뒤로는 'n째'", () => {
    expect(elapsed(now - 10_000, now)).toBe("1분째");
    expect(elapsed(now - 23 * MIN, now)).toBe("23분째");
    expect(elapsed(now - 3 * 60 * MIN, now)).toBe("3시간째");
    expect(elapsed(now - 2 * 24 * 60 * MIN, now)).toBe("2일째");
  });

  it("agoLabel은 '… 전'(책상·지도 갱신, 답해 둔 것)", () => {
    expect(agoLabel(now - 10_000, now)).toBe("방금");
    expect(agoLabel(now - 23 * MIN, now)).toBe("23분 전");
    expect(agoLabel(now - 150 * MIN, now)).toBe("2시간 전");
    expect(agoLabel(now - 3 * 24 * 60 * MIN, now)).toBe("3일 전");
    // 미래 시각(시계가 어긋난 본부)도 "방금"
    expect(agoLabel(now + 5 * MIN, now)).toBe("방금");
  });

  it("agoLabel seconds는 1분 안을 초로(사용량 화면 '기록 n초 전에 읽음')", () => {
    expect(agoLabel(now - 12_000, now, { seconds: true })).toBe("12초 전");
    expect(agoLabel(now - 59_000, now, { seconds: true })).toBe("59초 전");
    expect(agoLabel(now - 61_000, now, { seconds: true })).toBe("1분 전");
    expect(agoLabel(now - 3 * 60 * MIN, now, { seconds: true })).toBe(
      "3시간 전",
    );
  });
});
