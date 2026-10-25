import { type CSSProperties, useState } from "react";
import {
  between,
  type Direction,
  pick,
  type SceneProps,
  Traveler,
  useSvgId,
} from "./common";

function flip(dir: Direction) {
  return dir === "rtl" ? { transform: "scaleX(-1)" } : undefined;
}

/* ───────────── 혜성: 휘는 먼지 꼬리와 곧은 이온 꼬리 ───────────── */

export function CometScene({ durationMs, rand, reduced }: SceneProps) {
  const [cfg] = useState(() => ({
    dir: pick(rand, ["ltr", "rtl"] as const),
    y: between(rand, 0.02, 0.45),
    drift: between(rand, 10, 50),
  }));
  const id = useSvgId("comet");
  const W = 560;
  return (
    <Traveler
      width={W}
      height={220}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      {/* 해는 가는 쪽 너머에 있다고 보고, 두 꼬리는 해 반대쪽으로 뻗는다 */}
      <svg
        width={W}
        height={220}
        viewBox="0 0 560 220"
        style={{ ...flip(cfg.dir), overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <linearGradient
            id={id("ion")}
            gradientUnits="userSpaceOnUse"
            x1="500"
            y1="110"
            x2="20"
            y2="70"
          >
            <stop offset="0%" stopColor="#d4ecff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#7fb8ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#4a6dff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={id("dust")}
            gradientUnits="userSpaceOnUse"
            x1="500"
            y1="110"
            x2="90"
            y2="185"
          >
            <stop offset="0%" stopColor="#fff8e6" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#ffe3b0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffc98a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id("coma")}>
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor="#e6f6ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#8fd0ff" stopOpacity="0" />
          </radialGradient>
          <filter id={id("soft")} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id={id("thin")} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        </defs>

        {/* 먼지 꼬리: 넓고 노르스름하며 지나온 길 쪽으로 휜다 */}
        <path
          d="M500 103 C 400 104 260 122 70 182 C 120 200 205 198 262 188 C 362 168 440 134 500 117 Z"
          fill={`url(#${id("dust")})`}
          filter={`url(#${id("soft")})`}
        />
        <path
          d="M500 108 C 400 114 280 136 150 178"
          fill="none"
          stroke={`url(#${id("dust")})`}
          strokeWidth="5"
          filter={`url(#${id("soft")})`}
          opacity="0.7"
        />

        {/* 이온 꼬리: 가늘고 푸르며 곧게 뻗는다 */}
        <g filter={`url(#${id("thin")})`}>
          <path
            d="M500 107 L 20 66 L 20 76 L 500 113 Z"
            fill={`url(#${id("ion")})`}
          />
          <path
            d="M500 110 L 60 52"
            stroke={`url(#${id("ion")})`}
            strokeWidth="1"
            opacity="0.6"
          />
          <path
            d="M500 110 L 90 88"
            stroke={`url(#${id("ion")})`}
            strokeWidth="0.8"
            opacity="0.5"
          />
        </g>

        {/* 머리(코마)와 핵 */}
        <circle
          className="ev-twinkle"
          cx="500"
          cy="110"
          r="30"
          fill={`url(#${id("coma")})`}
        />
        <circle cx="500" cy="110" r="3.4" fill="#ffffff" />
      </svg>
    </Traveler>
  );
}

/* ───────────── 유성우: 한 점(복사점)에서 퍼지는 줄기들 ───────────── */

interface Streak {
  angle: number;
  d0: number;
  d1: number;
  len: number;
  delay: number;
  dur: number;
  tint: string;
  width: number;
}

export function MeteorsScene({ durationMs, rand, reduced }: SceneProps) {
  const [cfg] = useState(() => {
    const total = (durationMs - 1400) / 1000;
    const count = 64;
    const streaks: Streak[] = Array.from({ length: count }, (_, i) => {
      const bright = rand() < 0.2;
      return {
        // 복사점이 창 위쪽에 있으니 줄기는 주로 옆과 아래로 퍼진다
        angle: between(rand, -15, 195),
        d0: between(rand, 20, 150),
        d1: 0,
        len: bright ? between(rand, 150, 230) : between(rand, 70, 150),
        // 고르게 흩어 두되 처음 몇 개는 바로 떨어지게 한다
        delay: i < 5 ? 0.15 + i * 0.2 : between(rand, 0.3, total),
        dur: bright ? between(rand, 1.4, 2) : between(rand, 1.1, 1.7),
        tint: bright
          ? pick(rand, ["#c8ffd9", "#fff1c4", "#ffffff"])
          : pick(rand, ["#dbe8ff", "#ffffff", "#e9e2ff"]),
        width: bright ? 2.8 : between(rand, 1.5, 2.2),
      };
    }).map((s) => ({ ...s, d1: s.d0 + between(rand, 110, 220) }));
    return {
      x: between(rand, 35, 65),
      y: between(rand, 6, 18),
      streaks,
    };
  });
  return (
    <div className="absolute inset-0">
      {cfg.streaks.map((s) => (
        <div
          key={`${s.angle}-${s.delay}`}
          className="absolute"
          style={{
            left: `${cfg.x}%`,
            top: `${cfg.y}%`,
            width: 0,
            height: 0,
            transform: `rotate(${s.angle}deg)`,
          }}
        >
          <div
            className={reduced ? "ev-streak-still" : "ev-streak"}
            style={
              {
                position: "absolute",
                left: 0,
                top: -s.width / 2,
                width: s.len,
                height: s.width,
                borderRadius: s.width,
                transformOrigin: "100% 50%",
                background: `linear-gradient(90deg, transparent, ${s.tint})`,
                "--d0": `${s.d0}px`,
                "--d1": `${s.d1}px`,
                "--delay": `${s.delay}s`,
                "--sd": `${s.dur}s`,
                ...(reduced
                  ? { transform: `translateX(${s.d1 - s.len}px)` }
                  : {}),
              } as CSSProperties
            }
          >
            <span
              className="absolute rounded-full"
              style={{
                right: -s.width,
                top: -s.width / 2,
                width: s.width * 2,
                height: s.width * 2,
                background: "#fff",
                boxShadow: `0 0 ${4 + s.width * 2}px ${s.width}px ${s.tint}`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── 우주정거장이 달 앞을 빠르게 지나감 ───────────── */

export function StationScene({ durationMs, rand, reduced }: SceneProps) {
  const [cfg] = useState(() => ({
    x: between(rand, 52, 74),
    tilt: pick(rand, [1, -1] as const),
  }));
  const id = useSvgId("moon");
  const D = 210;
  return (
    <div
      className="absolute"
      style={
        {
          "--dur": `${durationMs}ms`,
          left: `calc(${cfg.x}% - ${D / 2}px)`,
          top: 26,
          width: D,
          height: D,
        } as CSSProperties
      }
    >
      <svg
        width={D}
        height={D}
        className="ev-moon"
        viewBox="0 0 200 200"
        style={{ filter: "drop-shadow(0 0 26px rgba(240,236,220,.22))" }}
        aria-hidden
      >
        <defs>
          <radialGradient id={id("disk")} cx="42%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#f6f4ee" />
            <stop offset="70%" stopColor="#d9d5ca" />
            <stop offset="100%" stopColor="#aaa596" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill={`url(#${id("disk")})`} />
        <g fill="#9e998b" opacity="0.42">
          <ellipse
            cx="70"
            cy="70"
            rx="28"
            ry="20"
            transform="rotate(-20 70 70)"
          />
          <ellipse cx="112" cy="58" rx="20" ry="14" />
          <ellipse
            cx="128"
            cy="96"
            rx="26"
            ry="18"
            transform="rotate(15 128 96)"
          />
          <ellipse cx="86" cy="120" rx="18" ry="22" />
          <ellipse cx="60" cy="140" rx="12" ry="9" />
        </g>
        <g fill="none" stroke="#bdb8aa" strokeWidth="1.2" opacity="0.7">
          <circle cx="118" cy="156" r="7" />
          <circle cx="146" cy="130" r="4" />
          <circle cx="44" cy="96" r="5" />
        </g>
      </svg>

      {/* 정거장은 달 한가운데를 지나가는 길을 탄다 */}
      <div
        className="absolute"
        style={{ left: D / 2 - 66, top: D / 2 - 33, width: 132, height: 66 }}
      >
        <div style={{ transform: cfg.tilt < 0 ? "scaleY(-1)" : undefined }}>
          <div className={reduced ? "ev-moon" : "ev-iss"}>
            <div style={{ transform: cfg.tilt < 0 ? "scaleY(-1)" : undefined }}>
              <StationSilhouette />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 햇빛을 받은 정거장. 달 앞에서는 짙은 전지판이, 어두운 하늘에서는 밝은 몸체가 보인다. */
function StationSilhouette() {
  const wings = [10, 24, 87, 101];
  return (
    <svg
      width="132"
      height="66"
      viewBox="0 0 120 60"
      style={{ filter: "drop-shadow(0 0 3px rgba(255,236,190,.35))" }}
      aria-hidden
    >
      {wings.map((x) => (
        <g key={x}>
          <rect
            x={x}
            y="4"
            width="10"
            height="22"
            fill="#26345a"
            stroke="#e9c97e"
            strokeWidth="0.8"
          />
          <rect
            x={x}
            y="34"
            width="10"
            height="22"
            fill="#26345a"
            stroke="#e9c97e"
            strokeWidth="0.8"
          />
          <path
            d={`M${x} 11.3 h10 M${x} 18.6 h10 M${x} 41.3 h10 M${x} 48.6 h10`}
            stroke="#e9c97e"
            strokeOpacity="0.45"
            strokeWidth="0.5"
          />
          <path
            d={`M${x + 5} 26 L ${x + 5} 34`}
            stroke="#c9ccd3"
            strokeWidth="1"
          />
        </g>
      ))}
      <rect x="6" y="28" width="108" height="4" fill="#c9ccd3" />
      <rect x="38" y="35" width="6" height="15" fill="#eef0f4" />
      <rect x="76" y="35" width="6" height="15" fill="#eef0f4" />
      <rect
        x="46"
        y="22"
        width="28"
        height="16"
        rx="3"
        fill="#f4f5f7"
        stroke="#8d939e"
        strokeWidth="0.6"
      />
      <rect
        x="56"
        y="12"
        width="9"
        height="36"
        rx="2.5"
        fill="#e3e6eb"
        stroke="#8d939e"
        strokeWidth="0.6"
      />
      <circle className="ev-blink" cx="74" cy="23" r="1.4" fill="#ff5a5a" />
    </svg>
  );
}

/* ───────────── 오우무아무아처럼 길쭉한 성간 천체 ───────────── */

export function OumuamuaScene({ durationMs, rand, reduced }: SceneProps) {
  const [cfg] = useState(() => ({
    dir: pick(rand, ["ltr", "rtl"] as const),
    y: between(rand, 0.05, 0.8),
    drift: between(rand, -50, 50),
  }));
  const id = useSvgId("oumua");
  const W = 240;
  return (
    <Traveler
      width={W}
      height={240}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      <svg
        width={W}
        height={240}
        viewBox="0 -60 240 240"
        style={flip(cfg.dir)}
        aria-hidden
      >
        <defs>
          <linearGradient id={id("rock")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc9a78" />
            <stop offset="45%" stopColor="#9a553b" />
            <stop offset="100%" stopColor="#4a261c" />
          </linearGradient>
        </defs>
        <g className="ev-tumble">
          <g className="ev-squash">
            <path
              d="M22 62 C 25 50 56 43 96 42 C 120 40 150 39 178 43 C 200 46 214 50 220 57 C 225 63 220 70 210 73 C 182 80 142 80 104 79 C 66 79 34 77 24 69 C 21 67 21 64 22 62 Z"
              fill={`url(#${id("rock")})`}
            />
            <path
              d="M30 56 C 60 45 120 41 178 44 C 198 46 212 50 218 56"
              fill="none"
              stroke="#f4c3a4"
              strokeOpacity="0.55"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <g fill="#5e3022" opacity="0.55">
              <ellipse cx="70" cy="62" rx="9" ry="4.5" />
              <ellipse cx="132" cy="57" rx="6" ry="3.4" />
              <ellipse cx="170" cy="66" rx="10" ry="4" />
              <circle cx="104" cy="70" r="2.6" />
              <circle cx="198" cy="58" r="2.2" />
            </g>
            <path
              d="M40 72 C 80 76 140 77 206 70"
              fill="none"
              stroke="#2b140e"
              strokeOpacity="0.45"
              strokeWidth="3"
            />
          </g>
        </g>
      </svg>
    </Traveler>
  );
}
