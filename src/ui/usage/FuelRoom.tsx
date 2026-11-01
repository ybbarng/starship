"use client";

// 연료실: 오늘 쓴 연료(출력 토큰)를 기관 계통도로 그린다. 설계: docs/usage.md "연료실".
// 위: 청사진 유리 위 계통도. 금속 원통 탱크 셋(업무·개인·기타, 들여다보는 창에 오늘 연소 몫만큼 연료),
//     밸브·플랜지가 달린 배관(최근 15분 연소가 셀수록 연료 점이 빨리 흐른다), 연소실과 종 모양 노즐의 엔진 셋
//     (그 영역의 지금 속도만큼 배기 불꽃이 길다).
// 아래: 계기판. 아날로그 속도계 넷(전체·업무·개인·기타, 로그 눈금), 호박색 숫자판(오늘 연소·연료비),
//       판에 끼워 둔 연료 기록 노트(누르면 자세한 도표 /usage). 맨 아래는 시간별 속도 기록지.
// 이름·부품마다 마우스를 올리면 실제 뜻이 보인다(조종석과 같은 빠른 말풍선).
import Link from "next/link";
import type { CSSProperties } from "react";
import { useUsage } from "@/data/hooks";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import { Tip } from "@/ui/kit/Tip";
import { AREA_LABEL, type Area, type UsageResponse } from "@/usage/model";
import { tokens, usd } from "./UsagePage";

const AREAS: Area[] = ["work", "personal", "other"];

const COLOR: Record<Area, string> = {
  work: "#6aa8ff",
  personal: "#ffb45c",
  other: "#9aa6bd",
};

/** 계통도 이름판에 적는 탱크 번호 */
const TAG: Record<Area, string> = {
  work: "T-1",
  personal: "T-2",
  other: "T-3",
};

/**
 * 바늘 끝: 분당 2만 토큰. 세션 하나는 수백, 여럿이 바쁘면 수천이라 로그 눈금으로 그린다
 * (2026-11-01 실측 7,927/분).
 */
export const SPEED_FULL = 20_000;

/** 분당 토큰 → 0..1(로그) */
export function speedRatio(v: number): number {
  return Math.min(1, Math.log10(1 + v) / Math.log10(1 + SPEED_FULL));
}

