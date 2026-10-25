"use client";

// 넓게 트인 곡면 유리 한 장. 유리 바깥(선실 천장·기둥)은 어둡게 칠하고, 유리 안쪽에는
// 가장자리 반사광·계기판 불빛 번짐·아주 옅은 먼지만 얹는다. 모양은 숫자(GlassShape)로 받아
// 감상 모드에서는 테두리가 화면 바깥으로 밀려나고, 선내 장면에서는 위쪽 띠가 된다.
import { useMemo } from "react";

export type GlassShape = {
  /** 왼쪽·오른쪽 가장자리 */
  x0: number;
  x1: number;
  /** 윗변 가운데(가장 높은 곳)와 윗변 양끝 */
  topMid: number;
  topCorner: number;
  /** 아랫변 */
  bottom: number;
  /** 모서리 둥글기 */
  r: number;
};

export function glassPath(g: GlassShape, w: number): string {
  const { x0, x1, topMid, topCorner: tc, bottom: b } = g;
  const r = Math.max(0, Math.min(g.r, (x1 - x0) / 2, (b - tc) / 2));
  const ctrl = 2 * topMid - tc; // 2차 곡선의 가운데가 topMid를 지나게
  return [
    `M ${x0} ${b - r}`,
    `L ${x0} ${tc + r}`,
    `Q ${x0} ${tc} ${x0 + r} ${tc}`,
    `Q ${w / 2} ${ctrl} ${x1 - r} ${tc}`,
    `Q ${x1} ${tc} ${x1} ${tc + r}`,
    `L ${x1} ${b - r}`,
    `Q ${x1} ${b} ${x1 - r} ${b}`,
    `L ${x0 + r} ${b}`,
    `Q ${x0} ${b} ${x0} ${b - r}`,
    "Z",
  ].join(" ");
}

export function GlassFrame({
  w,
  h,
  shape,
  frame,
  reflect,
  blocking,
}: {
  w: number;
  h: number;
  shape: GlassShape;
  /** 유리 바깥 선실의 진하기(0..1) */
  frame: number;
  /** 반사광·먼지의 진하기(0..1) */
  reflect: number;
  /** 유리 바깥을 눌러도 창밖으로 지나가지 않게 막는다 */
  blocking: boolean;
}) {
  const d = glassPath(shape, w);
  const dust = useDust(w);
  const glassH = shape.bottom - shape.topMid;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <clipPath id="cg-glass">
          <path d={d} />
        </clipPath>
        <linearGradient id="cg-cabin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#080b12" />
          <stop offset="0.6" stopColor="#0c1019" />
          <stop offset="1" stopColor="#11161f" />
        </linearGradient>
        <linearGradient id="cg-streak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbe8ff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#dbe8ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#dbe8ff" stopOpacity="0.055" />
          <stop offset="0.56" stopColor="#dbe8ff" stopOpacity="0.015" />
          <stop offset="0.6" stopColor="#dbe8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cg-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cg-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity="0.07" />
          <stop offset="0.06" stopColor="#cfe0ff" stopOpacity="0" />
          <stop offset="0.94" stopColor="#cfe0ff" stopOpacity="0" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0.07" />
        </linearGradient>
        <radialGradient id="cg-bloom" cx="0.5" cy="1" r="0.5">
          <stop offset="0" stopColor="#7fb4ff" stopOpacity="0.13" />
          <stop offset="1" stopColor="#7fb4ff" stopOpacity="0" />
        </radialGradient>
        <filter id="cg-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* 유리 안쪽: 반사광·불빛 번짐·먼지 */}
      <g clipPath="url(#cg-glass)" opacity={reflect}>
        <rect x={0} y={0} width={w} height={h} fill="url(#cg-streak)" />
        <rect
          x={0}
          y={shape.topMid}
          width={w}
          height={Math.max(1, glassH * 0.22)}
          fill="url(#cg-top)"
        />
        <rect
          x={shape.x0}
          y={0}
          width={shape.x1 - shape.x0}
          height={h}
          fill="url(#cg-side)"
        />
        <ellipse
          cx={w / 2}
          cy={shape.bottom}
          rx={w * 0.34}
          ry={Math.max(20, glassH * 0.16)}
          fill="url(#cg-bloom)"
        />
        <g filter="url(#cg-soft)">
          {dust.map((p) => (
            <circle
              key={p.i}
              cx={p.x}
              cy={shape.topMid + p.y * glassH}
              r={p.r}
              fill="#e8f0ff"
              opacity={p.o}
            />
          ))}
        </g>
      </g>

      {/* 유리 바깥: 선실 천장과 기둥 */}
      <g opacity={frame}>
        <path
          d={`M 0 0 H ${w} V ${h} H 0 Z ${d}`}
          fillRule="evenodd"
          fill="url(#cg-cabin)"
          style={{ pointerEvents: blocking ? "visiblePainted" : "none" }}
        />
        {/* 유리 테두리: 안쪽 그림자 + 얇은 빛 */}
        <path
          d={d}
          fill="none"
          stroke="#000"
          strokeOpacity="0.7"
          strokeWidth="5"
        />
        <path
          d={d}
          fill="none"
          stroke="#bcd3ff"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

/** 유리 위 먼지 자리(화면 크기마다 한 번만) */
function useDust(w: number) {
  return useMemo(() => {
    let a = 11;
    const rand = () => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    };
    return Array.from({ length: 46 }, (_, i) => ({
      i,
      x: rand() * w,
      y: rand(),
      r: 0.5 + rand() * 1.3,
      o: 0.05 + rand() * 0.12,
    }));
  }, [w]);
}
