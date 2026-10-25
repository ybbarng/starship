"use client";

// 우주왕복선 앞 유리 다섯 장. 굵은 기둥과 윗판·아래 문턱은 금속, 유리 칸은 뚫려 있어 뒤의 창밖이 보인다.
// viewBox를 1372×506(1372×872 화면의 위 58%)에 맞춰 그리고 늘려 쓴다.

export const FRAME_W = 1372;
export const FRAME_H = 506;

type Pt = [number, number];

/** 유리 칸 다섯(왼쪽부터). 기둥 너비는 26 */
export const PANES: Pt[][] = [
  [
    [40, 100],
    [274, 68],
    [236, 440],
    [26, 404],
  ],
  [
    [300, 68],
    [510, 54],
    [486, 452],
    [262, 440],
  ],
  [
    [536, 54],
    [836, 54],
    [860, 452],
    [512, 452],
  ],
  [
    [862, 54],
    [1072, 68],
    [1110, 440],
    [886, 452],
  ],
  [
    [1098, 68],
    [1332, 100],
    [1346, 404],
    [1136, 440],
  ],
];

/** 모서리를 둥글린 다각형 경로 */
function roundedPath(points: Pt[], r: number): string {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = points[i] as Pt;
    const prev = points[(i - 1 + n) % n] as Pt;
    const next = points[(i + 1) % n] as Pt;
    const toPrev = norm([prev[0] - p[0], prev[1] - p[1]]);
    const toNext = norm([next[0] - p[0], next[1] - p[1]]);
    const a: Pt = [p[0] + toPrev[0] * r, p[1] + toPrev[1] * r];
    const b: Pt = [p[0] + toNext[0] * r, p[1] + toNext[1] * r];
    d += `${i === 0 ? "M" : "L"}${a[0].toFixed(1)},${a[1].toFixed(1)} Q${p[0]},${p[1]} ${b[0].toFixed(1)},${b[1].toFixed(1)} `;
  }
  return `${d}Z`;
}

function norm([x, y]: Pt): Pt {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

const PANE_PATHS = PANES.map((p) => roundedPath(p, 16));

/** 기둥 가운데 줄(나사 자리) */
const PILLARS: [Pt, Pt][] = [
  [
    [287, 68],
    [249, 440],
  ],
  [
    [523, 54],
    [499, 452],
  ],
  [
    [849, 54],
    [873, 452],
  ],
  [
    [1085, 68],
    [1123, 440],
  ],
];

export function WindowFrame({
  backdrop = 0,
  className,
}: {
  /** 0..1. 조종석이 작아질 때 유리 칸을 어두운 하늘색으로 채운다(뒤의 진짜 창밖과 따로 놀지 않게). */
  backdrop?: number;
  className?: string;
}) {
  const outer = `M0,0 H${FRAME_W} V${FRAME_H} H0 Z`;
  return (
    <svg
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="cl-frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b313d" />
          <stop offset="0.12" stopColor="#1c212b" />
          <stop offset="0.8" stopColor="#161a22" />
          <stop offset="1" stopColor="#232935" />
        </linearGradient>
        <linearGradient id="cl-glare" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#bfe0ff" stopOpacity="0.05" />
          <stop offset="0.78" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cl-backdrop" cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#11203d" />
          <stop offset="1" stopColor="#03050c" />
        </radialGradient>
        <linearGradient id="cl-sill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4150" />
          <stop offset="0.25" stopColor="#262b36" />
          <stop offset="1" stopColor="#1a1e27" />
        </linearGradient>
        <clipPath id="cl-panes">
          {PANE_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
      </defs>

      {backdrop > 0 && (
        <g clipPath="url(#cl-panes)" opacity={backdrop}>
          <rect width={FRAME_W} height={FRAME_H} fill="url(#cl-backdrop)" />
          {STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#dfe8ff" />
          ))}
        </g>
      )}

      {/* 유리 반사 */}
      <g clipPath="url(#cl-panes)">
        <rect width={FRAME_W} height={FRAME_H} fill="url(#cl-glare)" />
      </g>

      {/* 금속 틀 */}
      <path
        d={`${outer} ${PANE_PATHS.join(" ")}`}
        fill="url(#cl-frame)"
        fillRule="evenodd"
      />

      {/* 고무 패킹과 빛 받는 모서리 */}
      {PANE_PATHS.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="#05070b" strokeWidth={7} />
          <path
            d={d}
            fill="none"
            stroke="#8b96ad"
            strokeOpacity={0.22}
            strokeWidth={1.5}
            transform="translate(0 -2)"
          />
        </g>
      ))}

      {/* 기둥 나사 */}
      {PILLARS.flatMap(([a, b]) =>
        [0.08, 0.36, 0.64, 0.92].map((t) => {
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          return (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={3.4} fill="#0e1117" />
              <circle cx={x - 0.6} cy={y - 0.8} r={2.2} fill="#566074" />
            </g>
          );
        }),
      )}

      {/* 윗판: 가는 홈과 작은 표시등 */}
      <path d="M0,24 H1372" stroke="#0c0f15" strokeWidth={1.5} />
      <path d="M0,26 H1372" stroke="#ffffff" strokeOpacity={0.05} />
      {[120, 160, 200, 1172, 1212, 1252].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={13}
          r={3}
          fill={i % 3 === 1 ? "#5ee08a" : "#3a4252"}
          opacity={0.9}
        />
      ))}

      {/* 아래 문턱(눈부심 가리개 끝) */}
      <path
        d="M0,452 Q686,436 1372,452 V506 H0 Z"
        fill="url(#cl-sill)"
        stroke="#0a0c11"
        strokeWidth={2}
      />
      <path
        d="M0,456 Q686,440 1372,456"
        fill="none"
        stroke="#fff"
        strokeOpacity={0.09}
        strokeWidth={1.5}
      />
    </svg>
  );
}

/** 작아진 조종석 유리에 비치는 별(씨앗 고정) */
const STARS: [number, number, number][] = (() => {
  let a = 7;
  const rand = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  return Array.from({ length: 90 }, () => [
    Math.round(rand() * FRAME_W),
    Math.round(rand() * 460),
    rand() < 0.1 ? 3.2 : 1.6,
  ]);
})();