export function FuelRoom() {
  const query = useUsage("today");
  const data = query.data;
  return (
    <main className={`min-h-dvh text-white ${cockpit.panel}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/50 px-4 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <Link
          href="/"
          className="rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          ← 갑판으로
        </Link>
        <h1 className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-[#ffb45c]/80">
            ENGINE ROOM · FUEL
          </span>
          <span className="text-[15px] font-semibold">연료실</span>
          <span className="text-[12px] text-white/45">
            · 오늘의 연료와 추력
          </span>
        </h1>
        {data && (
          <span className="ml-auto font-mono text-[11px] text-white/35">
            {data.meta.source === "demo"
              ? "데모 · 지어낸 숫자"
              : `계측 ${new Date(data.meta.scannedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 최근 ${data.burn.windowMin}분 평균`}
          </span>
        )}
      </header>
      {query.isLoading || !data ? (
        <p className="p-8 font-mono text-[12px] text-white/50">
          계기를 켜는 중…
        </p>
      ) : (
        <Room data={data} />
      )}
    </main>
  );
}

function Room({ data }: { data: UsageResponse }) {
  return (
    <div className="mx-auto flex max-w-[1220px] flex-col gap-4 px-4 py-4">
      <Schematic data={data} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_230px]">
        <Instruments data={data} />
        <LogBook />
      </div>
      <HourLog data={data} />
    </div>
  );
}

/* ───────────── 계통도 ───────────── */

const VB_W = 1100;
const VB_H = 400;

/** 탱크 i(왼쪽부터 업무·개인·기타)의 자리 */
const TANK = (i: number) => ({ x: 70 + i * 150, y: 52, w: 96, h: 248 });
/** 엔진 줄의 높이(위에서부터). 탱크 i는 엔진 ENGINE_OF[i]로 간다(배관이 서로 엇갈리지 않게) */
const ENGINE_Y = [110, 210, 310];
const ENGINE_OF = [2, 1, 0];
/** 탱크 i의 배관: 아래로 내려가 가로 길(LANE)을 달리고, 세로 길(RISER)로 엔진 높이까지 오른다 */
const LANE = [380, 358, 336];
const RISER = [700, 670, 640];
const ENGINE_X = 760;

function pipePath(i: number): string {
  const t = TANK(i);
  const cx = t.x + t.w / 2;
  const y = ENGINE_Y[ENGINE_OF[i] ?? 0] ?? 110;
  const lane = LANE[i] ?? 360;
  const riser = RISER[i] ?? 680;
  return `M ${cx} ${t.y + t.h} V ${lane} H ${riser} V ${y} H ${ENGINE_X}`;
}

function Schematic({ data }: { data: UsageResponse }) {
  const total = data.total.output || 1;
  const maxBurn = Math.max(1, ...AREAS.map((a) => data.burn.perMin[a]));
  return (
    <section
      data-fuel-flow
      className={`relative overflow-hidden rounded-xl border border-white/10 ${cockpit.screen}`}
    >
      <div className="pointer-events-none absolute top-2.5 left-4 z-10 font-mono text-[10px] tracking-[0.25em] text-[#7ce0ff]/55">
        FUEL SYSTEM · 연료 계통도
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block w-full"
          role="img"
          aria-label="연료 계통도: 탱크 셋에서 배관을 지나 엔진 셋으로"
        >
          <SchematicDefs />
          <Blueprint />
          {AREAS.map((a, i) => (
            <PipeRun
              key={a}
              i={i}
              area={a}
              perMin={data.burn.perMin[a]}
              flow={data.burn.perMin[a] / maxBurn}
            />
          ))}
          {AREAS.map((a, i) => (
            <Tank
              key={a}
              i={i}
              area={a}
              share={data.areas[a].output / total}
              today={data.areas[a].output}
            />
          ))}
          {AREAS.map((a, i) => (
            <Engine
              key={a}
              y={ENGINE_Y[ENGINE_OF[i] ?? 0] ?? 110}
              area={a}
              perMin={data.burn.perMin[a]}
              thrust={data.burn.perMin[a] / maxBurn}
            />
          ))}
        </svg>
        {/* 말풍선 자리(SVG 위에 겹친 투명 단추) */}
        {AREAS.map((a, i) => {
          const t = TANK(i);
          const y = ENGINE_Y[ENGINE_OF[i] ?? 0] ?? 110;
          return (
            <div key={a}>
              <Zone
                x={t.x - 8}
                y={t.y - 10}
                w={t.w + 16}
                h={t.h + 46}
                align={i === 0 ? "start" : "center"}
                text={`${AREA_LABEL[a]} 탱크(${TAG[a]}) = ${AREA_LABEL[a]} 프로젝트 세션이 오늘 쓴 연료(출력 토큰).\n오늘 ${tokens(data.areas[a].output)} · 오늘 연소의 ${Math.round((data.areas[a].output / total) * 100)}% · 연료비 추정 ${usd(data.areas[a].cost)}`}
              />
              <Zone
                x={RISER[i] ?? 680}
                y={y - 14}
                w={ENGINE_X - (RISER[i] ?? 680)}
                h={28}
                text={`${AREA_LABEL[a]} 연료관 = 탱크에서 엔진으로 가는 연료. 점이 빨리 흐를수록 최근 ${data.burn.windowMin}분에 많이 썼어요.`}
              />
              <Zone
                x={ENGINE_X}
                y={y - 46}
                w={300}
                h={92}
                align="end"
                text={`${AREA_LABEL[a]} 엔진 = 지금 ${AREA_LABEL[a]} 쪽 속도.\n최근 ${data.burn.windowMin}분 동안 분당 ${tokens(Math.round(data.burn.perMin[a]))} 토큰을 태웠어요. 배기 불꽃이 길수록 빨라요.`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** SVG 좌표를 %로 바꿔 겹치는 말풍선 자리 */
function Zone({
  x,
  y,
  w,
  h,
  text,
  align = "center",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${(x / VB_W) * 100}%`,
        top: `${(y / VB_H) * 100}%`,
        width: `${(w / VB_W) * 100}%`,
        height: `${(h / VB_H) * 100}%`,
      }}
    >
      <Tip text={text} align={align} className="h-full w-full">
        <button
          type="button"
          aria-label={text.split("\n")[0]}
          className="h-full w-full cursor-default rounded-md outline-none focus-visible:ring-1 focus-visible:ring-[#7ce0ff]/50 hover:bg-[#7ce0ff]/[0.04]"
        />
      </Tip>
    </div>
  );
}

function SchematicDefs() {
  return (
    <defs>
      {/* 금속 원통: 가운데가 밝고 양끝이 어두운 가로 그라디언트 */}
      <linearGradient id="fr-metal" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#1c2330" />
        <stop offset="0.18" stopColor="#3a4558" />
        <stop offset="0.42" stopColor="#5a687f" />
        <stop offset="0.6" stopColor="#3a4558" />
        <stop offset="1" stopColor="#161c27" />
      </linearGradient>
      <linearGradient id="fr-cap" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6b7a92" />
        <stop offset="1" stopColor="#2a3342" />
      </linearGradient>
      <linearGradient id="fr-pipe" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#4c586c" />
        <stop offset="0.5" stopColor="#2a3240" />
        <stop offset="1" stopColor="#141922" />
      </linearGradient>
      <linearGradient id="fr-bell" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#2a3240" />
        <stop offset="0.45" stopColor="#7d6a55" />
        <stop offset="0.55" stopColor="#9a7f62" />
        <stop offset="1" stopColor="#241d17" />
      </linearGradient>
      <linearGradient id="fr-glass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#05080d" />
        <stop offset="0.5" stopColor="#0d1420" />
        <stop offset="1" stopColor="#05080d" />
      </linearGradient>
      {/* 배기 불꽃: 겉불꽃(영역 색) · 속불꽃(주황) · 심(흰빛) 세 겹 */}
      {AREAS.map((a) => (
        <linearGradient key={a} id={`fr-plume-${a}`} x1="0" x2="1">
          <stop offset="0" stopColor={COLOR[a]} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={COLOR[a]} stopOpacity="0.45" />
          <stop offset="1" stopColor={COLOR[a]} stopOpacity="0" />
        </linearGradient>
      ))}
      <linearGradient id="fr-plume-mid" x1="0" x2="1">
        <stop offset="0" stopColor="#fff1c2" stopOpacity="1" />
        <stop offset="0.35" stopColor="#ffb347" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="fr-plume-core" x1="0" x2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="0.6" stopColor="#dff1ff" stopOpacity="0.85" />
        <stop offset="1" stopColor="#bfe3ff" stopOpacity="0" />
      </linearGradient>
      {/* 가장자리가 일렁이게: 흐르는 노이즈로 불꽃 모양을 흔든다 */}
      <filter id="fr-fire" x="-5%" y="-40%" width="115%" height="180%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.03 0.11"
          numOctaves="3"
          seed="7"
          result="noise"
        >
          <animate
            attributeName="baseFrequency"
            dur="0.9s"
            values="0.03 0.11;0.036 0.15;0.028 0.12;0.03 0.11"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="10"
          xChannelSelector="R"
          yChannelSelector="G"
          result="shaken"
        />
        <feGaussianBlur in="shaken" stdDeviation="0.8" />
      </filter>
      <filter id="fr-glow" x="-30%" y="-80%" width="160%" height="260%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <pattern
        id="fr-grid"
        width="20"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 20 0 L 0 0 0 20"
          fill="none"
          stroke="#7ce0ff"
          strokeOpacity="0.05"
          strokeWidth="1"
        />
      </pattern>
    </defs>
  );
}

/** 청사진 바탕: 모눈과 선체 윤곽 */
function Blueprint() {
  return (
    <g aria-hidden>
      <rect width={VB_W} height={VB_H} fill="url(#fr-grid)" />
      <rect
        x="24"
        y="30"
        width="1052"
        height="356"
        rx="34"
        fill="none"
        stroke="#7ce0ff"
        strokeOpacity="0.12"
        strokeDasharray="2 6"
      />
      {[250, 520, 760].map((x) => (
        <line
          key={x}
          x1={x}
          y1="34"
          x2={x}
          y2="382"
          stroke="#7ce0ff"
          strokeOpacity="0.05"
        />
      ))}
      <text
        x="1060"
        y="378"
        textAnchor="end"
        fontFamily="ui-monospace, monospace"
        fontSize="9"
        fill="#7ce0ff"
        fillOpacity="0.35"
      >
        DECK 4 · AFT
      </text>
    </g>
  );
}

function Tank({
  i,
  area,
  share,
  today,
}: {
  i: number;
  area: Area;
  share: number;
  today: number;
}) {
  const t = TANK(i);
  const c = COLOR[area];
  // 들여다보는 창(사이트 글라스): 탱크 가운데 세로 홈
  const gx = t.x + t.w / 2 - 9;
  const gy = t.y + 28;
  const gh = t.h - 56;
  const level = Math.max(0.02, Math.min(1, share));
  const ly = gy + gh * (1 - level);
  return (
    <g data-tank={area}>
      {/* 받침 */}
      <rect
        x={t.x + 10}
        y={t.y + t.h - 2}
        width={t.w - 20}
        height="10"
        rx="2"
        fill="#11161f"
        stroke="#ffffff"
        strokeOpacity="0.08"
      />
      {/* 몸통 */}
      <rect
        x={t.x}
        y={t.y + 10}
        width={t.w}
        height={t.h - 20}
        fill="url(#fr-metal)"
      />
      {/* 위·아래 뚜껑 */}
      <ellipse
        cx={t.x + t.w / 2}
        cy={t.y + 10}
        rx={t.w / 2}
        ry="11"
        fill="url(#fr-cap)"
      />
      <ellipse
        cx={t.x + t.w / 2}
        cy={t.y + t.h - 10}
        rx={t.w / 2}
        ry="11"
        fill="#1a212c"
      />
      {/* 이음 띠와 리벳 */}
      {[0.3, 0.7].map((f) => (
        <g key={f}>
          <rect
            x={t.x}
            y={t.y + t.h * f - 3}
            width={t.w}
            height="6"
            fill="#000"
            fillOpacity="0.28"
          />
          {[0.12, 0.88].map((r) => (
            <circle
              key={r}
              cx={t.x + t.w * r}
              cy={t.y + t.h * f}
              r="1.8"
              fill="#8a97ad"
              fillOpacity="0.7"
            />
          ))}
        </g>
      ))}
      {/* 사이트 글라스 */}
      <rect
        x={gx - 3}
        y={gy - 3}
        width="24"
        height={gh + 6}
        rx="5"
        fill="#0b0f16"
        stroke="#8a97ad"
        strokeOpacity="0.45"
      />
      <rect x={gx} y={gy} width="18" height={gh} rx="3" fill="url(#fr-glass)" />
      <rect
        x={gx}
        y={ly}
        width="18"
        height={gy + gh - ly}
        rx="3"
        fill={c}
        fillOpacity="0.85"
        style={{ filter: `drop-shadow(0 0 6px ${c})` }}
      />
      <line
        x1={gx}
        x2={gx + 18}
        y1={ly}
        y2={ly}
        stroke="#fff"
        strokeOpacity="0.8"
        strokeWidth="1"
      />
      {/* 눈금 */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={gx + 20}
          x2={gx + 27}
          y1={gy + gh * (1 - f)}
          y2={gy + gh * (1 - f)}
          stroke="#cfd8e8"
          strokeOpacity="0.45"
        />
      ))}
      {/* 이름판 */}
      <rect
        x={t.x + 6}
        y={t.y + t.h + 12}
        width={t.w - 12}
        height="30"
        rx="2"
        fill="#0d1118"
        stroke="#ffffff"
        strokeOpacity="0.1"
      />
      <text
        x={t.x + t.w / 2}
        y={t.y + t.h + 24}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={c}
      >
        {TAG[area]} · {AREA_LABEL[area]}
      </text>
      <text
        x={t.x + t.w / 2}
        y={t.y + t.h + 37}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill="#e8edf7"
        fillOpacity="0.85"
      >
        {tokens(today)} · {Math.round(share * 100)}%
      </text>
    </g>
  );
}

