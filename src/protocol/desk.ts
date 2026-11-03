// 책상 형식 starship-desk/1. 세션 하나가 "나를 기다리는 것"과 "지금 하는 일"을 적어 두는 한 장이다.
// 이 파일이 스키마의 원본이다. 비서도 같은 규칙으로 읽으니 여기 함수는 모두 순수 함수로 둔다.
// 자세한 설명은 docs/desk.md.
import { z } from "zod";
import { parseEach, WebUrl, When } from "./common";

export const DESK_FORMAT = "starship-desk/1" as const;

/**
 * 이 맥의 파일 경로. 절대 경로(/로 시작)나 홈 기준 경로(~/로 시작). 선실이 "보기"(/api/files)·"열기"(/api/files/open) 단추로 쓴다.
 * ~/는 Starship 서버가 홈으로 펼친다. 허용 폴더·숨김·확장자 검사도 서버가 따로 한다(docs/files.md). 여기서는 모양만 본다.
 */
const FilePath = z
  .string()
  .max(4096)
  .refine(
    (s) => s.startsWith("/") || s.startsWith("~/"),
    "절대 경로(/로 시작)나 ~/로 시작하는 경로만 쓸 수 있어요",
  );

/**
 * 기다리는 것의 종류.
 * - decide: 둘 이상 중 하나를 골라 달라
 * - check: 만든 것을 봐 달라(항목마다 주소와 보실 점)
 * - approve: 해도 되는지 승인해 달라(push·배포 같은 바깥 일)
 * - answer: 글로 답해 달라
 */
export const WaitType = z.enum(["decide", "check", "approve", "answer"]);
export type WaitType = z.infer<typeof WaitType>;

export const WaitOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: WebUrl.optional(),
  /** 선택지를 보여 줄 파일(스크린샷·PDF 등) */
  path: FilePath.optional(),
  note: z.string().optional(),
  recommended: z.boolean().optional(),
});
export type WaitOption = z.infer<typeof WaitOption>;

export const CheckItem = z.object({
  label: z.string().min(1),
  url: WebUrl.optional(),
  /** 볼 파일(스크린샷·PDF·동영상 등) */
  path: FilePath.optional(),
  /** 보실 점 */
  look: z.string().optional(),
});
export type CheckItem = z.infer<typeof CheckItem>;

/**
 * 기다림의 주제(선택). 종류(type)와 따로 "무엇에 관한 기다림인가"를 적는다.
 * - code-review: 코드 리뷰를 사람이 봐 달라(PR 주소는 items[].url 등에 그대로). 할 일로 나갈 때 source.kind가 "review"가 되고,
 *   조종석 결재함 맨 위 "코드 리뷰" 칸에 모인다(2026-11-03 사용자 결정, docs/cockpit-inbox.md).
 */
export const WaitTopic = z.enum(["code-review"]);
export type WaitTopic = z.infer<typeof WaitTopic>;

export const Waiting = z
  .object({
    id: z.string().min(1),
    type: WaitType,
    /** 무엇에 관한 기다림인가(선택). code-review면 코드 리뷰 */
    topic: WaitTopic.optional(),
    /** 내가 할 일 한 줄 */
    title: z.string().min(1),
    /** 왜·맥락 짧게 */
    detail: z.string().optional(),
    since: When.optional(),
    /** 세션이 이것 때문에 멈췄나 */
    blocks: z.boolean().optional(),
    options: z.array(WaitOption).optional(),
    items: z.array(CheckItem).optional(),
    /** 답하거나 승인하면 세션이 할 일 */
    after: z.string().optional(),
  })
  .superRefine((w, ctx) => {
    if (w.type === "decide" && (w.options?.length ?? 0) < 2)
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "decide는 선택지가 2개 이상 있어야 해요",
      });
    if (w.type === "check" && (w.items?.length ?? 0) < 1)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "check는 항목이 1개 이상 있어야 해요",
      });
  });
export type Waiting = z.infer<typeof Waiting>;

export const Doing = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  since: When.optional(),
  /** 이 일에서 사용자가 미리 승인한 바깥 일(push·게시 등) 한두 줄. 선실 카드에 "승인받은 것"으로 보인다(2026-11-03 전역 규칙) */
  approved: z.string().min(1).max(500).optional(),
});
export type Doing = z.infer<typeof Doing>;

