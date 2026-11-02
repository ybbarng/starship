"use client";

// 살아 있는 지도: 승무원이 새 땅으로 걸어가고, 완공된 땅에 폭죽이 터지고, 나를 기다리면 말풍선이 뜬다.
// 무엇이 바뀌었는지는 seen.ts가 고른다. 설계: docs/frontier.md "살아 있는 지도".
import { useEffect, useState } from "react";
import type { Crew } from "@/protocol/v1";
import { markBusy } from "@/ui/kit/pace";
import styles from "./frontier.module.css";

type P = { x: number; y: number };

export const WALK_MS = 2400;
export const PARTY_MS = 2200;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * 걷는 승무원. 자리는 땅 좌표(착륙선 0,0, 칸 반지름 1)로 받아 매 프레임 화면으로 옮긴다
 * (걷는 동안 지도를 끌거나 확대해도 땅을 따라간다). 걷는 동안 통통 튄다.
 */
export function Walker({
  from,
  to,
  t0,
  ox,
  oy,
  s,
  size,
  lift,
  children,
}: {
  from: P;
  to: P;
  t0: number;
  ox: number;
  oy: number;
  s: number;
  size: number;
  /** 발이 땅 칸 가운데보다 얼마나 아래 있나(화면 px) */
  lift: number;
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    markBusy(WALK_MS + 200);
    let id = requestAnimationFrame(function step(t) {
      setNow(t);
      if (t - t0 < WALK_MS) id = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [t0]);
  const k = Math.min(1, Math.max(0, (now - t0) / WALK_MS));
  const e = ease(k);
  const x = ox + (from.x + (to.x - from.x) * e) * s;
  const y = oy + (from.y + (to.y - from.y) * e) * s;
  const hop = k < 1 ? Math.abs(Math.sin(k * Math.PI * 7)) * size * 0.14 : 0;
  // 가는 쪽을 바라본다(왼쪽으로 가면 뒤집는다)
  const flip = to.x < from.x ? -1 : 1;
  return (
    <g pointerEvents="none" data-walker>
      <ellipse
        cx={x}
        cy={y + lift * 0.84}
        rx={size * 0.28 * (1 - hop / size)}
        ry={size * 0.08}
        fill="#000"
        opacity="0.3"
      />
      <g
        transform={`translate(${x} ${y + lift - size * 1.25 - hop}) scale(${flip} 1) translate(${-size / 2} 0)`}
      >
        {children}
      </g>
    </g>
  );
}

/** 완공 폭죽: 땅 가운데서 불꽃이 퍼지고 "완공!"이 떠오른다. 한 번만. */
export function Party({ x, y, s }: { x: number; y: number; s: number }) {
  useEffect(() => {
    markBusy(PARTY_MS + 200);
  }, []);
  const r = Math.max(18, Math.min(60, s * 1.6));
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const d = r * (0.8 + (i % 3) * 0.2);
    return {
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d * 0.8 - r * 0.25,
      c: ["#ffd84a", "#8fe8b4", "#7ce0ff", "#ff9f5c"][i % 4],
    };
  });
  return (
    <g pointerEvents="none" data-party>
      <circle
        className={styles.partyRing}
        cx={x}
        cy={y}
        r={r * 0.9}
        fill="none"
        stroke="#8fe8b4"
        strokeWidth="2"
      />
      {sparks.map((p, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 불꽃 차례
          key={i}
          className={styles.spark}
          cx={x}
          cy={y}
          r={Math.max(1.8, s * 0.07)}
          fill={p.c}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
      <text
        className={styles.partyText}
        x={x}
        y={y - r * 0.55}
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#d6ffe6"
        stroke="#0b2417"
        strokeWidth="3"
        paintOrder="stroke"
      >
        완공!
      </text>
    </g>
  );
}

/** 나를 기다리는 것이 있으면 승무원 머리 위에 "! n" */
export function WaitBubble({
  x,
  y,
  crew,
}: {
  x: number;
  y: number;
  crew?: Crew;
}) {
  const n = crew?.desk?.waiting ?? 0;
  if (!n) return null;
  const label = `! ${n}`;
  const w = 14 + label.length * 6.5;
  return (
    <g pointerEvents="none" className={styles.bob} data-wait-bubble>
      <title>{`나를 기다리는 것 ${n}개 · 옆판 '할 일'`}</title>
      <path
        d={`M${x - 3} ${y + 8}L${x} ${y + 13}L${x + 3} ${y + 8}Z`}
        fill="#ffd84a"
      />
      <rect
        x={x - w / 2}
        y={y - 9}
        width={w}
        height={18}
        rx={9}
        fill="#ffd84a"
        stroke="#7a5a00"
        strokeWidth="1"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#1a1405"
      >
        {label}
      </text>
    </g>
  );
}
