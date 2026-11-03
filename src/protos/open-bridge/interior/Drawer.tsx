"use client";

// 선원이나 자리를 누르면 열리는 옆 서랍: 결재 목록(처리는 조종석 결재함에서), 브리핑, 창으로 가기·브리핑 다시.
// 접힌 자리("+n")를 누르면 그 선원 목록이, "베이 밖 대기"·통신 콘솔 "더 보기"를 누르면 교신 전체 목록이 먼저 나온다.
// 처리 단추는 결재함과 선실 "할 일"에만 둔다(docs/crew-views.md). 여기서는 각 결재에 "결재함에서 열기"만 두고,
// 책상 밖 일 중 치울 수 있는 것(dismiss)만 체크로 치운다. 글은 모두 끌어서 고를 수 있다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  elapsed,
  KIND_LABEL,
  sourceLabel,
} from "@/ui/kit";
import type { Berth } from "./berths";
import { PORTS } from "./Dock";
import { SHIP } from "./ships";

export type DrawerState =
  | { type: "crew"; id: string }
  | { type: "group"; title: string; ids: string[] }
  | { type: "hails" };

const STATUS_DOT: Record<Crew["status"], string> = {
  working: "#5ee08a",
  "needs-you": "#ffd84a",
  idle: "#6c7a99",
  off: "#3a4256",
};

const NO_TASKS: Task[] = [];