function PipeRun({
  i,
  area,
  perMin,
  flow,
}: {
  i: number;
  area: Area;
  perMin: number;
  flow: number;
}) {
  const d = pipePath(i);
  const c = COLOR[area];
  // 연료 점이 한 칸(20) 가는 데 걸리는 시간: 셀수록 짧게, 안 쓰면 멈춤
  const secs = perMin > 0 ? Math.max(0.35, 2.4 - 2 * flow) : 0;
  const t = TANK(i);
  const lane = LANE[i] ?? 360;
  const riser = RISER[i] ?? 680;
  return (
    <g data-pipe={area}>
      <path
        d={d}
        fill="none"
        stroke="#0a0d13"
        strokeWidth="13"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#3d4758"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#0f141c"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {secs > 0 && (
        <path
          d={d}
          fill="none"
          stroke={c}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="4 16"
          className="fuel-dash"
          style={
            {
              animationDuration: `${secs}s`,
              filter: `drop-shadow(0 0 3px ${c})`,
            } as CSSProperties
          }
        />
      )}
      {/* 밸브(나비 모양): 탱크 아래 이름판에 가리지 않게 가로 배관 위, 탱크 바로 오른쪽 */}
      <g transform={`translate(${t.x + t.w / 2 + 34} ${lane})`}>
        <path
          d="M -8 -6 L 8 6 L 8 -6 L -8 6 Z"
          fill="#2a3240"
          stroke="#9aa6bd"
          strokeOpacity="0.7"
        />
        <rect
          x="-2"
          y="-12"
          width="4"
          height="6"
          fill="#9aa6bd"
          fillOpacity="0.6"
        />
      </g>
      {[riser - 20, (riser + ENGINE_X) / 2].map((fx) => (
        <rect
          key={fx}
          x={fx - 2}
          y={(ENGINE_Y[ENGINE_OF[i] ?? 0] ?? 110) - 8}
          width="4"
          height="16"
          fill="#6b7a92"
          fillOpacity="0.8"
        />
      ))}
      <rect
        x={(t.x + t.w / 2 + riser) / 2 - 2}
        y={lane - 8}
        width="4"
        height="16"
        fill="#6b7a92"
        fillOpacity="0.8"
      />
    </g>
  );
}

