// 데모 모드의 지어낸 데이터. 실제 사람·회사·서비스 내용은 없다.
// 시나리오: default(보통), empty(할 일 0개), busy(승무원 30명·할 일 많음).
import {
  type Crew,
  type Gauge,
  type Hail,
  PROTOCOL,
  type Snapshot,
  type Task,
  type TaskAction,
  type TaskKind,
} from "@/protocol/v1";

const MIN = 60_000;
const HOUR = 60 * MIN;

export type Scenario = "default" | "empty" | "busy";

export function parseScenario(value: string | null | undefined): Scenario {
  return value === "empty" || value === "busy" ? value : "default";
}

type CrewSeed = {
  id: string;
  context: Crew["context"];
  status: Crew["status"];
  activity?: string;
  onDeck: boolean;
};

const CREW: CrewSeed[] = [
  { id: "orbit-notes", context: "personal", status: "needs-you", onDeck: true },
  {
    id: "web-shop",
    context: "work",
    status: "working",
    activity: "장바구니 쿠폰 계산 고치는 중",
    onDeck: true,
  },
  { id: "pixel-forge", context: "work", status: "needs-you", onDeck: true },
  {
    id: "garden-bot",
    context: "personal",
    status: "working",
    activity: "물 주기 일정표 만드는 중",
    onDeck: true,
  },
  { id: "lunar-blog", context: "personal", status: "needs-you", onDeck: true },
  { id: "billing-api", context: "work", status: "idle", onDeck: true },
  {
    id: "star-atlas",
    context: "personal",
    status: "working",
    activity: "별자리 선 데이터 정리 중",
    onDeck: true,
  },
  { id: "admin-console", context: "work", status: "needs-you", onDeck: true },
  { id: "recipe-box", context: "personal", status: "idle", onDeck: false },
  { id: "trail-map", context: "personal", status: "off", onDeck: false },
  { id: "data-pipeline", context: "work", status: "off", onDeck: false },
  { id: "chess-coach", context: "personal", status: "off", onDeck: false },
  { id: "design-tokens", context: "work", status: "off", onDeck: false },
  { id: "home-lab", context: "personal", status: "idle", onDeck: false },
  { id: "search-index", context: "work", status: "off", onDeck: false },
  { id: "kanji-cards", context: "personal", status: "off", onDeck: false },
];

const EXTRA_CREW = [
  "sound-loom",
  "photo-sorter",
  "budget-buddy",
  "weather-desk",
  "book-shelf",
  "auth-gateway",
  "mobile-app",
  "event-bus",
  "tea-timer",
  "dotfiles",
  "lab-notebook",
  "release-bot",
  "map-tiles",
  "invoice-pdf",
];

const BRIEFS: Record<string, NonNullable<Crew["brief"]>> = {
  "orbit-notes": {
    summary:
      "메모 앱에 궤도 모양 타임라인을 붙이는 중. 저장 형식을 바꾸기 전에 확인을 기다린다.",
    today: ["저장 형식 v2로 옮기기", "타임라인 확대·축소 버튼"],
    next: ["모바일 화면 맞추기"],
    risks: ["옛 메모를 옮기다 날짜가 하루 밀릴 수 있다"],
    at: 0,
  },
  "web-shop": {
    summary: "쿠폰 두 장을 같이 쓰면 금액이 틀리는 버그를 고치는 중.",
    today: ["쿠폰 계산 테스트 추가", "결제 화면 문구 정리"],
    next: ["배송비 무료 기준 설정 화면"],
    risks: [],
    at: 0,
  },
  "pixel-forge": {
    summary: "아이콘 묶음을 SVG로 뽑는 도구. 내보내기 설정을 정하는 중.",
    today: ["내보내기 크기 고르기", "색 이름 규칙 정하기"],
    next: ["미리보기 화면"],
    risks: ["색 이름이 디자인 파일과 어긋난다"],
    at: 0,
  },
};

function crewName(id: string) {
  return id;
}

type TaskSeed = {
  id: string;
  kind: TaskKind;
  crewId?: string;
  source: Task["source"];
  context: Task["context"];
  from: string;
  title: string;
  detail?: string;
  ago: number;
  choices?: string[];
  url?: string;
};

