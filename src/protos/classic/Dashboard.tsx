"use client";

// 아래 42% 계기판: 위 가장자리 계기 등 줄, 가운데 주 표시창(지금 할 일), 양옆 승무원 토글 줄, 오른쪽 끝 항법·브리핑·전체 할 일.
import type { Context, Crew, Gauge, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  isHail,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
  type TaskButton,
} from "@/ui/kit";
import styles from "./classic.module.css";
import { ContextChip } from "./Lists";
import { ToggleSwitch } from "./ToggleSwitch";
import { sortCrew } from "./util";

const SLOTS = 12;

export type DashProps = {
  now: number;
  task: Task | undefined;
  next: Task[];
  crew: Crew[];
  crewById: Map<string, Crew>;
  gauges: Gauge[];
  hailCount: number;
  hailFresh: boolean;
  destination: string;
  onCrew: (id: string) => void;
  onBank: (context: Context) => void;
  onNav: () => void;
  onBrief: () => void;
  onTasks: () => void;
  onHails: () => void;
};

export function Dashboard(p: DashProps) {
  return (
    <div className={`relative flex h-full flex-col ${styles.metal}`}>
      {/* 위 가장자리 빛 */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <GaugeStrip gauges={p.gauges} />
      <div className="flex min-h-0 flex-1 gap-3 px-4 pt-1 pb-3">
        <Bank
          context="work"
          crew={p.crew.filter((c) => c.context === "work")}
          now={p.now}
          onCrew={p.onCrew}
          onMore={() => p.onBank("work")}
        />
        <MainDisplay
          task={p.task}
          next={p.next}
          crewById={p.crewById}
          now={p.now}
          crewCount={p.crew.length}
        />
        <Bank
          context="personal"
          crew={p.crew.filter((c) => c.context === "personal")}
          now={p.now}
          onCrew={p.onCrew}
          onMore={() => p.onBank("personal")}
        />
        <SideKeys {...p} />
      </div>
    </div>
  );
}

const GAUGE_LAMP: Record<Gauge["status"], string> = {
  ok: "bg-[#5ee08a] shadow-[0_0_7px_#5ee08a]",
  warn: "bg-[#ffcf5c] shadow-[0_0_7px_#ffcf5c]",
  error: "bg-[#ff6b6b] shadow-[0_0_9px_#ff6b6b]",
  off: "bg-[#3a404b]",
};

function GaugeStrip({ gauges }: { gauges: Gauge[] }) {
  return (
    <div className="flex h-[30px] shrink-0 items-center gap-1 overflow-hidden border-b border-black/50 bg-black/25 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
      <span className="mr-2 text-[10px] font-semibold tracking-[0.2em] text-white/35">
        계기 등
      </span>
      {gauges.map((g) => (
        <span
          key={g.id}
          title={g.detail ?? g.label}
          data-gauge={g.id}
          className="flex shrink-0 items-center gap-1.5 rounded border border-black/50 bg-black/30 px-2 py-0.5 text-[11px]"
        >
          <span
            className={`h-2 w-2 rounded-full ${GAUGE_LAMP[g.status]} ${g.status === "error" ? styles.blink : ""}`}
          />
          <span className="text-white/75">{g.label}</span>
          {g.value && (
            <span
              className={`font-mono text-[10px] ${g.status === "error" ? "text-[#ff8f8f]" : g.status === "warn" ? "text-[#ffcf5c]" : "text-white/45"}`}
            >
              {g.value}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function Bank({
  context,
  crew,
  now,
  onCrew,
  onMore,
}: {
  context: Context;
  crew: Crew[];
  now: number;
  onCrew: (id: string) => void;
  onMore: () => void;
}) {
  const sorted = sortCrew(crew);
  const overflow = sorted.length > SLOTS;
  const shown = overflow ? sorted.slice(0, SLOTS - 1) : sorted;
  const waiting = crew.filter((c) => c.status === "needs-you").length;
  const working = crew.filter((c) => c.status === "working").length;
  return (
    <div
      className={`flex w-[292px] shrink-0 flex-col rounded-lg border border-black/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_20px_rgba(0,0,0,0.35)] ${styles.metalDark}`}
    >
      <div className="flex items-center gap-1.5 px-1 pb-1 text-[11px]">
        <span
          className="h-2.5 w-1 rounded-sm"
          style={{ background: CONTEXT_COLOR[context] }}
        />
        <span className="font-semibold tracking-wide text-white/85">
          {CONTEXT_LABEL[context]} 승무원 {crew.length}
        </span>
        <span className="ml-auto flex gap-2 text-white/55">
          {waiting > 0 && (
            <span className="font-semibold text-[#ffd84a]">
              기다림 {waiting}
            </span>
          )}
          <span>일함 {working}</span>
        </span>
      </div>
      <div className="grid flex-1 grid-cols-4 content-start gap-x-1 gap-y-0.5">
        {shown.map((c) => (
          <ToggleSwitch
            key={c.id}
            crew={c}
            now={now}
            onOpen={() => onCrew(c.id)}
          />
        ))}
        {overflow && (
          <button
            type="button"
            onClick={onMore}
            className="m-1 flex flex-col items-center justify-center rounded-md border border-dashed border-white/20 text-white/70 hover:bg-white/5"
          >
            <span className="text-lg font-semibold">
              +{sorted.length - shown.length}
            </span>
            <span className="text-[10px] text-white/45">모두 보기</span>
          </button>
        )}
        {crew.length === 0 && (
          <p className="col-span-4 px-1 pt-4 text-center text-xs text-white/40">
            탑승한 승무원이 없어요
          </p>
        )}
      </div>
    </div>
  );
}

function crewName(t: Task, crewById: Map<string, Crew>) {
  return t.crewId ? (crewById.get(t.crewId)?.name ?? t.crewId) : "새 일";
}

const KEY = `${styles.key} rounded-md px-3 py-1.5 text-[13px] font-semibold text-white/90`;

function renderKey(b: TaskButton) {
  const cls =
    b.action === "answer" && b.choice
      ? `${styles.key} ${styles.keyChoice} rounded-md px-3 py-1.5 text-[13px] font-semibold`
      : b.primary
        ? `${styles.key} ${styles.keyPrimary} rounded-md px-3 py-1.5 text-[13px] font-semibold`
        : KEY;
  return (
    <button
      key={b.key}
      type="button"
      data-action={b.action}
      onClick={b.onClick}
      className={cls}
    >
      {b.label}
    </button>
  );
}

function MainDisplay({
  task,
  next,
  crewById,
  now,
  crewCount,
}: {
  task: Task | undefined;
  next: Task[];
  crewById: Map<string, Crew>;
  now: number;
  crewCount: number;
}) {
  return (
    <div className="relative min-w-0 flex-1 rounded-xl border-[3px] border-[#0b0e13] bg-[#0b0e13] p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_6px_18px_rgba(0,0,0,0.5)]">
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-lg px-5 pt-3 pb-2.5 ${styles.screen}`}
        data-now={task?.id ?? "none"}
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-[0.25em] text-[#7fb8ff]/70">
          <span>지금 할 일</span>
          <span className="h-px flex-1 bg-[#7fb8ff]/15" />
        </div>
        {task ? (
          <>
            <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-white/70">
              <ContextChip context={task.context} />
              <span className="truncate font-semibold text-white">
                {crewName(task, crewById)}
              </span>
              {isHail(task) && (
                <span className="truncate text-white/80">· {task.from}</span>
              )}
              <span className="shrink-0">· {KIND_LABEL[task.kind]}</span>
              <span className="shrink-0 text-white/50">
                · {sourceLabel(task.source)}
              </span>
              <span className="ml-auto shrink-0 rounded bg-[#ffd84a]/12 px-1.5 font-semibold text-[#ffd84a] tabular-nums">
                {ago(task.since, now)}째 기다림
              </span>
            </div>
            <h2 className="mt-1.5 line-clamp-2 text-[27px] leading-[1.25] font-semibold tracking-[-0.01em] text-white">
              {task.title}
            </h2>
            {task.detail && (
              <p className="mt-1 truncate text-[13px] text-white/50">
                {task.detail.split("\n")[0]}
              </p>
            )}
            <TaskActions
              task={task}
              className="mt-2.5 flex flex-wrap gap-1.5"
              buttonClassName={KEY}
              renderButton={renderKey}
            />
            <div className="mt-auto border-t border-white/10 pt-1.5">
              <div className="mb-0.5 text-[10px] font-semibold tracking-[0.2em] text-white/35">
                다음 차례
              </div>
              {next.length === 0 && (
                <div className="text-[13px] text-white/40">
                  이게 마지막이에요
                </div>
              )}
              {next.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[1.45] text-white/50"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: CONTEXT_COLOR[t.context] }}
                  />
                  <span className="shrink-0 text-white/70">
                    {crewName(t, crewById)}
                  </span>
                  <span className="shrink-0">· {KIND_LABEL[t.kind]}</span>
                  <span className="truncate">— {t.title}</span>
                  <span className="ml-auto shrink-0 pl-2 tabular-nums">
                    {ago(t.since, now)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span
              className={`h-4 w-4 rounded-full bg-[#5ee08a] shadow-[0_0_16px_#5ee08a] ${styles.blinkSoft}`}
            />
            <div className="text-[26px] font-semibold text-white">
              내 차례 없음 · 순항 중
            </div>
            <div className="text-sm text-white/50">
              {crewCount
                ? `승무원 ${crewCount}명이 알아서 일하고 있어요. 부르면 여기 뜹니다.`
                : "탑승한 승무원이 없어요. 창밖 여행을 즐기세요."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SideKeys(p: DashProps) {
  return (
    <div className="flex w-[118px] shrink-0 flex-col gap-2">
      <button
        type="button"
        onClick={p.onHails}
        data-lamp="hail"
        className={`${styles.key} flex flex-1 flex-col items-center justify-center rounded-lg px-2 py-2`}
      >
        <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50">
          교신 수신
        </span>
        <span
          className={`mt-1 flex h-11 w-11 items-center justify-center rounded-full border-2 border-black/70 text-xl font-bold tabular-nums ${
            p.hailCount
              ? `bg-[radial-gradient(circle_at_40%_35%,#fff3b0,#ffb020_55%,#a86800)] text-[#3a2400] shadow-[0_0_16px_rgba(255,176,32,0.7)] ${p.hailFresh ? styles.blink : ""}`
              : "bg-[#2a2f39] text-white/30"
          }`}
        >
          {p.hailCount}
        </span>
        <span className="mt-1 text-[10px] text-white/45">
          {p.hailCount ? "누르면 목록" : "조용함"}
        </span>
      </button>
      <SideKey label="항법" sub={p.destination} glyph="◎" onClick={p.onNav} />
      <SideKey label="브리핑" glyph="▤" onClick={p.onBrief} />
      <SideKey label="전체 할 일" glyph="☰" onClick={p.onTasks} />
    </div>
  );
}

function SideKey({
  label,
  sub,
  glyph,
  onClick,
}: {
  label: string;
  sub?: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-key={label}
      className={`${styles.key} flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left`}
    >
      <span className="text-[15px] text-[#7fd0ff] drop-shadow-[0_0_4px_rgba(127,208,255,0.7)]">
        {glyph}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-white/90">
          {label}
        </span>
        {sub && (
          <span className="block truncate text-[10px] text-white/45">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}
