"use client";

// 발아래 선원 갑판: 원탁 둘(왼쪽 업무, 오른쪽 개인).
// 일함 = 고개 숙여 작업, 나를 기다림 = 앞으로 나와 위(나)를 올려다보며 손짓 + 첫 줄, 쉼 = 엎드려 잠.
import { type RefObject, useEffect, useRef, useState } from "react";
import type { Context, Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, CONTEXT_LABEL, CREW_STATUS_LABEL } from "@/ui/kit";
import s from "./hud.module.css";

export const DECK_W = 1372;
export const DECK_H = 540;
const MAX_STANDING = 3;

function useFit(ref: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(
        Math.min(el.clientWidth / DECK_W, el.clientHeight / DECK_H) || 1,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

function Floor() {
  const vx = DECK_W / 2;
  const verticals = [];
  for (let x = -1400; x <= DECK_W + 1400; x += 96) {
    verticals.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={DECK_H}
        x2={Math.round(vx + (x - vx) * 0.32)}
        y2={0}
        stroke="#7fa7ff"
        strokeOpacity="0.09"
      />,
    );
  }
  const horizontals = [];
  for (let k = 1; k <= 12; k++) {
    const y = Math.round(DECK_H * (k / 12) ** 1.5);
    horizontals.push(
      <line
        key={`h${k}`}
        x1={0}
        x2={DECK_W}
        y1={y}
        y2={y}
        stroke="#7fa7ff"
        strokeOpacity={0.05 + k * 0.006}
      />,
    );
  }
  return (
    <svg
      width={DECK_W}
      height={DECK_H}
      className="absolute inset-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="deck-floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#060a15" />
          <stop offset="1" stopColor="#0d1528" />
        </linearGradient>
        <radialGradient id="pool-work">
          <stop offset="0" stopColor="#6cb6ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#6cb6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pool-personal">
          <stop offset="0" stopColor="#ffb86c" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffb86c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={DECK_W} height={DECK_H} fill="url(#deck-floor)" />
      {verticals}
      {horizontals}
      <ellipse cx={343} cy={250} rx={330} ry={190} fill="url(#pool-work)" />
      <ellipse
        cx={1029}
        cy={250}
        rx={330}
        ry={190}
        fill="url(#pool-personal)"
      />
      {/* 가운데 통로 */}
      <rect
        x={DECK_W / 2 - 34}
        y={0}
        width={68}
        height={DECK_H}
        fill="#0b1324"
      />
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 장식
          key={i}
          cx={DECK_W / 2}
          cy={20 + i * 38}
          r={2}
          fill="#a6fbff"
          fillOpacity={0.35}
        />
      ))}
    </svg>
  );
}

const TABLE = { cy: 214, rx: 205, ry: 72 };

function TableArt({ cx, context }: { cx: number; context: Context }) {
  const c = CONTEXT_COLOR[context];
  const { cy, rx, ry } = TABLE;
  const id = `tbl-${context}`;
  return (
    <svg
      width={DECK_W}
      height={DECK_H}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-top`} cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#2a3756" />
          <stop offset="0.7" stopColor="#18213a" />
          <stop offset="1" stopColor="#0f1628" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" x2="1">
          <stop offset="0" stopColor="#0b101d" />
          <stop offset="0.5" stopColor="#2b3655" />
          <stop offset="1" stopColor="#0b101d" />
        </linearGradient>
        <radialGradient id={`${id}-holo`}>
          <stop offset="0" stopColor={c} stopOpacity="0.28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={cy + 40}
        rx={rx + 26}
        ry={ry + 22}
        fill="#000"
        opacity="0.45"
      />
      <rect x={cx - 30} y={cy} width={60} height={46} fill="#0c1220" />
      <ellipse cx={cx} cy={cy + 16} rx={rx} ry={ry} fill={`url(#${id}-rim)`} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-top)`} />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 2}
        ry={ry - 2}
        fill="none"
        stroke={c}
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * 0.62}
        ry={ry * 0.62}
        fill="none"
        stroke={c}
        strokeOpacity="0.18"
        strokeDasharray="6 8"
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * 0.55}
        ry={ry * 0.55}
        fill={`url(#${id}-holo)`}
        className={s.shimmer}
      />
      {/* 탁자 위 작은 단말 불빛 */}
      {Array.from({ length: 10 }, (_, i) => {
        const t = (i / 10) * Math.PI * 2;
        return (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 장식
            key={i}
            cx={Math.round(cx + (rx - 26) * Math.cos(t))}
            cy={Math.round(cy + (ry - 12) * Math.sin(t))}
            rx={9}
            ry={3.5}
            fill={c}
            fillOpacity="0.4"
          />
        );
      })}
    </svg>
  );
}

type Seat = { crew: Crew; x: number; y: number; size: number; back: boolean };

function firstTask(
  crew: Crew,
  tasksByCrew: Map<string, Task[]>,
): Task | undefined {
  return tasksByCrew.get(crew.id)?.[0];
}

