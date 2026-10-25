"use client";

// 경고등을 눌렀을 때 뜨는 목록: 할 일(전체·오래 기다린 것), 정기 작업 계기.
import type { Crew, Gauge, GaugeStatus, Task } from "@/protocol/v1";
import { ago, KIND_LABEL, sourceLabel, TaskActions } from "@/ui/kit";
import styles from "./cockpit.module.css";
import { ContextTag, crewName, KEY_SMALL } from "./MainDisplay";

export function TaskList({
  tasks,
  crewById,
  now,
  empty,
}: {
  tasks: Task[];
  crewById: Map<string, Crew>;
  now: number;
  empty: string;
}) {
  if (!tasks.length) return <p className="text-white/55">{empty}</p>;
  return (
    <ol data-scroll-inside className="space-y-2">
      {tasks.map((t, i) => (
        <li
          key={t.id}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
            <span className="w-5 text-white/35 tabular-nums">{i + 1}</span>
            <ContextTag context={t.context} />
            <span className="text-white/80">{crewName(t, crewById)}</span>
            <span>· {t.from}</span>
            <span>· {KIND_LABEL[t.kind]}</span>
            <span>· {sourceLabel(t.source)}</span>
            <span className="ml-auto text-[#ffd84a]">
              {ago(t.since, now)}째
            </span>
          </div>
          <div className="mt-1 pl-6 font-medium">{t.title}</div>
          <TaskActions
            task={t}
            className="mt-2 flex flex-wrap gap-1.5 pl-6"
            buttonClassName={KEY_SMALL}
            primaryClassName={`${KEY_SMALL} ${styles.keyPrimary}`}
          />
        </li>
      ))}
    </ol>
  );
}

const GAUGE_LAMP: Record<GaugeStatus, string> = {
  ok: "bg-[#5ee08a] shadow-[0_0_7px_#5ee08a]",
  warn: "bg-[#ffcf5c] shadow-[0_0_7px_#ffcf5c]",
  error: "bg-[#ff6b6b] shadow-[0_0_9px_#ff6b6b]",
  off: "border border-white/25",
};

const GAUGE_WORD: Record<GaugeStatus, string> = {
  ok: "정상",
  warn: "경고",
  error: "실패",
  off: "꺼짐",
};

export function GaugeList({ gauges, now }: { gauges: Gauge[]; now: number }) {
  if (!gauges.length) return <p className="text-white/55">계기가 없어요.</p>;
  const order: Record<GaugeStatus, number> = {
    error: 0,
    warn: 1,
    ok: 2,
    off: 3,
  };
  const sorted = [...gauges].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <ul className="divide-y divide-white/[0.06]">
      {sorted.map((g) => (
        <li
          key={g.id}
          data-gauge={g.id}
          className="flex items-start gap-3 py-2.5"
        >
          <span
            className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${GAUGE_LAMP[g.status]}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-[14px]">
              <span className="font-medium text-white/90">{g.label}</span>
              <span
                className={`text-[12px] ${g.status === "error" ? "text-[#ff8f8f]" : g.status === "warn" ? "text-[#ffcf5c]" : "text-white/45"}`}
              >
                {GAUGE_WORD[g.status]}
                {g.value ? ` · ${g.value}` : ""}
              </span>
              {g.at && (
                <span className="ml-auto text-[11px] text-white/35">
                  {ago(g.at, now)} 전
                </span>
              )}
            </div>
            {g.detail && (
              <p className="mt-0.5 text-[12px] text-white/50">{g.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
