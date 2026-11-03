import { describe, expect, it } from "vitest";
import type { Crew, Task } from "@/protocol/v1";
import {
  inboxGroups,
  inboxOrder,
  LOOSE_KEY,
  lastReplies,
  pickGroup,
  pickReview,
  REVIEW_LATE_MS,
  REVIEW_PREFIX,
  repick,
  reviewLane,
  STALE_MS,
  stepKey,
} from "./inboxGroups";

const NOW = Date.parse("2026-11-02T11:00:00+09:00");
const H = 3600_000;

/** 본부가 주는 모양 그대로의 할 일(책상 기다림이면 id가 desk:<crewId>:<waitId>) */
function task(
  id: string,
  crewId: string | undefined,
  hoursAgo: number,
  over: Partial<Task> = {},
): Task {
  return {
    id: crewId ? `desk:${crewId}:${id}` : id,
    kind: "question",
    source: crewId
      ? { kind: "session", service: "Claude Code" }
      : { kind: "monitor", service: "ci" },
    context: "work",
    title: `${id} 정하기`,
    from: crewId ?? "비서",
    crewId,
    since: NOW - hoursAgo * H,
    actions: ["answer", "focus", "dismiss"],
    ...over,
  };
}

function crew(id: string): Crew {
  return {
    id,
    name: id,
    context: "work",
    status: "needs-you",
    onDeck: true,
    actions: ["focus"],
  };
}

