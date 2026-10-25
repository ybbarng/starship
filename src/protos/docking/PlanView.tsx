"use client";

// 스크롤 뒤: 위에서 본 우주선 평면도. 선체 둘레 포트에 교신선이 그대로 붙어 있고,
// 안쪽 칸칸에 승무원(앞쪽 업무, 뒤쪽 개인). 나를 기다리는 선원은 복도로 나와 손짓한다.
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, CREW_STATUS_LABEL } from "@/ui/kit";
import { useArriving, useFlights } from "./Flights";
import { type Berth, PORT_COUNT } from "./model";
import { SHIP, Ship } from "./ships";

export const PLAN_W = 1300;
export const PLAN_H = 592;

const HULL_TOP = 54;
const HULL_BOTTOM = 532;
const IN_L = 168;
const IN_R = 1196;
const MID = (IN_L + IN_R) / 2;
const ROW_H = 128;
const TOP_ROW = HULL_TOP + 14;
const BOTTOM_ROW = HULL_BOTTOM - 14 - ROW_H;
const CORR_TOP = TOP_ROW + ROW_H + 6;
const CORR_BOTTOM = BOTTOM_ROW - 6;
const PORT_X = [330, 650, 970];

const STATUS_LAMP: Record<Crew["status"], string> = {
  "needs-you": "#ffcf5c",
  working: "#5ee08a",
  idle: "#7d8db3",
  off: "#2a3248",
};

export function PlanView({
  crew,
  tasksByCrew,
  berths,
  nowId,
  clock,
  onCrew,
  onBerth,
  onCockpit,
  selectedId,
}: {
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  berths: Berth[];
  nowId?: string;
  clock: number;
  onCrew: (c: Crew) => void;
  onBerth: (b: Berth) => void;
  onCockpit: () => void;
  selectedId?: string;
}) {
  return (
    <div className="relative" style={{ width: PLAN_W, height: PLAN_H }}>
      <Hull />
      <Bridge onClick={onCockpit} />
      {(["work", "personal"] as const).map((ctx, half) => (
        <Half
          key={ctx}
          ctx={ctx}
          left={half ? MID + 5 : IN_L}
          width={MID - IN_L - 5}
          crew={crew.filter((c) => c.context === ctx)}
          tasksByCrew={tasksByCrew}
          clock={clock}
          onCrew={onCrew}
          selectedId={selectedId}
        />
      ))}
      <Ports berths={berths} nowId={nowId} clock={clock} onBerth={onBerth} />
    </div>
  );
}

function Hull() {
  return (
    <svg
      width={PLAN_W}
      height={PLAN_H}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="dk-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4766" />
          <stop offset="0.5" stopColor="#2a3450" />
          <stop offset="1" stopColor="#1d253a" />
        </linearGradient>
        <pattern
          id="dk-floor"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <rect width="24" height="24" fill="#141b2c" />
          <path d="M24 0H0V24" fill="none" stroke="#1f2840" strokeWidth="1" />
        </pattern>
        <radialGradient id="dk-thrust" cx="0" cy="0.5" r="1">
          <stop offset="0" stopColor="#bfe3ff" />
          <stop offset="0.4" stopColor="#6cb6ff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#6cb6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 엔진 불꽃 */}
      {[130, 270, 410].map((y) => (
        <g key={y}>
          <ellipse
            cx="1262"
            cy={y + 26}
            rx="40"
            ry="16"
            fill="url(#dk-thrust)"
            className="dk-pulse"
          />
          <rect
            x="1206"
            y={y}
            width="50"
            height="52"
            rx="10"
            fill="#2a3149"
            stroke="#0b0f1a"
            strokeWidth="2"
          />
          <rect
            x="1246"
            y={y + 8}
            width="10"
            height="36"
            rx="3"
            fill="#8fb7e6"
          />
        </g>
      ))}
      {/* 선체 */}
      <path
        d={`M150 ${HULL_TOP} L1188 ${HULL_TOP} Q1214 ${HULL_TOP} 1216 84 L1216 ${HULL_BOTTOM - 30} Q1214 ${HULL_BOTTOM} 1188 ${HULL_BOTTOM} L150 ${HULL_BOTTOM} Q36 ${HULL_BOTTOM - 14} 14 ${(HULL_TOP + HULL_BOTTOM) / 2} Q36 ${HULL_TOP + 14} 150 ${HULL_TOP} Z`}
        fill="url(#dk-hull)"
        stroke="#0b0f1a"
        strokeWidth="3"
      />
      <path
        d={`M156 ${HULL_TOP + 6} L1186 ${HULL_TOP + 6}`}
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="2"
      />
      {/* 안쪽 바닥 */}
      <rect
        x={IN_L - 6}
        y={HULL_TOP + 8}
        width={IN_R - IN_L + 12}
        height={HULL_BOTTOM - HULL_TOP - 16}
        rx="14"
        fill="url(#dk-floor)"
        stroke="#0b0f1a"
        strokeWidth="2"
      />
      {/* 복도 */}
      <rect
        x={IN_L}
        y={CORR_TOP}
        width={IN_R - IN_L}
        height={CORR_BOTTOM - CORR_TOP}
        rx="10"
        fill="#1a2236"
        stroke="#2d3856"
      />
      <path
        d={`M${IN_L + 20} ${(CORR_TOP + CORR_BOTTOM) / 2} H${IN_R - 20}`}
        stroke="#ffcf5c"
        strokeOpacity="0.18"
        strokeWidth="3"
        strokeDasharray="18 14"
      />
      {/* 앞·뒤 칸막이 */}
      <path
        d={`M${MID} ${HULL_TOP + 10} V${CORR_TOP} M${MID} ${CORR_BOTTOM} V${HULL_BOTTOM - 10}`}
        stroke="#0b0f1a"
        strokeWidth="6"
      />
    </svg>
  );
}

