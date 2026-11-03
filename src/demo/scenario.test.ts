import { describe, expect, it } from "vitest";
import { parseDesk } from "@/protocol/desk";
import { Snapshot } from "@/protocol/v1";
import { buildDemoDesks } from "./desk";
import { buildSnapshot, createDemoState, INCOMING_EVERY } from "./scenario";

describe("데모 시나리오", () => {
  const t0 = 1_800_000_000_000;

  it("프로토콜 스키마를 지킨다", () => {
    for (const scenario of ["default", "empty", "busy"] as const) {
      const snap = buildSnapshot(createDemoState(t0), scenario, t0);
      expect(() => Snapshot.parse(snap)).not.toThrow();
    }
  });

  it("권한·질문이 맨 앞에 온다", () => {
    const snap = buildSnapshot(createDemoState(t0), "default", t0);
    expect(["question", "permission"]).toContain(snap.tasks[0]?.kind);
  });

  it("empty는 할 일과 교신이 없다", () => {
    const snap = buildSnapshot(createDemoState(t0), "empty", t0);
    expect(snap.tasks).toHaveLength(0);
    expect(snap.hails).toHaveLength(0);
  });

  it("시간이 지나면 교신이 하나씩 도착한다", () => {
    const state = createDemoState(t0);
    const before = buildSnapshot(state, "default", t0).hails.length;
    const after = buildSnapshot(state, "default", t0 + INCOMING_EVERY + 1).hails
      .length;
    expect(after).toBe(before + 1);
  });

  it("세션 할 일과 책상 기다림을 모두 치우면 그 승무원은 다시 일하러 간다", () => {
    const state = createDemoState(t0);
    state.dismissed.add("t-orbit-q");
    const half = buildSnapshot(state, "default", t0);
    expect(half.crew.find((c) => c.id === "orbit-notes")?.status).toBe(
      "needs-you",
    );
    state.dismissed.add("desk:orbit-notes:format-v2");
    const snap = buildSnapshot(state, "default", t0);
    expect(snap.crew.find((c) => c.id === "orbit-notes")?.status).toBe(
      "working",
    );
  });
});

describe("데모 책상", () => {
  const t0 = 1_800_000_000_000;

  it("기다림마다 Task가 desk:<crewId>:<waitId>로 나가고, 승무원에 요약이 붙는다", () => {
    const snap = buildSnapshot(createDemoState(t0), "default", t0);
    const deskTasks = snap.tasks.filter((t) =>
      t.id.startsWith("desk:web-shop:"),
    );
    expect(deskTasks.map((t) => t.id).sort()).toEqual([
      "desk:web-shop:checkout-motion",
      "desk:web-shop:coupon-entry",
      "desk:web-shop:free-ship",
      "desk:web-shop:pr-231",
      "desk:web-shop:prod-push",
    ]);
    const approve = deskTasks.find((t) => t.id.endsWith(":prod-push"));
    expect(approve?.choices).toEqual(["승인", "보류"]);
    expect(snap.crew.find((c) => c.id === "web-shop")?.desk).toEqual({
      waiting: 5,
      doing: 2,
      answers: 2,
    });
  });

  it("코드 리뷰 기다림은 source review로 나가고, 교신은 만들지 않는다", () => {
    const snap = buildSnapshot(createDemoState(t0), "default", t0);
    const review = snap.tasks.find((t) => t.id === "desk:web-shop:pr-231");
    expect(review?.source).toEqual({ kind: "review" });
    expect(review?.kind).toBe("review");
    expect(
      snap.tasks.find((t) => t.id === "desk:web-shop:coupon-entry")?.source,
    ).toEqual({ kind: "session" });
    expect(snap.hails.some((h) => h.taskId === "desk:web-shop:pr-231")).toBe(
      false,
    );
  });

  it("답한 기다림은 Task에서도 책상 요약에서도 빠진다", () => {
    const state = createDemoState(t0);
    state.dismissed.add("desk:web-shop:prod-push");
    const snap = buildSnapshot(state, "default", t0);
    expect(snap.tasks.some((t) => t.id === "desk:web-shop:prod-push")).toBe(
      false,
    );
    expect(snap.crew.find((c) => c.id === "web-shop")?.desk?.waiting).toBe(4);
  });

  it("데모 책상은 모두 형식 검사를 통과한다", () => {
    for (const desk of Object.values(buildDemoDesks(t0)))
      expect(parseDesk(desk).problems).toEqual([]);
  });

  it("빈 시나리오에는 책상이 없다", () => {
    const snap = buildSnapshot(createDemoState(t0), "empty", t0);
    expect(snap.crew.every((c) => c.desk === undefined)).toBe(true);
  });
});
