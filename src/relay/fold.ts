// 나르기 기록 줄을 나르기 하나씩으로 접는다. 순수 함수만 둔다(시각은 부르는 쪽이 넘긴다).
// 규칙은 docs/hq.md "형식" 표: 같은 id의 줄을 시각순으로 모으고, 마지막 줄로 상태와 지금 있는 곳을 정한다.
import type { RelayKind, RelayLine } from "@/protocol/relay";

const HOUR = 3_600_000;

/** 끝나지 않은 나르기에 이만큼 새 줄이 없으면 멈춤으로 본다(docs/hq.md "멈춤 표시"). */
export const STALL_MS = 24 * HOUR;

/** 끝났거나 그만둔 나르기(와 어느 일인지 모르는 넘김)를 판에 남겨 두는 기간. 지나면 뺀다. */
export const KEEP_DONE_MS = 7 * 24 * HOUR;

/** 마지막 줄 뒤 상태 */
export type RelayState =
  | "open"
  | "moving"
  | "returned"
  | "closed"
  | "cancelled";

/** 상태 이름. docs/hq.md 표의 "이 줄 뒤 상태" 칸과 같다(src/relay/fold.test.ts가 문서와 맞춰 본다). */
export const STATE_LABEL: Record<RelayState, string> = {
  open: "넘기기 전",
  moving: "진행 중",
  returned: "돌려줌",
  closed: "끝",
  cancelled: "그만둠",
};

/** 줄 종류 이름(나르기 판의 지난 줄에 쓴다) */
export const KIND_LABEL: Record<RelayKind, string> = {
  open: "부탁 받음",
  forward: "넘김",
  update: "소식",
  return: "돌려줌",
  close: "끝",
  cancel: "그만둠",
};

/** 지금 있는 곳: 비서(본부) · 어느 세션 · 없음(끝났거나 그만둠, 또는 알 수 없음) */
export type RelayWhere =
  | { kind: "hq" }
  | { kind: "session"; name: string }
  | { kind: "none" };

export type Relay = {
  id: string;
  /** 마지막으로 적힌 title */
  title?: string;
  /** 처음 부탁한 세션(open의 from) */
  from?: string;
  state: RelayState;
  where: RelayWhere;
  /** 첫 줄 시각 */
  openedAt: number;
  /** 마지막 줄 시각(마지막 소식) */
  lastAt: number;
  /** 마지막으로 적힌 card */
  card?: string;
  /** 마지막으로 적힌 note */
  note?: string;
  /** 끝·그만둠인가 */
  done: boolean;
  /** 끝나지 않았고 마지막 줄 뒤 STALL_MS가 넘었나 */
  stalled: boolean;
  /** 이 나르기의 줄, 시각순 */
  lines: RelayLine[];
};

export type RelayBoard = {
  /** 끝나지 않은 나르기. 멈춘 것이 먼저, 그다음 마지막 소식이 최근인 순 */
  active: Relay[];
  /** KEEP_DONE_MS 안에 끝났거나 그만둔 나르기. 최근순 */
  done: Relay[];
  /** id 없는 forward(어느 일인지 모르는 넘김), KEEP_DONE_MS 안의 것만. 최근순 */
  unlinked: RelayLine[];
};

const DONE_STATES: ReadonlySet<RelayState> = new Set(["closed", "cancelled"]);

/** 줄 하나를 지나고 난 상태와 있는 곳. from은 처음 부탁한 세션(return이 돌아갈 곳) */
function step(
  prev: { state: RelayState; where: RelayWhere },
  line: RelayLine,
  from: string | undefined,
): { state: RelayState; where: RelayWhere } {
  switch (line.kind) {
    case "open":
      return { state: "open", where: { kind: "hq" } };
    case "forward":
      // to가 빠진 넘김은 어디로 갔는지 몰라 있는 곳을 그대로 둔다
      return {
        state: "moving",
        where: line.to ? { kind: "session", name: line.to } : prev.where,
      };
    case "update":
      return { state: "moving", where: prev.where };
    case "return":
      return {
        state: "returned",
        where: from ? { kind: "session", name: from } : { kind: "none" },
      };
    case "close":
      return { state: "closed", where: { kind: "none" } };
    case "cancel":
      return { state: "cancelled", where: { kind: "none" } };
  }
}

/** 같은 id의 줄(시각순)을 나르기 하나로 */
export function foldOne(id: string, lines: RelayLine[], now: number): Relay {
  const first = lines[0];
  if (!first) throw new Error("줄이 없는 나르기는 접을 수 없어요");
  const from = lines.find((l) => l.kind === "open" && l.from)?.from;
  let cur: { state: RelayState; where: RelayWhere } = {
    state: "open",
    where: { kind: "hq" },
  };
  let title: string | undefined;
  let card: string | undefined;
  let note: string | undefined;
  for (const l of lines) {
    cur = step(cur, l, from);
    if (l.title) title = l.title;
    if (l.card) card = l.card;
    if (l.note) note = l.note;
  }
  const lastAt = lines[lines.length - 1]?.at ?? first.at;
  const done = DONE_STATES.has(cur.state);
  return {
    id,
    ...(title ? { title } : {}),
    ...(from ? { from } : {}),
    state: cur.state,
    where: cur.where,
    openedAt: first.at,
    lastAt,
    ...(card ? { card } : {}),
    ...(note ? { note } : {}),
    done,
    stalled: !done && now - lastAt > STALL_MS,
    lines,
  };
}

/** 시각순. 같은 시각이면 받은 차례를 지킨다(Array.prototype.sort는 안정 정렬이다). */
function byTime(a: RelayLine, b: RelayLine) {
  return a.at - b.at;
}

/** 기록 줄 전체를 나르기 판으로 접는다. 줄 순서는 상관없다. */
export function foldRelays(
  lines: readonly RelayLine[],
  now: number,
): RelayBoard {
  const sorted = [...lines].sort(byTime);
  const groups = new Map<string, RelayLine[]>();
  const unlinked: RelayLine[] = [];
  for (const l of sorted) {
    if (l.id === undefined) {
      // 형식 검사가 id 없는 줄은 forward만 남긴다
      if (now - l.at <= KEEP_DONE_MS) unlinked.push(l);
      continue;
    }
    const g = groups.get(l.id);
    if (g) g.push(l);
    else groups.set(l.id, [l]);
  }
  const relays = [...groups].map(([id, g]) => foldOne(id, g, now));
  const active = relays
    .filter((r) => !r.done)
    .sort(
      (a, b) => Number(b.stalled) - Number(a.stalled) || b.lastAt - a.lastAt,
    );
  const done = relays
    .filter((r) => r.done && now - r.lastAt <= KEEP_DONE_MS)
    .sort((a, b) => b.lastAt - a.lastAt);
  return { active, done, unlinked: unlinked.reverse() };
}

/** 멈춘 나르기 수(선실 맨 위 건수) */
export function stalledCount(board: RelayBoard): number {
  return board.active.filter((r) => r.stalled).length;
}

/** 있는 곳 이름. hqName은 본부 승무원 이름(보통 "비서") */
export function whereLabel(where: RelayWhere, hqName = "비서"): string {
  if (where.kind === "hq") return hqName;
  if (where.kind === "session") return where.name;
  return "없음";
}