const TASKS: TaskSeed[] = [
  {
    id: "t-orbit-q",
    kind: "question",
    crewId: "orbit-notes",
    source: { kind: "session" },
    context: "personal",
    from: "orbit-notes 세션",
    title:
      "옛 메모 1,204개를 새 저장 형식으로 옮길까요? 되돌리려면 백업이 필요해요",
    detail:
      "백업은 ~/notes-backup 에 만들어 둘게요. 옮기는 데 1분쯤 걸려요.\n옮긴 뒤 날짜가 하루 밀린 메모가 있는지 10개를 뽑아 확인할게요.",
    ago: 23 * MIN,
    choices: ["옮겨 줘", "백업만 먼저", "나중에"],
  },
  {
    id: "t-pixel-perm",
    kind: "permission",
    crewId: "pixel-forge",
    source: { kind: "session" },
    context: "work",
    from: "pixel-forge 세션",
    title: "pnpm add svgo 를 실행해도 될까요?",
    detail: "SVG 크기를 줄이는 도구예요. MIT 라이선스, 의존성 6개.",
    ago: 12 * MIN,
    choices: ["허락", "거절"],
  },
  {
    id: "t-hail-review",
    kind: "review",
    crewId: "web-shop",
    source: { kind: "review", service: "GitHub" },
    context: "work",
    from: "리뷰어",
    title: "web-shop#212 쿠폰 계산 고침 — 리뷰 요청",
    ago: 2 * HOUR + 10 * MIN,
    url: "https://example.com/web-shop/pull/212",
  },
  {
    id: "t-lunar-reply",
    kind: "reply",
    crewId: "lunar-blog",
    source: { kind: "session" },
    context: "personal",
    from: "lunar-blog 세션",
    title: "초안 세 편 맞춤법을 고쳤어요. 다음은 무엇을 할까요?",
    ago: 41 * MIN,
  },
  {
    id: "t-admin-input",
    kind: "input",
    crewId: "admin-console",
    source: { kind: "session" },
    context: "work",
    from: "admin-console 세션",
    title: "권한 표를 다 그렸어요. 역할 이름을 정해 주세요",
    ago: 8 * MIN,
  },
  {
    id: "t-hail-chat",
    kind: "mention",
    crewId: "pixel-forge",
    source: { kind: "chat", service: "Slack" },
    context: "work",
    from: "디자이너",
    title: "아이콘 색 이름 규칙, 오늘 안에 정해 주실 수 있을까요?",
    ago: 55 * MIN,
    url: "https://example.com/chat/design/1",
  },
  {
    id: "t-hail-issue",
    kind: "mention",
    source: { kind: "issue", service: "Linear" },
    context: "work",
    from: "기획자",
    title: "SHIP-88 다음 주 일정에 넣어도 될까요?",
    ago: 3 * HOUR,
    url: "https://example.com/issues/SHIP-88",
  },
  {
    id: "t-todo",
    kind: "todo",
    source: { kind: "reminder" },
    context: "personal",
    from: "날짜 할 일",
    title: "오늘 18:00 · 도메인 갱신하기",
    ago: 5 * HOUR,
  },
  {
    id: "t-alert",
    kind: "alert",
    source: { kind: "monitor" },
    context: "personal",
    from: "정기 점검",
    title: "백업 작업이 두 번 연속 실패했어요",
    ago: 90 * MIN,
  },
];

/** 시간이 지나면 하나씩 도착하는 교신(도착 연출을 보기 위한 것). */
const INCOMING: TaskSeed[] = [
  {
    id: "t-in-doc",
    kind: "mention",
    crewId: "admin-console",
    source: { kind: "doc", service: "Confluence" },
    context: "work",
    from: "팀장",
    title: "권한 정책 문서에 의견 하나만 달아 주세요",
    ago: 0,
    url: "https://example.com/docs/policy",
  },
  {
    id: "t-in-dm",
    kind: "mention",
    source: { kind: "chat", service: "Slack" },
    context: "work",
    from: "옆 팀 동료",
    title: "점심 같이 하실래요? 12시 반쯤",
    ago: 0,
    url: "https://example.com/chat/dm/2",
  },
  {
    id: "t-in-gh",
    kind: "review",
    crewId: "billing-api",
    source: { kind: "review", service: "GitHub" },
    context: "work",
    from: "동료 개발자",
    title: "billing-api#97 영수증 PDF 글꼴 바꿈 — 한 번 봐 주세요",
    ago: 0,
    url: "https://example.com/billing-api/pull/97",
  },
];

/** 교신 하나가 도착하는 간격. */
export const INCOMING_EVERY = 75_000;

const RANK: Record<TaskKind, number> = {
  permission: 0,
  question: 0,
  input: 1,
  reply: 2,
  mention: 3,
  review: 4,
  alert: 5,
  todo: 6,
};