function Bridge({ onClick }: { onClick: () => void }) {
  const y = (HULL_TOP + HULL_BOTTOM) / 2;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute flex flex-col items-center rounded-l-[60px] rounded-r-xl border-2 border-glow-work/50 bg-[#0c1426] px-2 py-2 text-center hover:border-glow-work"
      style={{ left: 40, top: y - 62, width: 112, height: 124 }}
      title="조종석으로 돌아가기"
    >
      <div
        className="mt-1 h-9 w-20 rounded-l-full rounded-r-md"
        style={{
          background: "linear-gradient(90deg,#3a6aa8 0%,#0b1a33 100%)",
          boxShadow: "inset 0 0 0 2px #6cb6ff55",
        }}
      />
      <div className="mt-1.5 text-[12px] font-semibold text-white/90">
        조종석
      </div>
      <div className="text-[10px] leading-3 text-white/45">나 · 여기</div>
      <div className="mt-1 text-[10px] text-glow-work">▴ 돌아가기</div>
    </button>
  );
}

function Half({
  ctx,
  left,
  width,
  crew,
  tasksByCrew,
  clock,
  onCrew,
  selectedId,
}: {
  ctx: Crew["context"];
  left: number;
  width: number;
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  clock: number;
  onCrew: (c: Crew) => void;
  selectedId?: string;
}) {
  const cols = Math.max(4, Math.ceil(crew.length / 2));
  const cw = width / cols;
  const waiting = crew
    .filter((c) => c.status === "needs-you")
    .map((c) => ({ c, t: tasksByCrew.get(c.id)?.[0] }))
    .sort((a, b) => (a.t?.since ?? clock) - (b.t?.since ?? clock));
  const shown = waiting.slice(0, 2);
  const animal = Math.min(46, cw - 16);
  return (
    <>
      <div
        className="pointer-events-none absolute text-[11px] font-semibold tracking-[0.2em]"
        style={{
          left: left + 8,
          top: CORR_TOP + 6,
          color: CONTEXT_COLOR[ctx],
          opacity: 0.8,
        }}
      >
        {ctx === "work" ? "앞쪽 · 업무" : "뒤쪽 · 개인"} {crew.length}
      </div>
      {crew.map((c, i) => {
        const row = i < cols ? 0 : 1;
        const col = row ? i - cols : i;
        const out = c.status === "needs-you";
        const sel = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            data-crew={c.id}
            onClick={() => onCrew(c)}
            className="absolute flex flex-col items-center justify-end overflow-hidden rounded-lg border pb-2.5 text-center transition hover:bg-white/5"
            style={{
              left: left + col * cw + 3,
              top: row ? BOTTOM_ROW : TOP_ROW,
              width: cw - 6,
              height: ROW_H,
              borderColor: sel
                ? "#ffffff"
                : out
                  ? "#ffcf5c99"
                  : "rgba(255,255,255,.1)",
              background: `linear-gradient(${row ? 0 : 180}deg, ${CONTEXT_COLOR[ctx]}14, transparent 60%)`,
              opacity: c.status === "off" ? 0.55 : 1,
            }}
            title={`${c.name} · ${CREW_STATUS_LABEL[c.status]}`}
          >
            <span
              className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${out ? "dk-pulse" : ""}`}
              style={{ background: STATUS_LAMP[c.status] }}
            />
            {/* 복도 쪽 문 */}
            <span
              className="absolute left-1/2 h-1 w-8 -translate-x-1/2 rounded-full"
              style={{
                [row ? "top" : "bottom"]: 0,
                background: out ? "#ffcf5c" : "#2d3856",
              }}
            />
            {out ? (
              <span className="mb-auto pt-7 text-[11px] leading-4 text-signal-warn/90">
                복도에
                <br />
                나와 있어요
              </span>
            ) : (
              <Animal
                kind={animalFor(c.id)}
                pose={poseFor(c.status)}
                context={ctx}
                size={animal}
              />
            )}
            <span className="mt-0.5 w-full truncate px-1 text-[11px] text-white/80">
              {c.name}
            </span>
            <span className="text-[10px] leading-3 text-white/40">
              {CREW_STATUS_LABEL[c.status]}
            </span>
          </button>
        );
      })}
      {shown.map(({ c, t }, i) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCrew(c)}
          className="absolute flex items-end gap-1.5 text-left"
          style={{
            left: left + 10 + i * (width / 2),
            top: CORR_TOP + 26,
            width: width / 2 - 16,
          }}
        >
          <span className="shrink-0">
            <Animal
              kind={animalFor(c.id)}
              pose="wave"
              context={ctx}
              size={56}
              label={`${c.name} 선원, 나를 부름`}
            />
          </span>
          <span className="dk-wait relative mb-6 min-w-0 flex-1 rounded-xl border border-signal-warn/50 bg-[#0b1020]/95 px-2.5 py-1.5">
            <span className="absolute top-1/2 -left-[6px] h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-signal-warn/50 bg-[#0b1020]" />
            <span className="flex items-baseline gap-1 text-[12px]">
              <b className="truncate text-white">{c.name}</b>
              {t && (
                <span className="ml-auto shrink-0 text-[11px] text-signal-warn">
                  {ago(t.since, clock)}
                </span>
              )}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-[16px] text-white/85">
              {t?.title ?? c.activity ?? "불렀어요"}
            </span>
          </span>
        </button>
      ))}
      {waiting.length > shown.length && (
        <div
          className="absolute rounded-full bg-signal-warn/15 px-2 text-[11px] text-signal-warn"
          style={{ left: left + width - 90, top: CORR_BOTTOM - 22 }}
        >
          +{waiting.length - shown.length}명 더
        </div>
      )}
      {waiting.length === 0 && (
        <div
          className="pointer-events-none absolute text-[12px] text-white/30"
          style={{ left: left + 10, top: CORR_TOP + 70 }}
        >
          복도가 조용해요 · 부르는 선원 없음
        </div>
      )}
    </>
  );
}

function Ports({
  berths,
  nowId,
  clock,
  onBerth,
}: {
  berths: Berth[];
  nowId?: string;
  clock: number;
  onBerth: (b: Berth) => void;
}) {
  const arriving = useArriving();
  const clamped = useFlights((s) => s.clamped);
  const waiting = berths.length - PORT_COUNT;
  return (
    <>
      {Array.from({ length: PORT_COUNT }, (_, i) => {
        const top = i < 3;
        const x = PORT_X[i % 3] ?? 0;
        const b = berths[i];
        const lit = b && !arriving.has(b.id);
        const c = b ? SHIP[b.kind].color : "#4b5674";
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 포트는 자리 번호가 곧 이름
            key={i}
            className="absolute"
            style={{
              left: x - 30,
              top: top ? HULL_TOP - 4 : HULL_BOTTOM - 8,
              width: 60,
              height: 12,
            }}
          >
            <div
              className="h-full w-full rounded-md border-2"
              style={{
                borderColor: lit ? c : "#4b5674",
                background: "#0c111d",
                boxShadow: lit ? `0 0 10px ${c}88` : "none",
              }}
            />
            {!b && (
              <div
                className="absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-white/30"
                style={top ? { bottom: 16 } : { top: 16 }}
              >
                포트 {i + 1} · 빔
              </div>
            )}
          </div>
        );
      })}
      {berths.slice(0, PORT_COUNT).map((b, i) => {
        const top = i < 3;
        const x = PORT_X[i % 3] ?? 0;
        const c = SHIP[b.kind].color;
        const isNow = b.id === nowId;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onBerth(b)}
            className="absolute flex items-center gap-2 text-left transition-[left,top] duration-700"
            style={{
              left: x - 36,
              top: top ? 2 : HULL_BOTTOM + 2,
              height: 50,
            }}
          >
            <span
              data-dk-ship={b.id}
              className={`block shrink-0 ${clamped[b.id] ? "dk-clamp" : ""}`}
              style={{
                width: 72,
                height: 36,
                marginTop: top ? 6 : -10,
                transform: top ? undefined : "scaleY(-1)",
                opacity: arriving.has(b.id) ? 0 : 1,
              }}
            >
              <Ship kind={b.kind} width={72} flame={false} />
            </span>
            <span
              className="w-[190px] rounded-md border bg-[#0b1020]/85 px-1.5 py-0.5"
              style={{
                borderColor: isNow ? c : "rgba(255,255,255,.12)",
                boxShadow: isNow ? `0 0 12px ${c}66` : undefined,
              }}
            >
              <span className="flex items-baseline gap-1 text-[11.5px] leading-4">
                <b className="truncate text-white">{b.from}</b>
                <span className="shrink-0 text-[10.5px]" style={{ color: c }}>
                  {b.source}
                </span>
                <span className="ml-auto shrink-0 text-[10.5px] text-white/60">
                  {ago(b.since, clock)}
                </span>
              </span>
              <span className="block truncate text-[11px] leading-4 text-white/70">
                {b.line}
              </span>
            </span>
          </button>
        );
      })}
      {waiting > 0 && (
        <div
          className="absolute rounded-full border border-signal-warn/60 bg-black/70 px-2.5 py-0.5 text-xs text-signal-warn"
          style={{ left: 1110, top: 14 }}
        >
          +{waiting}척 대기
        </div>
      )}
    </>
  );
}
