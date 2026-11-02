"use client";

// 조종석 여러 곳이 함께 쓰는 작은 조각: 작은 단추 모양, 승무원 이름, 업무/개인 꼬리표.
import type { Crew, Task } from "@/protocol/v1";
import { CONTEXT_COLOR, CONTEXT_LABEL } from "@/ui/kit";
import styles from "./cockpit.module.css";

export const KEY_SMALL = `${styles.key} rounded px-2 py-0.5 text-[12px] text-white/85`;

export function crewName(t: Task, crewById: Map<string, Crew>): string {
  return t.crewId ? (crewById.get(t.crewId)?.name ?? t.crewId) : "새 일";
}

export function ContextTag({ context }: { context: Task["context"] }) {
  return (
    <span
      className="rounded-[3px] px-1.5 py-px text-[10.5px] font-semibold text-black"
      style={{ background: CONTEXT_COLOR[context] }}
    >
      {CONTEXT_LABEL[context]}
    </span>
  );
}
