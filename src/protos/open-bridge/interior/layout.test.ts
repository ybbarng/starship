import { describe, expect, it } from "vitest";
import type { Crew } from "@/protocol/v1";
import { layoutModule, type Wing } from "./layout";

const NOW = Date.parse("2026-11-03T11:00:00+09:00");
const WINGS: Wing[] = [
  { x0: 0, x1: 400, side: "left" },
  { x0: 460, x1: 800, side: "right" },
];

function crew(id: string, status: Crew["status"], since?: number): Crew {
  return {
    id,
    name: id,
    context: "work",
    status,
    since,
    onDeck: status !== "off",
    actions: ["focus"],
  };
}

describe("layoutModule: 손짓은 결재가 있는 선원만", () => {
  it("결재가 있으면 일어서고(standX), 가장 오래된 결재부터 사다리 가까이", () => {
    const l = layoutModule(
      [crew("web-shop", "needs-you"), crew("billing", "working")],
      WINGS,
      new Map([
        ["web-shop", NOW - 60_000],
        ["billing", NOW - 3_600_000],
      ]),
    );
    const standing = l.desks.filter((d) => d.standX !== undefined);
    expect(standing.map((d) => d.crew.id).sort()).toEqual([
      "billing",
      "web-shop",
    ]);
  });

  it("나를 기다림이어도 소식(마지막 답변)뿐이면 손짓하지 않고 자기 책상에 앉는다", () => {
    const l = layoutModule(
      [crew("web-shop", "needs-you", NOW - 60_000)],
      WINGS,
      new Map(),
    );
    expect(l.desks).toHaveLength(1);
    expect(l.desks[0]?.standX).toBeUndefined();
    expect(l.rest).toHaveLength(0);
  });

  it("쉬는 선원도 결재가 오면 휴게석에서 나와 손짓한다", () => {
    const l = layoutModule(
      [crew("blog", "idle"), crew("notes", "idle")],
      WINGS,
      new Map([["blog", NOW]]),
    );
    expect(l.rest.map((c) => c.id)).toEqual(["notes"]);
    expect(l.desks.find((d) => d.crew.id === "blog")?.standX).toBeDefined();
  });
});
