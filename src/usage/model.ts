// 토큰 사용량 통계. 기록에서 뽑은 요청 하나하나(UsageRecord)를 기간·영역·프로젝트·세션으로 묶는다.
// 파일을 읽는 일은 src/server/usage.ts가 하고, 여기는 순수 함수만 둔다. 설계: docs/usage.md.

/** 요청 하나. 같은 요청이 기록에 여러 줄로 남으므로 message.id로 묶어 마지막 줄만 쓴다. */
export type UsageRecord = {
  /** message.id */
  id: string;
  /** 응답 시각(Unix 밀리초) */
  t: number;
  /** 기록이 놓인 폴더 이름(~/.claude/projects/<폴더>). 프로젝트를 이걸로 묶는다 */
  project: string;
  /** 세션 id. 서브에이전트 요청도 부모 세션 id로 적힌다 */
  session: string;
  model: string;
  /** fast 모드면 가격이 2배 */
  fast?: boolean;
  /** 캐시 안 쓴 입력 */
  input: number;
  /** 캐시 쓰기(5분) */
  cacheWrite5m: number;
  /** 캐시 쓰기(1시간) */
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
};

export type Area = "work" | "personal" | "other";

export const AREA_LABEL: Record<Area, string> = {
  work: "업무",
  personal: "개인",
  other: "기타",
};

/** 경로 접두사 → 영역. 가장 긴 접두사가 이긴다. */
export type AreaRule = { prefix: string; area: Area };

/**
 * "work:~/company;personal:~/personal" 꼴의 설정 글을 읽는다. ~는 home으로 바꾼다.
 * 회사 경로를 공개 저장소에 적지 않으려고 규칙은 코드가 아니라 설정(STARSHIP_USAGE_AREAS)으로 받는다.
 */
export function parseAreaRules(
  text: string | undefined,
  home: string,
): AreaRule[] {
  if (!text) return [];
  return text
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const at = part.indexOf(":");
      const area = part.slice(0, at).trim();
      const raw = part.slice(at + 1).trim();
      if (
        at < 0 ||
        !raw ||
        !(area === "work" || area === "personal" || area === "other")
      )
        return [];
      const prefix = (raw.startsWith("~") ? home + raw.slice(1) : raw).replace(
        /\/+$/,
        "",
      );
      return [{ prefix, area }];
    });
}

export function areaOf(path: string | undefined, rules: AreaRule[]): Area {
  if (!path) return "other";
  let best: AreaRule | undefined;
  for (const r of rules)
    if (
      (path === r.prefix || path.startsWith(`${r.prefix}/`)) &&
      r.prefix.length > (best?.prefix.length ?? -1)
    )
      best = r;
  return best?.area ?? "other";
}

/* ───────────── 가격(추정) ───────────── */

/** 100만 토큰당 달러. API 가격 기준이고 구독 한도와는 다르다. */
export type Price = { input: number; output: number; cacheRead: number };

/** 2026-10 Anthropic API 가격. 표에 없는 모델은 비용을 세지 않는다. */
export const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

/** 캐시 쓰기는 입력값의 1.25배(5분), 2배(1시간). */
export function costOf(r: UsageRecord): number | undefined {
  const p = PRICES[r.model];
  if (!p) return undefined;
  const usd =
    (r.input * p.input +
      r.cacheWrite5m * p.input * 1.25 +
      r.cacheWrite1h * p.input * 2 +
      r.cacheRead * p.cacheRead +
      r.output * p.output) /
    1_000_000;
  return r.fast ? usd * 2 : usd;
}

/* ───────────── 묶기 ───────────── */

export type Totals = {
  requests: number;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  /** API 가격으로 셈한 추정 비용(달러). 가격을 모르는 모델은 빠진다 */
  cost: number;
  /** 가격을 몰라 비용에서 빠진 요청 수 */
  unpriced: number;
};

export function emptyTotals(): Totals {
  return {
    requests: 0,
    input: 0,
    cacheWrite: 0,
    cacheRead: 0,
    output: 0,
    cost: 0,
    unpriced: 0,
  };
}

function add(t: Totals, r: UsageRecord) {
  t.requests++;
  t.input += r.input;
  t.cacheWrite += r.cacheWrite5m + r.cacheWrite1h;
  t.cacheRead += r.cacheRead;
  t.output += r.output;
  const c = costOf(r);
  if (c === undefined) t.unpriced++;
  else t.cost += c;
}

export type UsageRange = "today" | "7d" | "30d";

export const RANGE_LABEL: Record<UsageRange, string> = {
  today: "오늘",
  "7d": "7일",
  "30d": "30일",
};

export function parseRange(v: string | null | undefined): UsageRange {
  return v === "today" || v === "30d" ? v : "7d";
}

/** 기간의 시작 시각. 오늘은 이 컴퓨터 시간대의 자정, 7일·30일은 그 날수만큼 앞의 자정. */
export function rangeStart(range: UsageRange, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  d.setDate(d.getDate() - days);
  return d.getTime();
}

export type SessionUsage = Totals & {
  id: string;
  first: number;
  last: number;
};

export type ProjectUsage = Totals & {
  /** 기록 폴더 이름 */
  key: string;
  /** 화면에 적을 이름(작업 폴더 이름) */
  name: string;
  /** 작업 폴더 경로 */
  path?: string;
  area: Area;
  sessions: SessionUsage[];
};

export type DayUsage = { day: string } & Record<Area, number>;

