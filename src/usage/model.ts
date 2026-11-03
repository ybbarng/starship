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

/** 가격을 정하는 값: 요청 하나(UsageRecord)도, 미리 합친 값(UsageBucket)도 이 모양을 갖는다. */
export type Tokens = Pick<
  UsageRecord,
  | "model"
  | "fast"
  | "input"
  | "cacheWrite5m"
  | "cacheWrite1h"
  | "cacheRead"
  | "output"
>;

/** 캐시 쓰기는 입력값의 1.25배(5분), 2배(1시간). */
export function costOf(r: Tokens): number | undefined {
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

function add(t: Totals, b: UsageBucket) {
  t.requests += b.requests;
  t.input += b.input;
  t.cacheWrite += b.cacheWrite5m + b.cacheWrite1h;
  t.cacheRead += b.cacheRead;
  t.output += b.output;
  const c = costOf(b);
  if (c === undefined) t.unpriced += b.requests;
  else t.cost += c;
}

/* ───────────── 미리 합치기 ───────────── */

/**
 * 날·프로젝트·세션·모델마다 미리 합친 값. 서버는 요청 하나하나 대신 이것만 남기고,
 * 화면은 이것만 읽는다(30일이면 수천 개).
 */
export type UsageBucket = Tokens & {
  /** 이 컴퓨터 시간대의 날짜("2026-11-01") */
  day: string;
  /** 그날의 몇 시(0~23). 시간별 속도 그래프가 쓴다 */
  hour: number;
  project: string;
  session: string;
  requests: number;
  first: number;
  last: number;
};

export function dayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 합계 칸의 열쇠: 날·시·프로젝트·세션·모델·fast */
export function keyOf(
  b: Pick<
    UsageBucket,
    "day" | "hour" | "project" | "session" | "model" | "fast"
  >,
): string {
  return `${b.day}T${b.hour}\t${b.project}\t${b.session}\t${b.model}\t${b.fast ? "fast" : ""}`;
}

export function bucketKey(r: UsageRecord): string {
  return keyOf({ ...r, day: dayKey(r.t), hour: new Date(r.t).getHours() });
}

/**
 * 요청 하나를 합계에 더하거나(1) 뺀다(-1). 같은 요청의 줄이 다시 오면 앞 줄 값을 빼고 새 줄 값을 더한다.
 * 뺄 때 first·last는 그대로 둔다(같은 요청이라 시각이 거의 같다).
 */
export function applyRecord(
  buckets: Map<string, UsageBucket>,
  r: UsageRecord,
  sign: 1 | -1,
) {
  const key = bucketKey(r);
  let b = buckets.get(key);
  if (!b) {
    if (sign < 0) return;
    b = {
      day: dayKey(r.t),
      hour: new Date(r.t).getHours(),
      project: r.project,
      session: r.session,
      model: r.model,
      fast: r.fast,
      requests: 0,
      input: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      output: 0,
      first: r.t,
      last: r.t,
    };
    buckets.set(key, b);
  }
  b.requests += sign;
  b.input += sign * r.input;
  b.cacheWrite5m += sign * r.cacheWrite5m;
  b.cacheWrite1h += sign * r.cacheWrite1h;
  b.cacheRead += sign * r.cacheRead;
  b.output += sign * r.output;
  if (sign > 0) {
    b.first = Math.min(b.first, r.t);
    b.last = Math.max(b.last, r.t);
  }
  if (b.requests <= 0) buckets.delete(key);
}

/** 요청들을 합계로 묶는다(같은 id는 마지막 것만). 데모와 시험이 쓴다. */
export function bucketsFrom(
  records: Iterable<UsageRecord>,
): Map<string, UsageBucket> {
  const last = new Map<string, UsageRecord>();
  for (const r of records) last.set(r.id, r);
  const out = new Map<string, UsageBucket>();
  for (const r of last.values()) applyRecord(out, r, 1);
  return out;
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

/**
 * 계정을 바꾼 날(STARSHIP_USAGE_ACCOUNT_SWITCH, "YYYY-MM-DD"). 이 컴퓨터 기록에는 계정을 나눌 값이 없어
 * 그날 앞뒤 기록이 섞인다고 화면에 알린다. 형식이 틀리거나 없는 날이면 undefined(화면에 줄을 두지 않는다).
 */
export function parseAccountSwitch(
  v: string | null | undefined,
): string | undefined {
  const s = v?.trim() ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
    ? s
    : undefined;
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
  /** 작업 폴더 경로(모르면 기록 폴더 이름) */
  key: string;
  /** 화면에 적을 이름(작업 폴더 이름) */
  name: string;
  /** 작업 폴더 경로 */
  path?: string;
  area: Area;
  sessions: SessionUsage[];
};

export type DayUsage = { day: string } & Record<Area, number>;

/** 한 시간 동안의 영역별 출력 토큰. at은 그 시간이 시작한 시각 */
export type HourUsage = { at: number } & Record<Area, number>;

/** 최근 몇 분 동안 분당 출력 토큰(= 우주선 속도). 연료실·조종석 계기가 쓴다 */
export type Burn = {
  windowMin: number;
  perMin: Record<Area, number>;
  total: number;
};

/** 최근 windowMin분 안의 요청으로 분당 출력 토큰을 셈한다. */
export function burnRate(
  records: Iterable<UsageRecord>,
  opts: {
    now: number;
    rules: AreaRule[];
    paths: ProjectPaths;
    windowMin?: number;
  },
): Burn {
  const windowMin = opts.windowMin ?? 15;
  const from = opts.now - windowMin * 60_000;
  const perMin: Record<Area, number> = { work: 0, personal: 0, other: 0 };
  for (const r of records) {
    if (r.t < from || r.t > opts.now) continue;
    perMin[areaOf(opts.paths[r.project], opts.rules)] += r.output / windowMin;
  }
  return {
    windowMin,
    perMin,
    total: perMin.work + perMin.personal + perMin.other,
  };
}

export type UsageReport = {
  range: UsageRange;
  from: number;
  to: number;
  areas: Record<Area, Totals>;
  total: Totals;
  projects: ProjectUsage[];
  /** 날마다 영역별 출력 토큰 */
  days: DayUsage[];
  /** 시간마다 영역별 출력 토큰(기간 전체, 오늘이면 24칸) */
  hours: HourUsage[];
  models: { model: string; requests: number; output: number; cost?: number }[];
};

/** 프로젝트(기록 폴더) → 작업 폴더 경로. 서버가 기록의 cwd에서 정한다. */
export type ProjectPaths = Record<string, string | undefined>;

export function buildReport(
  buckets: Iterable<UsageBucket>,
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
  // 시간 칸: 기간 시작 자정부터 지금 시각까지. 열쇠는 "날짜T시"
  const hours = new Map<string, HourUsage>();
  for (let t = from; t <= opts.now; t += 3_600_000) {
    const d = new Date(t);
    hours.set(`${dayKey(t)}T${d.getHours()}`, {
      at: t,
      work: 0,
      personal: 0,
      other: 0,
    });
  }

  const fromDay = dayKey(from);
  const toDay = dayKey(opts.now);
  for (const r of buckets) {
    if (r.day < fromDay || r.day > toDay) continue;
    const path = opts.paths[r.project];
    const area = areaOf(path, opts.rules);
    add(total, r);
    add(areas[area], r);

    // 프로젝트는 작업 폴더로 묶는다. 폴더 이름을 바꾸면 기록 폴더가 둘로 나뉘는데, 사람에게는 한 프로젝트다.
    const pk = path ?? r.project;
    let p = projects.get(pk);
    if (!p) {
      p = {
        ...emptyTotals(),
        key: pk,
        name: path ? (path.split("/").pop() ?? r.project) : r.project,
        path,
        area,
        sessions: [],
      };
      projects.set(pk, p);
    }
    add(p, r);

    const sk = `${r.project}\n${r.session}`;
    let s = sessions.get(sk);
    if (!s) {
      s = { ...emptyTotals(), id: r.session, first: r.first, last: r.last };
      sessions.set(sk, s);
      p.sessions.push(s);
    }
    add(s, r);
    s.first = Math.min(s.first, r.first);
    s.last = Math.max(s.last, r.last);

    const day = days.get(r.day);
    if (day) day[area] += r.output;
    const hour = hours.get(`${r.day}T${r.hour}`);
    if (hour) hour[area] += r.output;

    const m = models.get(r.model) ?? { requests: 0, output: 0 };
    m.requests += r.requests;
    m.output += r.output;
    const c = costOf(r);
    if (c !== undefined) m.cost = (m.cost ?? 0) + c;
    models.set(r.model, m);
  }

  const list = [...projects.values()].sort((a, b) => b.output - a.output);
  for (const p of list) p.sessions.sort((a, b) => b.output - a.output);
  // 작업 폴더 이름만 같은 프로젝트(…/comet과 …/comet/comet)는 부모 폴더를 붙여 나눈다.
  const byName = new Map<string, number>();
  for (const p of list) byName.set(p.name, (byName.get(p.name) ?? 0) + 1);
  for (const p of list)
    if ((byName.get(p.name) ?? 0) > 1 && p.path)
      p.name = p.path.split("/").slice(-2).join("/");
  return {
    range: opts.range,
    from,
    to: opts.now,
    areas,
    total,
    projects: list,
    days: [...days.values()],
    hours: [...hours.values()],
    models: [...models.entries()]
      .map(([model, m]) => ({ model, ...m }))
      .sort((a, b) => b.output - a.output),
  };
}

/* ───────────── 기록 한 줄 읽기 ───────────── */

/**
 * assistant 줄의 차례: parentUuid·isSidechain → message{model, id, …, content, …, usage} → (wireToolInputs …) →
 * type·timestamp·cwd·sessionId. 본문과 도구 입력은 수십 KB까지 길어져 글자로 바꾸지 않고 세 창만 본다.
 * - 앞 2KB: model·id(오류 줄은 type·timestamp도 여기)
 * - "usage":{부터 4KB: usage 객체
 * - 끝 4KB: 맨 위 type·timestamp·cwd·sessionId
 * JSON 글 안의 따옴표는 늘 \"로 바뀌므로 줄 원문의 "usage":{는 진짜 키에서만 나온다. 그래서 첫 번째 것을 쓴다.
 */
export const HEAD_BYTES = 2 * 1024;
export const USAGE_BYTES = 4 * 1024;
export const TAIL_BYTES = 4 * 1024;
export const USAGE_KEY = '"usage":{';

/** 줄 하나(테스트·짧은 줄용). 세 창을 잘라 recordFromWindows로 읽는다. */
export function recordFromLine(
  line: string,
  project: string,
): ReturnType<typeof recordFromWindows> {
  const at = line.indexOf(USAGE_KEY);
  if (at < 0) return undefined;
  return recordFromWindows(
    line.slice(0, HEAD_BYTES),
    line.slice(at, at + USAGE_BYTES),
    line.slice(-TAIL_BYTES),
    project,
  );
}

const STRING_FIELD = (key: string) =>
  new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`, "g");

function jsonString(v: string): string {
  try {
    return JSON.parse(`"${v}"`) as string;
  } catch {
    return v;
  }
}

function firstString(s: string, key: string, from = 0): string | undefined {
  const re = STRING_FIELD(key);
  re.lastIndex = from;
  const m = re.exec(s);
  return m?.[1] === undefined ? undefined : jsonString(m[1]);
}

function lastString(s: string, key: string): string | undefined {
  let last: string | undefined;
  for (const m of s.matchAll(STRING_FIELD(key))) last = m[1];
  return last === undefined ? undefined : jsonString(last);
}

type RawUsage = {
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

/**
 * 세 창(앞부분, "usage":{부터, 끝부분)에서 요청 하나를 뽑는다. 맨 위 필드(type·timestamp·cwd·sessionId)는
 * 끝부분에서 찾고, 없으면(API 오류 줄) message 앞에서 찾는다.
 * project는 줄이 아니라 파일이 놓인 폴더에서 온다(worktree 서브에이전트는 cwd가 다른 폴더라서).
 */
export function recordFromWindows(
  head: string,
  usage: string,
  tail: string,
  project: string,
): { record: UsageRecord; cwd?: string; sidechain: boolean } | undefined {
  if (!usage.startsWith(USAGE_KEY)) return undefined;
  const open = USAGE_KEY.length - 1;
  let depth = 0;
  let close = -1;
  for (let i = open; i < usage.length; i++) {
    const c = usage[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      close = i + 1;
      break;
    }
  }
  if (close < 0) return undefined;
  let u: RawUsage;
  try {
    u = JSON.parse(usage.slice(open, close)) as RawUsage;
  } catch {
    return undefined;
  }
  const msgAt = head.indexOf('"message":{');
  if (msgAt < 0) return undefined;
  const before = head.slice(0, msgAt);
  const top = (key: string) => lastString(tail, key) ?? lastString(before, key);
  if (
    !tail.includes('"type":"assistant"') &&
    !before.includes('"type":"assistant"')
  )
    return undefined;
  const id = firstString(head, "id", msgAt);
  const session = top("sessionId");
  const t = Date.parse(top("timestamp") ?? "");
  if (!id || !session || Number.isNaN(t)) return undefined;
  const write = u.cache_creation_input_tokens ?? 0;
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  return {
    record: {
      id,
      t,
      project,
      session,
      model: firstString(head, "model", msgAt) ?? "?",
      fast: u.speed === "fast" || undefined,
      input: u.input_tokens ?? 0,
      cacheWrite5m: Math.max(0, write - w1h),
      cacheWrite1h: w1h,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    },
    cwd: top("cwd"),
    sidechain: before.includes('"isSidechain":true'),
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
  /** 남겨 둔 합계 칸 수 */
  buckets: number;
  /** 업무·개인 규칙이 있나 */
  rules: boolean;
  /** 계정을 바꾼 날("YYYY-MM-DD", STARSHIP_USAGE_ACCOUNT_SWITCH). 없으면 화면에 그 줄을 두지 않는다 */
  accountSwitch?: string;
};

/** GET /api/usage?range= 응답. burn은 최근 15분 분당 출력(= 지금 속도) */
export type UsageResponse = UsageReport & { meta: UsageMeta; burn: Burn };
