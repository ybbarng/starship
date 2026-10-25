"use client";

// 교신 화상 창 안에 비치는 상대 우주선 함교. 출처마다 모양이 다르다(도형으로 직접 그림).
//   채팅 = 둥근 보라 함교, 이슈 = 각진 남색 함교, 리뷰 = 검은 화물선 조종실, 문서 = 파란 도서관선
import type { ReactNode } from "react";
import { BRIDGE_TINT, type Bridge } from "./util";

const W = 320;
const H = 150;

export function BridgeScene({
  bridge,
  initial,
  talking = true,
}: {
  bridge: Bridge;
  initial: string;
  talking?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {BACKS[bridge]}
      <Caller tint={BRIDGE_TINT[bridge]} initial={initial} talking={talking} />
      {FRONTS[bridge]}
    </svg>
  );
}

/** 보낸 사람: 동그란 얼굴, 헤드셋, 가슴에 이름 첫 글자 */
function Caller({
  tint,
  initial,
  talking,
}: {
  tint: string;
  initial: string;
  talking: boolean;
}) {
  return (
    <g>
      {/* 몸 */}
      <path
        d="M108,150 Q110,108 160,104 Q210,108 212,150 Z"
        fill={tint}
        opacity={0.95}
      />
      <path
        d="M146,106 L160,122 L174,106"
        fill="none"
        stroke="#fff"
        strokeOpacity={0.5}
        strokeWidth={2}
      />
      <circle cx={186} cy={128} r={9} fill="#fff" opacity={0.92} />
      <text
        x={186}
        y={132}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#1a1d2a"
      >
        {initial}
      </text>
      {/* 머리 */}
      <ellipse cx={160} cy={74} rx={27} ry={26} fill="#f4d7bf" />
      <path
        d="M133,70 Q136,44 160,44 Q186,44 188,72 Q176,58 160,57 Q142,58 133,70 Z"
        fill={HAIR[(initial.codePointAt(0) ?? 0) % HAIR.length]}
      />
      <ellipse cx={150} cy={76} rx={2.8} ry={3.4} fill="#231a26" />
      <ellipse cx={170} cy={76} rx={2.8} ry={3.4} fill="#231a26" />
      <circle cx={151} cy={75} r={0.9} fill="#fff" />
      <circle cx={171} cy={75} r={0.9} fill="#fff" />
      <ellipse cx={143} cy={85} rx={4} ry={2.4} fill="#ff9aa8" opacity={0.5} />
      <ellipse cx={177} cy={85} rx={4} ry={2.4} fill="#ff9aa8" opacity={0.5} />
      <ellipse cx={160} cy={89} rx={4} ry={1.6} fill="#8b3a46">
        {talking && (
          <animate
            attributeName="ry"
            values="1.4;3.2;1.6;2.6;1.4"
            dur="0.9s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>
      {/* 헤드셋 */}
      <path
        d="M131,74 Q131,40 160,40 Q189,40 189,74"
        fill="none"
        stroke="#20232c"
        strokeWidth={3.5}
      />
      <rect x={126} y={68} width={9} height={16} rx={4} fill="#20232c" />
      <rect x={185} y={68} width={9} height={16} rx={4} fill="#20232c" />
      <path
        d="M131,82 Q134,96 148,94"
        fill="none"
        stroke="#20232c"
        strokeWidth={2}
      />
      <circle cx={149} cy={94} r={2.6} fill={tint} />
    </g>
  );
}

function Stars({
  seed,
  n,
  x0,
  x1,
  y0,
  y1,
}: {
  seed: number;
  n: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  let a = seed;
  const rand = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      <circle
        key={i}
        cx={x0 + rand() * (x1 - x0)}
        cy={y0 + rand() * (y1 - y0)}
        r={rand() < 0.15 ? 1.3 : 0.7}
        fill="#fff"
        opacity={0.5 + rand() * 0.5}
      />,
    );
  }
  return <>{out}</>;
}

const BOOK_COLORS = [
  "#e86f5a",
  "#f2c45a",
  "#7fd1a8",
  "#7fb4ff",
  "#c29cff",
  "#f4f1e6",
];
const BOOKS: [number, number, string][] = [
  [7, 22, "#e86f5a"],
  [5, 18, "#f2c45a"],
  [8, 24, "#7fd1a8"],
  [6, 20, "#7fb4ff"],
  [9, 25, "#c29cff"],
  [5, 16, "#f4f1e6"],
  [7, 21, "#e86f5a"],
  [8, 23, "#7fb4ff"],
  [6, 19, "#f2c45a"],
];
const BACKS: Record<Bridge, ReactNode> = {
  /* 채팅: 둥근 보라 함교. 동그란 큰 창, 둥근 갈비뼈, 분홍 불빛 */
  chat: (
    <g>
      <defs>
        <radialGradient id="br-chat" cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#6a3fb8" />
          <stop offset="1" stopColor="#1f0f3d" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#br-chat)" />
      <circle
        cx={160}
        cy={60}
        r={66}
        fill="#0b0620"
        stroke="#9c74e8"
        strokeWidth={5}
      />
      <clipPath id="br-chat-win">
        <circle cx={160} cy={60} r={64} />
      </clipPath>
      <g clipPath="url(#br-chat-win)">
        <Stars seed={3} n={30} x0={94} x1={226} y0={0} y1={126} />
        <circle cx={206} cy={26} r={14} fill="#f6b3d8" opacity={0.85} />
        <path
          d="M188,30 Q206,20 226,22"
          stroke="#fff"
          strokeOpacity={0.4}
          fill="none"
        />
      </g>
      {[30, 70, 250, 290].map((x) => (
        <path
          key={x}
          d={`M${x},150 Q${x < 160 ? x + 26 : x - 26},40 160,-10`}
          fill="none"
          stroke="#8a62d6"
          strokeOpacity={0.45}
          strokeWidth={6}
        />
      ))}
      {[40, 58, 76, 244, 262, 280].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={112 - (i % 3) * 14}
          r={3}
          fill={i % 2 ? "#ff8ad8" : "#c7a6ff"}
        />
      ))}
    </g>
  ),
  /* 이슈: 각진 남색 함교. 육각 창, 비스듬한 판, 청록 줄 */
  issue: (
    <g>
      <defs>
        <linearGradient id="br-issue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24306b" />
          <stop offset="1" stopColor="#0c1233" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#br-issue)" />
      <polygon
        points="100,4 220,4 252,60 220,116 100,116 68,60"
        fill="#050820"
        stroke="#6e86ff"
        strokeWidth={4}
      />
      <clipPath id="br-issue-win">
        <polygon points="100,6 220,6 250,60 220,114 100,114 70,60" />
      </clipPath>
      <g clipPath="url(#br-issue-win)">
        <Stars seed={11} n={34} x0={70} x1={250} y0={6} y1={114} />
        <polygon
          points="96,90 140,70 180,96 130,114"
          fill="#3c4fa8"
          opacity={0.6}
        />
      </g>
      <polygon points="0,0 60,0 30,150 0,150" fill="#18215a" />
      <polygon points="320,0 260,0 290,150 320,150" fill="#18215a" />
      <path
        d="M8,30 L52,30 M6,48 L46,48 M268,30 L312,30 M274,48 L314,48"
        stroke="#5fe1ff"
        strokeWidth={2}
        opacity={0.7}
      />
      {[14, 24, 34].map((x) => (
        <rect
          key={x}
          x={x}
          y={70}
          width={6}
          height={6}
          fill="#5fe1ff"
          opacity={0.6}
        />
      ))}
      {[282, 292, 302].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={70}
          width={6}
          height={6}
          fill={i === 1 ? "#ffd84a" : "#5fe1ff"}
          opacity={0.7}
        />
      ))}
    </g>
  ),
  /* 리뷰: 검은 화물선 조종실. 노랑·검정 경고 띠, 상자, 주황 불 */
  review: (
    <g>
      <rect width={W} height={H} fill="#0d0e11" />
      <rect
        x={70}
        y={22}
        width={180}
        height={66}
        rx={6}
        fill="#04050a"
        stroke="#3a3c42"
        strokeWidth={4}
      />
      <clipPath id="br-rev-win">
        <rect x={72} y={24} width={176} height={62} rx={5} />
      </clipPath>
      <g clipPath="url(#br-rev-win)">
        <Stars seed={21} n={24} x0={72} x1={248} y0={24} y1={86} />
        <rect x={150} y={22} width={6} height={66} fill="#3a3c42" />
      </g>
      <defs>
        <pattern
          id="br-hazard"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="16" fill="#f2b632" />
          <rect x="8" width="8" height="16" fill="#151515" />
        </pattern>
      </defs>
      <rect width={W} height={12} fill="url(#br-hazard)" />
      <rect
        x={6}
        y={60}
        width={46}
        height={40}
        fill="#3b2f22"
        stroke="#1b140c"
      />
      <rect
        x={14}
        y={98}
        width={46}
        height={52}
        fill="#4a3a28"
        stroke="#1b140c"
      />
      <path d="M6,80 H52 M29,60 V100" stroke="#1b140c" />
      <rect
        x={262}
        y={70}
        width={52}
        height={80}
        fill="#3b2f22"
        stroke="#1b140c"
      />
      <path d="M262,110 H314" stroke="#1b140c" />
      <path
        d="M290,12 V40 Q290,50 282,50"
        fill="none"
        stroke="#777"
        strokeWidth={3}
      />
      {[86, 102, 218, 234].map((x) => (
        <circle key={x} cx={x} cy={100} r={3.5} fill="#ff9d2e" opacity={0.9} />
      ))}
    </g>
  ),
  /* 문서: 파란 도서관선. 양옆 책장, 둥근 아치 창, 따뜻한 등 */
  doc: (
    <g>
      <defs>
        <linearGradient id="br-doc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f5fa6" />
          <stop offset="1" stopColor="#0b2648" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#br-doc)" />
      <path
        d="M104,120 V48 Q104,6 160,6 Q216,6 216,48 V120 Z"
        fill="#061428"
        stroke="#8cc8ff"
        strokeWidth={4}
      />
      <clipPath id="br-doc-win">
        <path d="M106,118 V48 Q106,8 160,8 Q214,8 214,48 V118 Z" />
      </clipPath>
      <g clipPath="url(#br-doc-win)">
        <Stars seed={31} n={26} x0={106} x1={214} y0={8} y1={118} />
        <circle cx={128} cy={34} r={9} fill="#ffe2a8" opacity={0.75} />
      </g>
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <rect x={0} y={16 + row * 34} width={84} height={3} fill="#5a3a22" />
          <rect
            x={236}
            y={16 + row * 34}
            width={84}
            height={3}
            fill="#5a3a22"
          />
          {BOOKS.map(([w, h, c], i) => (
            <rect
              key={`l${row}-${w}-${h}-${c}`}
              x={4 + BOOKS.slice(0, i).reduce((s, b) => s + b[0] + 1, 0)}
              y={16 + row * 34 - h}
              width={w}
              height={h}
              fill={c}
            />
          ))}
          {BOOKS.map(([w, h, c], i) => (
            <rect
              key={`r${row}-${w}-${h}-${c}`}
              x={240 + BOOKS.slice(0, i).reduce((s, b) => s + b[0] + 1, 0)}
              y={16 + row * 34 - h}
              width={w}
              height={h}
              fill={BOOK_COLORS[(i + row + 2) % BOOK_COLORS.length] ?? c}
            />
          ))}
        </g>
      ))}
      <circle cx={92} cy={20} r={5} fill="#ffd27a" />
      <circle cx={92} cy={20} r={12} fill="#ffd27a" opacity={0.18} />
    </g>
  ),
};