export type UsageReport = {
  range: UsageRange;
  from: number;
  to: number;
  areas: Record<Area, Totals>;
  total: Totals;
  projects: ProjectUsage[];
  /** 날마다 영역별 출력 토큰 */
  days: DayUsage[];
  models: { model: string; requests: number; output: number; cost?: number }[];
};

/** 프로젝트(기록 폴더) → 작업 폴더 경로. 서버가 기록의 cwd에서 정한다. */
export type ProjectPaths = Record<string, string | undefined>;

function dayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildReport(
  records: Iterable<UsageRecord>,
  opts: {
    range: UsageRange;
    now: number;
    rules: AreaRule[];
    paths: ProjectPaths;
  },
): UsageReport {
  const from = rangeStart(opts.range, opts.now);
  const areas: Record<Area, Totals> = {
    work: emptyTotals(),
    personal: emptyTotals(),
    other: emptyTotals(),
  };
  const total = emptyTotals();
  const projects = new Map<string, ProjectUsage>();
  const sessions = new Map<string, SessionUsage>();
  const days = new Map<string, DayUsage>();
  const models = new Map<
    string,
    { requests: number; output: number; cost?: number }
  >();

  for (let d = from; d <= opts.now; d += 86_400_000) {
    const k = dayKey(d);
    days.set(k, { day: k, work: 0, personal: 0, other: 0 });
  }

  for (const r of records) {
    if (r.t < from || r.t > opts.now) continue;
    const path = opts.paths[r.project];
    const area = areaOf(path, opts.rules);
    add(total, r);
    add(areas[area], r);

    let p = projects.get(r.project);
    if (!p) {
      p = {
        ...emptyTotals(),
        key: r.project,
        name: path ? (path.split("/").pop() ?? r.project) : r.project,
        path,
        area,
        sessions: [],
      };
      projects.set(r.project, p);
    }
    add(p, r);

    const sk = `${r.project}\n${r.session}`;
    let s = sessions.get(sk);
    if (!s) {
      s = { ...emptyTotals(), id: r.session, first: r.t, last: r.t };
      sessions.set(sk, s);
      p.sessions.push(s);
    }
    add(s, r);
    s.first = Math.min(s.first, r.t);
    s.last = Math.max(s.last, r.t);

    const day = days.get(dayKey(r.t));
    if (day) day[area] += r.output;

    const m = models.get(r.model) ?? { requests: 0, output: 0 };
    m.requests++;
    m.output += r.output;
    const c = costOf(r);
    if (c !== undefined) m.cost = (m.cost ?? 0) + c;
    models.set(r.model, m);
  }

  const list = [...projects.values()].sort((a, b) => b.output - a.output);
  for (const p of list) p.sessions.sort((a, b) => b.output - a.output);
  return {
    range: opts.range,
    from,
    to: opts.now,
    areas,
    total,
    projects: list,
    days: [...days.values()],
    models: [...models.entries()]
      .map(([model, m]) => ({ model, ...m }))
      .sort((a, b) => b.output - a.output),
  };
}

/* ───────────── 기록 한 줄 읽기 ───────────── */

/**
 * 기록(jsonl) 한 줄에서 요청 하나를 뽑는다. assistant 줄의 message.usage만 본다.
 * project는 줄이 아니라 파일이 놓인 폴더에서 온다(worktree 서브에이전트는 cwd가 다른 폴더라서).
 */
export function recordFromLine(
  line: string,
  project: string,
): { record: UsageRecord; cwd?: string; sidechain: boolean } | undefined {
  // JSON.parse가 비싸서 글자로 먼저 거른다.
  if (!line.includes('"usage"') || !line.includes('"assistant"'))
    return undefined;
  let row: unknown;
  try {
    row = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof row !== "object" || row === null) return undefined;
  const o = row as {
    type?: string;
    timestamp?: string;
    sessionId?: string;
    cwd?: string;
    isSidechain?: boolean;
    message?: {
      id?: string;
      model?: string;
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
        speed?: string;
        cache_creation?: {
          ephemeral_5m_input_tokens?: number;
          ephemeral_1h_input_tokens?: number;
        };
      };
    };
  };
  const u = o.message?.usage;
  if (o.type !== "assistant" || !u || !o.message?.id || !o.sessionId)
    return undefined;
  const t = Date.parse(o.timestamp ?? "");
  if (Number.isNaN(t)) return undefined;
  const write = u.cache_creation_input_tokens ?? 0;
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  return {
    record: {
      id: o.message.id,
      t,
      project,
      session: o.sessionId,
      model: o.message.model ?? "?",
      fast: u.speed === "fast" || undefined,
      input: u.input_tokens ?? 0,
      cacheWrite5m: Math.max(0, write - w1h),
      cacheWrite1h: w1h,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    },
    cwd: o.cwd,
    sidechain: o.isSidechain === true,
  };
}

/* ───────────── 응답 ───────────── */

export type UsageMeta = {
  source: "demo" | "local";
  /** 마지막으로 훑은 때 */
  scannedAt: number;
  /** 지난번 훑기에 걸린 시간 */
  scanMs: number;
  /** 지난번 훑기에서 새로 읽은 바이트 */
  readBytes: number;
  files: number;
  records: number;
  /** 업무·개인 규칙이 있나 */
  rules: boolean;
};

/** GET /api/usage?range= 응답 */
export type UsageResponse = UsageReport & { meta: UsageMeta };
