import { describe, expect, it } from "vitest";
import { parseDesk } from "@/protocol/desk";
import { Snapshot, Task } from "@/protocol/v1";
import { buildDemoDesks, deskTasks } from "./desk";
import { buildDemoMap } from "./map";
import { buildSnapshot, createDemoState } from "./scenario";

const now = Date.parse("2026-11-03T10:00:00+09:00");

describe("deskTasks", () => {
  const desks = buildDemoDesks(now);
  const webShop = desks["web-shop"];
  if (!webShop) throw new Error("데모 책상 web-shop이 없어요");
  const tasks = deskTasks("web-shop", webShop, "work", now);
  const byId = (id: string) =>
    tasks.find((t) => t.id === `desk:web-shop:${id}`);

  it("모두 프로토콜 v1 Task 모양이다", () => {
    for (const t of tasks) expect(Task.safeParse(t).success).toBe(true);
  });

  it("코드 리뷰 기다림은 PR 주소를 url로 낸다", () => {
    expect(byId("pr-231")?.url).toBe(
      "https://github.com/example/shop/pull/231",
    );
    expect(byId("pr-231")?.source).toEqual({ kind: "review" });
  });

  it("다른 기다림은 주소가 있어도 url을 내지 않는다", () => {
    expect(byId("coupon-entry")).not.toHaveProperty("url");
    expect(byId("checkout-motion")).not.toHaveProperty("url");
  });

  it("since는 parseWhen으로 읽는다: 날짜만 적으면 이 컴퓨터 시간대 자정", () => {
    const [t] = deskTasks(
      "orbit-notes",
      {
        desk: "starship-desk/1",
        updatedAt: "2026-11-03T09:00:00+09:00",
        waiting: [
          {
            id: "format-v2",
            type: "approve",
            title: "저장 형식 v2로 옮겨도 될까요",
            since: "2026-11-02",
          },
        ],
        doing: [],
      },
      "personal",
      now,
    );
    expect(t?.since).toBe(new Date(2026, 10, 2).getTime());
  });

  it("since가 없으면 지금", () => {
    const [t] = deskTasks(
      "orbit-notes",
      {
        desk: "starship-desk/1",
        updatedAt: "2026-11-03T09:00:00+09:00",
        waiting: [
          { id: "x", type: "answer", title: "기준 금액을 알려 주세요" },
        ],
        doing: [],
      },
      "personal",
      now,
    );
    expect(t?.since).toBe(now);
  });
});

describe("작업팀 데모(현장 방식)", () => {
  const snap = buildSnapshot(createDemoState(now), "default", now);
  const teams = snap.crew.filter((c) => c.foreman);
  const desks = buildDemoDesks(now);
  const regions = new Set(buildDemoMap(now).regions.map((r) => r.id));

  it("소장 web-shop 아래 작업팀 둘, 스냅숏 형식을 지킨다", () => {
    expect(teams.map((c) => [c.id, c.foreman])).toEqual([
      ["web-shop-coupon", "web-shop"],
      ["web-shop-mobile", "web-shop"],
    ]);
    expect(Snapshot.safeParse(snap).success).toBe(true);
  });

  it("한 작업팀은 소장 지도에 있는 구역에서, 다른 하나는 구역 없이 일한다", () => {
    const coupon = desks["web-shop-coupon"]?.doing ?? [];
    const mobile = desks["web-shop-mobile"]?.doing ?? [];
    expect(regions.has(coupon[0]?.region ?? "")).toBe(true);
    expect(mobile.length).toBeGreaterThan(0);
    expect(mobile.every((d) => d.region === undefined)).toBe(true);
    for (const id of ["web-shop-coupon", "web-shop-mobile"])
      expect(parseDesk(desks[id]).ok).toBe(true);
  });
});
