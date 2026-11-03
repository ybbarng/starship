import { describe, expect, it } from "vitest";
import { KEY_OWNERS, keyStaysPut, SCROLL_OWNERS } from "./scrollKeys";

/** closest가 주어진 선택자 하나에만 맞는 가짜 요소 */
const inside = (match: string | null) => ({
  closest: (s: string) => (match !== null && s === match ? {} : null),
});

describe("keyStaysPut", () => {
  it("아무 데도 속하지 않은 포커스(본문·보통 단추)면 장면 넘김에 쓴다", () => {
    expect(keyStaysPut({ target: inside(null), dialogOpen: false })).toBe(
      false,
    );
    expect(keyStaysPut({ target: null, dialogOpen: false })).toBe(false);
  });

  it("대화상자가 열려 있으면 포커스가 어디든 두고 간다", () => {
    expect(keyStaysPut({ target: null, dialogOpen: true })).toBe(true);
    expect(keyStaysPut({ target: inside(null), dialogOpen: true })).toBe(true);
  });

  it("스스로 스크롤하는 목록(결재함 서류)이나 대화상자 안이면 두고 간다", () => {
    expect(
      keyStaysPut({ target: inside(SCROLL_OWNERS), dialogOpen: false }),
    ).toBe(true);
  });

  it("화살표를 쓰는 조작 요소(입력칸·목록 상자 등)면 두고 간다", () => {
    expect(keyStaysPut({ target: inside(KEY_OWNERS), dialogOpen: false })).toBe(
      true,
    );
  });

  it("단축키 조합은 가로채지 않는다", () => {
    expect(
      keyStaysPut({ target: inside(null), dialogOpen: false, modifier: true }),
    ).toBe(true);
  });
});