function TableGroup({
  context,
  cx,
  crew,
  tasksByCrew,
  onPick,
  clock,
}: {
  context: Context;
  cx: number;
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  onPick: (c: Crew) => void;
  clock: number;
}) {
  const color = CONTEXT_COLOR[context];
  const waiting = crew
    .filter((c) => c.status === "needs-you")
    .sort(
      (a, b) =>
        (firstTask(a, tasksByCrew)?.since ?? a.since ?? 0) -
        (firstTask(b, tasksByCrew)?.since ?? b.since ?? 0),
    );
  const standing = waiting.slice(0, MAX_STANDING);
  const standingIds = new Set(standing.map((c) => c.id));
  const seated = crew.filter((c) => !standingIds.has(c.id));
  const n = seated.length;
  const size = n <= 8 ? 54 : n <= 12 ? 48 : 42;
  const { cy, rx, ry } = TABLE;
  const seats: Seat[] = seated.map((c, i) => {
    const t = -Math.PI / 2 + ((i + 0.5) / Math.max(1, n)) * Math.PI * 2;
    const x = Math.round(cx + (rx + 34) * Math.cos(t));
    const y = Math.round(cy + (ry + 40) * Math.sin(t));
    const back = Math.sin(t) < -0.05;
    const sz = Math.round(size * (back ? 0.88 : 1) * (c.onDeck ? 1.08 : 1));
    return { crew: c, x, y, size: sz, back };
  });
  const back = seats.filter((p) => p.back).sort((a, b) => a.y - b.y);
  const front = seats.filter((p) => !p.back).sort((a, b) => a.y - b.y);
  const count = (st: Crew["status"]) =>
    crew.filter((c) => c.status === st).length;

  const seatNode = (p: Seat) => (
    <button
      key={p.crew.id}
      type="button"
      data-deck-crew={p.crew.id}
      onClick={() => onPick(p.crew)}
      className="group absolute flex flex-col items-center"
      style={{
        left: p.x - 48,
        top: p.y - p.size * 1.25,
        width: 96,
      }}
      title={`${p.crew.name} · ${CREW_STATUS_LABEL[p.crew.status]}`}
    >
      <span className="relative">
        <Animal
          kind={animalFor(p.crew.id)}
          pose={poseFor(p.crew.status)}
          context={context}
          size={p.size}
          furniture={false}
          label={`${p.crew.name}, ${CREW_STATUS_LABEL[p.crew.status]}`}
          className="transition group-hover:brightness-125"
        />
        {p.crew.status === "needs-you" && (
          <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[#ffcf5c] text-[10px] font-black text-black">
            !
          </span>
        )}
      </span>
      <span
        className="mt-0.5 flex max-w-[92px] items-center gap-1 truncate rounded bg-black/55 px-1 text-[10.5px] leading-[15px] text-white/80 group-hover:text-white"
        style={{ opacity: p.crew.status === "off" ? 0.55 : 1 }}
      >
        <i
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background:
              p.crew.status === "needs-you"
                ? "#ffcf5c"
                : p.crew.status === "working"
                  ? color
                  : p.crew.status === "idle"
                    ? `${color}66`
                    : "#3a4258",
          }}
        />
        <span className="truncate">{p.crew.name}</span>
      </span>
    </button>
  );

  const xs =
    standing.length === 1
      ? [cx]
      : standing.length === 2
        ? [cx - 112, cx + 112]
        : [cx - 218, cx, cx + 218];

  return (
    <>
      {back.map(seatNode)}
      <TableArt cx={cx} context={context} />
      <div
        className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center text-center"
        style={{ left: cx, top: cy - 26 }}
      >
        <div className="text-[15px] font-bold tracking-wide" style={{ color }}>
          {CONTEXT_LABEL[context]} 원탁
        </div>
        <div className="mt-0.5 text-[11.5px] whitespace-nowrap text-white/60">
          {crew.length === 0
            ? "앉은 선원이 없어요"
            : `기다림 ${count("needs-you")} · 일함 ${count("working")} · 쉼 ${count("idle")} · 비움 ${count("off")}`}
        </div>
      </div>
      {front.map(seatNode)}

      {standing.map((c, i) => {
        const task = firstTask(c, tasksByCrew);
        const x = xs[i] ?? cx;
        return (
          <button
            key={c.id}
            type="button"
            data-deck-crew={c.id}
            onClick={() => onPick(c)}
            className="group absolute flex w-[204px] flex-col items-center"
            style={{ left: x - 102, top: 364 }}
          >
            <span className="relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-[#ffcf5c]">
                ↑ 나를 봐요
              </span>
              <Animal
                kind={animalFor(c.id)}
                pose="wave"
                context={context}
                size={60}
                label={`${c.name}, 나를 기다림`}
              />
            </span>
            <span
              className={`${s.cardGlow} mt-1 block w-full rounded-lg bg-[#1a1406]/85 px-2.5 py-1.5 text-left backdrop-blur-sm transition group-hover:bg-[#2a2008]/90`}
            >
              <span className="flex items-center gap-1.5 text-[11.5px]">
                <b className="truncate" style={{ color }}>
                  {c.name}
                </b>
                <span className="ml-auto shrink-0 font-mono text-[#ffe2a0]/80">
                  {task ? ago(task.since, clock) : ""}
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium text-[#fff4d6]">
                {task?.title ?? c.activity ?? "나를 기다려요"}
              </span>
            </span>
          </button>
        );
      })}
      {waiting.length > MAX_STANDING && (
        <div
          className="absolute -translate-x-1/2 text-[11.5px] whitespace-nowrap text-[#ffcf5c]"
          style={{ left: cx, top: 524 }}
        >
          + 자리에서 손드는 선원 {waiting.length - MAX_STANDING}명 (! 표시)
        </div>
      )}
    </>
  );
}

export function Deck({
  crew,
  tasksByCrew,
  onPick,
  clock,
}: {
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  onPick: (c: Crew) => void;
  clock: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useFit(ref);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div
        className="absolute top-0 left-1/2"
        style={{
          width: DECK_W,
          height: DECK_H,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <Floor />
        <TableGroup
          context="work"
          cx={343}
          crew={crew.filter((c) => c.context === "work")}
          tasksByCrew={tasksByCrew}
          onPick={onPick}
          clock={clock}
        />
        <TableGroup
          context="personal"
          cx={1029}
          crew={crew.filter((c) => c.context === "personal")}
          tasksByCrew={tasksByCrew}
          onPick={onPick}
          clock={clock}
        />
      </div>
    </div>
  );
}
