import { describe, expect, it } from "vitest";
import { snoozeNote, waitAnswerState } from "./waitState";

const now = Date.parse("2026-11-03T10:00:00+09:00");
const MIN = 60_000;

describe("waitAnswerState: 기다림 카드 아래쪽", () => {
  it("보낸 답이 있으면 무엇보다 먼저 '보냈어요'", () => {
    expect(
      waitAnswerState({
        sent: "승인",
        canAnswer: true,
        snoozedUntil: now + 30 * MIN,
        now,
      }),
    ).toBe("sent");
  });

  it("미룬 뒤 할 일이 빠지면 '아직 답할 수 없어요'가 아니라 미뤘다고 보인다", () => {
    expect(
      waitAnswerState({
        sent: undefined,
        canAnswer: false,
        snoozedUntil: now + 59 * MIN,
        now,
      }),
    ).toBe("snoozed");
  });

  it("다시 읽기 전 할 일이 아직 남아 있어도 미룬 동안은 답 단추를 막는다", () => {
    expect(
      waitAnswerState({
        sent: undefined,
        canAnswer: true,
        snoozedUntil: now + 59 * MIN,
        now,
      }),
    ).toBe("snoozed");
  });

  it("미룬 시간이 지나 할 일이 돌아오면 다시 답할 수 있다", () => {
    expect(
      waitAnswerState({
        sent: undefined,
        canAnswer: true,
        snoozedUntil: now - MIN,
        now,
      }),
    ).toBe("open");
  });

  it("시간이 지났는데 할 일이 아직 안 돌아왔으면 미룬 것으로 둔다", () => {
    expect(
      waitAnswerState({
        sent: undefined,
        canAnswer: false,
        snoozedUntil: now - MIN,
        now,
      }),
    ).toBe("snoozed");
  });

  it("미루지 않았고 할 일이 없으면 none, 있으면 open", () => {
    const base = { sent: undefined, snoozedUntil: undefined, now };
    expect(waitAnswerState({ ...base, canAnswer: false })).toBe("none");
    expect(waitAnswerState({ ...base, canAnswer: true })).toBe("open");
  });
});

describe("snoozeNote", () => {
  it("남은 분을 적는다", () => {
    expect(snoozeNote(now + 42 * MIN, now)).toBe(
      "1시간 뒤로 미뤘어요 · 42분 뒤 다시 와요",
    );
    expect(snoozeNote(now + 60 * MIN, now)).toBe(
      "1시간 뒤로 미뤘어요 · 1시간 뒤 다시 와요",
    );
  });

  it("1분 안쪽이거나 지났으면 곧 다시 와요", () => {
    expect(snoozeNote(now + 30_000, now)).toBe(
      "1시간 뒤로 미뤘어요 · 곧 다시 와요",
    );
    expect(snoozeNote(now - MIN, now)).toBe(
      "1시간 뒤로 미뤘어요 · 곧 다시 와요",
    );
  });
});
