import { describe, expect, it } from "vitest";
import {
  type Desk,
  deskAnswer,
  deskChoices,
  deskTaskId,
  parseDesk,
  summarizeDesk,
  type Waiting,
} from "./desk";

function desk(waiting: unknown[], doing: unknown[] = []): unknown {
  return {
    desk: "starship-desk/1",
    updatedAt: "2026-10-31T10:12:00+09:00",
    waiting,
    doing,
  };
}

const decide = {
  id: "submit-way",
  type: "decide",
  title: "용지 제출 방식 고르기",
  detail: "사진 올리기와 칸 채우기 중 하나",
  since: "2026-10-31T09:00:00+09:00",
  blocks: true,
  options: [
    {
      id: "photo",
      label: "사진 올리기",
      url: "https://example.com/demo/photo",
      recommended: true,
    },
    { id: "form", label: "칸 채우기", url: "https://example.com/demo/form" },
  ],
  after: "고른 방식으로 제출 화면을 마무리한다",
};

describe("parseDesk", () => {
  describe("형식", () => {
    it("비서가 쓰는 모양을 그대로 받는다", () => {
      const result = parseDesk(
        desk(
          [
            decide,
            {
              id: "scenes",
              type: "check",
              title: "연출 4개 확인",
              items: [
                {
                  label: "시작 장면",
                  url: "https://example.com/demo/1",
                  look: "글자가 너무 빨리 지나가지 않나",
                },
              ],
            },
            { id: "push", type: "approve", title: "운영에 올려도 될까요" },
            { id: "name", type: "answer", title: "대회 이름을 알려 주세요" },
          ],
          [{ title: "단위 시험 돌리는 중", since: "2026-10-31" }],
        ),
      );
      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);
    });

    it("선택지와 확인 항목에 파일 절대 경로(path)를 받는다", () => {
      const result = parseDesk(
        desk([
          {
            ...decide,
            options: [
              { ...decide.options[0], path: "/Users/me/Desktop/photo.png" },
              decide.options[1],
            ],
          },
          {
            id: "report",
            type: "check",
            title: "보고서 확인",
            items: [{ label: "보고서", path: "/Users/me/Documents/r.pdf" }],
          },
        ]),
      );
      expect(result.ok).toBe(true);
      expect(result.desk?.waiting[1]?.items?.[0]?.path).toBe(
        "/Users/me/Documents/r.pdf",
      );
    });

    it("~/로 시작하는 path도 받는다(서버가 홈으로 펼친다)", () => {
      const result = parseDesk(
        desk([
          {
            id: "report",
            type: "check",
            title: "보고서 확인",
            items: [{ label: "보고서", path: "~/Documents/r.pdf" }],
          },
        ]),
      );
      expect(result.ok).toBe(true);
    });

    it("상대 경로나 ~user 꼴 path는 걸린다", () => {
      for (const path of ["Desktop/a.png", "~me/Desktop/a.png", "~", ""]) {
        const result = parseDesk(
          desk([
            {
              id: "report",
              type: "check",
              title: "보고서 확인",
              items: [{ label: "보고서", path }],
            },
          ]),
        );
        expect(result.ok).toBe(false);
      }
    });

    it("모르는 필드는 버리고 받는다", () => {
      const result = parseDesk({
        ...(desk([{ ...decide, color: "red" }]) as object),
        extra: 1,
      });
      expect(result.ok).toBe(true);
      expect(result.desk?.waiting[0]).not.toHaveProperty("color");
    });

    it("decide에 선택지가 하나뿐이면 걸린다", () => {
      const result = parseDesk(
        desk([{ ...decide, options: [decide.options[0]] }]),
      );
      expect(result.ok).toBe(false);
      expect(result.problems[0]).toContain("waiting.0.options");
    });

    it("check에 항목이 없으면 걸린다", () => {
      const result = parseDesk(
        desk([{ id: "c", type: "check", title: "봐 주세요" }]),
      );
      expect(result.ok).toBe(false);
      expect(result.problems[0]).toContain("waiting.0.items");
    });

    it("읽을 수 없는 날짜는 걸린다", () => {
      const result = parseDesk(desk([{ ...decide, since: "어제쯤" }]));
      expect(result.ok).toBe(false);
    });

    it("http(s)가 아닌 주소는 걸린다", () => {
      const bad = {
        ...decide,
        options: [
          { id: "a", label: "가", url: "javascript:alert(1)" },
          decide.options[1],
        ],
      };
      expect(parseDesk(desk([bad])).ok).toBe(false);
      const file = {
        id: "c",
        type: "check",
        title: "봐 주세요",
        items: [{ label: "가", url: "file:///etc/passwd" }],
      };
      expect(parseDesk(desk([file])).ok).toBe(false);
    });

    it("다른 버전은 받지 않는다", () => {
      const result = parseDesk({
        ...(desk([]) as object),
        desk: "starship-desk/2",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("짜임", () => {
    it("waiting id가 겹치면 걸린다", () => {
      const result = parseDesk(desk([decide, { ...decide }]));
      expect(result.ok).toBe(false);
      expect(result.problems).toEqual(['기다림 id "submit-way"가 겹쳐요']);
    });

    it("한 기다림 안에서 선택지 id가 겹치면 걸린다", () => {
      const result = parseDesk(
        desk([
          {
            ...decide,
            options: [decide.options[0], { ...decide.options[1], id: "photo" }],
          },
        ]),
      );
      expect(result.problems).toEqual([
        '기다림 "submit-way"에 선택지 id "photo"가 겹쳐요',
      ]);
    });
  });

  describe("하는 일의 승인받은 것(approved)", () => {
    const ship = {
      id: "ship",
      title: "쿠폰 화면 고친 것 내보내기",
      since: "2026-11-03T11:40:00+09:00",
      approved: "main에 push, 시험 서버 배포. 운영 배포는 안 함",
    };

    it("있으면 버리지 않고 그대로 읽는다", () => {
      const result = parseDesk(desk([], [ship]));
      expect(result.ok && result.desk.doing[0]?.approved).toBe(ship.approved);
    });

    it("빈 글은 거절한다", () => {
      expect(parseDesk(desk([], [{ ...ship, approved: "" }])).ok).toBe(false);
    });
  });
});

describe("할 일과 이어 주기", () => {
  const parsed = parseDesk(desk([decide])) as { desk: Desk };
  const w = parsed.desk.waiting[0] as Waiting;

  it("Task id는 desk:<crewId>:<waitId>", () => {
    expect(deskTaskId("mighty", "submit-way")).toBe("desk:mighty:submit-way");
  });

  it("종류마다 고를 것이 정해져 있다", () => {
    expect(deskChoices(w)).toEqual(["사진 올리기", "칸 채우기"]);
    expect(deskChoices({ ...w, type: "approve" })).toEqual(["승인", "보류"]);
    expect(deskChoices({ ...w, type: "check" })).toEqual([
      "확인함",
      "고칠 것 있음",
    ]);
    expect(deskChoices({ ...w, type: "answer" })).toBeUndefined();
  });

  it("요약은 기다림 수와 하는 일 수", () => {
    expect(summarizeDesk(parsed.desk)).toEqual({ waiting: 1, doing: 0 });
  });
});

describe("deskAnswer", () => {
  it("고른 것과 글을 한 줄로 잇는다", () => {
    expect(deskAnswer("고칠 것 있음", "버튼 색이\n흐려요 ")).toBe(
      "고칠 것 있음 — 버튼 색이 흐려요",
    );
  });
  it("하나만 있으면 그것만", () => {
    expect(deskAnswer("승인")).toBe("승인");
    expect(deskAnswer(undefined, "3만 원")).toBe("3만 원");
    expect(deskAnswer(undefined, "  \n ")).toBeUndefined();
  });
});

describe("답해 둔 것(answers)", () => {
  const answer = (id: string) => ({
    id,
    q: "중복 쿠폰은 왜 두 장까지만 돼요?",
    a: "결제 대행사가 할인 줄을 두 개까지만 받아요.",
    at: "2026-11-02T17:20:00+09:00",
  });
  const withAnswers = (answers: unknown[]) => ({
    ...(desk([]) as object),
    answers,
  });

  it("없어도 되고, 있으면 그대로 읽는다", () => {
    expect(parseDesk(desk([])).ok).toBe(true);
    const r = parseDesk(withAnswers([answer("a1")]));
    expect(r.ok && r.desk.answers?.[0]?.q).toBe(answer("a1").q);
  });

  it("id가 겹치면 거절한다", () => {
    const r = parseDesk(withAnswers([answer("a1"), answer("a1")]));
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toContain("a1");
  });

  it("요약에 답 수가 붙는다(없으면 빠진다)", () => {
    const r = parseDesk(withAnswers([answer("a1"), answer("a2")]));
    expect(r.ok && summarizeDesk(r.desk)).toEqual({
      waiting: 0,
      doing: 0,
      answers: 2,
    });
    const empty = parseDesk(desk([]));
    expect(empty.ok && summarizeDesk(empty.desk)).toEqual({
      waiting: 0,
      doing: 0,
    });
  });
});
