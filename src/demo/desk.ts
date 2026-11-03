// 데모 책상: 지어낸 세션들이 나를 기다리는 것과 지금 하는 일.
// web-shop은 네 종류(decide·check·approve·answer)와 코드 리뷰(topic code-review)가 다 있고 지도도 있다. orbit-notes는 지도 없이 책상만 있다.
// 기다림 하나하나는 스냅샷의 Task로도 나간다(id desk:<crewId>:<waitId>). 답하면 책상에서도 빠진다.
import {
  answerKey,
  type Desk,
  deskChoices,
  deskSource,
  deskTaskId,
  type Waiting,
} from "@/protocol/desk";
import type { Task, TaskKind } from "@/protocol/v1";

const MIN = 60_000;

/**
 * 데모 예시 파일(public/demo-files) 절대 경로. 데모 모드의 파일 끝점이 허용하는 폴더와 같다
 * (src/server/files.ts의 demoFilesDir). 이 모듈은 서버에서만 불린다.
 */
const demoFile = (name: string) => `${process.cwd()}/public/demo-files/${name}`;

const iso = (now: number, minsAgo: number) =>
  new Date(now - minsAgo * MIN).toISOString();

export function buildDemoDesks(now = Date.now()): Record<string, Desk> {
  return {
    "web-shop": {
      desk: "starship-desk/1",
      updatedAt: iso(now, 4),
      waiting: [
        {
          id: "coupon-entry",
          type: "decide",
          title: "쿠폰 입력 방식 두 가지 중 고르기",
          detail:
            "결제 화면에서 쿠폰을 넣는 자리. 둘 다 데모로 띄워 뒀어요. 고르면 나머지는 지워요.",
          since: iso(now, 42),
          blocks: true,
          options: [
            {
              id: "inline",
              label: "결제 칸 안에 바로 입력",
              url: "https://example.com/web-shop/demo/coupon-inline",
              note: "한 화면에서 끝나요. 칸이 하나 늘어요",
              recommended: true,
            },
            {
              id: "sheet",
              label: "쿠폰함을 아래에서 열기",
              url: "https://example.com/web-shop/demo/coupon-sheet",
              path: demoFile("coupon-sheet.png"),
              note: "가진 쿠폰을 골라요. 누르는 횟수가 하나 늘어요",
            },
          ],
          after: "고른 방식만 남기고 결제 화면 시험을 다시 돌려요",
        },
        {
          id: "checkout-motion",
          type: "check",
          title: "결제 화면 연출 4개 확인",
          detail: "움직임이 과하지 않은지 봐 주세요.",
          since: iso(now, 25),
          items: [
            {
              label: "담기 버튼이 장바구니로 날아가기",
              url: "https://example.com/web-shop/demo/motion-1",
              look: "느린 폰에서도 끊기지 않나",
            },
            {
              label: "쿠폰 적용 때 금액 숫자 굴리기",
              url: "https://example.com/web-shop/demo/motion-2",
              look: "숫자가 다 굴러간 뒤 최종 금액이 바로 읽히나",
            },
            {
              label: "결제 완료 색종이",
              url: "https://example.com/web-shop/demo/motion-3",
              look: "2초 안에 끝나나",
            },
            {
              label: "품절 상품 흔들기",
              url: "https://example.com/web-shop/demo/motion-4",
              look: "오류처럼 보이지 않나",
            },
            {
              label: "연출 점검표",
              path: demoFile("motion-checklist.pdf"),
              look: "네 연출의 길이가 표와 맞나",
            },
            {
              label: "느린 폰에서 잰 기록",
              path: demoFile("slow-phone.log"),
              look: "끊긴 프레임이 있나",
            },
            {
              // path 없이 글 속에만 경로를 적는 세션도 있다. 선실이 글 속 경로에도 보기·열기를 붙인다.
              label: `릴리스 노트 초안 ${demoFile("release-notes.md")}`,
              look: "표의 숫자가 점검표와 맞나, 남은 일이 맞나",
            },
          ],
          after: "고칠 것이 없으면 연출을 그대로 굳혀요",
        },
        {
          // AI 리뷰 세션이 "사람이 보는 게 좋다"고 올린 코드 리뷰. 반나절 넘게 기다려 결재함 리뷰 칸이 경고 색이 된다.
          id: "pr-231",
          type: "check",
          topic: "code-review",
          title: "shop#231 결제 재시도 고침 — 사람 리뷰 필요",
          detail:
            "AI 리뷰로는 재시도 상한과 중복 결제 막기가 맞는지 판단하기 어려워요. 결제 대행사 응답 표와 함께 봐 주세요.",
          since: iso(now, 13 * 60),
          items: [
            {
              label: "shop#231 결제 재시도 고침",
              url: "https://github.com/example/shop/pull/231",
              look: "같은 주문이 두 번 결제될 길이 없나",
            },
          ],
          after: "고칠 것이 없으면 승인 리뷰를 남기고 머지를 맡겨요",
        },
        {
          id: "prod-push",
          type: "approve",
          title: "마음에 들면 운영에 올리기",
          detail: "위 두 가지가 끝나면 올려도 되는지 알려 주세요.",
          since: iso(now, 12),
          after: "운영 브랜치에 push하고 배포 결과를 알려 드려요",
        },
        {
          id: "free-ship",
          type: "answer",
          title: "무료 배송 기준 금액을 알려 주세요",
          detail: "지금은 3만 원으로 적어 뒀어요.",
          since: iso(now, 8),
          after: "그 금액으로 설정 화면 기본값을 바꿔요",
        },
      ],
      answers: [
        {
          id: "coupon-limit-why",
          q: "중복 쿠폰은 왜 두 장까지만 돼요?",
          a: "결제 대행사가 한 주문에 할인 줄을 두 개까지만 받아요. 세 장 이상은 앞의 두 장을 먼저 합쳐서 한 줄로 보내면 돼요.\n그렇게 바꿀지는 쿠폰 한도 갈림길에서 정하시면 돼요.",
          at: iso(now, 11),
        },
        {
          id: "screenshot-where",
          q: "장바구니 스크린샷 어디 있어요?",
          a: `${demoFile("coupon-sheet.png")} 에 있어요.`,
          at: iso(now, 26),
        },
      ],
      doing: [
        { id: "cart-scene", title: "장바구니 장면 확인", since: iso(now, 6) },
        {
          id: "unit",
          title: "쿠폰 계산 단위 시험 돌리는 중",
          since: iso(now, 3),
          approved: "시험이 통과하면 main에 push. 운영 배포는 안 함",
        },
      ],
    },
    "orbit-notes": {
      desk: "starship-desk/1",
      updatedAt: iso(now, 15),
      waiting: [
        {
          id: "format-v2",
          type: "approve",
          title: "저장 형식 v2로 옮겨도 될까요",
          detail: "옛 메모를 옮기기 전에 백업을 한 벌 만들어 둬요.",
          since: iso(now, 15),
          blocks: true,
          after: "백업하고 옮긴 뒤 날짜가 맞는지 확인해요",
        },
      ],
      doing: [],
    },
  };
}

