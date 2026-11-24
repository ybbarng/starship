import { beforeEach, describe, expect, it } from "vitest";
import { type Desk, deskTaskId } from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { crewTaskCount } from "@/ui/desk/CrewTasks";
import {
  deskSentKey,
  forkKey,
  keepLast,
  noteTaskResult,
  READ_MAX,
  readKey,
  SENT_MAX,
  SENT_TTL_MS,
  tidySaved,
  useSent,
} from "./sent";

beforeEach(() =>
  useSent.setState({ sent: {}, sentAt: {}, read: {}, snoozed: {} }),
);

describe("tidySaved: 저장해 둔 것을 읽을 때 정리한다", () => {
  const now = Date.parse("2026-11-24T12:00:00+09:00");
  const HOUR = 60 * 60 * 1000;
  const coupon = deskSentKey(deskTaskId("web-shop", "coupon-ui"));
  const push = deskSentKey(deskTaskId("web-shop", "prod-push"));

  it("끝 시각이 지난 미룸은 버리고 아직 남은 미룸은 둔다", () => {
    const saved = { snoozed: { [coupon]: now - 1, [push]: now + HOUR } };
    expect(tidySaved(saved, now).snoozed).toEqual({ [push]: now + HOUR });
  });

  it("보낸 지 7일이 지났거나 보낸 시각이 없는 답은 버린다", () => {
    const fork = forkKey("web-shop", "cart", "coupon");
    const saved = {
      sent: { [coupon]: "결제 칸 안에", [push]: "승인", [fork]: "합치기" },
      sentAt: { [coupon]: now - SENT_TTL_MS - 1, [push]: now - HOUR },
    };
    const out = tidySaved(saved, now);
    expect(out.sent).toEqual({ [push]: "승인" });
    expect(out.sentAt).toEqual({ [push]: now - HOUR });
  });

  it("읽음은 넣은 순서로 최근 READ_MAX개만 남긴다", () => {
    const read: Record<string, true> = {};
    for (let i = 0; i < READ_MAX + 2; i++)
      read[readKey("web-shop", `a${i}`)] = true;
    const out = Object.keys(tidySaved({ read }, now).read);
    expect(out.length).toBe(READ_MAX);
    expect(out[0]).toBe(readKey("web-shop", "a2"));
  });

  it("보낸 답도 최근 SENT_MAX개만 남긴다", () => {
    const sent: Record<string, string> = {};
    const sentAt: Record<string, number> = {};
    for (let i = 0; i < SENT_MAX + 1; i++) {
      const k = deskSentKey(deskTaskId("web-shop", `w${i}`));
      sent[k] = "승인";
      sentAt[k] = now - HOUR;
    }
    const out = Object.keys(tidySaved({ sent, sentAt }, now).sent);
    expect(out.length).toBe(SENT_MAX);
    expect(out[0]).toBe(deskSentKey(deskTaskId("web-shop", "w1")));
  });

  it("모양이 틀린 값과 비어 있는 저장은 빈 상태로 읽는다", () => {
    const empty = { sent: {}, sentAt: {}, read: {}, snoozed: {} };
    expect(tidySaved(undefined, now)).toEqual(empty);
    expect(
      tidySaved({ sent: [1], read: { [coupon]: "yes" }, snoozed: "x" }, now),
    ).toEqual(empty);
  });

  it("keepLast는 상한 안이면 그대로 두고 넘으면 앞에서부터 버린다", () => {
    expect(keepLast({ a: 1, b: 2 }, 2)).toEqual({ a: 1, b: 2 });
    expect(keepLast({ a: 1, b: 2, c: 3 }, 2)).toEqual({ b: 2, c: 3 });
  });
});

describe("저장소 동작이 남긴 시각과 상한", () => {
  it("mark는 보낸 시각을 남기고 clear는 함께 지운다", () => {
    const key = forkKey("web-shop", "cart", "coupon");
    const before = Date.now();
    useSent.getState().mark(key, "합치기");
    expect(useSent.getState().sentAt[key]).toBeGreaterThanOrEqual(before);
    useSent.getState().clear(key);
    expect(useSent.getState().sentAt).toEqual({});
  });

  it("다시 보낸 답은 맨 뒤로 옮겨 상한에서 가장 늦게 버려진다", () => {
    const s = useSent.getState();
    s.mark("fork:a", "1");
    s.mark("fork:b", "2");
    s.mark("fork:a", "3");
    expect(Object.keys(useSent.getState().sent)).toEqual(["fork:b", "fork:a"]);
  });
});

