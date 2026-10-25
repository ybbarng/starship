// Starship 프로토콜 v1. 화면(이 앱)과 데이터를 주는 서버 사이의 약속이다.
// 서버는 GET {base}/v1/snapshot 으로 Snapshot을, POST {base}/v1/actions 로 ActionRequest를 받는다.
// 자세한 설명은 docs/protocol.md.
import { z } from "zod";

export const PROTOCOL = "starship/1" as const;

/** 업무인지 개인인지. 화면은 두 가지를 색과 글로 나눠 보여 준다. */
export const Context = z.enum(["work", "personal"]);
export type Context = z.infer<typeof Context>;

/** 시각은 모두 Unix 밀리초. 소수점이 와도 받아서 반올림한다. */
const Millis = z.number().nonnegative().transform(Math.round);

/**
 * 할 일이 어디서 왔나.
 * - session: AI 코딩 세션(세션이 나를 기다린다)
 * - chat: 채팅(DM·멘션)
 * - issue: 이슈 트래커(카드 담당·댓글·멘션)
 * - review: 코드 리뷰 요청
 * - doc: 문서 댓글·멘션
 * - reminder: 날짜가 정해진 할 일
 * - monitor: 정기 작업·점검 경보
 */
export const SourceKind = z.enum([
  "session",
  "chat",
  "issue",
  "review",
  "doc",
  "reminder",
  "monitor",
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const Source = z.object({
  kind: SourceKind,
  /** 서비스 이름. 화면에 그대로 적는다(예: "Slack", "GitHub"). */
  service: z.string().min(1).optional(),
});
export type Source = z.infer<typeof Source>;

/**
 * 무엇을 바라나.
 * - question: 질문에 답해 달라
 * - permission: 허락해 달라
 * - input: 다음 지시를 기다린다
 * - reply: 세션이 일을 마쳤다, 결과를 봐 달라
 * - mention: 사람이 불렀다
 * - review: 봐 달라(코드·문서)
 * - todo: 할 일
 * - alert: 경보
 */
export const TaskKind = z.enum([
  "question",
  "permission",
  "input",
  "reply",
  "mention",
  "review",
  "todo",
  "alert",
]);
export type TaskKind = z.infer<typeof TaskKind>;

/**
 * 할 일에 할 수 있는 동작.
 * - focus: 그 일이 있는 곳으로 간다(세션 창, 원래 서비스)
 * - answer: 그 자리에서 답한다(choices 중 하나 또는 글)
 * - snooze: 미룬다(until까지)
 * - dismiss: 치운다
 * - handoff: 비서에게 넘긴다
 */
export const TaskAction = z.enum([
  "focus",
  "answer",
  "snooze",
  "dismiss",
  "handoff",
]);
export type TaskAction = z.infer<typeof TaskAction>;

export const Task = z.object({
  id: z.string().min(1),
  kind: TaskKind,
  source: Source,
  context: Context,
  /** 첫 줄. 화면에서 가장 크게 보이는 글이다. */
  title: z.string(),
  /** 나머지 글. 모달에서 펼쳐 보인다. */
  detail: z.string().optional(),
  /** 누가 기다리나(사람 이름, 세션 이름). */
  from: z.string().min(1),
  /** 어느 승무원(프로젝트)의 일인가. 없으면 "새 일". */
  crewId: z.string().min(1).optional(),
  /** 언제부터 기다렸나. */
  since: Millis,
  /** 할 수 있는 동작. 화면은 여기 있는 버튼만 보인다. */
  actions: z.array(TaskAction),
  /** answer로 고를 수 있는 선택지. */
  choices: z.array(z.string().min(1)).optional(),
  /** 원래 서비스에서 여는 주소. */
  url: z.url().optional(),
});
export type Task = z.infer<typeof Task>;

/** 교신: 사람이 나에게 보낸 메시지 한 통. 할 일과 이어질 수 있다. */
export const Hail = z.object({
  id: z.string().min(1),
  from: z.object({
    name: z.string().min(1),
    /** 보낸 사람의 역할이나 자리(예: "디자이너", "#web-team"). */
    where: z.string().optional(),
  }),
  source: Source,
  context: Context,
  /** 메시지 한 줄. */
  line: z.string(),
  since: Millis,
  /** 이 교신으로 생긴 할 일. 있으면 할 일 동작으로 답한다. */
  taskId: z.string().min(1).optional(),
  crewId: z.string().min(1).optional(),
  url: z.url().optional(),
});
export type Hail = z.infer<typeof Hail>;

/**
 * 승무원 상태.
 * - working: 일하는 중
 * - needs-you: 나를 기다린다
 * - idle: 쉬는 중(세션은 있음)
 * - off: 세션 없음
 */
export const CrewStatus = z.enum(["working", "needs-you", "idle", "off"]);
export type CrewStatus = z.infer<typeof CrewStatus>;

export const CrewAction = z.enum(["focus", "brief"]);
export type CrewAction = z.infer<typeof CrewAction>;

/** 승무원 = 프로젝트 하나(와 그 AI 세션). */
export const Crew = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  context: Context,
  status: CrewStatus,
  /** 지금 하는 일 한 줄. */
  activity: z.string().optional(),
  /** 마지막으로 상태가 바뀐 때. */
  since: Millis.optional(),
  /** 창(터미널)이 열려 있나. 열린 승무원은 크게, 나머지는 작게. */
  onDeck: z.boolean(),
  brief: z
    .object({
      summary: z.string(),
      today: z.array(z.string()),
      next: z.array(z.string()),
      risks: z.array(z.string()),
      at: Millis,
    })
    .optional(),
  actions: z.array(CrewAction),
});
export type Crew = z.infer<typeof Crew>;

export const GaugeStatus = z.enum(["ok", "warn", "error", "off"]);
export type GaugeStatus = z.infer<typeof GaugeStatus>;

/** 계기판 등 하나: 정기 작업, 서비스 상태, 숫자. */
export const Gauge = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: GaugeStatus,
  /** 등 옆에 적을 짧은 값(예: "3/4", "2시간 전"). */
  value: z.string().optional(),
  detail: z.string().optional(),
  at: Millis.optional(),
});
export type Gauge = z.infer<typeof Gauge>;

export const Snapshot = z.object({
  protocol: z.literal(PROTOCOL),
  generatedAt: Millis,
  /** 할 일. 서버가 급한 순으로 정렬해 준다. 첫째가 "지금 할 일". */
  tasks: z.array(Task),
  hails: z.array(Hail),
  crew: z.array(Crew),
  gauges: z.array(Gauge),
  /** 화면 구석에 적을 안내(예: "데모 데이터"). */
  notice: z.string().optional(),
});
export type Snapshot = z.infer<typeof Snapshot>;

export const ActionRequest = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("task"),
    id: z.string().min(1),
    action: TaskAction,
    /** answer일 때 고른 선택지나 쓴 글. */
    answer: z.string().optional(),
    /** snooze일 때 다시 보일 시각. */
    until: Millis.optional(),
  }),
  z.object({
    target: z.literal("crew"),
    id: z.string().min(1),
    action: CrewAction,
  }),
]);
export type ActionRequest = z.infer<typeof ActionRequest>;

export const ActionResult = z.object({
  ok: z.boolean(),
  /** 화면에 잠깐 띄울 한 줄. */
  note: z.string().optional(),
  /** 브라우저에서 열 주소(focus가 원래 서비스로 가야 할 때). */
  openUrl: z.url().optional(),
});
export type ActionResult = z.infer<typeof ActionResult>;