const FRONTS: Record<Bridge, ReactNode> = {
  chat: (
    <g>
      <ellipse cx={160} cy={160} rx={150} ry={28} fill="#2a1652" />
      <ellipse
        cx={160}
        cy={146}
        rx={120}
        ry={10}
        fill="none"
        stroke="#c7a6ff"
        strokeOpacity={0.5}
        strokeWidth={2}
      />
    </g>
  ),
  issue: (
    <g>
      <polygon
        points="40,150 90,132 230,132 280,150"
        fill="#141c4d"
        stroke="#5fe1ff"
        strokeOpacity={0.5}
      />
    </g>
  ),
  review: (
    <g>
      <rect x={60} y={136} width={200} height={14} fill="#1c1d21" />
      <rect
        x={60}
        y={136}
        width={200}
        height={3}
        fill="#f2b632"
        opacity={0.7}
      />
    </g>
  ),
  doc: (
    <g>
      <rect x={70} y={138} width={180} height={12} rx={3} fill="#5a3a22" />
      <rect x={110} y={132} width={30} height={7} fill="#f4f1e6" />
      <rect x={112} y={130} width={26} height={3} fill="#e86f5a" />
    </g>
  ),
};

const HAIR = ["#3b2e3f", "#7a4a2a", "#c98a3c", "#2f3d5c", "#8a3b52"];
