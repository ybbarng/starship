import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type RelayKind, RelayLine } from "@/protocol/relay";
import {
  foldRelays,
  KEEP_DONE_MS,
  type RelayState,
  STALL_MS,
  STATE_LABEL,
  stalledCount,
  whereLabel,
} from "./fold";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse("2026-11-12T12:00:00+09:00");

/** 지금보다 minsAgo분 앞의 줄 */
function line(
  id: string | undefined,
  kind: RelayKind,
  minsAgo: number,
  over: Record<string, unknown> = {},
): RelayLine {
  return RelayLine.parse({
    relay: "starship-relay/1",
    ...(id === undefined ? {} : { id }),
    at: NOW - minsAgo * MIN,
    kind,
    ...over,
  });
}

describe("foldRelays: 상태와 지금 있는 곳(docs/hq.md 표)", () => {
  const cases: [string, RelayLine[], RelayState, string][] = [
    [
      "open 뒤: 넘기기 전, 비서",
      [line("A", "open", 10, { from: "web-shop" })],
      "open",
      "비서",
    ],
    [
      "forward 뒤: 진행 중, to의 세션",
      [
        line("A", "open", 10, { from: "web-shop" }),
        line("A", "forward", 9, { to: "doc-review" }),
      ],
      "moving",
      "doc-review",
    ],
    [
      "update 뒤: 진행 중, 있는 곳은 그대로",
      [
        line("A", "open", 10, { from: "web-shop" }),
        line("A", "forward", 9, { to: "doc-review" }),
        line("A", "update", 5, { note: "절반 봤어요" }),
      ],
      "moving",
      "doc-review",
    ],
    [
      "return 뒤: 돌려줌, 처음 부탁한 세션",
      [
        line("A", "open", 10, { from: "web-shop" }),
        line("A", "forward", 9, { to: "doc-review" }),
        line("A", "return", 2),
      ],
      "returned",
      "web-shop",
    ],
    [
      "close 뒤: 끝, 없음",
      [line("A", "open", 10, { from: "web-shop" }), line("A", "close", 1)],
      "closed",
      "없음",
    ],
    [
      "cancel 뒤: 그만둠, 없음",
      [line("A", "open", 10, { from: "web-shop" }), line("A", "cancel", 1)],
      "cancelled",
      "없음",
    ],
  ];
  it.each(cases)("%s", (_name, lines, state, where) => {
    const board = foldRelays(lines, NOW);
    const r = [...board.active, ...board.done][0];
    expect(r?.state).toBe(state);
    expect(r && whereLabel(r.where)).toBe(where);
  });

  it("줄 순서가 뒤섞여 와도 시각순으로 접는다", () => {
    const board = foldRelays(
      [
        line("A", "return", 2),
        line("A", "forward", 9, { to: "doc-review" }),
        line("A", "open", 10, { from: "web-shop" }),
      ],
      NOW,
    );
    expect(board.active[0]?.state).toBe("returned");
    expect(board.active[0]?.lines.map((l) => l.kind)).toEqual([
      "open",
      "forward",
      "return",
    ]);
  });

  it("제목·카드·note는 마지막으로 적힌 것", () => {
    const board = foldRelays(
      [
        line("A", "open", 10, {
          from: "web-shop",
          title: "문서 검토",
          card: "C-1",
        }),
        line("A", "update", 5, { title: "결제 문서 검토", note: "첫 소식" }),
        line("A", "update", 3, { note: "고칠 곳 2건" }),
      ],
      NOW,
    );
    expect(board.active[0]).toMatchObject({
      title: "결제 문서 검토",
      card: "C-1",
      note: "고칠 곳 2건",
      from: "web-shop",
      openedAt: NOW - 10 * MIN,
      lastAt: NOW - 3 * MIN,
    });
  });

  it("open이 없는 나르기는 처음 부탁한 세션을 모른다(return 뒤 없음)", () => {
    const board = foldRelays(
      [line("A", "forward", 9, { to: "x" }), line("A", "return", 1)],
      NOW,
    );
    expect(board.active[0]?.from).toBeUndefined();
    expect(board.active[0]?.where).toEqual({ kind: "none" });
  });
});

