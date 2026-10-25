"use client";

// 시안 안에서 여러 곳이 같이 쓰는 작은 것들.
import { useEffect, useState } from "react";
import type { Crew, GaugeStatus, Task } from "@/protocol/v1";
import { isHail, KIND_LABEL, sourceLabel } from "@/ui/kit";

export function useViewport() {
  const [vp, setVp] = useState({ w: 1372, h: 872 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/** 누가 기다리나: 세션이면 승무원 이름, 사람이 부른 일이면 그 사람 · 서비스 */
export function whoOf(task: Task, crewById: Map<string, Crew>): string {
  if (isHail(task)) return `${task.from} · ${sourceLabel(task.source)}`;
  const crew = task.crewId ? crewById.get(task.crewId) : undefined;
  return crew?.name ?? task.from;
}

export function kindLine(task: Task): string {
  return isHail(task)
    ? KIND_LABEL[task.kind]
    : `${KIND_LABEL[task.kind]} · ${sourceLabel(task.source)}`;
}

export const LAMP: Record<GaugeStatus, string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "#3a4560",
};

export function Lamp({
  status,
  size = 9,
  blink = false,
}: {
  status: GaugeStatus;
  size?: number;
  blink?: boolean;
}) {
  const c = LAMP[status];
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${blink ? "ring-blink" : ""}`}
      style={{
        width: size,
        height: size,
        background: status === "off" ? "#1a2133" : c,
        boxShadow:
          status === "off"
            ? "inset 0 0 0 1px #3a4560"
            : `0 0 6px ${c}, inset 0 -1px 2px rgba(0,0,0,.35)`,
      }}
    />
  );
}

/** 업무/개인 작은 딱지 */
export function ContextChip({ context }: { context: "work" | "personal" }) {
  const work = context === "work";
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] font-semibold"
      style={{
        color: work ? "#0b1a2e" : "#2e1a08",
        background: work ? "#6cb6ff" : "#ffb86c",
      }}
    >
      {work ? "업무" : "개인"}
    </span>
  );
}

/** 이 시안 전체에서 쓰는 애니메이션 */
export const RING_CSS = `
@keyframes ring-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.ring-blink { animation: ring-blink 1.2s ease-in-out infinite; }
@keyframes ring-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,207,92,.0), 0 0 18px 2px rgba(255,207,92,.55) } 50% { box-shadow: 0 0 0 6px rgba(255,207,92,.18), 0 0 28px 6px rgba(255,207,92,.8) } }
.ring-pulse { animation: ring-pulse 1.6s ease-in-out infinite; }
@keyframes ring-wave { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.8); opacity: 0 } }
.ring-wave { animation: ring-wave 1.8s ease-out infinite; transform-origin: center; transform-box: fill-box; }
@keyframes ring-spin { to { transform: rotate(360deg) } }
.ring-spin { animation: ring-spin 90s linear infinite; transform-origin: center; transform-box: fill-box; }
@keyframes ring-beam { 0% { stroke-dashoffset: 40 } 100% { stroke-dashoffset: 0 } }
.ring-beam { stroke-dasharray: 6 8; animation: ring-beam 1s linear infinite; }
@keyframes ring-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
.ring-float { animation: ring-float 3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ring-blink, .ring-pulse, .ring-wave, .ring-spin, .ring-beam, .ring-float { animation: none; }
}
`;