const KIND: Record<Waiting["type"], TaskKind> = {
  decide: "question",
  check: "review",
  approve: "permission",
  answer: "question",
};

/**
 * 책상의 기다림을 Task로 내보낸다. 비서가 하는 일과 같은 모양.
 * 출처는 deskSource: 코드 리뷰(topic "code-review")면 review라서 결재함 "코드 리뷰" 칸에 모인다.
 */
export function deskTasks(
  crewId: string,
  desk: Desk,
  context: Task["context"],
  now = Date.now(),
): Task[] {
  return desk.waiting.map((w) => ({
    id: deskTaskId(crewId, w.id),
    kind: KIND[w.type],
    source: deskSource(w),
    context,
    title: w.title,
    detail: w.detail,
    from: crewId,
    crewId,
    since: w.since ? Date.parse(w.since) : now,
    actions: ["focus", "answer", "snooze"],
    choices: deskChoices(w),
  }));
}

/** 답하거나 치우거나 미룬 기다림, 읽은 답을 뺀 책상. hidden은 Task id나 answerKey로 묻는다. */
export function visibleDesk(
  crewId: string,
  desk: Desk,
  hidden: (key: string) => boolean,
): Desk {
  return {
    ...desk,
    waiting: desk.waiting.filter((w) => !hidden(deskTaskId(crewId, w.id))),
    answers: desk.answers?.filter((a) => !hidden(answerKey(crewId, a.id))),
  };
}
