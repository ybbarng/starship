import { describe, expect, it } from "vitest";
import { inboxKey } from "./inboxFocus";

describe("inboxKey: 결재함 단축키", () => {
  it("J/K는 다음·이전 서류, 한글 자판의 ㅓ·ㅏ도 같게", () => {
    for (const k of ["j", "J", "ㅓ"])
      expect(inboxKey(k)).toEqual({ type: "paper", d: 1 });
    for (const k of ["k", "K", "ㅏ"])
      expect(inboxKey(k)).toEqual({ type: "paper", d: -1 });
  });

  it("[ ]는 이전·다음 묶음", () => {
    expect(inboxKey("[")).toEqual({ type: "group", d: -1 });
    expect(inboxKey("]")).toEqual({ type: "group", d: 1 });
  });

  it("1~9는 선택지 순번, 0은 받지 않는다", () => {
    expect(inboxKey("1")).toEqual({ type: "choice", n: 1 });
    expect(inboxKey("9")).toEqual({ type: "choice", n: 9 });
    expect(inboxKey("0")).toBeNull();
  });

  it("S는 1시간 뒤, 한글 자판의 ㄴ도 같게", () => {
    for (const k of ["s", "S", "ㄴ"])
      expect(inboxKey(k)).toEqual({ type: "snooze" });
  });

  it("다른 키는 건드리지 않는다(G·Esc는 조종석이 따로 받는다)", () => {
    for (const k of ["g", "Escape", "ArrowDown", "Enter", " "])
      expect(inboxKey(k)).toBeNull();
  });
});
