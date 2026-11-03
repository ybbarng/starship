import { describe, expect, it } from "vitest";
import { wrapFocus } from "./focusTrap";

describe("wrapFocus", () => {
  it("마지막에서 Tab이면 처음으로 돌아간다", () => {
    expect(wrapFocus(2, 3, false)).toBe(0);
  });

  it("처음에서 Shift+Tab이면 마지막으로 간다", () => {
    expect(wrapFocus(0, 3, true)).toBe(2);
  });

  it("가운데에서는 브라우저에 맡긴다", () => {
    expect(wrapFocus(1, 3, false)).toBeNull();
    expect(wrapFocus(1, 3, true)).toBeNull();
  });

  it("포커스가 창 밖이면 처음(또는 Shift+Tab이면 끝)으로 끌어온다", () => {
    expect(wrapFocus(-1, 3, false)).toBe(0);
    expect(wrapFocus(-1, 3, true)).toBe(2);
  });

  it("포커스 받을 것이 하나뿐이면 그 자리에 머문다", () => {
    expect(wrapFocus(0, 1, false)).toBe(0);
    expect(wrapFocus(0, 1, true)).toBe(0);
  });

  it("포커스 받을 것이 없으면 아무것도 하지 않는다", () => {
    expect(wrapFocus(-1, 0, false)).toBeNull();
  });
});
