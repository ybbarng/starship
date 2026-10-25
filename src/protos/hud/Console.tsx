"use client";

// 낮고 단순한 계기판: 업무·개인 두 개의 큰 막대 계기(칸 하나 = 승무원 하나), 계기 등 줄, 버튼.
import type { ReactNode } from "react";
import type { Context, Crew, CrewStatus, Gauge } from "@/protocol/v1";
import { CONTEXT_COLOR, CONTEXT_LABEL, CREW_STATUS_LABEL } from "@/ui/kit";
import s from "./hud.module.css";

const ORDER: Record<CrewStatus, number> = {
  "needs-you": 0,
  working: 1,
  idle: 2,
  off: 3,
};

function Segment({ crew, onPick }: { crew: Crew; onPick: (c: Crew) => void }) {
  const color = CONTEXT_COLOR[crew.context];
  const style =
    crew.status === "needs-you"
      ? { background: "#ffcf5c" }
      : crew.status === "working"
        ? { background: color, boxShadow: `0 0 8px ${color}88` }
        : crew.status === "idle"
          ? { background: `${color}40` }
          : { background: "#1d2438" };
  return (
    <button
      type="button"
      data-crew-segment={crew.id}
      title={`${crew.name} · ${CREW_STATUS_LABEL[crew.status]}`}
      aria-label={`${crew.name}, ${CREW_STATUS_LABEL[crew.status]}`}
      onClick={() => onPick(crew)}
      className={`h-full min-w-[6px] flex-1 rounded-[3px] transition hover:brightness-125 ${
        crew.status === "needs-you" ? s.blink : ""
      }`}
      style={style}
    />
  );
}

function BarGauge({
  context,
  crew,
  onPick,
  onList,
}: {
  context: Context;
  crew: Crew[];
  onPick: (c: Crew) => void;
  onList: () => void;
}) {
  const list = [...crew].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (st: CrewStatus) => crew.filter((c) => c.status === st).length;
  const waiting = count("needs-you");
  const color = CONTEXT_COLOR[context];
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline gap-2">
        <button
          type="button"
          onClick={onList}
          className="text-[13px] font-semibold tracking-wide hover:underline"
          style={{ color }}
        >
          {CONTEXT_LABEL[context]} 승무원
        </button>
        <span className="text-[12px] text-white/50">나를 기다림</span>
        <span
          className="font-mono text-[26px] leading-none font-bold"
          style={{ color: waiting ? "#ffcf5c" : "#ffffff60" }}
        >
          {waiting}
        </span>
        <span className="font-mono text-[15px] text-white/45">
          / {crew.length}
        </span>
        <span className="ml-auto truncate text-[11.5px] text-white/50">
          일함 {count("working")} · 쉼 {count("idle")} · 비움 {count("off")}
        </span>
      </div>
      <div className="flex h-[30px] gap-[3px] rounded-md border border-white/10 bg-black/50 p-[3px] shadow-[inset_0_2px_6px_#000]">
        {list.length === 0 ? (
          <span className="px-2 text-xs leading-[24px] text-white/35">
            승무원 없음
          </span>
        ) : (
          list.map((c) => <Segment key={c.id} crew={c} onPick={onPick} />)
        )}
      </div>
    </div>
  );
}

const LAMP: Record<Gauge["status"], string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "#3a4258",
};

function Lamp({ g }: { g: Gauge }) {
  const c = LAMP[g.status];
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      title={g.detail ?? `${g.label} ${g.value ?? ""}`}
    >
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${g.status === "error" ? s.alarm : ""}`}
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff8, ${c} 45%, ${c}88)`,
          boxShadow: g.status === "off" ? "none" : `0 0 9px ${c}`,
        }}
      />
      <span className="truncate text-[12.5px] text-white/80">{g.label}</span>
      {g.value && (
        <span
          className="ml-auto shrink-0 font-mono text-[11px]"
          style={{ color: g.status === "off" ? "#ffffff50" : c }}
        >
          {g.value}
        </span>
      )}
    </div>
  );
}

function ConsoleButton({
  label,
  sub,
  onClick,
  icon,
  testId,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  icon: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-console={testId}
      className={`${s.consoleButton} flex flex-col items-center justify-center gap-1 px-2 py-2`}
    >
      <span className="text-[#a6fbff] drop-shadow-[0_0_4px_#5ae9ff]">
        {icon}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
      {sub && <span className="text-[10.5px] text-white/45">{sub}</span>}
    </button>
  );
}