function actionsFor(seed: TaskSeed): TaskAction[] {
  const base: TaskAction[] = ["focus"];
  if (seed.choices || seed.source.kind === "session") base.push("answer");
  base.push("snooze", "dismiss", "handoff");
  return base;
}

export type DemoState = {
  startedAt: number;
  dismissed: Set<string>;
  snoozed: Map<string, number>;
};

export function createDemoState(now = Date.now()): DemoState {
  return { startedAt: now, dismissed: new Set(), snoozed: new Map() };
}

export function buildSnapshot(
  state: DemoState,
  scenario: Scenario,
  now = Date.now(),
): Snapshot {
  const arrived = Math.min(
    INCOMING.length,
    Math.floor((now - state.startedAt) / INCOMING_EVERY),
  );
  const seeds =
    scenario === "empty"
      ? []
      : [
          ...TASKS,
          ...INCOMING.slice(0, arrived).map((s, i) => ({
            ...s,
            ago: now - (state.startedAt + (i + 1) * INCOMING_EVERY),
          })),
        ];
  const visible = seeds.filter(
    (s) => !state.dismissed.has(s.id) && (state.snoozed.get(s.id) ?? 0) <= now,
  );

  const tasks: Task[] = visible
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      source: s.source,
      context: s.context,
      title: s.title,
      detail: s.detail,
      from: s.from,
      crewId: s.crewId,
      since: now - s.ago,
      actions: actionsFor(s),
      choices: s.choices,
      url: s.url,
    }))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.since - b.since);

  const hails: Hail[] = tasks
    .filter((t) => ["chat", "issue", "review", "doc"].includes(t.source.kind))
    .map((t) => ({
      id: `h-${t.id}`,
      from: { name: t.from, where: t.source.service },
      source: t.source,
      context: t.context,
      line: t.title,
      since: t.since,
      taskId: t.id,
      crewId: t.crewId,
      url: t.url,
    }));

  const waiting = new Set(
    tasks.filter((t) => t.source.kind === "session").map((t) => t.crewId),
  );
  const seeds2: CrewSeed[] =
    scenario === "busy"
      ? [
          ...CREW,
          ...EXTRA_CREW.map((id, i) => ({
            id,
            context: (i % 2 ? "work" : "personal") as Crew["context"],
            status: (["working", "idle", "off"] as const)[i % 3] ?? "off",
            activity: i % 3 === 0 ? "테스트 돌리는 중" : undefined,
            onDeck: i < 6,
          })),
        ]
      : CREW;

  const crew: Crew[] = seeds2.map((c, i) => {
    // 세션 할 일이 치워지면 그 승무원은 다시 일하러 간다.
    const status =
      c.status === "needs-you" && !waiting.has(c.id) ? "working" : c.status;
    const brief = BRIEFS[c.id];
    return {
      id: c.id,
      name: crewName(c.id),
      context: c.context,
      status,
      activity:
        status === "working" ? (c.activity ?? "다음 단계 진행 중") : c.activity,
      since: now - (i + 1) * 7 * MIN,
      onDeck: c.onDeck,
      brief: brief ? { ...brief, at: now - 2 * HOUR } : undefined,
      actions: c.status === "off" ? ["brief"] : ["focus", "brief"],
    };
  });

  const gauges: Gauge[] = [
    {
      id: "brief",
      label: "아침 브리핑",
      status: "ok",
      value: "08:00",
      at: now - 6 * HOUR,
    },
    {
      id: "collect",
      label: "부름 모으기",
      status: "ok",
      value: "5분마다",
      at: now - 2 * MIN,
    },
    {
      id: "backup",
      label: "백업",
      status: scenario === "empty" ? "ok" : "error",
      value: scenario === "empty" ? "어젯밤" : "2회 실패",
      at: now - 90 * MIN,
    },
    {
      id: "doctor",
      label: "점검",
      status: "warn",
      value: "경고 1",
      detail: "디스크 사용량 82%",
      at: now - 3 * HOUR,
    },
    { id: "notify", label: "폰 알림", status: "ok", value: "켜짐" },
    { id: "sync", label: "원격 동기화", status: "off", value: "꺼짐" },
  ];

  return {
    protocol: PROTOCOL,
    generatedAt: now,
    tasks,
    hails,
    crew,
    gauges,
    notice: "데모 데이터 · 지어낸 할 일이에요",
  };
}
