// 화면에 쓰는 낱말. 프로토콜 값을 사람이 읽는 글로 바꾼다.
import type {
  Context,
  CrewStatus,
  Source,
  Task,
  TaskAction,
  TaskKind,
} from "@/protocol/v1";

export const KIND_LABEL: Record<TaskKind, string> = {
  question: "질문",
  permission: "허락 요청",
  input: "지시 기다림",
  reply: "일 마침",
  mention: "부름",
  review: "리뷰 요청",
  todo: "할 일",
  alert: "경보",
};

const SOURCE_KIND_LABEL: Record<Source["kind"], string> = {
  session: "AI 세션",
  chat: "채팅",
  issue: "이슈",
  review: "코드 리뷰",
  doc: "문서",
  reminder: "날짜 할 일",
  monitor: "정기 점검",
};

/** 서비스 이름이 있으면 그것을, 없으면 출처 종류를 */
export function sourceLabel(source: Source): string {
  return source.service ?? SOURCE_KIND_LABEL[source.kind];
}

export const CONTEXT_LABEL: Record<Context, string> = {
  work: "업무",
  personal: "개인",
};

export const CONTEXT_COLOR: Record<Context, string> = {
  work: "#6cb6ff",
  personal: "#ffb86c",
};

export const CREW_STATUS_LABEL: Record<CrewStatus, string> = {
  working: "일하는 중",
  "needs-you": "나를 기다림",
  idle: "쉬는 중",
  off: "자리 비움",
};

export const ACTION_LABEL: Record<TaskAction, string> = {
  focus: "창으로 가기",
  answer: "답하기",
  snooze: "1시간 뒤",
  dismiss: "치우기",
  handoff: "비서에게",
};

/** 사람에게 온 것인가(교신으로 그릴 것) */
export function isHail(task: Task): boolean {
  return ["chat", "issue", "review", "doc"].includes(task.source.kind);
}

/** "23분", "2시간", "3일" */
export function ago(since: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - since) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

/**
 * 얼마나 이어졌나: "23분째", "2시간째". 1분이 안 됐으면 "방금부터".
 * ago() 뒤에 "째"를 바로 붙이면 "방금째"가 되므로 이것을 쓴다.
 */
export function elapsed(since: number, now = Date.now()): string {
  const a = ago(since, now);
  return a === "방금" ? "방금부터" : `${a}째`;
}
