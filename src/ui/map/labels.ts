// 지도 값을 사람이 읽는 글로 바꾼다.
import type { RegionStatus, Sign } from "@/protocol/map";

export const REGION_STATUS_LABEL: Record<RegionStatus, string> = {
  fog: "안개",
  building: "공사중",
  done: "완공",
  blocked: "막힘",
  dropped: "버림",
};

/** 상태 막대·점 색 */
export const REGION_STATUS_COLOR: Record<RegionStatus, string> = {
  fog: "#8792a8",
  building: "#ffcf5c",
  done: "#5ee08a",
  blocked: "#ff6b6b",
  dropped: "#4a5163",
};

export const REGION_STATUS_ICON: Partial<Record<RegionStatus, string>> = {
  building: "🚧",
  done: "⚑",
  blocked: "⛔",
};

export const SIGN_ICON: Record<Sign["type"], string> = {
  fork: "⑂",
  talk: "📡",
  risk: "⚠",
};

export const SIGN_LABEL: Record<Sign["type"], string> = {
  fork: "갈림길",
  talk: "교신",
  risk: "위험",
};

export const TALK_STATUS_LABEL: Record<
  Extract<Sign, { type: "talk" }>["status"],
  string
> = {
  draft: "초안",
  sent: "보냄",
  waiting: "답 기다림",
  done: "끝",
};

/** owner가 me면 "내가", 아니면 그 이름 */
export function ownerLabel(owner: string): string {
  return owner === "me" ? "내가" : owner;
}

/** "2시간 전", "3일 전" */
export function agoLabel(at: number, now: number): string {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
