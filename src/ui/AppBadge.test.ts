import { describe, expect, it } from "vitest";
import { waitingTotal } from "./AppBadge";

describe("waitingTotal: Dock 배지 숫자", () => {
  it("승무원마다 책상 기다림 수를 더한다", () => {
    expect(
      waitingTotal([
        { desk: { waiting: 2, doing: 1 } },
        { desk: { waiting: 0, doing: 3 } },
        { desk: { waiting: 1, doing: 0 } },
      ]),
    ).toBe(3);
  });

  it("책상이 없는 승무원은 0으로 센다", () => {
    expect(waitingTotal([{}, { desk: { waiting: 4, doing: 0 } }])).toBe(4);
    expect(waitingTotal([])).toBe(0);
  });
});