/**
 * 답해 둔 것: 사용자가 물어본 것에 세션이 답했는데 이어서 다른 일을 해서 답이 대화에서 지나갈 때,
 * 질문과 답을 남겨 둔다(2026-11-02 사용자 요청). 사용자가 "읽음"을 누르면 서버가 책상에서 뺀다.
 */
export const Answered = z.object({
  id: z.string().min(1),
  /** 물어본 것 한 줄 */
  q: z.string().min(1),
  /** 답의 요점. 길면 줄을 바꾼다. 파일 경로(/… ~/…)는 화면이 보기·열기 단추로 바꾼다 */
  a: z.string().min(1),
  /** 답한 때 */
  at: When,
});
export type Answered = z.infer<typeof Answered>;

/** 책상 한 장. 모르는 필드는 버린다(같은 버전 안에서 필드를 더할 수 있게). */
export const Desk = z.object({
  desk: z.literal(DESK_FORMAT),
  updatedAt: When,
  waiting: z.array(Waiting),
  doing: z.array(Doing),
  /** 답해 둔 것(선택). 읽으면 빠진다 */
  answers: z.array(Answered).optional(),
});
export type Desk = z.infer<typeof Desk>;

/* ───────────── 검사 ───────────── */

/**
 * 스키마로 잡지 못하는 짜임 검사: waiting id 중복, 한 기다림 안 선택지 id 중복, 답해 둔 것 id 중복.
 * parseDesk는 겹친 뒤쪽을 빼서 이 검사를 늘 통과하는 책상을 돌려준다. 책상을 직접 만드는 쪽(데모·본부)이 스스로 살필 때 쓴다.
 */
export function checkDesk(desk: Desk): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const w of desk.waiting) {
    if (ids.has(w.id)) problems.push(`기다림 id "${w.id}"가 겹쳐요`);
    ids.add(w.id);
    const opts = new Set<string>();
    for (const o of w.options ?? []) {
      if (opts.has(o.id))
        problems.push(`기다림 "${w.id}"에 선택지 id "${o.id}"가 겹쳐요`);
      opts.add(o.id);
    }
  }
  const answerIds = new Set<string>();
  for (const a of desk.answers ?? []) {
    if (answerIds.has(a.id)) problems.push(`답해 둔 것 id "${a.id}"가 겹쳐요`);
    answerIds.add(a.id);
  }
  return problems;
}

/**
 * 책상을 읽은 결과. ok면 desk는 쓸 수 있는 책상이고, problems에는 틀려서 뺀 항목이 한 줄씩 남는다(없으면 빈 배열).
 * 겉(desk 이름·updatedAt·배열 자체)이 틀릴 때만 ok가 false이고 desk가 null이다.
 */
export type DeskParse =
  | { ok: true; desk: Desk; problems: string[] }
  | { ok: false; desk: null; problems: string[] };

/** 책상의 겉. 항목은 아직 보지 않는다. */
const DeskShell = z.object({
  desk: z.literal(DESK_FORMAT),
  updatedAt: When,
  waiting: z.array(z.unknown()),
  doing: z.array(z.unknown()),
  answers: z.array(z.unknown()).optional(),
});

/** 한 기다림 안에서 겹친 선택지 id는 뒤쪽만 뺀다. 그래서 decide 선택지가 2개 미만이 되면 기다림째 뺀다. */
function fixOptions(w: Waiting, note: (why: string) => void): Waiting | string {
  if (!w.options) return w;
  const ids = new Set<string>();
  const options = w.options.filter((o) => {
    if (!ids.has(o.id)) {
      ids.add(o.id);
      return true;
    }
    note(`선택지 id "${o.id}"가 겹쳐 뒤쪽을 뺐어요`);
    return false;
  });
  if (w.type === "decide" && options.length < 2)
    return "겹친 선택지를 빼니 decide 선택지가 2개보다 적어 뺐어요";
  return { ...w, options };
}

/**
 * 책상 내용(이미 JSON.parse한 값)을 읽는다. 겉이 틀리면 책상 전체를 거절하고,
 * waiting·doing·answers는 항목마다 따로 검사해 틀린 항목만 뺀다(2026-11-03, 스냅숏과 같은 규칙).
 * 뺀 까닭은 "waiting[2] (id x): …" 꼴로 problems에 적는다. 겹친 id는 앞쪽을 남기고 뒤쪽만 뺀다.
 * 돌려준 책상은 checkDesk를 늘 통과한다.
 */
