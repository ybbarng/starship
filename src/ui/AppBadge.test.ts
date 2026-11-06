import { describe, expect, it } from "vitest";
import type { Task } from "@/protocol/v1";
import { isInstalledApp, waitingTotal } from "./AppBadge";

const NOW = Date.parse("2026-11-03T11:00:00+09:00");

/** 본부가 주는 모양의 할 일. 책상 기다림이면 id가 desk:<crewId>:<waitId> */
function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    kind: "question",
    source: { kind: "session", service: "Claude Code" },
    context: "work",
    title: `${id} 정하기`,
    from: "web-shop",
    crewId: "web-shop",
    since: NOW - 3600_000,
    actions: ["answer", "focus"],
    ...over,
  };
}

describe("waitingTotal: Dock 배지 숫자 = 결재 수 + 답해 둔 것", () => {
  it("책상 기다림은 desk: 할 일로 한 번만 센다(desk.waiting을 또 더하지 않는다)", () => {
    expect(
      waitingTotal(
        [task("desk:web-shop:w1"), task("desk:web-shop:w2")],
        [{ desk: { waiting: 2, doing: 1 } }],
      ),
    ).toBe(2);
  });

  it("책상 밖 할 일(감시·승무원 없는 일)도 결재로 센다", () => {
    expect(
      waitingTotal(
        [
          task("desk:web-shop:w1"),
          task("ci-red", {
            source: { kind: "monitor", service: "ci" },
            crewId: undefined,
            actions: ["focus", "dismiss"],
          }),
        ],
        [{ desk: { waiting: 1, doing: 0 } }],
      ),
    ).toBe(2);
  });

  it("마지막 답변(reply)은 소식이라 세지 않는다", () => {
    expect(
      waitingTotal(
        [
          task("0b6f1-7c8f-4d89-9a3e-3d524ba13f0c", {
            kind: "reply",
            actions: ["focus", "answer", "snooze", "dismiss"],
          }),
          task("desk:web-shop:w1"),
        ],
        [{ desk: { waiting: 1, doing: 0 } }],
      ),
    ).toBe(1);
  });

  it("답해 둔 것(desk.answers)은 승무원마다 더한다", () => {
    expect(
      waitingTotal(
        [task("desk:web-shop:w1")],
        [
          { desk: { waiting: 1, doing: 0, answers: 2 } },
          { desk: { waiting: 0, doing: 0, answers: 1 } },
          {},
        ],
      ),
    ).toBe(4);
  });

  it("아무것도 없으면 0", () => {
    expect(waitingTotal([], [])).toBe(0);
  });
});

describe("배지를 거는 곳", () => {
  /** 브라우저가 이 표시 방식만 맞다고 답하는 matchMedia */
  const mode = (m: string) => (q: string) => q === `(display-mode: ${m})`;

  it("설치한 앱(standalone)에서는 건다", () => {
    expect(isInstalledApp(mode("standalone"))).toBe(true);
    expect(isInstalledApp(mode("window-controls-overlay"))).toBe(true);
  });

  it("보통 탭(Electron 앱의 내장 탭 포함)에서는 걸지 않는다", () => {
    expect(isInstalledApp(mode("browser"))).toBe(false);
    expect(isInstalledApp(mode("minimal-ui"))).toBe(false);
  });
});
