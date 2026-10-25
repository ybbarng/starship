"use client";

import { useEffect, useState } from "react";
import type { Crew, CrewStatus, Source } from "@/protocol/v1";

/** 기다린 시간 글이 저절로 바뀌도록 30초마다 다시 그린다. */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

const STATUS_ORDER: Record<CrewStatus, number> = {
  "needs-you": 0,
  working: 1,
  idle: 2,
  off: 3,
};

/** 나를 기다리는 선원이 먼저, 그다음 일함·쉼·자리 비움. 같은 상태끼리는 이름순. */
export function sortCrew(list: Crew[]): Crew[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.name.localeCompare(b.name),
  );
}

/** 이름표에 쓰는 첫 글자 */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

export type Bridge = "chat" | "issue" | "review" | "doc";

/** 교신 출처마다 그리는 함교 */
export function bridgeOf(source: Source): Bridge {
  if (source.kind === "issue") return "issue";
  if (source.kind === "review") return "review";
  if (source.kind === "doc") return "doc";
  return "chat";
}

export const BRIDGE_NAME: Record<Bridge, string> = {
  chat: "보라 둥근 함교",
  issue: "남색 각진 함교",
  review: "검은 화물선 조종실",
  doc: "파란 도서관선",
};

export const BRIDGE_TINT: Record<Bridge, string> = {
  chat: "#b48cff",
  issue: "#7e9cff",
  review: "#ffb347",
  doc: "#6fc3ff",
};
