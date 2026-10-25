"use client";

// 선원이나 자리를 누르면 열리는 옆 서랍: 브리핑, 할 일 체크(체크 = 치우기), 창으로 가기·브리핑 다시.
// 접힌 자리("+n")를 누르면 그 선원 목록이 먼저 나온다. 글은 모두 끌어서 고를 수 있다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  KIND_LABEL,
  sourceLabel,
} from "@/ui/kit";

export type DrawerState =
  | { type: "crew"; id: string }
  | { type: "group"; title: string; ids: string[] };

const STATUS_DOT: Record<Crew["status"], string> = {
  working: "#5ee08a",
  "needs-you": "#ffd84a",
  idle: "#6c7a99",
  off: "#3a4256",
};

export function Drawer({
  state,
  crewById,
  tasksByCrew,
  clock,
  onSelect,
  onClose,
}: {
  state: DrawerState;
  crewById: Map<string, Crew>;
  tasksByCrew: Map<string, Task[]>;
  clock: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const crew = state.type === "crew" ? crewById.get(state.id) : undefined;
  return (
    <aside
      aria-label={crew ? `${crew.name} 자리` : "선원 목록"}
      className="ib-drawer absolute top-2 right-2 bottom-2 z-30 flex w-[372px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b1020]/95 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 pt-3 pb-2.5">
        {crew ? (
          <CrewHeader crew={crew} clock={clock} />
        ) : (
          <div className="text-[15px] font-semibold">
            {state.type === "group" ? state.title : "선원"}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="서랍 닫기"
          className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto px-4 py-3"
        data-scroll-inside
      >
        {crew ? (
          <CrewBody
            crew={crew}
            tasks={tasksByCrew.get(crew.id) ?? []}
            clock={clock}
          />
        ) : state.type === "group" ? (
          <ul className="space-y-1">
            {state.ids.map((id) => {
              const c = crewById.get(id);
              if (!c) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-left text-sm hover:bg-white/10"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_DOT[c.status] }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-auto text-xs text-white/50">
                      {CREW_STATUS_LABEL[c.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/50">이 선원은 배를 떠났어요.</p>
        )}
      </div>
    </aside>
  );
}

function CrewHeader({ crew, clock }: { crew: Crew; clock: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Animal
        kind={animalFor(crew.id)}
        pose={poseFor(crew.status)}
        context={crew.context}
        size={52}
        furniture={false}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-lg font-semibold">{crew.name}</span>
          <span
            className="shrink-0 rounded px-1.5 py-px text-[11px] font-semibold text-black"
            style={{ background: CONTEXT_COLOR[crew.context] }}
          >
            {CONTEXT_LABEL[crew.context]}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-white/65">
          <span
            className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${crew.status === "needs-you" ? "ib-blink" : ""}`}
            style={{ background: STATUS_DOT[crew.status] }}
          />
          {CREW_STATUS_LABEL[crew.status]}
          {crew.since ? ` · ${ago(crew.since, clock)}째` : ""}
        </div>
        {crew.activity && (
          <div className="text-[13px] text-white/55">{crew.activity}</div>
        )}
      </div>
    </div>
  );
}

function CrewBody({
  crew,
  tasks,
  clock,
}: {
  crew: Crew;
  tasks: Task[];
  clock: number;
}) {
  const act = useAct();
  const brief = crew.brief;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-white/45">
          할 일 체크 · 체크하면 치운다
        </h3>
        {tasks.length === 0 ? (
          <p className="text-white/50">이 선원이 기다리는 일은 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <CheckItem key={t.id} task={t} clock={clock} />
            ))}
          </ul>
        )}
      </section>

      {brief ? (
        <section className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold tracking-widest text-white/45">
              브리핑
            </h3>
            <span className="text-[11px] text-white/40">
              {ago(brief.at, clock)} 전에 만듦
            </span>
          </div>
          <p className="leading-relaxed text-white/90">{brief.summary}</p>
          <BriefList title="오늘" items={brief.today} />
          <BriefList title="다음" items={brief.next} />
          <BriefList title="위험" items={brief.risks} risk />
        </section>
      ) : (
        <p className="text-white/50">아직 브리핑이 없어요.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {crew.actions.includes("focus") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "focus")}
            className="rounded-md bg-white px-3 py-1.5 text-[13px] font-semibold text-hull-950 hover:bg-white/90"
          >
            창으로 가기
          </button>
        )}
        {crew.actions.includes("brief") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "brief")}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] text-white/90 hover:bg-white/10"
          >
            브리핑 다시
          </button>
        )}
      </div>
    </div>
  );
}

function BriefList({
  title,
  items,
  risk,
}: {
  title: string;
  items: string[];
  risk?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="flex gap-2">
      <span
        className={`w-8 shrink-0 text-xs font-semibold ${risk ? "text-[#ff8f8f]" : "text-white/45"}`}
      >
        {title}
      </span>
      <ul className="min-w-0 space-y-0.5 text-white/80">
        {items.map((s) => (
          <li key={s}>· {s}</li>
        ))}
      </ul>
    </div>
  );
}

/** 체크 칸만 누르는 곳이다. 글은 label로 감싸지 않아 끌어서 고를 수 있다. */
function CheckItem({ task, clock }: { task: Task; clock: number }) {
  const act = useAct();
  const [done, setDone] = useState(false);
  const canDismiss = task.actions.includes("dismiss");
  return (
    <li className="flex items-start gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2">
      <input
        type="checkbox"
        aria-label={`치우기: ${task.title}`}
        data-check={task.id}
        disabled={!canDismiss || done}
        checked={done}
        onChange={() => {
          setDone(true);
          act.task(task, "dismiss");
        }}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#5ee08a]"
      />
      <div
        className={`min-w-0 flex-1 ${done ? "text-white/35 line-through" : ""}`}
      >
        <div className="text-[11px] text-white/50">
          {KIND_LABEL[task.kind]} · {sourceLabel(task.source)} · {task.from} ·{" "}
          {ago(task.since, clock)}째
        </div>
        <div className="leading-snug" data-task-title>
          {task.title}
        </div>
        {task.detail && !done && (
          <div className="mt-0.5 text-[12px] whitespace-pre-wrap text-white/55">
            {task.detail}
          </div>
        )}
      </div>
      {task.actions.includes("focus") && !done && (
        <button
          type="button"
          onClick={() => act.task(task, "focus")}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-[#9cc8ff] hover:bg-white/10"
        >
          창으로
        </button>
      )}
    </li>
  );
}
