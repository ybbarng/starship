import { describe, expect, it } from "vitest";
import type { Crew, Task } from "@/protocol/v1";
import {
  inboxGroups,
  LOOSE_KEY,
  lastReplies,
  pickGroup,
  STALE_MS,
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
