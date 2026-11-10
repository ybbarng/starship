// 보안 구역 화면이 기록을 줄로 만드는 순수 함수: 호출 묶기, 빨간 표시, 거르기, 유효한 신청서.
// 설명: docs/secure.md.
import type {
  SecureActor,
  SecureCall,
  SecureRequest,
  SecureSession,
} from "@/protocol/secure";

/** hook 기록과 wrapper 기록을 한 호출로 볼 시각 차이 상한 */
export const PAIR_WINDOW_MS = 5_000;

/** 화면의 호출 한 줄. AI 호출 하나의 hook 기록과 wrapper 기록을 묶은 것, 또는 기록 하나. */
export type CallRow = {
  /** 묶은 기록 id들을 이은 열쇠 */
  key: string;
  /** 묶은 기록 중 가장 이른 시각 */
  at: number;
  actor: SecureActor;
  session?: SecureSession;
  context?: SecureCall["context"];
  /** 보일 명령. 인자가 더 많은 기록(보통 wrapper)의 것 */
  command: SecureCall["command"];
  requestId: string | null;
  decision?: "allowed" | "denied";
  exit?: number;
  ms?: number;
  /** 묶인 기록이 어디서 왔나(hook·wrapper) */
  vias: SecureCall["via"][];
  calls: SecureCall[];
  /** 빨갛게 보일 까닭. 비었으면 빨갛지 않다 */
  alerts: string[];
  /** 확인함 표시. 빨간 까닭이 있는 기록이 모두 확인됐을 때 그중 가장 늦은 것(rowAck) */
  ack?: { at: number; by?: string };
};

export const ALERT_DENIED = "hook이 막은 호출이에요";
export const ALERT_NO_REQUEST = "신청서 없이 나간 호출이에요";

/** 값을 건드리지 않는 인자. 하위 명령 없이 이것만 있으면 `op --version`처럼 판본·도움말만 본 호출이다 */
const HARMLESS_ARGS = new Set(["--version", "-v", "--help", "-h", "help"]);

/**
 * 값을 건드리지 않는 호출인가. 보수적으로 하위 명령(command.sub)이 빈 글이고 인자가 모두
 * --version·-v·--help·-h·help 중 하나일 때만 그렇다. 인자가 하나도 없으면 무엇을 했는지 몰라 예외로 두지 않는다.
 */
export function isHarmlessCall(command: SecureCall["command"]): boolean {
  return (
    command.sub === "" &&
    command.args.length > 0 &&
    command.args.every((a) => HARMLESS_ARGS.has(a))
  );
}

/**
 * 기록 하나가 빨간 까닭. denied면 늘 빨갛다. AI의 wrapper 기록인데 신청서가 없으면 빨갛되,
 * 값을 건드리지 않는 호출(isHarmlessCall)은 뺀다.
 */
export function callAlerts(call: SecureCall): string[] {
  const out: string[] = [];
  if (call.decision === "denied") out.push(ALERT_DENIED);
  if (
    call.actor === "ai" &&
    call.via === "wrapper" &&
    call.requestId === null &&
    !isHarmlessCall(call.command)
  )
    out.push(ALERT_NO_REQUEST);
  return out;
}

/**
 * 줄의 확인함 표시. 빨간 까닭이 있는 기록이 모두 ack를 가지면 그중 가장 늦은 것, 아니면 undefined.
 * 빨간 기록이 하나도 없으면 확인할 것이 없으니 undefined.
 */
export function rowAck(
  calls: readonly SecureCall[],
): { at: number; by?: string } | undefined {
  const red = calls.filter((c) => callAlerts(c).length > 0);
  if (red.length === 0) return undefined;
  let latest: { at: number; by?: string } | undefined;
  for (const c of red) {
    if (!c.ack) return undefined;
    if (!latest || c.ack.at > latest.at)
      latest = c.ack.by === undefined ? { at: c.ack.at } : { ...c.ack };
  }
  return latest;
}

/** 빨간데 아직 확인함 표시를 하지 않은 줄 수. */
export function unackedAlertCount(rows: readonly CallRow[]): number {
  return rows.filter((r) => r.alerts.length > 0 && !r.ack).length;
}

function canPair(group: SecureCall[], call: SecureCall, windowMs: number) {
  const first = group[0];
  if (!first || call.actor !== "ai" || first.actor !== "ai") return false;
  const key = call.session?.key;
  if (!key || first.session?.key !== key) return false;
  if (first.command.sub !== call.command.sub) return false;
  if (group.some((c) => c.via === call.via)) return false;
  return Math.abs(call.at - first.at) <= windowMs;
}

