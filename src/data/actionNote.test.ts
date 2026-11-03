import { describe, expect, it } from "vitest";
import { failNote } from "./actionNote";

describe("failNote", () => {
  it("본부가 오류로 답하면 번호와 함께 서류가 남았다고 적는다", () => {
    expect(
      failNote({ target: "task", id: "t-1", action: "dismiss" }, 500),
    ).toBe("본부가 받지 못했어요(500). 서류는 그대로 있어요");
  });

  it("본부에 닿지 못하면 번호 없이 적는다", () => {
    expect(
      failNote({
        target: "answer",
        crewId: "starship",
        id: "a1",
        action: "read",
      }),
    ).toBe("본부에 닿지 못했어요. 답은 그대로 남겨 둘게요");
  });

  it("승무원·갈림길 동작도 무엇이 남았는지 적는다", () => {
    expect(
      failNote({ target: "crew", id: "starship", action: "focus" }, 502),
    ).toContain("승무원에게는 아직 전하지 않았어요");
    expect(
      failNote(
        {
          target: "sign",
          crewId: "starship",
          region: "map",
          id: "fork-1",
          action: "answer",
          answer: "A안",
        },
        503,
      ),
    ).toContain("갈림길은 그대로 있어요");
  });
});