/**
 * (x, y)에서 오른쪽으로 len만큼 뻗는 불꽃 모양. 시작 반높이 h0(노즐 입구보다 좁게)에서
 * 조금 부풀었다가(hMax) 끝으로 가늘어진다.
 */
function flameShape(
  x: number,
  y: number,
  len: number,
  h0: number,
  hMax: number,
) {
  return [
    `M ${x} ${y - h0}`,
    `C ${x + len * 0.18} ${y - hMax}, ${x + len * 0.55} ${y - hMax * 0.8}, ${x + len} ${y}`,
    `C ${x + len * 0.55} ${y + hMax * 0.8}, ${x + len * 0.18} ${y + hMax}, ${x} ${y + h0}`,
    "Z",
  ].join(" ");
}

/** 노즐 출구 안쪽으로 불꽃을 숨겨 시작하는 거리. 일렁이는 왼쪽 끝을 노즐 종이 가린다. */
const PLUME_INSET = 8;

/**
 * 배기 불꽃: 번진 빛 · 겉불꽃(영역 색) · 속불꽃(주황) · 흰 심 · 충격파 무늬(마하 다이아몬드).
 * 겉·속불꽃은 흐르는 노이즈로 가장자리가 일렁이고(fr-fire), 무리 전체가 불규칙하게 떤다.
 */
