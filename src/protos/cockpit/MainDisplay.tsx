"use client";

// 계기판 한가운데 주 표시창 = 지금 할 일 하나. 업무/개인 · 누가 · 종류 · 기다린 시간, 첫 줄(크게),
// 단추 두세 개(주된 동작 + 치우기 + 더 보기). 다음 차례·전체 목록은 위쪽 손잡이로 서랍처럼 펼친다.
import { useState } from "react";
import type { Crew, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  isHail,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
  type TaskButton,
  useTaskButtons,
} from "@/ui/kit";
import styles from "./cockpit.module.css";
import { selecting } from "./util";

export const KEY = `${styles.key} rounded-md px-3 py-1.5 text-[13px] font-semibold text-white/90`;
export const KEY_PRIMARY = `${styles.key} ${styles.keyPrimary} rounded-md px-3 py-1.5 text-[13px] font-semibold`;
export const KEY_CHOICE = `${styles.key} ${styles.keyChoice} rounded-md px-3 py-1.5 text-[13px] font-semibold`;
export const KEY_SMALL = `${styles.key} rounded px-2 py-0.5 text-[12px] text-white/85`;

export function crewName(t: Task, crewById: Map<string, Crew>): string {
  return t.crewId ? (crewById.get(t.crewId)?.name ?? t.crewId) : "새 일";
}

function keyClass(b: TaskButton): string {
  if (b.action === "answer" && b.choice)
    return b.primary ? KEY_PRIMARY : KEY_CHOICE;
  return b.primary ? KEY_PRIMARY : KEY;
}

