import { describe, expect, it } from "vitest";
import { parseDesk } from "@/protocol/desk";
import { Snapshot } from "@/protocol/v1";
import { buildDemoDesks } from "./desk";
import {
  buildSnapshot,
  createDemoState,
  demoDesks,
  INCOMING_EVERY,
} from "./scenario";

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

describe("데모 시각: 데모 시작 기준이라 내용이 같으면 같은 값", () => {
  const t0 = 1_800_000_000_000;
  const strip = ({
    generatedAt: _,
    ...rest
  }: ReturnType<typeof buildSnapshot>) => rest;

  it("5초 뒤에 다시 물어도 스냅샷이 같다(만든 시각만 다르다)", () => {
    const state = createDemoState(t0);
    for (const link of ["ok", "warn", "down", "off", "vpn-warn"] as const) {
      const a = buildSnapshot(state, "default", t0 + 1_000, link);
      const b = buildSnapshot(state, "default", t0 + 6_000, link);
      expect(strip(b)).toEqual(strip(a));
    }
  });

  it("관제 링크 측정 시각은 20초마다만 바뀐다", () => {
    const state = createDemoState(t0);
    const at = (now: number) => buildSnapshot(state, "default", now).link?.at;
    expect(at(t0 + 19_000)).toBe(at(t0));
    expect(at(t0 + 20_000)).toBe((at(t0) ?? 0) + 20_000);
  });

  it("책상도 요청 시각과 상관없이 같다(미뤄도 책상은 그대로)", () => {
    const state = createDemoState(t0);
    const before = demoDesks(state);
    state.snoozed.set("desk:web-shop:coupon-entry", t0 + 30 * 60_000);
    expect(demoDesks(state)).toEqual(before);
  });

  it("교신 도착 시각은 시작부터 INCOMING_EVERY마다", () => {
    const state = createDemoState(t0);
    const snap = buildSnapshot(state, "default", t0 + 2 * INCOMING_EVERY + 5);
    expect(snap.tasks.find((t) => t.id === "t-in-doc")?.since).toBe(
      t0 + INCOMING_EVERY,
    );
    expect(snap.tasks.find((t) => t.id === "t-in-dm")?.since).toBe(
      t0 + 2 * INCOMING_EVERY,
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

  it("미룬 기다림은 본부처럼 Task만 빠지고 책상에는 남는다(끝나면 Task도 돌아온다)", () => {
    const state = createDemoState(t0);
    const id = "desk:web-shop:coupon-entry";
    state.snoozed.set(id, t0 + 3_600_000);
    const snap = buildSnapshot(state, "default", t0);
    expect(snap.tasks.some((t) => t.id === id)).toBe(false);
    expect(snap.crew.find((c) => c.id === "web-shop")?.desk?.waiting).toBe(5);
    expect(
      demoDesks(state)["web-shop"]?.waiting.some(
        (w) => w.id === "coupon-entry",
      ),
    ).toBe(true);
    const later = buildSnapshot(state, "default", t0 + 3_600_001);
    expect(later.tasks.some((t) => t.id === id)).toBe(true);
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
