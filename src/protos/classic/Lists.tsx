"use client";

// 모달 안에 넣는 목록: 전체 할 일, 전체 브리핑, 교신 목록.
import type { Crew, Hail, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  isHail,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import { StatusDot } from "./CrewDetail";
import styles from "./classic.module.css";
import { BRIDGE_NAME, BRIDGE_TINT, bridgeOf, sortCrew } from "./util";

export function ContextChip({ context }: { context: Task["context"] }) {
  return (
    <span
      className="rounded px-1.5 py-px text-[11px] font-semibold text-black"
      style={{ background: CONTEXT_COLOR[context] }}
    >
      {CONTEXT_LABEL[context]}
    </span>
  );
}

const SMALL_KEY = `${styles.key} rounded px-2 py-0.5 text-[12px] text-white/85`;

export function AllTasksList({
  tasks,
  crewById,
  now,
}: {
  tasks: Task[];
  crewById: Map<string, Crew>;
  now: number;
}) {
  if (!tasks.length)
    return <p className="text-white/60">할 일이 하나도 없어요. 순항 중.</p>;
  return (
    <ol className="space-y-2">
      {tasks.map((t, i) => (
        <li
          key={t.id}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
            <span className="w-5 text-white/35 tabular-nums">{i + 1}</span>
            <ContextChip context={t.context} />
            <span className="text-white/80">
              {t.crewId ? (crewById.get(t.crewId)?.name ?? t.crewId) : "새 일"}
            </span>
            <span>· {KIND_LABEL[t.kind]}</span>
            <span>
              · {isHail(t) ? `${t.from} · ` : ""}
              {sourceLabel(t.source)}
            </span>
            <span className="ml-auto text-[#ffd84a]">
              {ago(t.since, now)}째
            </span>
          </div>
          <div className="mt-1 pl-6 font-medium">{t.title}</div>
          <TaskActions
            task={t}
            className="mt-2 flex flex-wrap gap-1.5 pl-6"
            buttonClassName={SMALL_KEY}
            primaryClassName={`${SMALL_KEY} ${styles.keyPrimary}`}
          />
        </li>
      ))}
    </ol>
  );
}

export function BriefsList({
  crew,
  now,
  onOpen,
}: {
  crew: Crew[];
  now: number;
  onOpen: (id: string) => void;
}) {
  const withBrief = sortCrew(crew).filter((c) => c.brief);
  if (!withBrief.length)
    return <p className="text-white/60">브리핑이 아직 없어요.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {withBrief.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            className="h-full w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left hover:border-white/25 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <StatusDot status={c.status} />
              {c.name}
              <ContextChip context={c.context} />
              <span className="ml-auto text-[11px] font-normal text-white/40">
                {c.brief ? `${ago(c.brief.at, now)} 전` : ""}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-white/75">
              {c.brief?.summary}
            </p>
            {!!c.brief?.risks.length && (
              <p className="mt-1 text-[12px] text-[#ff8f8f]">
                위험 · {c.brief.risks[0]}
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function HailsList({
  hails,
  taskById,
  now,
  onShow,
}: {
  hails: Hail[];
  taskById: Map<string, Task>;
  now: number;
  onShow: (id: string) => void;
}) {
  if (!hails.length)
    return <p className="text-white/60">들어온 교신이 없어요.</p>;
  return (
    <ul className="space-y-2">
      {hails.map((h) => {
        const b = bridgeOf(h.source);
        const task = h.taskId ? taskById.get(h.taskId) : undefined;
        return (
          <li
            key={h.id}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
            style={{ borderLeft: `3px solid ${BRIDGE_TINT[b]}` }}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/55">
              <ContextChip context={h.context} />
              <span className="font-semibold text-white/85">{h.from.name}</span>
              <span>· {sourceLabel(h.source)}</span>
              <span>· {BRIDGE_NAME[b]}</span>
              <span className="ml-auto text-[#ffd84a]">
                {ago(h.since, now)}째
              </span>
            </div>
            <div className="mt-1 font-medium">“{h.line}”</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onShow(h.id)}
                className={SMALL_KEY}
              >
                화상 창으로 보기
              </button>
              {task && (
                <TaskActions
                  task={task}
                  className="flex flex-wrap gap-1.5"
                  buttonClassName={SMALL_KEY}
                  primaryClassName={`${SMALL_KEY} ${styles.keyPrimary}`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