export function renderKey(b: TaskButton) {
  return (
    <button
      key={b.key}
      type="button"
      data-action={b.action}
      onClick={b.onClick}
      className={keyClass(b)}
    >
      {b.label}
    </button>
  );
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

export function MainDisplay({
  task,
  rest,
  total,
  crewById,
  crewCount,
  now,
  drawerOpen,
  onDrawer,
  onMore,
}: {
  task: Task | undefined;
  rest: Task[];
  total: number;
  crewById: Map<string, Crew>;
  crewCount: number;
  now: number;
  drawerOpen: boolean;
  onDrawer: () => void;
  onMore: (task: Task) => void;
}) {
  const { buttons } = useTaskButtons(task);
  // 주된 동작: 선택지가 있으면 선택지(셋까지), 없으면 창으로 가기. 그리고 치우기.
  const choices = buttons.filter((b) => b.action === "answer" && b.choice);
  const main = choices.length
    ? choices.slice(0, 3)
    : buttons.filter((b) => b.action === "focus");
  const dismiss = buttons.find((b) => b.action === "dismiss");

  return (
    <div className="relative flex h-full min-w-0 flex-col rounded-xl bg-[#07090d] p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_8px_22px_rgba(0,0,0,0.55)]">
      {/* 서랍 손잡이: 주 표시창 윗변에 붙은 탭 */}
      {total > 1 && (
        <button
          type="button"
          data-drawer-handle
          aria-expanded={drawerOpen}
          onClick={onDrawer}
          className={`absolute -top-[19px] right-6 z-10 flex h-[19px] items-center gap-1.5 rounded-t-md border border-b-0 border-white/[0.09] px-2.5 text-[11px] transition ${
            drawerOpen
              ? "bg-[#101826] text-white"
              : "bg-[#0b0f16] text-white/60 hover:text-white"
          }`}
        >
          다음
          <b className="font-mono tabular-nums text-white/90">{total - 1}</b>
          <span className="text-[9px]">{drawerOpen ? "▾" : "▴"}</span>
        </button>
      )}
      <div
        className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[9px] px-5 pt-2.5 pb-3 ${styles.screen}`}
        data-now={task?.id ?? "none"}
      >
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.24em] text-[#7fb8ff]/70">
          <span>지금 할 일</span>
          <span className="h-px flex-1 bg-[#7fb8ff]/15" />
          {task && (
            <span className="font-mono tracking-normal text-white/40 tabular-nums">
              1 / {total}
            </span>
          )}
        </div>

        {task ? (
          <div
            key={task.id}
            className={`flex min-h-0 flex-1 flex-col ${styles.swap}`}
          >
            <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-white/65">
              <ContextTag context={task.context} />
              <span className="truncate font-semibold text-white">
                {crewName(task, crewById)}
              </span>
              {isHail(task) && (
                <span className="truncate text-white/75">· {task.from}</span>
              )}
              <span className="shrink-0">· {KIND_LABEL[task.kind]}</span>
              <span className="shrink-0 text-white/45">
                · {sourceLabel(task.source)}
              </span>
              <span className="ml-auto shrink-0 rounded bg-[#ffd84a]/10 px-1.5 font-semibold text-[#ffd84a] tabular-nums">
                {ago(task.since, now)}째 기다림
              </span>
            </div>
            <h2 className="mt-1.5 line-clamp-2 text-[26px] leading-[1.28] font-semibold tracking-[-0.01em] text-white">
              {task.title}
            </h2>
            {task.detail && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed whitespace-pre-line text-white/45">
                {task.detail}
              </p>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
              {main.map(renderKey)}
              {dismiss && (
                <button
                  type="button"
                  data-action="dismiss"
                  onClick={dismiss.onClick}
                  className={KEY}
                >
                  {dismiss.label}
                </button>
              )}
              <button
                type="button"
                data-more
                onClick={() => onMore(task)}
                className={`${KEY} ml-auto font-normal text-white/65`}
              >
                더 보기 …
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="h-3.5 w-3.5 rounded-full bg-[#5ee08a] shadow-[0_0_16px_#5ee08a]" />
            <div className="text-[24px] font-semibold text-white">순항 중</div>
            <div className="text-[13px] text-white/45">
              {crewCount
                ? `내 차례가 없어요. 승무원 ${crewCount}명이 알아서 일하는 중 — 부르면 여기 뜹니다.`
                : "내 차례가 없어요. 창밖 여행을 즐기세요."}
            </div>
          </div>
        )}
      </div>
      {drawerOpen && (
        <NextDrawer
          tasks={rest}
          crewById={crewById}
          now={now}
          onClose={onDrawer}
        />
      )}
    </div>
  );
}

/** 다음 차례 서랍: 주 표시창 위로 올라온다. 줄을 누르면 그 자리에서 펼쳐 바로 답한다. */
function NextDrawer({
  tasks,
  crewById,
  now,
  onClose,
}: {
  tasks: Task[];
  crewById: Map<string, Crew>;
  now: number;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      aria-label="다음 차례"
      data-next-drawer
      className={`absolute inset-x-1 bottom-[calc(100%+22px)] z-20 flex max-h-[min(440px,52vh)] flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#070b13]/90 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-md ${styles.drawer}`}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.07] px-4 pt-2.5 pb-2">
        <h3 className="text-[12.5px] font-semibold text-white">다음 차례</h3>
        <span className="font-mono text-[12px] tabular-nums text-white/45">
          {tasks.length}
        </span>
        <span className="text-[11px] text-white/30">
          · 오래 기다린 순서 · 줄을 누르면 펼쳐요
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="다음 차례 접기"
          className="ml-auto rounded px-1.5 text-[12px] text-white/45 hover:bg-white/10 hover:text-white"
        >
          ▾ 접기
        </button>
      </header>
      <ul
        data-scroll-inside
        className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin]"
      >
        {tasks.map((t, i) => {
          const isOpen = open === t.id;
          return (
            <li
              key={t.id}
              className={`rounded-md px-2 ${isOpen ? "bg-white/[0.045] pb-2.5" : ""}`}
            >
              {/* biome-ignore lint/a11y/useSemanticElements: 글을 드래그해 고를 수 있게 div */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                data-next-row={t.id}
                onClick={() => !selecting() && setOpen(isOpen ? null : t.id)}
                onKeyDown={(e) =>
                  e.key === "Enter" && setOpen(isOpen ? null : t.id)
                }
                className="flex cursor-pointer items-baseline gap-2 py-1.5 text-[12.5px]"
              >
                <span className="w-4 shrink-0 text-right font-mono text-[10.5px] text-white/30 tabular-nums">
                  {i + 2}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ background: CONTEXT_COLOR[t.context] }}
                />
                <span className="w-[104px] shrink-0 truncate text-white/60">
                  {crewName(t, crewById)}
                </span>
                <span
                  className={`min-w-0 flex-1 text-white/85 ${isOpen ? "" : "truncate"}`}
                >
                  {t.title}
                </span>
                <span className="shrink-0 text-[11px] text-white/35">
                  {KIND_LABEL[t.kind]}
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] text-white/40 tabular-nums">
                  {ago(t.since, now)}
                </span>
              </div>
              {isOpen && (
                <div className="pl-[136px]">
                  <div className="text-[11px] text-white/45">
                    {t.from} · {sourceLabel(t.source)}
                  </div>
                  {t.detail && (
                    <p className="mt-1 text-[12px] leading-relaxed whitespace-pre-line text-white/55">
                      {t.detail}
                    </p>
                  )}
                  <TaskActions
                    task={t}
                    className="mt-2 flex flex-wrap gap-1.5"
                    buttonClassName={KEY_SMALL}
                    renderButton={(b) => (
                      <button
                        key={b.key}
                        type="button"
                        data-action={b.action}
                        onClick={b.onClick}
                        className={`${KEY_SMALL} ${b.primary ? styles.keyPrimary : ""}`}
                      >
                        {b.label}
                      </button>
                    )}
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

/** "더 보기": 지금 할 일의 전문과 모든 단추 */
export function TaskDetail({
  task,
  crewById,
  now,
}: {
  task: Task;
  crewById: Map<string, Crew>;
  now: number;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-white/55">
        <ContextTag context={task.context} />
        <span className="font-semibold text-white/85">
          {crewName(task, crewById)}
        </span>
        <span>· {task.from}</span>
        <span>· {KIND_LABEL[task.kind]}</span>
        <span>· {sourceLabel(task.source)}</span>
        <span className="ml-auto text-[#ffd84a]">{ago(task.since, now)}째</span>
      </div>
      <p className="text-[18px] leading-snug font-semibold text-white">
        {task.title}
      </p>
      {task.detail ? (
        <p className="leading-relaxed whitespace-pre-line text-white/70">
          {task.detail}
        </p>
      ) : (
        <p className="text-white/40">덧붙인 글은 없어요.</p>
      )}
      <TaskActions
        task={task}
        className="flex flex-wrap gap-1.5 pt-1"
        buttonClassName={KEY}
        renderButton={renderKey}
      />
    </div>
  );
}