function Plume({
  x,
  y,
  len,
  area,
}: {
  x: number;
  y: number;
  len: number;
  area: Area;
}) {
  // x는 노즐 출구. 불꽃은 출구 안쪽(PLUME_INSET)에서 노즐 입구(반높이 38)보다 좁게 시작한다.
  const sx = x - PLUME_INSET;
  const diamonds = [0.16, 0.3, 0.43].filter((t) => t * len > 14);
  return (
    <g style={{ mixBlendMode: "screen" }}>
      {/* 번진 빛은 출구 밖에서만(노즐 몸통 뒤로 번지면 얼룩처럼 보였다) */}
      <path
        d={flameShape(x + 6, y, len, 22, 34)}
        fill={COLOR[area]}
        fillOpacity="0.3"
        filter="url(#fr-glow)"
      />
      <g className="fuel-plume">
        <g filter="url(#fr-fire)">
          <path
            d={flameShape(sx, y, len + PLUME_INSET, 27, 33)}
            fill={`url(#fr-plume-${area})`}
          />
          <path
            d={flameShape(sx, y, len * 0.72, 18, 21)}
            fill="url(#fr-plume-mid)"
          />
        </g>
        <path
          d={flameShape(sx, y, len * 0.48, 9, 10)}
          fill="url(#fr-plume-core)"
        />
        {diamonds.map((t, i) => (
          <ellipse
            key={t}
            cx={x + t * len}
            cy={y}
            rx={4.5 - i}
            ry={7 - i * 1.5}
            fill="#ffffff"
            fillOpacity={0.75 - i * 0.2}
          />
        ))}
      </g>
    </g>
  );
}

