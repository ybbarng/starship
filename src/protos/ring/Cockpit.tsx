"use client";

// 계기판: 왼쪽 고리 표시기, 가운데 주 표시창(지금 할 일), 오른쪽 교신 안테나와 계기 등.
import { useBridge } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { ago, isHail, sourceLabel, TaskActions } from "@/ui/kit";
import { ContextChip, kindLine, Lamp, whoOf } from "./common";
import { freeU, planRing, waitAngle } from "./model";

const BTN =
  "rounded-lg border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.03] px-3 py-1.5 text-[13px] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] hover:border-white/40 active:translate-y-px";
const PRIMARY =
  "rounded-lg border border-[#6cb6ff]/70 bg-gradient-to-b from-[#6cb6ff]/45 to-[#6cb6ff]/20 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_0_14px_rgba(108,182,255,.35),inset_0_1px_0_rgba(255,255,255,.25)] hover:from-[#6cb6ff]/60 active:translate-y-px";

/** 금속 판 위의 움푹한 화면 */
function Bezel({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl p-[3px] ${className}`}
      style={{
        background: "linear-gradient(180deg,#0a0f1c,#2a3654)",
        boxShadow: glow
          ? `0 0 0 1px ${glow}55, 0 0 24px ${glow}22`
          : "0 0 0 1px #00000080",
      }}
    >
      <div
        className="relative h-full overflow-hidden rounded-[13px]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #101a30 0%, #070b15 70%)",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,.8)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[.07]"
          style={{
            background:
              "repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)",
          }}
        />
        {children}
      </div>
    </div>
  );
}

function RingGauge({
  onCrew,
  onRing,
}: {
  onCrew: (id: string) => void;
  onRing: () => void;
}) {
  const { crew, tasksByCrew } = useBridge();
  const plan = planRing(crew, tasksByCrew);
  const R = 58;
  const cx = 80;
  const cy = 76;
  const counts = {
    working: crew.filter((c) => c.status === "working").length,
    idle: crew.filter((c) => c.status === "idle").length,
    off: crew.filter((c) => c.status === "off").length,
  };
  const dot = (c: Crew | undefined, a: number, key: string, wait = false) => {
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    if (!c) return <circle key={key} cx={x} cy={y} r={1.6} fill="#2c3a5c" />;
    const color = c.context === "work" ? "#6cb6ff" : "#ffb86c";
    return (
      // biome-ignore lint/a11y/useSemanticElements: SVG 안의 누르는 점
      <g
        key={key}
        role="button"
        tabIndex={0}
        aria-label={`${c.name} 상세`}
        className="cursor-pointer"
        onClick={() => onCrew(c.id)}
        onKeyDown={(e) => e.key === "Enter" && onCrew(c.id)}
      >
        <title>{c.name}</title>
        {wait && (
          <circle
            className="ring-wave"
            cx={x}
            cy={y}
            r={7}
            fill="none"
            stroke="#ffcf5c"
            strokeWidth={1.2}
          />
        )}
        <circle
          cx={x}
          cy={y}
          r={wait ? 6 : 4}
          fill={
            wait
              ? "#ffcf5c"
              : c.status === "working"
                ? color
                : c.status === "idle"
                  ? `${color}55`
                  : "transparent"
          }
          stroke={wait ? "#fff3c4" : color}
          strokeOpacity={c.status === "off" ? 0.4 : 0.9}
          strokeWidth={wait ? 1.2 : 1}
          style={wait ? { filter: "drop-shadow(0 0 4px #ffcf5c)" } : undefined}
        />
      </g>
    );
  };

  return (
    <div className="flex h-full flex-col items-center">
      <div className="self-stretch text-[11px] font-semibold tracking-widest text-white/45">
        회전 고리
      </div>
      <svg width="160" height="150" viewBox="0 0 160 150" aria-hidden>
        <title>고리 표시기</title>
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#1f2942"
          strokeWidth={10}
        />
        <circle
          cx={cx}
          cy={cy}
          r={R + 8}
          fill="none"
          stroke="#2c3a5c"
          strokeDasharray="1 5"
          className="ring-spin"
        />
        {[0, 1, 2, 3].map((k) => (
          <line
            key={k}
            x1={cx + Math.cos((k * Math.PI) / 2 + 0.4) * 14}
            y1={cy + Math.sin((k * Math.PI) / 2 + 0.4) * 14}
            x2={cx + Math.cos((k * Math.PI) / 2 + 0.4) * (R - 6)}
            y2={cy + Math.sin((k * Math.PI) / 2 + 0.4) * (R - 6)}
            stroke="#1f2942"
            strokeWidth={2}
          />
        ))}
        <circle cx={cx} cy={cy} r={13} fill="#141b2f" stroke="#2c3a5c" />
        <circle cx={cx} cy={cy} r={5} fill="#6cb6ff" opacity={0.7} />
        {/* 내 자리(아래) 표시 */}
        <path
          d={`M${cx - 6} ${cy + R + 16} L${cx} ${cy + R + 10} L${cx + 6} ${cy + R + 16}`}
          fill="none"
          stroke="#ffcf5c"
          strokeWidth={1.5}
          opacity={plan.waiting.length ? 1 : 0.3}
        />
        {plan.free.map((p, i) =>
          dot(p.crew, plan.arcStart + freeU(plan, i, 0), p.key),
        )}
        {plan.waiting.map((p) =>
          dot(p.crew, waitAngle(plan, p.rank ?? 0), p.key, true),
        )}
      </svg>
      <button
        type="button"
        onClick={onRing}
        className="mt-0.5 text-center hover:opacity-80"
      >
        <div
          className={`text-[17px] font-bold ${plan.waiting.length ? "text-[#ffcf5c]" : "text-white/60"}`}
        >
          기다리는 선원 {plan.waiting.length}
        </div>
        <div className="text-[11px] text-white/50">
          일함 {counts.working} · 쉼 {counts.idle} · 비움 {counts.off}
        </div>
      </button>
    </div>
  );
}

function NowDisplay({
  now,
  next,
  onCrew,
}: {
  now: Task | undefined;
  next: Task[];
  onCrew: (id: string) => void;
}) {
  const { crewById, crew } = useBridge();
  if (!now) {
    const working = crew.filter((c) => c.status === "working").length;
    return (
      <div className="flex h-full flex-col justify-center px-6">
        <div className="text-[11px] font-semibold tracking-widest text-[#5ee08a]/80">
          지금 할 일
        </div>
        <div className="mt-2 text-[26px] font-semibold text-white/90">
          지금 나를 기다리는 일이 없어요
        </div>
        <div className="mt-2 text-sm text-white/55">
          선원 {crew.length}명 중 {working}명이 일하는 중. 고리는 멈추지 않고
          천천히 돌고 있어요.
        </div>
      </div>
    );
  }
  const accent = now.context === "work" ? "#6cb6ff" : "#ffb86c";
  const hail = isHail(now);
  return (
    <div className="flex h-full flex-col px-5 pt-3.5 pb-3">
      <div className="flex items-center gap-2 text-[13px] text-white/70">
        <span className="text-[11px] font-semibold tracking-widest text-white/45">
          지금 할 일
        </span>
        <ContextChip context={now.context} />
        {hail && (
          <span className="rounded border border-[#ffcf5c]/50 px-1.5 text-[11px] text-[#ffcf5c]">
            교신
          </span>
        )}
        <span className="truncate font-semibold text-white">
          {whoOf(now, crewById)}
        </span>
        <span className="truncate text-white/55">· {kindLine(now)}</span>
        <span
          className="ml-auto shrink-0 font-semibold"
          style={{ color: accent }}
        >
          {ago(now.since)}째 기다림
        </span>
      </div>
      <div
        data-now-title
        className="mt-1.5 line-clamp-2 text-[28px] leading-[1.28] font-semibold text-white"
      >
        {now.title}
      </div>
      {now.detail && (
        <div className="mt-1 truncate text-[13px] text-white/50">
          {now.detail.split("\n")[0]}
        </div>
      )}
      <TaskActions
        task={now}
        className="mt-3 flex flex-wrap items-center gap-1.5"
        buttonClassName={BTN}
        primaryClassName={PRIMARY}
      />
      <div className="mt-auto border-t border-white/10 pt-2">
        <div className="mb-1 text-[11px] font-semibold tracking-widest text-white/40">
          다음 차례
        </div>
        {next.length === 0 && (
          <div className="text-[13px] text-white/40">다음 차례는 없어요</div>
        )}
        <ul className="space-y-0.5">
          {next.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => t.crewId && onCrew(t.crewId)}
                className="flex w-full items-center gap-2 rounded px-1 text-left text-[13px] text-white/60 hover:bg-white/5 hover:text-white/85"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: t.context === "work" ? "#6cb6ff" : "#ffb86c",
                  }}
                />
                <span className="shrink-0 font-medium text-white/75">
                  {whoOf(t, crewById)}
                </span>
                <span className="truncate">{t.title}</span>
                <span className="ml-auto shrink-0 text-white/40">
                  {ago(t.since)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Comms({
  onHail,
  onNav,
  onRing,
}: {
  onHail: (id?: string) => void;
  onNav: () => void;
  onRing: () => void;
}) {
  const { hails, gauges } = useBridge();
  const bars = Math.min(4, hails.length);
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
          <title>교신 안테나</title>
          <path
            d="M17 14 L11 32 M17 14 L23 32 M13 26 L21 26"
            stroke="#4a5a80"
            strokeWidth="1.5"
            fill="none"
          />
          <circle
            cx="17"
            cy="12"
            r="3"
            fill={hails.length ? "#ffcf5c" : "#2c3a5c"}
            className={hails.length ? "ring-blink" : ""}
          />
          {hails.length > 0 && (
            <>
              <path
                d="M10 6 A10 10 0 0 0 10 18"
                stroke="#ffcf5c"
                fill="none"
                strokeWidth="1.3"
                className="ring-blink"
              />
              <path
                d="M24 6 A10 10 0 0 1 24 18"
                stroke="#ffcf5c"
                fill="none"
                strokeWidth="1.3"
                className="ring-blink"
              />
            </>
          )}
        </svg>
        <div className="flex-1">
          <div className="text-[11px] font-semibold tracking-widest text-white/45">
            교신 안테나
          </div>
          <div
            className={`text-[15px] font-bold ${hails.length ? "text-[#ffcf5c]" : "text-white/50"}`}
          >
            {hails.length ? `교신 ${hails.length}통 들어옴` : "조용함"}
          </div>
        </div>
        <div className="flex items-end gap-[3px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-[5px] rounded-sm"
              style={{
                height: 6 + i * 5,
                background: i < bars ? "#ffcf5c" : "#1f2942",
                boxShadow: i < bars ? "0 0 6px #ffcf5c88" : undefined,
              }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {hails.slice(0, 2).map((h) => (
          <button
            key={h.id}
            type="button"
            data-hail={h.id}
            onClick={() => onHail(h.id)}
            className="block w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-left hover:border-[#ffcf5c]/50"
          >
            <div className="flex text-[11px] text-white/55">
              <span className="truncate">
                <b className="font-semibold text-white/85">{h.from.name}</b> ·{" "}
                {sourceLabel(h.source)}
              </span>
              <span className="ml-auto shrink-0 pl-2">{ago(h.since)}</span>
            </div>
            <div className="truncate text-[12.5px] text-white/85">{h.line}</div>
          </button>
        ))}
        {hails.length > 2 && (
          <button
            type="button"
            onClick={() => onHail()}
            className="text-[11px] text-white/50 hover:text-white/80"
          >
            교신 {hails.length - 2}통 더 보기
          </button>
        )}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2">
        {gauges.slice(0, 6).map((g) => (
          <div
            key={g.id}
            title={g.detail ?? g.label}
            className="flex items-center gap-1.5 text-[11.5px] text-white/65"
          >
            <Lamp status={g.status} blink={g.status === "error"} />
            <span className="truncate">{g.label}</span>
            <span className="ml-auto shrink-0 text-white/40">{g.value}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={onNav} className={`${BTN} flex-1`}>
          항법
        </button>
        <button type="button" onClick={onRing} className={`${BTN} flex-1`}>
          고리 전경 ▾
        </button>
      </div>
    </div>
  );
}

export function Cockpit({
  push,
  onCrew,
  onHail,
  onNav,
  onRing,
}: {
  push: number;
  onCrew: (id: string) => void;
  onHail: (id?: string) => void;
  onNav: () => void;
  onRing: () => void;
}) {
  const { now, next } = useBridge();
  const accent = now
    ? now.context === "work"
      ? "#6cb6ff"
      : "#ffb86c"
    : "#5ee08a";
  return (
    <div
      className="relative h-full w-full overflow-hidden px-4 pt-4 pb-5"
      style={{
        background:
          "linear-gradient(180deg,#1b2440 0%,#121a2e 18%,#0d1324 100%)",
        boxShadow: "inset 0 1px 0 #3a4a70, inset 0 2px 0 #0a0f1c",
      }}
    >
      {/* 판 나사 */}
      {[
        "left-2 top-2",
        "right-2 top-2",
        "left-2 bottom-2",
        "right-2 bottom-2",
      ].map((p) => (
        <span
          key={p}
          className={`absolute ${p} h-2 w-2 rounded-full`}
          style={{
            background: "radial-gradient(circle at 35% 35%,#6a7aa0,#1a2238)",
          }}
        />
      ))}
      <div className="flex h-full gap-3">
        <Bezel className="w-[196px] shrink-0">
          <div className="h-full p-3">
            <RingGauge onCrew={onCrew} onRing={onRing} />
          </div>
        </Bezel>
        <Bezel className="min-w-0 flex-1" glow={accent}>
          <NowDisplay now={now} next={next} onCrew={onCrew} />
        </Bezel>
        <Bezel className="w-[300px] shrink-0">
          <div className="h-full p-3">
            <Comms onHail={onHail} onNav={onNav} onRing={onRing} />
          </div>
        </Bezel>
      </div>
      {/* 아래로 밀기 안내 */}
      <div className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-2 text-[10.5px] text-white/40">
        <span>아래로 밀면 고리 전경</span>
        <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full bg-[#6cb6ff]"
            style={{ width: `${push * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}