const I = {
  nav: (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" />
      <path d="M10 3 L13 11 L10 9.5 L7 11 Z" fill="currentColor" />
    </svg>
  ),
  brief: (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <rect
        x="4"
        y="2.5"
        width="12"
        height="15"
        rx="1.5"
        fill="none"
        stroke="currentColor"
      />
      <path d="M7 7 h6 M7 10 h6 M7 13 h4" stroke="currentColor" />
    </svg>
  ),
  list: (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M3 5 l1.5 1.5 L7 4 M3 10 l1.5 1.5 L7 9 M3 15 l1.5 1.5 L7 14 M9 5.5 h8 M9 10.5 h8 M9 15.5 h8"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  ),
  bright: (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="3.5" fill="currentColor" />
      <path
        d="M10 1.5 v3 M10 15.5 v3 M1.5 10 h3 M15.5 10 h3 M4 4 l2 2 M14 14 l2 2 M4 16 l2 -2 M14 6 l2 -2"
        stroke="currentColor"
      />
    </svg>
  ),
};

export function Console({
  crew,
  gauges,
  hailCount,
  taskCount,
  brightnessLabel,
  push,
  onCrew,
  onCrewList,
  onNav,
  onBrief,
  onAll,
  onBright,
  onDeck,
  fade,
}: {
  crew: Crew[];
  gauges: Gauge[];
  hailCount: number;
  taskCount: number;
  brightnessLabel: string;
  push: number;
  onCrew: (c: Crew) => void;
  onCrewList: (ctx: Context) => void;
  onNav: () => void;
  onBrief: () => void;
  onAll: () => void;
  onBright: () => void;
  onDeck: () => void;
  /** 0 = 다 보임, 1 = 윤곽만 */
  fade: number;
}) {
  // 글이 먼저 사라지고, 그 뒤에 바탕이 투명해진다
  const k = Math.max(0, Math.min(1, (fade - 0.35) / 0.4));
  const bgOpacity = 1 - k * k * (3 - 2 * k);
  const work = crew.filter((c) => c.context === "work");
  const personal = crew.filter((c) => c.context === "personal");
  return (
    <div className="relative h-full w-full">
      {/* 눈부심 가림막(유리와 계기판 사이 턱) */}
      <svg
        className="pointer-events-none absolute -top-[18px] left-0 h-[26px] w-full"
        viewBox="0 0 1000 26"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="hud-lip" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2b3757" />
            <stop offset="1" stopColor="#141b2f" />
          </linearGradient>
        </defs>
        <path
          d="M0 26 L0 14 Q 500 -6 1000 14 L1000 26 Z"
          fill="url(#hud-lip)"
          fillOpacity={bgOpacity}
          stroke="#a6fbff"
          strokeOpacity={0.25 + fade * 0.5}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className={`${s.console} absolute inset-0 border-t border-white/10`}
        style={{ opacity: bgOpacity }}
      />
      {/* 윤곽선: 갑판을 내려다볼 때 남는 계기판 테두리 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-b-[28px] border-x border-b border-[#a6fbff]/40"
        style={{ opacity: fade }}
      />

      <div
        className="relative grid h-full grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_auto] gap-6 px-8 pt-5 pb-7"
        style={{
          opacity: Math.max(0, 1 - fade * 2.6),
          pointerEvents: fade > 0.3 ? "none" : "auto",
        }}
      >
        <div className="flex min-w-0 flex-col justify-center gap-4">
          <BarGauge
            context="work"
            crew={work}
            onPick={onCrew}
            onList={() => onCrewList("work")}
          />
          <BarGauge
            context="personal"
            crew={personal}
            onPick={onCrew}
            onList={() => onCrewList("personal")}
          />
          <div className="flex items-center gap-3 text-[11px] text-white/45">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-3 rounded-sm bg-[#ffcf5c]" />
              나를 기다림(깜빡임)
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-3 rounded-sm bg-[#6cb6ff]" />
              일함
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-3 rounded-sm bg-[#6cb6ff40]" />쉼
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-3 rounded-sm bg-[#1d2438]" />
              자리 비움
            </span>
            <span className="ml-auto">칸을 누르면 그 선원</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center rounded-xl border border-white/8 bg-black/30 px-4 py-3">
          <div className="mb-2 flex items-center text-[11px] tracking-wide text-white/45">
            계기 등
            <span className="ml-auto tracking-normal">
              교신 {hailCount} · 할 일 {taskCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {gauges.map((g) => (
              <Lamp key={g.id} g={g} />
            ))}
          </div>
        </div>

        <div className="grid w-[300px] grid-cols-2 gap-2">
          <ConsoleButton
            label="항법"
            sub="목적지 고르기"
            icon={I.nav}
            onClick={onNav}
            testId="nav"
          />
          <ConsoleButton
            label="브리핑"
            sub="승무원 요약"
            icon={I.brief}
            onClick={onBrief}
            testId="brief"
          />
          <ConsoleButton
            label="전체 할 일"
            sub={`${taskCount}개`}
            icon={I.list}
            onClick={onAll}
            testId="all"
          />
          <ConsoleButton
            label="투영 밝기"
            sub={brightnessLabel}
            icon={I.bright}
            onClick={onBright}
            testId="bright"
          />
        </div>
      </div>

      {/* 아래로 밀면 갑판: 저항 표시 */}
      <button
        type="button"
        onClick={onDeck}
        className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-0.5 text-[11.5px] text-white/50 hover:text-white/85"
        style={{ opacity: Math.max(0, 1 - fade * 2) }}
      >
        <span>▾ 아래로 밀면 발아래 선원 갑판</span>
        <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full bg-[#a6fbff]"
            style={{ width: `${push * 100}%` }}
          />
        </span>
      </button>
    </div>
  );
}