export function parseDesk(raw: unknown): DeskParse {
  const shell = DeskShell.safeParse(raw);
  if (!shell.success) {
    return {
      ok: false,
      desk: null,
      problems: shell.error.issues.map(
        (i) => `${i.path.join(".") || "(맨 위)"}: ${i.message}`,
      ),
    };
  }
  const s = shell.data;
  const problems: string[] = [];
  const waiting = parseEach(s.waiting, Waiting, "waiting", problems, {
    keyOf: (w) => w.id,
    fix: fixOptions,
  });
  const doing = parseEach(s.doing, Doing, "doing", problems);
  const answers =
    s.answers &&
    parseEach(s.answers, Answered, "answers", problems, { keyOf: (a) => a.id });
  return {
    ok: true,
    desk: {
      desk: s.desk,
      updatedAt: s.updatedAt,
      waiting,
      doing,
      ...(answers ? { answers } : {}),
    },
    problems,
  };
}

/* ───────────── 할 일과 이어 주기 ───────────── */

/** 기다림 하나를 Task로 내보낼 때의 id. 비서와 화면이 같은 규칙을 쓴다. */
export function deskTaskId(crewId: string, waitId: string): string {
  return `desk:${crewId}:${waitId}`;
}

/**
 * 기다림 하나를 Task로 내보낼 때의 출처. 코드 리뷰(topic "code-review")면 "review", 아니면 "session".
 * 비서(본부)와 데모가 같은 규칙을 쓴다(docs/desk.md "답하기" 1번).
 */
export function deskSource(w: Waiting): { kind: "review" | "session" } {
  return { kind: w.topic === "code-review" ? "review" : "session" };
}

/**
 * 기다림을 할 일로 내보낼 때의 원래 서비스 주소(Task.url).
 * 코드 리뷰(topic "code-review")일 때만 낸다: 확인 항목(items[].url)에서 먼저, 없으면 선택지(options[].url)에서
 * 첫 http(s) 주소. 결재함 서류에서 PR로 바로 가게(2026-11-03). 다른 기다림은 주소가 여럿이라 하나를 고르지 않는다.
 */
export function deskUrl(w: Waiting): string | undefined {
  if (w.topic !== "code-review") return undefined;
  const urls = [
    ...(w.items ?? []).map((i) => i.url),
    ...(w.options ?? []).map((o) => o.url),
  ];
  return urls.find((u) => u !== undefined && /^https?:\/\//i.test(u));
}

/** 기다림 하나에 답할 때 고를 수 있는 것. answer는 글로만 답한다. */
export function deskChoices(w: Waiting): string[] | undefined {
  switch (w.type) {
    case "decide":
      return (w.options ?? []).map((o) => o.label);
    case "approve":
      return ["승인", "보류"];
    case "check":
      return ["확인함", "고칠 것 있음"];
    case "answer":
      return undefined;
  }
}

/** 갑판에 작게 보일 책상 요약. Crew.desk와 같다. */
export type DeskSummary = { waiting: number; doing: number; answers?: number };

export function summarizeDesk(desk: Desk): DeskSummary {
  const answers = desk.answers?.length ?? 0;
  return {
    waiting: desk.waiting.length,
    doing: desk.doing.length,
    ...(answers ? { answers } : {}),
  };
}

/** 답해 둔 것을 읽음으로 할 때 쓰는 열쇠(데모 상태·비서가 같은 규칙). */
export function answerKey(crewId: string, answerId: string): string {
  return `answer:${crewId}:${answerId}`;
}

/**
 * 카드에서 보낼 answer 글. 고른 것에 글을 덧붙이면 "고른 것 — 글"로 한 줄에 잇는다.
 * 세션 창에서는 줄바꿈이 곧 보내기라 줄바꿈은 공백으로 바꾼다. 둘 다 비면 undefined.
 */
export function deskAnswer(choice?: string, text?: string): string | undefined {
  const note = (text ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
  if (choice && note) return `${choice} — ${note}`;
  return choice || note || undefined;
}