function toRow(calls: SecureCall[]): CallRow {
  const sorted = [...calls].sort((a, b) => a.at - b.at);
  const first = sorted[0] as SecureCall;
  const main = sorted.reduce((best, c) =>
    c.command.args.length > best.command.args.length ? c : best,
  );
  const wrapper = sorted.find((c) => c.via === "wrapper");
  const alerts = [...new Set(sorted.flatMap(callAlerts))];
  const ack = rowAck(sorted);
  const decision = sorted.some((c) => c.decision === "denied")
    ? "denied"
    : sorted.some((c) => c.decision === "allowed")
      ? "allowed"
      : undefined;
  return {
    key: sorted.map((c) => c.id).join("+"),
    at: first.at,
    actor: first.actor,
    session: sorted.find((c) => c.session)?.session,
    context: sorted.find((c) => c.context)?.context,
    command: main.command,
    requestId: sorted.find((c) => c.requestId)?.requestId ?? null,
    decision,
    exit: wrapper?.exit ?? sorted.find((c) => c.exit !== undefined)?.exit,
    ms: wrapper?.ms ?? sorted.find((c) => c.ms !== undefined)?.ms,
    vias: sorted.map((c) => c.via),
    calls: sorted,
    alerts,
    ...(ack ? { ack } : {}),
  };
}

/**
 * 호출 기록을 화면 줄로 묶는다. 같은 세션(session.key)·같은 하위 명령(command.sub)의 AI 기록이
 * 시각 차이 windowMs 안이면 한 줄로 묶는다. 한 줄에는 hook 하나와 wrapper 하나까지만 든다
 * (같은 명령을 잇달아 두 번 부르면 두 줄이 된다). 사람의 직접 실행은 묶지 않는다. 결과는 최근순.
 */
export function groupCalls(
  calls: readonly SecureCall[],
  windowMs = PAIR_WINDOW_MS,
): CallRow[] {
  const groups: SecureCall[][] = [];
  for (const call of [...calls].sort((a, b) => a.at - b.at)) {
    const open = groups.find((g) => canPair(g, call, windowMs));
    if (open) open.push(call);
    else groups.push([call]);
  }
  return groups.map(toRow).sort((a, b) => b.at - a.at);
}

export type Period = "1h" | "today" | "7d" | "all";
export const PERIOD_LABEL: Record<Period, string> = {
  "1h": "1시간",
  today: "오늘",
  "7d": "7일",
  all: "전체",
};

/** 기간의 시작 시각. today는 이 컴퓨터 시간대의 오늘 자정. all은 0. */
export function periodStart(period: Period, now: number): number {
  if (period === "1h") return now - 3_600_000;
  if (period === "7d") return now - 7 * 86_400_000;
  if (period === "today") {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return 0;
}

export type Filter = {
  /** 세션 열쇠. 없으면 모든 세션 */
  session?: string;
  actor: SecureActor | "all";
  period: Period;
};

/** 신청서를 거른다. 신청서는 늘 AI가 쓰니 actor가 human이면 하나도 남지 않는다. */
export function filterRequests(
  requests: readonly SecureRequest[],
  f: Filter,
  now: number,
): SecureRequest[] {
  const from = periodStart(f.period, now);
  return requests.filter(
    (r) =>
      r.at >= from &&
      (f.actor === "all" || r.actor === f.actor) &&
      (!f.session || r.session.key === f.session),
  );
}

export function filterRows(
  rows: readonly CallRow[],
  f: Filter,
  now: number,
): CallRow[] {
  const from = periodStart(f.period, now);
  return rows.filter(
    (r) =>
      r.at >= from &&
      (f.actor === "all" || r.actor === f.actor) &&
      (!f.session || r.session?.key === f.session),
  );
}

/** 거르기에 보일 세션 목록(열쇠·이름). 최근에 나온 순. */
export function sessionsOf(
  requests: readonly SecureRequest[],
  calls: readonly SecureCall[],
): { key: string; name: string }[] {
  const seen = new Map<string, { name: string; at: number }>();
  const add = (s: SecureSession | undefined, at: number) => {
    if (!s) return;
    const prev = seen.get(s.key);
    if (!prev || prev.at < at) seen.set(s.key, { name: s.name ?? s.key, at });
  };
  for (const r of requests) add(r.session, r.at);
  for (const c of calls) add(c.session, c.at);
  return [...seen.entries()]
    .sort((a, b) => b[1].at - a[1].at)
    .map(([key, v]) => ({ key, name: v.name }));
}

/** 지금 유효한 신청서(expiresAt > now). 최근에 쓴 순. */
export function activeRequests(
  requests: readonly SecureRequest[],
  now: number,
): SecureRequest[] {
  return requests.filter((r) => r.expiresAt > now).sort((a, b) => b.at - a.at);
}

/** 가장 최근 신청서. 없으면 undefined. */
export function latestRequest(
  requests: readonly SecureRequest[],
): SecureRequest | undefined {
  return requests.reduce<SecureRequest | undefined>(
    (best, r) => (!best || r.at > best.at ? r : best),
    undefined,
  );
}

/** 남은 시간 글: "12분 남음", "1시간 5분 남음", "40초 남음", 지났으면 "만료됨". */
export function remainingLabel(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return "만료됨";
  const s = Math.floor(left / 1000);
  if (s < 60) return `${s}초 남음`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 남음`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}시간 ${m % 60}분 남음` : `${h}시간 남음`;
}