describe("보낸 답: 화면 하나가 아니라 저장소에", () => {
  it("깃발 답은 승무원·구역·깃발로 찾는다(창을 닫았다 열어도 같은 열쇠)", () => {
    useSent.getState().mark(forkKey("web-shop", "cart", "coupon"), "합치기");
    expect(useSent.getState().sent[forkKey("web-shop", "cart", "coupon")]).toBe(
      "합치기",
    );
    useSent.getState().clear(forkKey("web-shop", "cart", "coupon"));
    expect(useSent.getState().sent).toEqual({});
  });

  it("책상에서 빠진 기다림의 답만 지우고 다른 승무원 것은 둔다", () => {
    const keep = deskSentKey(deskTaskId("web-shop", "coupon-ui"));
    const gone = deskSentKey(deskTaskId("web-shop", "prod-push"));
    const other = deskSentKey(deskTaskId("blog", "title"));
    const s = useSent.getState();
    s.mark(keep, "결제 칸 안에 바로 입력");
    s.mark(gone, "승인");
    s.mark(other, "확인함");
    s.prune(deskTaskId("web-shop", ""), new Set([keep]));
    expect(Object.keys(useSent.getState().sent).sort()).toEqual(
      [keep, other].sort(),
    );
  });

  it("noteTaskResult: 본부가 받은 책상 할 일 미룸은 어느 화면에서 눌렀든 남긴다", () => {
    const id = deskTaskId("web-shop", "coupon-ui");
    const until = Date.parse("2026-11-03T11:00:00+09:00");
    const req = { target: "task", id, action: "snooze", until } as const;
    // 본부가 못 받았으면 남기지 않는다
    noteTaskResult(req, { ok: false });
    expect(useSent.getState().snoozed).toEqual({});
    // 책상 밖 할 일은 카드가 없으니 남기지 않는다
    noteTaskResult({ ...req, id: "gh:pr:1" }, { ok: true });
    expect(useSent.getState().snoozed).toEqual({});
    noteTaskResult(req, { ok: true });
    expect(useSent.getState().snoozed).toEqual({ [deskSentKey(id)]: until });
  });

  it("미룬 기다림도 책상에서 빠지면 함께 지운다", () => {
    const keep = deskSentKey(deskTaskId("web-shop", "coupon-ui"));
    const gone = deskSentKey(deskTaskId("web-shop", "prod-push"));
    const until = Date.parse("2026-11-03T11:00:00+09:00");
    const s = useSent.getState();
    s.snooze(keep, until);
    s.snooze(gone, until);
    s.prune(deskTaskId("web-shop", ""), new Set([keep]));
    expect(useSent.getState().snoozed).toEqual({ [keep]: until });
  });
});

describe("crewTaskCount: 읽음으로 숨긴 답해 둔 것은 세지 않는다", () => {
  const desk: Desk = {
    desk: "starship-desk/1",
    updatedAt: "2026-11-03T10:00:00+09:00",
    waiting: [],
    doing: [],
    answers: [
      {
        id: "a1",
        q: "쿠폰 두 장?",
        a: "합쳐서 한 줄",
        at: "2026-11-03T09:50:00+09:00",
      },
      {
        id: "a2",
        q: "스크린샷 어디?",
        a: "public/demo-files",
        at: "2026-11-03T09:40:00+09:00",
      },
    ],
  };
  const reply: Task = {
    id: "reply:web-shop",
    kind: "reply",
    source: { kind: "session", service: "Claude Code" },
    context: "work",
    title: "마지막 답변",
    from: "web-shop",
    crewId: "web-shop",
    since: Date.parse("2026-11-03T09:00:00+09:00"),
    actions: ["answer"],
  };

  // 화면은 useSent((s) => s.read)를 구독해 넘긴다. 읽음을 누르면 배지가 바로 다시 그려지게(2026-11-03)
  const read = () => useSent.getState().read;

  it("숨긴 것을 빼고, 본부가 못 받아 되돌리면 다시 센다", () => {
    expect(crewTaskCount("web-shop", desk, [reply], read())).toBe(2);
    useSent.getState().setRead(readKey("web-shop", "a1"), true);
    expect(crewTaskCount("web-shop", desk, [reply], read())).toBe(1);
    useSent.getState().setRead(readKey("web-shop", "a1"), false);
    expect(crewTaskCount("web-shop", desk, [reply], read())).toBe(2);
  });

  it("넘긴 읽음 기록으로 센다(가게의 지금 값을 몰래 읽지 않는다)", () => {
    const hidden = { [readKey("web-shop", "a1")]: true as const };
    expect(crewTaskCount("web-shop", desk, [reply], hidden)).toBe(1);
    expect(crewTaskCount("web-shop", desk, [reply], {})).toBe(2);
  });

  it("할 일이 마지막 답변뿐이어도 승무원 id로 찾는다(할 일에서 crewId를 짐작하지 않는다)", () => {
    const hidden = { [readKey("web-shop", "a2")]: true as const };
    expect(crewTaskCount("web-shop", desk, [], hidden)).toBe(1);
  });

  it("결재(decisionsByCrew) + 읽지 않은 답: 미뤘거나 아직 Task가 없는 기다림은 세지 않는다", () => {
    const since = Date.parse("2026-11-03T09:30:00+09:00");
    const deskTask = (waitId: string): Task => ({
      ...reply,
      id: deskTaskId("web-shop", waitId),
      kind: "question",
      title: `${waitId} 정하기`,
      since,
      actions: ["answer", "snooze"],
    });
    const outside: Task = {
      ...reply,
      id: "gh:pr:41",
      kind: "review",
      source: { kind: "review", service: "GitHub" },
      title: "PR #41 리뷰",
      since,
      actions: ["focus", "dismiss"],
    };
    // 기다림 셋: w1은 Task가 있고, w2는 미뤄서 Task가 빠졌고, w3는 아직 Task가 안 왔다
    const three: Desk = {
      ...desk,
      waiting: ["w1", "w2", "w3"].map((id) => ({
        id,
        type: "answer" as const,
        title: `${id} 정하기`,
      })),
    };
    expect(
      crewTaskCount("web-shop", three, [deskTask("w1"), outside, reply], {}),
    ).toBe(2 + 2);
  });

  it("다른 승무원에서 숨긴 같은 id는 건드리지 않는다", () => {
    useSent.getState().setRead(readKey("blog", "a1"), true);
    expect(crewTaskCount("web-shop", desk, [reply], read())).toBe(2);
  });
});
