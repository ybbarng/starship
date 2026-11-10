// 보안 구역 형식: 비서가 남긴 1Password CLI(op) 신청서와 호출 기록.
// 정의 출처는 비서 서버의 GET /api/secure 응답이다. 설명: docs/secure.md.
// 바깥(requests·calls가 배열인지)만 엄격하고, 항목은 하나씩 따로 검사해 틀린 것만 빼고 problems에 적는다(v1.ts Snapshot과 같은 방식).
import { z } from "zod";
import { lenientArray, parseWhen } from "./common";

/** 시각: ISO 글이나 Unix 밀리초. 읽으면 밀리초 숫자로 바꾼다. */
export const Instant = z
  .union([
    z.number().nonnegative(),
    z
      .string()
      .refine((s) => !Number.isNaN(parseWhen(s)), "시각으로 읽을 수 없어요"),
  ])
  .transform((v) => (typeof v === "number" ? Math.round(v) : parseWhen(v)));

const Text = z.string();
/** 빠져도 되는 칸. null도 받아 없는 것으로 본다(출력에서는 선택 칸). */
function opt<T extends z.ZodType>(s: T) {
  return s
    .nullish()
    .transform((v) => v ?? undefined)
    .optional();
}
const MaybeText = opt(z.string());

export const SecureSession = z.object({
  /** 세션을 가리키는 열쇠. 같은 세션의 기록을 묶을 때 쓴다 */
  key: Text.min(1),
  /** 사람이 읽는 세션 이름(보통 폴더 이름). 없으면 key를 쓴다 */
  name: MaybeText,
  cwd: MaybeText,
  tmuxPane: MaybeText,
});
export type SecureSession = z.infer<typeof SecureSession>;

export const SecureActor = z.enum(["ai", "human"]);
export type SecureActor = z.infer<typeof SecureActor>;

/** 신청서의 대상 하나: 무엇(ref, 보통 op:// 참조)을 어떻게(action, 예: read) 다루나. */
export const SecureItem = z.object({ ref: Text.min(1), action: Text });
export type SecureItem = z.infer<typeof SecureItem>;

/** 신청서: AI 세션이 op를 부르기 전에 쓴다. 누가·언제·목적·계획·대상. */
export const SecureRequest = z.object({
  id: Text.min(1),
  at: Instant,
  expiresAt: Instant,
  actor: SecureActor,
  session: SecureSession,
  purpose: Text,
  plan: z.array(Text),
  items: z.array(SecureItem),
  /** 관련 카드 번호나 주소. 없으면 생략 */
  card: MaybeText,
});
export type SecureRequest = z.infer<typeof SecureRequest>;

/** 사람이 터미널에서 직접 부른 호출에 자동으로 붙는 맥락. */
export const SecureContext = z.object({
  tty: MaybeText,
  termProgram: MaybeText,
  parentCmd: MaybeText,
  gitRoot: MaybeText,
});
export type SecureContext = z.infer<typeof SecureContext>;

/** 확인함 표시: 언제(at), 누가(by, 예: "starship"). */
export const SecureAck = z.object({ at: Instant, by: MaybeText });
export type SecureAck = z.infer<typeof SecureAck>;

/** 호출 기록 하나. AI 호출 하나에 hook 기록과 wrapper 기록이 둘 다 생길 수 있다. */
export const SecureCall = z.object({
  id: Text.min(1),
  at: Instant,
  actor: SecureActor,
  /** hook: Claude Code가 명령을 실행하기 전에 남김. wrapper: op 자체를 감싼 스크립트가 남김 */
  via: z.enum(["hook", "wrapper"]),
  session: opt(SecureSession),
  context: opt(SecureContext),
  command: z.object({ sub: Text, args: z.array(Text) }),
  /** 이 호출이 기댄 신청서 id. 없으면 null */
  requestId: Text.nullish().transform((v) => v ?? null),
  decision: opt(z.enum(["allowed", "denied"])),
  exit: opt(z.number().int()),
  ms: opt(z.number().nonnegative()),
  /** 사용자가 이 빨간 기록을 "확인함"으로 표시한 때와 누가. 없거나 null이면 확인 안 함. 기록은 지우지 않는다 */
  ack: opt(SecureAck),
});
export type SecureCall = z.infer<typeof SecureCall>;

/** Starship의 POST /api/v1/secure/ack 본문: 확인함 표시할(undo면 거둘) 호출 기록 id들. */
export const SecureAckBody = z.object({
  ids: z.array(Text.min(1).max(200)).min(1).max(50),
  undo: z.boolean().optional(),
});
export type SecureAckBody = z.infer<typeof SecureAckBody>;

/**
 * 비서 서버 POST /api/secure/ack 응답. 모르는 칸은 받아 넘기고(느슨하게), 세 목록 모두 빠져도 된다.
 * acked: 이번에 표시한 id, undone: 거둔 id, unknown: 비서가 모르는 id.
 */
export const SecureAckResult = z.looseObject({
  acked: z.array(Text).optional(),
  undone: z.array(Text).optional(),
  unknown: z.array(Text).optional(),
});
export type SecureAckResult = z.infer<typeof SecureAckResult>;

/** Starship의 POST /api/v1/secure/ack 응답(200). 실패는 4xx·502와 { error }. */
export const SecureAckResponse = z.object({
  source: z.enum(["demo", "remote"]),
  acked: z.array(Text),
  undone: z.array(Text),
  unknown: z.array(Text),
});
export type SecureAckResponse = z.infer<typeof SecureAckResponse>;

/**
 * GET {비서}/api/secure 응답. 둘 다 최근순.
 * 항목 하나가 틀리면 그것만 빼고, 까닭은 problems에 "calls[3] (id c1): …" 꼴로 적는다.
 */
export const SecureLog = z
  .object({
    requests: lenientArray(SecureRequest, "requests"),
    calls: lenientArray(SecureCall, "calls"),
    problems: z.array(z.string()).optional(),
  })
  .transform(({ requests, calls, problems }) => {
    const all = [...(problems ?? []), ...requests.problems, ...calls.problems];
    return {
      requests: requests.items,
      calls: calls.items,
      ...(all.length ? { problems: all } : {}),
    };
  });
export type SecureLog = z.infer<typeof SecureLog>;

/**
 * Starship의 GET /api/v1/secure 응답.
 * source: demo면 지어낸 시험 데이터, remote면 비서가 남긴 진짜 기록이다(둘을 섞지 않는다).
 * status: none이면 비서에 보안 기록 끝점이 아직 없다(404). 그때 log는 빈 배열이다.
 * hidden: 값처럼 보여 서버에서 지운 호출 인자(args) 개수.
 */
export const SecureResponse = z.object({
  source: z.enum(["demo", "remote"]),
  status: z.enum(["ok", "none"]),
  hidden: z.number().int().nonnegative(),
  log: SecureLog,
});
export type SecureResponse = z.infer<typeof SecureResponse>;
