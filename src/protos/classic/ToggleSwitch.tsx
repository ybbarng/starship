"use client";

// 승무원 한 명 = 토글 스위치 하나. 위에 작은 불(초록 일함 · 노랑 깜빡 나를 기다림 · 꺼짐 쉼), 아래 이름 테이프.
import { useState } from "react";
import type { Crew } from "@/protocol/v1";
import { ago, CREW_STATUS_LABEL } from "@/ui/kit";
import styles from "./classic.module.css";

const LAMP: Record<Crew["status"], { fill: string; glow?: string }> = {
  working: { fill: "#5ee08a", glow: "rgba(94,224,138,0.75)" },
  "needs-you": { fill: "#ffd84a", glow: "rgba(255,216,74,0.9)" },
  idle: { fill: "#39404c" },
  off: { fill: "#262a32" },
};

export function ToggleSwitch({
  crew,
  now,
  onOpen,
}: {
  crew: Crew;
  now: number;
  onOpen: () => void;
}) {
  // 누르면 손잡이가 한 번 넘어갔다 돌아온다(누른 느낌)
  const [flick, setFlick] = useState(false);
  const up = crew.status !== "off";
  const lamp = LAMP[crew.status];
  const waiting = crew.status === "needs-you";
  const angle = flick ? (up ? 180 : 0) : up ? 0 : 180;
  return (
    <button
      type="button"
      data-crew={crew.id}
      title={`${crew.name} · ${CREW_STATUS_LABEL[crew.status]}${crew.activity ? ` · ${crew.activity}` : ""}`}
      onClick={() => {
        setFlick(true);
        window.setTimeout(() => setFlick(false), 260);
        onOpen();
      }}
      className="group flex min-w-0 flex-col items-center gap-0.5 rounded-md px-0 pt-0.5 pb-1 outline-none hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-white/40"
    >
      <svg viewBox="0 0 44 68" width={34} height={52} aria-hidden>
        <defs>
          <radialGradient id={`lamp-${crew.id}`} cx="0.4" cy="0.35" r="0.7">
            <stop
              offset="0"
              stopColor="#fff"
              stopOpacity={lamp.glow ? 0.9 : 0.1}
            />
            <stop offset="0.45" stopColor={lamp.fill} />
            <stop offset="1" stopColor={lamp.fill} stopOpacity={0.85} />
          </radialGradient>
        </defs>
        {/* 불 */}
        <circle cx={22} cy={8} r={6.5} fill="#0b0d12" />
        {lamp.glow && (
          <circle
            cx={22}
            cy={8}
            r={9}
            fill={lamp.glow}
            opacity={0.35}
            className={waiting ? styles.blink : undefined}
          />
        )}
        <circle
          cx={22}
          cy={8}
          r={5}
          fill={`url(#lamp-${crew.id})`}
          className={waiting ? styles.blink : undefined}
        />
        {/* 바탕 판 */}
        <rect
          x={9}
          y={20}
          width={26}
          height={38}
          rx={4}
          fill="#353c49"
          stroke="#0d1016"
        />
        <rect
          x={10}
          y={21}
          width={24}
          height={2}
          rx={1}
          fill="#fff"
          opacity={0.1}
        />
        <circle cx={12.5} cy={23.5} r={1.1} fill="#141820" />
        <circle cx={31.5} cy={54.5} r={1.1} fill="#141820" />
        {/* 육각 너트 */}
        <polygon
          points="22,31 29,35 29,43 22,47 15,43 15,35"
          fill="#8a93a3"
          stroke="#2a2f39"
        />
        <circle cx={22} cy={39} r={4.2} fill="#5d6574" />
        {/* 손잡이 */}
        <g
          className={styles.lever}
          style={{
            transformOrigin: "22px 39px",
            transformBox: "view-box",
            transform: `rotate(${angle}deg)`,
          }}
        >
          <path d="M19.6,39 L20.7,22 H23.3 L24.4,39 Z" fill="#c9d0db" />
          <path
            d="M21,39 L21.4,22 H22.4 L22.6,39 Z"
            fill="#fff"
            opacity={0.6}
          />
          <circle cx={22} cy={21} r={4} fill="#e4e8ef" stroke="#7d8696" />
          <circle cx={20.8} cy={19.9} r={1.4} fill="#fff" />
        </g>
      </svg>
      {/* 이름 테이프 */}
      <span
        className="block max-w-full truncate rounded-[2px] bg-[#0b0c0f] px-1 py-px text-[10px] leading-tight font-medium tracking-[-0.03em] text-[#eef1f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_1px_rgba(0,0,0,0.6)]"
        style={{ opacity: crew.status === "off" ? 0.55 : 1 }}
      >
        {crew.name}
      </span>
      <span
        className={`h-3 text-[10px] leading-3 ${waiting ? "font-semibold text-[#ffd84a]" : "text-white/35"}`}
      >
        {waiting
          ? `${crew.since ? ago(crew.since, now) : ""} 기다림`
          : crew.status === "working"
            ? "일함"
            : crew.status === "idle"
              ? "쉼"
              : "꺼짐"}
      </span>
    </button>
  );
}