describe("멈춤", () => {
  it("끝나지 않았고 마지막 줄 뒤 24시간이 넘으면 멈춤", () => {
    const stalledMins = STALL_MS / MIN + 1;
    const board = foldRelays(
      [
        line("old", "open", stalledMins + 5, { from: "a" }),
        line("old", "forward", stalledMins, { to: "b" }),
        line("new", "open", 5, { from: "a" }),
      ],
      NOW,
    );
    expect(board.active.map((r) => [r.id, r.stalled])).toEqual([
      ["old", true],
      ["new", false],
    ]);
    expect(stalledCount(board)).toBe(1);
  });

  it("딱 24시간이면 아직 멈춤이 아니다", () => {
    const board = foldRelays([line("A", "open", STALL_MS / MIN)], NOW);
    expect(board.active[0]?.stalled).toBe(false);
  });

  it("끝난 나르기는 오래돼도 멈춤이 아니다", () => {
    const board = foldRelays([line("A", "close", 2 * 24 * 60)], NOW);
    expect(board.done[0]?.stalled).toBe(false);
  });
});

describe("끝·그만둠은 7일 지나면 뺀다", () => {
  it("7일 안은 done에, 넘으면 빠진다", () => {
    const days = (d: number) => d * 24 * 60;
    const board = foldRelays(
      [
        line("recent", "close", days(6)),
        line("gone", "cancel", KEEP_DONE_MS / MIN + 1),
        line("later", "close", days(1)),
      ],
      NOW,
    );
    expect(board.done.map((r) => r.id)).toEqual(["later", "recent"]);
  });

  it("끝나지 않은 나르기는 오래돼도 남는다", () => {
    const board = foldRelays([line("A", "open", 30 * 24 * 60)], NOW);
    expect(board.active).toHaveLength(1);
  });
});

describe("어느 일인지 모르는 넘김", () => {
  it("id 없는 forward는 따로 모으고 최근순", () => {
    const board = foldRelays(
      [
        line(undefined, "forward", 30, { to: "a" }),
        line("A", "open", 20),
        line(undefined, "forward", 10, { to: "b" }),
      ],
      NOW,
    );
    expect(board.unlinked.map((l) => l.to)).toEqual(["b", "a"]);
    expect(board.active.map((r) => r.id)).toEqual(["A"]);
  });

  it("7일 넘은 것은 뺀다", () => {
    const board = foldRelays(
      [line(undefined, "forward", KEEP_DONE_MS / MIN + 1, { to: "a" })],
      NOW,
    );
    expect(board.unlinked).toEqual([]);
  });
});

describe("docs/hq.md 표와 어긋나지 않는다", () => {
  const doc = readFileSync(
    new URL("../../docs/hq.md", import.meta.url),
    "utf8",
  );
  /** `kind` 표의 줄: | `open` | 뜻 | 상태 | 있는 곳 | */
  const rows = new Map(
    [...doc.matchAll(/^\| `(\w+)` \| [^|]+ \| ([^|]+) \| [^|]+ \|$/gm)].map(
      (m) => [m[1], m[2]?.trim()],
    ),
  );
  const after: Record<RelayKind, RelayState | undefined> = {
    open: "open",
    forward: "moving",
    update: "moving",
    return: "returned",
    close: "closed",
    cancel: "cancelled",
  };
  it.each(Object.entries(after))("%s 뒤 상태 이름", (kind, state) => {
    expect(rows.get(kind)).toBe(state && STATE_LABEL[state]);
  });

  it("문서의 멈춤 24시간·보관 7일과 상수가 같다", () => {
    expect(doc).toContain("24시간 동안 새 줄이 없으면");
    expect(STALL_MS).toBe(24 * HOUR);
    expect(doc).toContain("7일 동안 흐리게");
    expect(KEEP_DONE_MS).toBe(7 * 24 * HOUR);
  });
});
