import { describe, expect, it } from "vitest";
import { Snapshot } from "@/protocol/v1";
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

  it("세션 할 일을 치우면 그 승무원은 다시 일하러 간다", () => {
    const state = createDemoState(t0);
    state.dismissed.add("t-orbit-q");
    const snap = buildSnapshot(state, "default", t0);
    expect(snap.crew.find((c) => c.id === "orbit-notes")?.status).toBe(
      "working",
    );
  });
});
