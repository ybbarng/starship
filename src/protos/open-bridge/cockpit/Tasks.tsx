"use client";

// 일 신호 띠(아래 왼쪽 한 줄)와 할 일 패널(접힘이 기본).
// 띠: "내 차례 3 · 교신 2" + 가장 급한 일의 첫 줄과 기다린 시간. 누르거나 T로 패널을 연다.
// 패널: 지금 할 일(누가·무엇을·얼마나·버튼) + 다음 차례 + 새 일. 위·오른쪽 가장자리를 끌어 크기를 바꾼다.
import { useState } from "react";
import type { Crew, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  elapsed,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import styles from "./cockpit.module.css";
import { GLASS, LABEL, selecting, useEdgeDrag } from "./ui";

export type PanelState = { open: boolean; w: number; h: number };

export const BTN =
  "rounded-md border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/85 transition hover:border-white/30 hover:bg-white/[0.1]";
export const BTN_PRIMARY =
  "rounded-md border border-[#6cb6ff]/60 bg-[#6cb6ff]/20 px-2.5 py-1 text-[12px] font-medium text-[#d8ecff] transition hover:bg-[#6cb6ff]/30";

function Dot({
  task,
  size = 7,
}: {
  task: Pick<Task, "context">;
  size?: number;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: CONTEXT_COLOR[task.context],
      }}
      title={CONTEXT_LABEL[task.context]}
    />
  );
}

export function WorkStrip({
  tasks,
  hailCount,
  open,
  now,
  onToggle,
}: {
  tasks: Task[];
  hailCount: number;
  open: boolean;
  now: number;
  onToggle: () => void;
}) {
  const top = tasks[0];
  const quiet = !top && hailCount === 0;
  return (
    // biome-ignore lint/a11y/useSemanticElements: 안의 글을 드래그해 고를 수 있어야 해서 button 대신 div
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      data-work-strip
      onClick={() => !selecting() && onToggle()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`${GLASS} flex max-w-[340px] cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition hover:border-white/20 ${open ? "border-white/20 bg-[#0b1222]/75" : ""}`}
    >
      {quiet ? (
        <>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-ok/70" />
          <span className="text-white/60">조용함</span>
          <span className="text-white/30">· 기다리는 일이 없어요</span>
        </>
      ) : (
        <>
          <span className="shrink-0 whitespace-nowrap text-white/50">
            내 차례{" "}
            <b className="font-mono font-semibold tabular-nums text-white">
              {tasks.length}
            </b>
            {hailCount > 0 && (
              <>
                {" · "}교신{" "}
                <b className="font-mono font-semibold tabular-nums text-[#ffc478]">
                  {hailCount}
                </b>
              </>
            )}
          </span>
          {top && (
            <>
              <span className="h-3 w-px shrink-0 bg-white/15" />
              <Dot task={top} />
              <span className="min-w-0 truncate text-white/85">
                {top.title}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/40">
                {ago(top.since, now)}
              </span>
            </>
          )}
        </>
      )}
      <span className="ml-0.5 shrink-0 text-[10px] text-white/35">
        {open ? "▾" : "▴"}
      </span>
    </div>
  );
}

