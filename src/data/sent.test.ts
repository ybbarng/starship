import { beforeEach, describe, expect, it } from "vitest";
import { type Desk, deskTaskId } from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { crewTaskCount } from "@/ui/desk/CrewTasks";
import { deskSentKey, forkKey, isReadHidden, readKey, useSent } from "./sent";

beforeEach(() => useSent.setState({ sent: {}, read: {} }));

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

  it("숨긴 것을 빼고, 본부가 못 받아 되돌리면 다시 센다", () => {
    expect(crewTaskCount(desk, [reply])).toBe(2);
    useSent.getState().setRead(readKey("web-shop", "a1"), true);
    expect(isReadHidden("a1", "web-shop")).toBe(true);
    expect(crewTaskCount(desk, [reply])).toBe(1);
    useSent.getState().setRead(readKey("web-shop", "a1"), false);
    expect(crewTaskCount(desk, [reply])).toBe(2);
  });

  it("다른 승무원에서 숨긴 같은 id는 건드리지 않는다", () => {
    useSent.getState().setRead(readKey("blog", "a1"), true);
    expect(crewTaskCount(desk, [reply], "web-shop")).toBe(2);
  });
});
