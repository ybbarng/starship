import { describe, expect, it } from "vitest";
import type { Hail, Task } from "@/protocol/v1";
import { berthsOf } from "./berths";

const NOW = Date.parse("2026-11-03T11:00:00+09:00");
const M = 60_000;

function hail(id: string, minutesAgo: number, over: Partial<Hail> = {}): Hail {
  return {
    id,
    from: { name: "디자이너", where: "#web-team" },
    source: { kind: "chat", service: "Slack" },
    context: "work",
    line: "시안 봐 주실래요?",
    since: NOW - minutesAgo * M,
    ...over,
  };
}

/** 세션 책상의 코드 리뷰 기다림(본부는 이것으로 교신을 만들지 않는다) */
const deskReview: Task = {
  id: "desk:web-shop:review-1",
  kind: "review",
  source: { kind: "review" },
  context: "work",
  title: "결제 화면 PR 리뷰",
  from: "web-shop",
  crewId: "web-shop",
  since: NOW - 90 * M,
  actions: ["answer", "focus"],
};

describe("berthsOf: 도킹 베이 교신선", () => {
  it("본부가 준 교신만 배로 만든다. 책상 코드 리뷰는 배가 되지 않는다", () => {
    const b = berthsOf([hail("h1", 5), hail("h2", 30)], [deskReview]);
    expect(b.map((x) => x.id)).toEqual(["h2", "h1"]);
  });

  it("교신에 딸린 할 일을 붙인다", () => {
    const t: Task = {
      ...deskReview,
      id: "chat-1",
      kind: "question",
      source: { kind: "chat", service: "Slack" },
    };
    const [b] = berthsOf([hail("h1", 5, { taskId: "chat-1" })], [t]);
    expect(b?.task?.id).toBe("chat-1");
    expect(b?.source).toBe("Slack");
  });
});