describe("inboxGroups: 승무원별로 묶기", () => {
  const crewById = new Map(["web-shop", "billing"].map((id) => [id, crew(id)]));

  it("승무원마다 한 묶음, 묶음 안은 본부 순서 그대로", () => {
    const groups = inboxGroups(
      [
        task("a", "web-shop", 1),
        task("b", "billing", 3),
        task("c", "web-shop", 5),
      ],
      crewById,
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["web-shop", "billing"]);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual([
      "desk:web-shop:a",
      "desk:web-shop:c",
    ]);
    expect(groups[0]?.crew?.name).toBe("web-shop");
  });

  it("가장 오래 기다린 일이 있는 승무원부터, 승무원 없는 일은 맨 뒤", () => {
    const groups = inboxGroups(
      [
        task("ci-red", undefined, 100),
        task("a", "web-shop", 2),
        task("b", "billing", 9),
      ],
      crewById,
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual([
      "billing",
      "web-shop",
      LOOSE_KEY,
    ]);
    expect(groups[2]?.crew).toBeUndefined();
  });

  it("이틀 넘게 기다린 일 수를 센다", () => {
    const [g] = inboxGroups(
      [task("old", "billing", 50), task("new", "billing", 1)],
      crewById,
      NOW,
    );
    expect(g?.stale).toBe(1);
    expect(g?.oldest).toBe(NOW - 50 * H);
    expect(STALE_MS).toBe(48 * H);
  });

  it("승무원 목록에 없는 crewId도 그 id로 묶는다", () => {
    const [g] = inboxGroups([task("x", "ghost", 1)], crewById, NOW);
    expect(g?.key).toBe("ghost");
    expect(g?.crew).toBeUndefined();
  });
});

describe("마지막 답변(reply)은 결재가 아닌 소식", () => {
  const crewById = new Map(["web-shop", "billing"].map((id) => [id, crew(id)]));
  /** 본부가 차례 끝마다 만드는 모양: id는 이벤트 uuid, 동작에 answer */
  const reply = (id: string, crewId: string, hoursAgo: number) =>
    task(id, undefined, hoursAgo, {
      id: `0b6f${id}-7c8f-4d89-9a3e-3d524ba13f0c`,
      kind: "reply",
      source: { kind: "session", service: "Claude Code" },
      crewId,
      from: crewId,
      actions: ["focus", "answer", "snooze", "dismiss"],
    });

  it("묶음·건수에 넣지 않는다. 답변만 있는 승무원은 묶음이 없다", () => {
    const groups = inboxGroups(
      [
        reply("1", "billing", 0.5),
        task("a", "web-shop", 1),
        reply("2", "web-shop", 0.2),
      ],
      crewById,
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["web-shop"]);
    expect(groups[0]?.tasks.map((t) => t.kind)).toEqual(["question"]);
  });

  it("승무원마다 가장 최근 답변 하나만 남긴다", () => {
    const r = lastReplies([
      reply("old", "billing", 3),
      reply("new", "billing", 0.1),
      task("a", "web-shop", 1),
    ]);
    expect([...r.keys()]).toEqual(["billing"]);
    expect(r.get("billing")?.since).toBe(NOW - 0.1 * H);
  });
});

describe("답해 둔 것: 결재는 아니지만 목차에 둔다", () => {
  const withAnswers = (id: string, answers: number): Crew => ({
    ...crew(id),
    desk: { waiting: 0, doing: 1, answers },
  });

  it("결재가 있는 승무원은 그 묶음에 답 수를 단다", () => {
    const byId = new Map([["billing", withAnswers("billing", 2)]]);
    const [g] = inboxGroups([task("a", "billing", 1)], byId, NOW);
    expect(g?.answers).toBe(2);
    expect(g?.tasks).toHaveLength(1);
  });

  it("답만 있는 승무원도 묶음이 생기고, 결재 묶음 뒤·새 일 앞에 온다", () => {
    const byId = new Map([
      ["web-shop", crew("web-shop")],
      ["lunar-blog", withAnswers("lunar-blog", 1)],
    ]);
    const groups = inboxGroups(
      [task("ci-red", undefined, 9), task("a", "web-shop", 1)],
      byId,
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual([
      "web-shop",
      "lunar-blog",
      LOOSE_KEY,
    ]);
    expect(groups[1]?.tasks).toEqual([]);
    expect(groups[1]?.answers).toBe(1);
  });
});

describe("pickGroup: 고른 묶음", () => {
  const groups = inboxGroups(
    [task("a", "web-shop", 1), task("b", "billing", 3)],
    new Map(),
    NOW,
  );
  it("고른 것이 있으면 그것", () => {
    expect(pickGroup(groups, "web-shop")?.key).toBe("web-shop");
  });
  it("다 처리해서 사라졌으면 첫 묶음", () => {
    expect(pickGroup(groups, "gone")?.key).toBe("billing");
    expect(pickGroup([], "gone")).toBeUndefined();
  });
});

describe("reviewLane: 결재함 맨 위 코드 리뷰 칸", () => {
  /** 책상에서 온 코드 리뷰(topic code-review → source review). 비서가 내보내는 모양 */
  const deskReview = (id: string, crewId: string, hoursAgo: number) =>
    task(id, crewId, hoursAgo, {
      kind: "review",
      source: { kind: "review" },
      title: `${id} 리뷰 봐 주세요`,
      actions: ["focus", "answer", "snooze"],
      choices: ["확인함", "고칠 것 있음"],
    });
  /** 책상 밖 GitHub 리뷰 요청(승무원 없이 오기도 한다) */
  const ghReview = (id: string, hoursAgo: number, crewId?: string) =>
    task(id, undefined, hoursAgo, {
      kind: "review",
      source: { kind: "review", service: "GitHub" },
      crewId,
      url: `https://example.com/shop/pull/${id}`,
    });

  it("출처가 코드 리뷰인 것만 승무원 상관없이 모아 오래 기다린 것부터", () => {
    const lane = reviewLane(
      [
        task("coupon", "web-shop", 9),
        deskReview("pr-231", "web-shop", 2),
        ghReview("212", 5),
        ghReview("97", 1, "billing"),
        // 책상 check이지만 코드 리뷰가 아닌 것(연출 확인)은 넣지 않는다
        task("motion", "web-shop", 20, { kind: "review" }),
      ],
      NOW,
    );
    expect(lane.tasks.map((t) => t.id)).toEqual([
      "212",
      "desk:web-shop:pr-231",
      "97",
    ]);
  });

  it("소식(reply)은 리뷰 출처여도 넣지 않는다", () => {
    const lane = reviewLane(
      [ghReview("212", 1), { ...ghReview("old", 3), kind: "reply" }],
      NOW,
    );
    expect(lane.tasks.map((t) => t.id)).toEqual(["212"]);
  });

  it("반나절(REVIEW_LATE_MS) 넘게 기다린 리뷰 수를 센다", () => {
    expect(REVIEW_LATE_MS).toBe(12 * H);
    const lane = reviewLane(
      [deskReview("a", "web-shop", 13), ghReview("b", 12), ghReview("c", 1)],
      NOW,
    );
    expect(lane.late).toBe(1);
  });

  it("리뷰가 없으면 빈 칸", () => {
    expect(reviewLane([task("a", "web-shop", 1)], NOW)).toEqual({
      tasks: [],
      late: 0,
    });
  });

  it("승무원 묶음과 결재 건수는 그대로다(두 번 세지 않는다)", () => {
    const tasks = [
      deskReview("pr-231", "web-shop", 2),
      task("a", "web-shop", 1),
    ];
    const groups = inboxGroups(tasks, new Map(), NOW);
    expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBe(2);
    expect(reviewLane(tasks, NOW).tasks).toHaveLength(1);
  });

  describe("pickReview: 리뷰 줄을 누르면 그 서류 하나", () => {
    const byId = new Map([["web-shop", crew("web-shop")]]);
    const lane = reviewLane(
      [deskReview("pr-231", "web-shop", 2), ghReview("212", 50)],
      NOW,
    );

    it("고른 리뷰 한 장을 그 승무원 묶음처럼 연다", () => {
      const g = pickReview(
        lane,
        `${REVIEW_PREFIX}desk:web-shop:pr-231`,
        byId,
        NOW,
      );
      expect(g?.tasks.map((t) => t.id)).toEqual(["desk:web-shop:pr-231"]);
      expect(g?.crew?.id).toBe("web-shop");
      expect(g?.key).toBe(`${REVIEW_PREFIX}desk:web-shop:pr-231`);
    });

    it("승무원 없는 리뷰는 승무원 없이, 이틀 넘었으면 묵음 1", () => {
      const g = pickReview(lane, `${REVIEW_PREFIX}212`, byId, NOW);
      expect(g?.crew).toBeUndefined();
      expect(g?.stale).toBe(1);
    });

    it("리뷰 줄이 아니거나 처리해서 사라졌으면 없다", () => {
      expect(pickReview(lane, "web-shop", byId, NOW)).toBeUndefined();
      expect(pickReview(lane, null, byId, NOW)).toBeUndefined();
      expect(
        pickReview(lane, `${REVIEW_PREFIX}gone`, byId, NOW),
      ).toBeUndefined();
    });
  });
});

describe("repick: 고른 것이 사라지면 이웃으로", () => {
  // 실제 열쇠 모양: 리뷰 줄은 review:<Task id>, 승무원 묶음은 승무원 id
  const r = (crewId: string, wait: string) =>
    `${REVIEW_PREFIX}desk:${crewId}:${wait}`;
  const prev = [
    r("blog", "pr-12"),
    r("web-shop", "pr-40"),
    r("game", "pr-7"),
    "web-shop",
    "blog",
    "game",
    LOOSE_KEY,
  ];

  it("고른 것이 그대로 있거나 고르지 않았으면 바꾸지 않는다", () => {
    expect(repick(prev, prev, "blog")).toBe("blog");
    expect(repick(prev, prev, null)).toBeNull();
  });

  it("승무원 묶음을 다 처리하면 같은 자리(뒤에 있던 묶음)로", () => {
    const next = prev.filter((k) => k !== "blog");
    expect(repick(prev, next, "blog")).toBe("game");
  });

  it("맨 끝 묶음이 사라지면 앞 묶음으로", () => {
    expect(repick(["web-shop", "blog"], ["web-shop"], "blog")).toBe("web-shop");
  });

  it("리뷰 줄을 처리하면 리뷰 칸의 다음 줄로", () => {
    const gone = r("web-shop", "pr-40");
    const next = prev.filter((k) => k !== gone);
    expect(repick(prev, next, gone)).toBe(r("game", "pr-7"));
  });

  it("리뷰 칸 마지막 줄을 처리하면 첫 승무원 묶음으로(앞 리뷰로 되돌아가지 않는다)", () => {
    const gone = r("game", "pr-7");
    const next = prev.filter((k) => k !== gone);
    expect(repick(prev, next, gone)).toBe("web-shop");
  });

  it("지난 순서에도 없던 열쇠(결재 없는 승무원)는 첫 묶음으로 바꿔 옛 열쇠를 남기지 않는다", () => {
    expect(repick(prev, prev, "secretary")).toBe("web-shop");
  });

  it("묶음이 다 사라지면 null", () => {
    expect(repick(["blog"], [], "blog")).toBeNull();
  });

  it("리뷰 줄만 남으면 그 리뷰 줄로", () => {
    const left = r("blog", "pr-12");
    expect(repick(["blog", left], [left], "blog")).toBe(left);
  });
});

describe("inboxOrder·stepKey: [ ] 키 순서", () => {
  it("리뷰 칸 줄 다음 승무원 묶음", () => {
    const review = task("pr-12", "blog", 3, {
      kind: "review",
      source: { kind: "review", service: "GitHub" },
    });
    const ask = task("q1", "web-shop", 1);
    const order = inboxOrder(
      reviewLane([review, ask], NOW),
      inboxGroups([review, ask], new Map<string, Crew>(), NOW),
    );
    expect(order).toEqual([`${REVIEW_PREFIX}${review.id}`, "blog", "web-shop"]);
  });

  it("끝에서는 멈추고, 지금 것이 없으면 맨 앞", () => {
    const o = ["web-shop", "blog", LOOSE_KEY];
    expect(stepKey(o, "blog", 1)).toBe(LOOSE_KEY);
    expect(stepKey(o, LOOSE_KEY, 1)).toBe(LOOSE_KEY);
    expect(stepKey(o, "web-shop", -1)).toBe("web-shop");
    expect(stepKey(o, undefined, 1)).toBe("web-shop");
    expect(stepKey([], "blog", 1)).toBeUndefined();
  });
});