export function Drawer({
  state,
  crewById,
  decisions,
  berths,
  clock,
  onSelect,
  onHatch,
  onInbox,
  onClose,
}: {
  state: DrawerState;
  crewById: Map<string, Crew>;
  /** 승무원별 결재(decisionsByCrew) */
  decisions: ReadonlyMap<string, Task[]>;
  berths: Berth[];
  clock: number;
  onSelect: (id: string) => void;
  onHatch: (id: string) => void;
  /** 조종석으로 올라가 결재함에서 이 승무원 묶음을 연다 */
  onInbox: (crewId: string) => void;
  onClose: () => void;
}) {
  const crew = state.type === "crew" ? crewById.get(state.id) : undefined;
  const list = crew ? (decisions.get(crew.id) ?? NO_TASKS) : NO_TASKS;
  return (
    <aside
      aria-label={
        crew
          ? `${crew.name} 자리`
          : state.type === "hails"
            ? "교신 목록"
            : "선원 목록"
      }
      className="ib-drawer absolute top-2 right-2 bottom-2 z-30 flex w-[372px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b1020]/95 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 pt-3 pb-2.5">
        {crew ? (
          <CrewHeader crew={crew} decisions={list} clock={clock} />
        ) : (
          <div className="text-[15px] font-semibold">
            {state.type === "group"
              ? state.title
              : state.type === "hails"
                ? `교신 ${berths.length}척`
                : "선원"}
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
            decisions={list}
            clock={clock}
            onInbox={() => onInbox(crew.id)}
          />
        ) : state.type === "hails" ? (
          <HailList berths={berths} clock={clock} onHatch={onHatch} />
        ) : state.type === "group" ? (
          <ul className="space-y-1">
            {state.ids.map((id) => {
              const c = crewById.get(id);
              if (!c) return null;
              const n = decisions.get(id)?.length ?? 0;
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
                      {n > 0 ? `결재 ${n}` : CREW_STATUS_LABEL[c.status]}
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

/** 교신 전체: 포트에 붙은 셋 다음 베이 밖에서 기다리는 배까지. 누르면 해치가 열린다 */
function HailList({
  berths,
  clock,
  onHatch,
}: {
  berths: Berth[];
  clock: number;
  onHatch: (id: string) => void;
}) {
  if (!berths.length)
    return <p className="text-sm text-white/50">들어온 교신이 없어요.</p>;
  return (
    <ul className="space-y-1.5">
      {berths.map((b, i) => (
        <li key={b.id}>
          <button
            type="button"
            data-hail-row={b.id}
            onClick={() => onHatch(b.id)}
            className="flex w-full items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-sm hover:bg-white/10"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: SHIP[b.kind].color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-white/50">
                {i < PORTS ? `포트 ${i + 1}` : "베이 밖"} · {b.source} ·{" "}
                {ago(b.since, clock)}
              </span>
              <b style={{ color: CONTEXT_COLOR[b.context] }}>{b.from}</b>
              <span className="ml-1 text-white/80">{b.line}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CrewHeader({
  crew,
  decisions,
  clock,
}: {
  crew: Crew;
  decisions: Task[];
  clock: number;
}) {
  const calling = decisions.length > 0;
  // 기다린 시간은 결재함과 같게 가장 오래된 결재의 것. 결재가 없으면 상태가 바뀐 때(소식뿐인 "나를 기다림"은 적지 않는다)
  const oldest = calling
    ? Math.min(...decisions.map((t) => t.since))
    : undefined;
  const status: Crew["status"] = calling
    ? "needs-you"
    : crew.status === "needs-you"
      ? "idle"
      : crew.status;
  const tail = oldest
    ? ` · 결재 ${decisions.length}건 · 가장 오래 ${elapsed(oldest, clock)}`
    : crew.since && status === crew.status
      ? ` · ${elapsed(crew.since, clock)}`
      : "";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Animal
        kind={animalFor(crew.id)}
        pose={poseFor(status)}
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
        <div className="mt-0.5 text-sm text-white/65" data-drawer-wait>
          <span
            className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${calling ? "ib-blink" : ""}`}
            style={{ background: STATUS_DOT[status] }}
          />
          {CREW_STATUS_LABEL[status]}
          {tail}
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
  decisions,
  clock,
  onInbox,
}: {
  crew: Crew;
  decisions: Task[];
  clock: number;
  onInbox: () => void;
}) {
  const act = useAct();
  const brief = crew.brief;
  const answers = crew.desk?.answers ?? 0;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-white/45">
          결재 {decisions.length} · 처리는 조종석 결재함에서
        </h3>
        {answers > 0 && (
          <button
            type="button"
            data-inbox-answers
            onClick={onInbox}
            className="mb-1.5 flex w-full items-center justify-between rounded-md border border-[#7ce0ff]/30 bg-[#7ce0ff]/10 px-2.5 py-1.5 text-left text-[13px] text-[#bfefff] hover:bg-[#7ce0ff]/20"
          >
            <span>답해 둔 것 {answers}</span>
            <span className="text-[12px]">결재함에서 열기 ↑</span>
          </button>
        )}
        {decisions.length === 0 ? (
          <p className="text-white/50">이 선원이 기다리는 결재는 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {decisions.map((t) => (
              <DecisionItem
                key={t.id}
                task={t}
                clock={clock}
                onInbox={onInbox}
              />
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

/**
 * 결재 한 줄. "결재함에서 열기"로 조종석 결재함의 그 승무원 묶음을 연다.
 * 치울 수 있는 일(dismiss)만 체크 칸이 있고, 본부가 거절하거나 닿지 못하면 체크를 되돌린다.
 * 체크 칸만 누르는 곳이다. 글은 label로 감싸지 않아 끌어서 고를 수 있다.
 */
function DecisionItem({
  task,
  clock,
  onInbox,
}: {
  task: Task;
  clock: number;
  onInbox: () => void;
}) {
  const act = useAct();
  const [done, setDone] = useState(false);
  const canDismiss = task.actions.includes("dismiss");
  return (
    <li
      data-decision={task.id}
      className="flex items-start gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2"
    >
      {canDismiss && (
        <input
          type="checkbox"
          aria-label={`치우기: ${task.title}`}
          data-check={task.id}
          disabled={done}
          checked={done}
          onChange={async () => {
            setDone(true);
            const r = await act.task(task, "dismiss");
            if (!r.ok) setDone(false);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#5ee08a]"
        />
      )}
      <div
        className={`min-w-0 flex-1 ${done ? "text-white/35 line-through" : ""}`}
      >
        <div className="text-[11px] text-white/50">
          {KIND_LABEL[task.kind]} · {sourceLabel(task.source)} · {task.from} ·{" "}
          {elapsed(task.since, clock)}
        </div>
        <div className="leading-snug" data-task-title>
          {task.title}
        </div>
        {task.detail && !done && (
          <div className="mt-0.5 line-clamp-4 text-[12px] whitespace-pre-wrap text-white/55">
            {task.detail}
          </div>
        )}
        {!done && (
          <button
            type="button"
            data-open-inbox={task.id}
            onClick={onInbox}
            className="mt-1 rounded border border-[#7ce0ff]/40 px-1.5 py-0.5 text-[11px] font-semibold text-[#bfefff] hover:bg-[#7ce0ff]/15"
          >
            결재함에서 열기 ↑
          </button>
        )}
      </div>
    </li>
  );
}
