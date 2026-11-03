import { beforeEach, describe, expect, it } from "vitest";
import { type Desk, deskTaskId } from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { crewTaskCount } from "@/ui/desk/CrewTasks";
import { deskSentKey, forkKey, noteTaskResult, readKey, useSent } from "./sent";

beforeEach(() => useSent.setState({ sent: {}, read: {}, snoozed: {} }));

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
