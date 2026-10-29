import { describe, expect, it } from "vitest";
import { ago, elapsed } from "./labels";

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
});