export function TaskPanel({
  tasks,
  crewById,
  size,
  now,
  onResize,
  onClose,
}: {
  tasks: Task[];
  crewById: Map<string, Crew>;
  size: { w: number; h: number };
  now: number;
  onResize: (w: number, h: number) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const resize = (dx: number, dy: number) =>
    onResize(
      Math.max(320, Math.min(window.innerWidth - 40, size.w + dx)),
      Math.max(200, Math.min(window.innerHeight - 110, size.h - dy)),
    );
  const dragRight = useEdgeDrag((dx) => resize(dx, 0));
  const dragTop = useEdgeDrag((_, dy) => resize(0, dy));
  const dragCorner = useEdgeDrag((dx, dy) => resize(dx, dy));

  const [now0, ...rest] = tasks;
  const next = rest.filter((t) => t.crewId);
  const loose = rest.filter((t) => !t.crewId);

  return (
    <section
      aria-label="할 일"
      data-task-panel
      className={`${GLASS} ${styles.rise} relative flex flex-col overflow-hidden`}
      style={{ width: size.w, height: size.h }}
    >
      {/* 크기 조절 손잡이 */}
      <div
        onPointerDown={dragTop}
        className="absolute inset-x-3 top-0 z-10 h-1.5 cursor-ns-resize hover:bg-white/10"
        title="끌어서 높이 바꾸기"
      />
      <div
        onPointerDown={dragRight}
        className="absolute inset-y-3 right-0 z-10 w-1.5 cursor-ew-resize hover:bg-white/10"
        title="끌어서 너비 바꾸기"
      />
      <div
        onPointerDown={dragCorner}
        className="absolute top-0 right-0 z-20 h-3 w-3 cursor-nesw-resize"
      />

      <header className="flex items-center gap-2 border-b border-white/[0.07] px-4 pt-3 pb-2">
        <h2 className="text-[13px] font-semibold text-white">할 일</h2>
        <span className="font-mono text-[12px] tabular-nums text-white/45">
          {tasks.length}
        </span>
        <span className="ml-auto text-[10.5px] text-white/30">
          <kbd className="rounded border border-white/15 px-1 font-mono">T</kbd>{" "}
          여닫기
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="할 일 패널 접기"
          title="접기"
          className="rounded px-1.5 text-[13px] leading-none text-white/45 hover:bg-white/10 hover:text-white"
        >
          ─
        </button>
      </header>

      <div
        data-scroll-inside
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4 [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin]"
      >
        {!now0 ? (
          <p className="py-8 text-center text-[13px] text-white/45">
            기다리는 일이 없어요. 창밖을 즐기세요.
          </p>
        ) : (
          <>
            <div className={LABEL}>지금</div>
            <NowCard task={now0} crew={crewOf(now0, crewById)} now={now} />
            {next.length > 0 && (
              <List
                title="다음 차례"
                tasks={next}
                crewById={crewById}
                now={now}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            )}
            {loose.length > 0 && (
              <List
                title="새 일"
                tasks={loose}
                crewById={crewById}
                now={now}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function crewOf(task: Task, crewById: Map<string, Crew>): string {
  return task.crewId ? (crewById.get(task.crewId)?.name ?? "새 일") : "새 일";
}

function Meta({ task, crew, now }: { task: Task; crew: string; now: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
      <Dot task={task} />
      <span style={{ color: CONTEXT_COLOR[task.context] }}>
        {CONTEXT_LABEL[task.context]}
      </span>
      <span className="font-medium text-white/80">{crew}</span>
      <span>· {task.from}</span>
      <span>· {KIND_LABEL[task.kind]}</span>
      <span className="truncate">· {sourceLabel(task.source)}</span>
      <span className="ml-auto shrink-0 font-mono tabular-nums text-[#ffd98a]/80">
        {elapsed(task.since, now)}
      </span>
    </div>
  );
}

function NowCard({
  task,
  crew,
  now,
}: {
  task: Task;
  crew: string;
  now: number;
}) {
  return (
    <article
      data-now-task={task.id}
      className="mt-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2.5"
    >
      <Meta task={task} crew={crew} now={now} />
      <p className="mt-1.5 text-[15px] leading-snug font-medium text-white">
        {task.title}
      </p>
      {task.detail && (
        <p className="mt-1 line-clamp-4 text-[12px] leading-relaxed whitespace-pre-line text-white/55">
          {task.detail}
        </p>
      )}
      <TaskActions
        task={task}
        className="mt-2.5 flex flex-wrap gap-1.5"
        buttonClassName={BTN}
        primaryClassName={BTN_PRIMARY}
      />
    </article>
  );
}

function List({
  title,
  tasks,
  crewById,
  now,
  expanded,
  setExpanded,
}: {
  title: string;
  tasks: Task[];
  crewById: Map<string, Crew>;
  now: number;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  return (
    <section className="mt-4">
      <div className={LABEL}>
        {title} <span className="font-mono">{tasks.length}</span>
      </div>
      <ul className="mt-1">
        {tasks.map((t) => {
          const isOpen = expanded === t.id;
          return (
            <li
              key={t.id}
              className={`-mx-2 rounded-md px-2 ${isOpen ? "bg-white/[0.04] pb-2" : ""}`}
            >
              {/* biome-ignore lint/a11y/useSemanticElements: 글을 드래그해 고를 수 있게 div */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() =>
                  !selecting() && setExpanded(isOpen ? null : t.id)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") setExpanded(isOpen ? null : t.id);
                }}
                className="flex cursor-pointer items-baseline gap-2 py-1.5 text-[12.5px]"
              >
                <Dot task={t} size={6} />
                <span
                  className={`min-w-0 flex-1 text-white/80 ${isOpen ? "" : "truncate"}`}
                >
                  {t.title}
                </span>
                <span className="shrink-0 text-[11px] text-white/40">
                  {crewOf(t, crewById)}
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/35">
                  {ago(t.since, now)}
                </span>
              </div>
              {isOpen && (
                <div className="pl-3.5">
                  <div className="text-[11px] text-white/45">
                    {t.from} · {KIND_LABEL[t.kind]} · {sourceLabel(t.source)}
                  </div>
                  {t.detail && (
                    <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-line text-white/55">
                      {t.detail}
                    </p>
                  )}
                  <TaskActions
                    task={t}
                    className="mt-2 flex flex-wrap gap-1.5"
                    buttonClassName={BTN}
                    primaryClassName={BTN_PRIMARY}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
