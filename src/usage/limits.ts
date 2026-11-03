// 계정 사용 한도(주간 연료)를 화면에 적는 순수 함수. 한도 값은 본부가 주고(src/protocol/limits.ts),
// 영역(업무·개인·기타) 몫은 이 컴퓨터 기록에서 셈한 통계(src/usage/model.ts)로 근사한다. 설계: docs/usage.md "주간 연료".
import type { Area, Totals } from "./model";

export const AREAS: Area[] = ["work", "personal", "other"];

/** 본부 값이 이보다 오래되면 "n분 전 값"으로 흐리게 보인다(세션이 화면을 바꿀 때만 갱신되어 멈출 수 있다) */
export const STALE_MS = 30 * 60_000;

export function isStale(at: number | undefined, now: number): boolean {
  return at === undefined || now - at > STALE_MS;
}

/** 리셋 시각이 지났나. 지난 값은 이미 0으로 돌아갔을 것이라 그대로 믿지 않는다 */
export function isExpired(resetsAt: number | undefined, now: number): boolean {
  return resetsAt !== undefined && resetsAt <= now;
}

/**
 * 쓴 몫(usedPct)을 영역별로 나눈다. 비율의 바탕은 영역별 추정 비용이다:
 * 한도는 토큰 수가 아니라 모델·캐시까지 따진 계산량으로 깎인다고 보여서(공개 계산식 없음, docs/usage.md "정확도 한계"),
 * 출력 토큰만 보는 것보다 입력·캐시 쓰기·캐시 읽기·모델 가격을 다 넣은 추정 비용이 더 가깝다.
 * 비용을 셀 수 없으면(가격을 모르는 모델뿐) 출력 토큰으로 나눈다. 둘 다 0이면 모두 기타로 둔다.
 */
export function splitUsed(
  usedPct: number,
  areas: Record<Area, Pick<Totals, "cost" | "output">>,
): { basis: "cost" | "output" | "none"; parts: Record<Area, number> } {
  const sum = (k: "cost" | "output") =>
    AREAS.reduce((s, a) => s + Math.max(0, areas[a][k]), 0);
  const basis = sum("cost") > 0 ? "cost" : sum("output") > 0 ? "output" : null;
  if (!basis)
    return {
      basis: "none",
      parts: { work: 0, personal: 0, other: usedPct },
    };
  const total = sum(basis);
  const parts = { work: 0, personal: 0, other: 0 };
  for (const a of AREAS)
    parts[a] = (usedPct * Math.max(0, areas[a][basis])) / total;
  return { basis, parts };
}

/** 리셋까지 남은 시간: "곧" · "35분 뒤" · "2시간 20분 뒤" · "7시간 뒤" · "2일 3시간 뒤" */
export function untilText(resetsAt: number, now: number): string {
  const min = Math.floor((resetsAt - now) / 60_000);
  if (min < 1) return "곧";
  if (min < 60) return `${min}분 뒤`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m && h < 3 ? `${h}시간 ${m}분 뒤` : `${h}시간 뒤`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}일 ${rh}시간 뒤` : `${d}일 뒤`;
}

/** 값이 얼마나 지난 것인지: "12분 전" · "3시간 전" · "2일 전" */
export function agoText(at: number, now: number): string {
  const min = Math.max(0, Math.floor((now - at) / 60_000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/**
 * 리셋 시각: "11월 4일(수) 02:00". 시간대를 주지 않으면 브라우저(사용자 로캘)의 시간대를 쓴다.
 * 시험은 Asia/Seoul을 준다.
 */
export function resetText(resetsAt: number, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(resetsAt));
  const v = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${v("month")}월 ${v("day")}일(${v("weekday")}) ${v("hour").padStart(2, "0")}:${v("minute").padStart(2, "0")}`;
}

/** 쓴 몫에 따른 경고 단계: 80% 넘으면 주황, 95% 넘으면 빨강 */
export function levelOf(usedPct: number): "ok" | "warn" | "danger" {
  return usedPct > 95 ? "danger" : usedPct > 80 ? "warn" : "ok";
}

export const LEVEL_COLOR = {
  ok: "#cfd8e8",
  warn: "#ffa040",
  danger: "#ff5a5a",
} as const;

/** 한 줄 요약: "주간 50% 사용 · 50% 남음" */
export function pctText(usedPct: number): { used: string; left: string } {
  const r = (v: number) => `${Math.round(v)}%`;
  return { used: r(usedPct), left: r(100 - usedPct) };
}
