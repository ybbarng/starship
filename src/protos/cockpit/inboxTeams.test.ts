import { describe, expect, it } from "vitest";
import type { Crew, Task } from "@/protocol/v1";
import { inboxGroups, inboxOrder, LOOSE_KEY, reviewLane } from "./inboxGroups";
import {
  nestedCrewIds,
  nestTeams,
  rowGroups,
  teamsByForeman,
} from "./inboxTeams";

const NOW = Date.parse("2026-11-06T11:00:00+09:00");
const H = 3600_000;

/** 본부가 주는 책상 기다림 Task 모양(id desk:<crewId>:<waitId>) */
function task(id: string, crewId: string | undefined, hoursAgo: number): Task {
  return {
    id: crewId ? `desk:${crewId}:${id}` : id,
    kind: "question",
    source: crewId ? { kind: "session" } : { kind: "monitor", service: "ci" },
    context: "work",
    title: `${id} 정하기`,
    from: crewId ?? "비서",
    crewId,
    since: NOW - hoursAgo * H,
    actions: ["focus", "answer", "snooze"],
  };
}

function crew(id: string, foreman?: string): Crew {
  return {
    id,
    name: id,
    context: "work",
    status: "needs-you",
    onDeck: true,
    actions: ["focus", "brief"],
    ...(foreman ? { foreman } : {}),
  };
}

const byId = (list: Crew[]) => new Map(list.map((c) => [c.id, c]));

describe("teamsByForeman: 소장마다 작업팀", () => {
  it("스냅숏 차례로 소장 아래에 모은다", () => {
    const m = teamsByForeman(
      byId([
        crew("web-shop"),
        crew("web-shop-coupon", "web-shop"),
        crew("billing"),
        crew("web-shop-mobile", "web-shop"),
      ]),
    );
    expect([...m]).toEqual([
      [
        "web-shop",
        [
          crew("web-shop-coupon", "web-shop"),
          crew("web-shop-mobile", "web-shop"),
        ],
      ],
    ]);
  });

  it("소장이 스냅숏에 없으면 묶지 않는다", () => {
    expect(
      teamsByForeman(byId([crew("web-shop-coupon", "web-shop")])).size,
    ).toBe(0);
  });

  it("소장 자신이 작업팀이면 묶지 않는다(한 단만)", () => {
    const m = teamsByForeman(byId([crew("a"), crew("b", "a"), crew("c", "b")]));
    expect([...m.keys()]).toEqual(["a"]);
    expect(m.get("a")?.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("nestTeams: 목차 줄로 묶기", () => {
  const team = [
    crew("web-shop"),
    crew("web-shop-coupon", "web-shop"),
    crew("web-shop-mobile", "web-shop"),
    crew("billing"),
  ];
  const crewById = byId(team);

  it("작업팀 묶음은 소장 줄 아래로, 결재 없는 작업팀은 따로 적는다", () => {
    const groups = inboxGroups(
      [
        task("a", "billing", 5),
        task("b", "web-shop", 3),
        task("c", "web-shop-coupon", 1),
        task("d", undefined, 2),
      ],
      crewById,
      NOW,
    );
    const rows = nestTeams(groups, crewById);
    expect(rows.map((r) => r.key)).toEqual(["billing", "web-shop", LOOSE_KEY]);
    const shop = rows[1];
    expect(shop?.group?.key).toBe("web-shop");
    expect(shop?.foreman?.id).toBe("web-shop");
    expect(shop?.teams.map((g) => g.key)).toEqual(["web-shop-coupon"]);
    expect(shop?.idleTeams.map((c) => c.id)).toEqual(["web-shop-mobile"]);
    expect(rows[0]?.foreman).toBeUndefined();
  });

  it("소장 줄은 소장·작업팀 가운데 가장 오래 기다린 자리에 선다", () => {
    const groups = inboxGroups(
      [
        task("a", "billing", 2),
        task("b", "web-shop", 1),
        task("c", "web-shop-mobile", 6),
      ],
      crewById,
      NOW,
    );
    const rows = nestTeams(groups, crewById);
    expect(rows.map((r) => r.key)).toEqual(["web-shop", "billing"]);
    expect(rowGroups(rows).map((g) => g.key)).toEqual([
      "web-shop",
      "web-shop-mobile",
      "billing",
    ]);
  });

  it("소장이 결재가 없어도 작업팀 결재가 있으면 소장 줄이 생긴다(묶음 없이)", () => {
    const groups = inboxGroups(
      [task("c", "web-shop-coupon", 1)],
      crewById,
      NOW,
    );
    const [row] = nestTeams(groups, crewById);
    expect(row?.key).toBe("web-shop");
    expect(row?.group).toBeUndefined();
    expect(row?.foreman?.id).toBe("web-shop");
    expect(rowGroups(row ? [row] : []).map((g) => g.key)).toEqual([
      "web-shop-coupon",
    ]);
  });

  it("소장이 스냅숏에 없으면 작업팀은 지금처럼 따로 줄이 된다", () => {
    const alone = byId([crew("web-shop-coupon", "web-shop"), crew("billing")]);
    const groups = inboxGroups(
      [task("a", "billing", 2), task("c", "web-shop-coupon", 1)],
      alone,
      NOW,
    );
    const rows = nestTeams(groups, alone);
    expect(rows.map((r) => [r.key, r.group?.key, r.teams.length])).toEqual([
      ["billing", "billing", 0],
      ["web-shop-coupon", "web-shop-coupon", 0],
    ]);
  });

  it("작업팀이 없으면 줄 차례와 [ ] 차례가 묶음 차례 그대로다(기존 동작)", () => {
    const plain = byId([crew("billing"), crew("orbit")]);
    const tasks = [task("a", "orbit", 3), task("b", "billing", 1)];
    const groups = inboxGroups(tasks, plain, NOW);
    const rows = nestTeams(groups, plain);
    expect(rowGroups(rows)).toEqual(groups);
    const lane = reviewLane(tasks, NOW);
    expect(inboxOrder(lane, rowGroups(rows))).toEqual(inboxOrder(lane, groups));
  });

  it("묶어도 결재 수는 그대로다(묶음을 옮기기만 한다)", () => {
    const tasks = [
      task("a", "billing", 5),
      task("b", "web-shop", 3),
      task("c", "web-shop-coupon", 1),
      task("e", "web-shop-coupon", 2),
    ];
    const groups = inboxGroups(tasks, crewById, NOW);
    const count = (gs: { tasks: Task[] }[]) =>
      gs.reduce((n, g) => n + g.tasks.length, 0);
    expect(count(rowGroups(nestTeams(groups, crewById)))).toBe(count(groups));
  });
});

describe("nestedCrewIds: 나머지 승무원 칸에서 뺄 승무원", () => {
  it("줄에 든 승무원과 소장이 있는 작업팀을 뺀다", () => {
    const list = byId([
      crew("web-shop"),
      crew("web-shop-coupon", "web-shop"),
      crew("billing"),
      crew("ghost-team", "nobody"),
    ]);
    const groups = inboxGroups([task("a", "billing", 1)], list, NOW);
    const ids = nestedCrewIds(nestTeams(groups, list), list);
    expect([...ids].sort()).toEqual(["billing", "web-shop-coupon"]);
  });
});