function Engine({
  y,
  area,
  perMin,
  thrust,
}: {
  y: number;
  area: Area;
  perMin: number;
  thrust: number;
}) {
  const x = ENGINE_X;
  const c = COLOR[area];
  const plume = perMin > 0 ? 40 + thrust * 150 : 0;
  return (
    <g data-engine={area}>
      {/* 배기 불꽃: 노즐 안쪽에서 시작해 노즐 뒤에 그린다(일렁이는 왼쪽 끝을 노즐이 가린다) */}
      {plume > 0 && <Plume x={x + 142} y={y} len={plume} area={area} />}
      {/* 연소실 */}
      <rect
        x={x}
        y={y - 20}
        width="74"
        height="40"
        rx="5"
        fill="url(#fr-metal)"
        stroke="#000"
        strokeOpacity="0.5"
      />
      {[x + 14, x + 34, x + 54].map((rx) => (
        <rect
          key={rx}
          x={rx}
          y={y - 20}
          width="3"
          height="40"
          fill="#000"
          fillOpacity="0.25"
        />
      ))}
      {/* 목(스로트)과 종 모양 노즐 */}
      <path
        d={`M ${x + 74} ${y - 12} L ${x + 86} ${y - 8} L ${x + 86} ${y + 8} L ${x + 74} ${y + 12} Z`}
        fill="#2a3240"
      />
      <path
        d={`M ${x + 86} ${y - 8} C ${x + 110} ${y - 12}, ${x + 128} ${y - 30}, ${x + 142} ${y - 38} L ${x + 142} ${y + 38} C ${x + 128} ${y + 30}, ${x + 110} ${y + 12}, ${x + 86} ${y + 8} Z`}
        fill="url(#fr-bell)"
        stroke="#000"
        strokeOpacity="0.5"
      />
      {/* 이름판 */}
      <text
        x={x + 37}
        y={y + 4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={c}
      >
        {AREA_LABEL[area]}
      </text>
      <text
        x={x + 37}
        y={y + 34}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fill="#e8edf7"
        fillOpacity="0.8"
      >
        {tokens(Math.round(perMin))}/분
      </text>
    </g>
  );
}

/* ───────────── 계기판 ───────────── */

function Instruments({ data }: { data: UsageResponse }) {
  return (
    <section
      className={`flex flex-wrap items-stretch gap-3 rounded-xl px-4 py-3 ${cockpit.bay}`}
    >
      <Dial
        value={data.burn.total}
        label="전체 속도"
        color="#ffd9a8"
        big
        tip={`전체 속도 = 최근 ${data.burn.windowMin}분 동안 분당 태운 연료(출력 토큰), 엔진 셋 합.\n눈금은 로그(1·10·100·1천·1만), 끝은 분당 ${tokens(SPEED_FULL)}. 계측은 최대 5분 늦어요.`}
      />
      {AREAS.map((a) => (
        <Dial
          key={a}
          value={data.burn.perMin[a]}
          label={`${AREA_LABEL[a]} 엔진`}
          color={COLOR[a]}
          tip={`${AREA_LABEL[a]} 엔진 속도 = 최근 ${data.burn.windowMin}분 동안 ${AREA_LABEL[a]} 세션이 분당 태운 연료(출력 토큰).`}
        />
      ))}
      <div className="ml-auto flex min-w-[200px] flex-col justify-center gap-2">
        <Readout
          label="오늘 연소"
          value={tokens(data.total.output)}
          unit="토큰"
          tip={`오늘 연소 = 오늘 자정부터 쓴 출력 토큰 합(엔진 셋). 점화(요청) ${data.total.requests.toLocaleString("ko-KR")}번.`}
        />
        <Readout
          label="연료비"
          value={usd(data.total.cost)}
          unit="추정"
          tip="연료비 = 오늘 쓴 토큰을 API 가격으로 셈한 추정. 구독 사용 한도(%)와는 맞지 않아요."
        />
        <Readout
          label="재순환"
          value={tokens(data.total.cacheRead)}
          unit="캐시 읽기"
          tip="재순환 연료 = 캐시에서 다시 읽은 입력. 값이 싸서 토큰 수는 출력의 수백 배로 커요."
        />
      </div>
    </section>
  );
}

/** 아날로그 속도계: 240도 눈금, 로그 눈금(1·10·100·1천·1만) */
function Dial({
  value,
  label,
  color,
  tip,
  big,
}: {
  value: number;
  label: string;
  color: string;
  tip: string;
  big?: boolean;
}) {
  const r = speedRatio(value);
  const start = -120;
  const sweep = 240;
  const angle = start + r * sweep;
  const ticks = [0, 1, 2, 3, 4].map((p) => ({
    p,
    f: Math.log10(1 + 10 ** p) / Math.log10(1 + SPEED_FULL),
  }));
  const size = big ? 150 : 120;
  return (
    <Tip text={tip} align="start">
      <button
        type="button"
        data-fuel-speed={big ? "total" : label}
        className="flex cursor-default flex-col items-center outline-none"
      >
        <svg viewBox="-60 -60 120 120" width={size} aria-hidden>
          <circle r="56" fill="#0a0e15" stroke="#3a4558" strokeWidth="3" />
          <circle r="50" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
          {/* 바탕 호와 값 호 */}
          <path
            d={arc(44, start, start + sweep)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.1"
            strokeWidth="4"
          />
          <path
            d={arc(44, start, angle)}
            fill="none"
            stroke={color}
            strokeWidth="4"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
          {ticks.map(({ p, f }) => {
            const a = ((start + f * sweep - 90) * Math.PI) / 180;
            return (
              <g key={p}>
                <line
                  x1={Math.cos(a) * 36}
                  y1={Math.sin(a) * 36}
                  x2={Math.cos(a) * 42}
                  y2={Math.sin(a) * 42}
                  stroke="#cfd8e8"
                  strokeOpacity="0.6"
                />
                <text
                  x={Math.cos(a) * 28}
                  y={Math.sin(a) * 28 + 3}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="ui-monospace, monospace"
                  fill="#cfd8e8"
                  fillOpacity="0.5"
                >
                  {["1", "10", "100", "1천", "1만"][p]}
                </text>
              </g>
            );
          })}
          <line
            x1="0"
            y1="6"
            x2="0"
            y2="-40"
            stroke="#f4f6fa"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${angle})`}
          />
          <circle r="5" fill="#2a3240" stroke="#cfd8e8" strokeOpacity="0.6" />
          <text
            y="30"
            textAnchor="middle"
            fontSize={big ? 13 : 11}
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
            fill="#f4f6fa"
          >
            {tokens(Math.round(value))}
          </text>
          <text
            y="40"
            textAnchor="middle"
            fontSize="6.5"
            fill="#cfd8e8"
            fillOpacity="0.5"
          >
            분당 토큰
          </text>
        </svg>
        <span
          className="mt-0.5 text-[11px] font-semibold tracking-wide"
          style={{ color }}
        >
          {label}
        </span>
      </button>
    </Tip>
  );
}

/** 반지름 r, 각도 a0→a1(위가 0도, 시계 방향)인 호 */
function arc(r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(Math.cos(t) * r).toFixed(2)} ${(Math.sin(t) * r).toFixed(2)}`;
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
}

/** 호박색 숫자판 */
function Readout({
  label,
  value,
  unit,
  tip,
}: {
  label: string;
  value: string;
  unit: string;
  tip: string;
}) {
  return (
    <Tip text={tip} align="end">
      <button
        type="button"
        className="flex w-full cursor-default items-center gap-2 rounded-md border border-black/60 bg-[#07090d] px-2.5 py-1.5 text-left shadow-[inset_0_1px_6px_rgba(0,0,0,0.8)] outline-none"
      >
        <span className="w-[52px] shrink-0 text-[10.5px] text-white/45">
          {label}
        </span>
        <span className="flex-1 text-right font-mono text-[16px] font-semibold tabular-nums text-[#ffc46b] [text-shadow:0_0_8px_rgba(255,180,92,0.55)]">
          {value}
        </span>
        <span className="w-[44px] shrink-0 text-[10px] text-white/35">
          {unit}
        </span>
      </button>
    </Tip>
  );
}

/** 판에 끼워 둔 연료 기록 노트 */
function LogBook() {
  return (
    <Tip
      align="end"
      text={
        "연료 기록 노트 = 자세한 도표.\n오늘·7일·30일, 업무·개인 합계, 승무원(프로젝트)·세션 순위, 날마다 연소, 엔진(모델)별"
      }
      className="h-full"
    >
      <Link
        href="/usage"
        data-fuel-notebook
        className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl px-4 pt-6 pb-4 ${cockpit.bay}`}
      >
        {/* 집게 */}
        <span className="absolute top-0 left-1/2 h-[14px] w-[64px] -translate-x-1/2 rounded-b-md bg-gradient-to-b from-[#8a97ad] to-[#3a4558] shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
        <span className="flex flex-col gap-1.5">
          <span className="font-mono text-[9.5px] tracking-[0.25em] text-white/35">
            FUEL LOG BOOK
          </span>
          <span className="text-[15px] font-semibold text-[#ffd9a8]">
            연료 기록 노트
          </span>
          {[0, 1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-px bg-white/10"
              style={{ width: `${88 - n * 14}%` }}
            />
          ))}
        </span>
        <span className="mt-3 text-[12px] text-white/55 group-hover:text-white/85">
          펼쳐서 자세한 도표 보기 ▸
        </span>
      </Link>
    </Tip>
  );
}

/* ───────────── 속도 기록지 ───────────── */

/** 시간별 속도 기록: 그 시간 평균 분당 출력(시간 합 ÷ 60), 영역별로 쌓는다 */
function HourLog({ data }: { data: UsageResponse }) {
  const rows = data.hours.map((h) => ({
    at: h.at,
    work: h.work / 60,
    personal: h.personal / 60,
    other: h.other / 60,
  }));
  const max = Math.max(1, ...rows.map((h) => h.work + h.personal + h.other));
  const grid = [0.25, 0.5, 0.75, 1];
  return (
    <section
      data-fuel-hours
      className={`rounded-xl border border-white/10 px-4 pt-3 pb-2 ${cockpit.screen}`}
    >
      <div className="mb-2 flex items-center gap-3">
        <Tip
          align="start"
          text="속도 기록지 = 오늘 시간마다 평균 분당 출력 토큰. 언제 일을 많이 시켰는지(시간당 업무량)가 보여요."
        >
          <button
            type="button"
            className="cursor-default font-mono text-[10px] tracking-[0.25em] text-[#7ce0ff]/55 outline-none"
          >
            SPEED LOG · 오늘 시간별 속도
          </button>
        </Tip>
        <span className="ml-auto flex gap-3 text-[10.5px] text-white/45">
          {AREAS.map((a) => (
            <span key={a} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: COLOR[a] }}
              />
              {AREA_LABEL[a]}
            </span>
          ))}
        </span>
      </div>
      <div className="relative h-[140px] pl-12">
        {grid.map((g) => (
          <div
            key={g}
            className="absolute right-0 left-12 border-t border-dashed border-[#7ce0ff]/10"
            style={{ bottom: `${g * 100}%` }}
          >
            <span className="absolute -top-2 -left-12 w-10 text-right font-mono text-[9px] text-white/30">
              {tokens(Math.round(max * g))}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 left-12 flex items-end gap-[3px]">
          {rows.map((h) => {
            const sum = h.work + h.personal + h.other;
            const hour = new Date(h.at).getHours();
            return (
              <div
                key={h.at}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${hour}시 · 분당 ${tokens(Math.round(sum))}`}
              >
                <div
                  className="flex flex-col-reverse overflow-hidden rounded-t-[2px]"
                  style={{ height: `${(sum / max) * 100}%` }}
                >
                  {AREAS.map((a) =>
                    h[a] > 0 ? (
                      <div
                        key={a}
                        style={{
                          height: `${(h[a] / sum) * 100}%`,
                          background: COLOR[a],
                        }}
                        className="opacity-85"
                      />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-[3px] pt-1 pl-12">
        {rows.map((h) => {
          const hour = new Date(h.at).getHours();
          return (
            <div
              key={h.at}
              className="min-w-0 flex-1 text-center font-mono text-[9px] text-white/30"
            >
              {hour % 3 === 0 ? hour : ""}
            </div>
          );
        })}
      </div>
    </section>
  );
}
