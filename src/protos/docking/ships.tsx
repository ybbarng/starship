"use client";

// 교신선 네 가지. 출처마다 모양과 색이 다르고, 늘 같은 항구 별 쪽에서 온다.
// 모두 옆에서 본 모습(코는 오른쪽, 엔진은 왼쪽, 도킹 어댑터는 배 아래 가운데).
import { useId } from "react";

export type ShipKind = "chat" | "issue" | "review" | "doc";

export const SHIP: Record<
  ShipKind,
  {
    /** 배 이름 */
    name: string;
    /** 출처 이름(서비스 이름이 없을 때) */
    source: string;
    /** 항구 별 */
    star: string;
    ra: number;
    dec: number;
    color: string;
  }
> = {
  chat: {
    name: "둥근 셔틀",
    source: "채팅",
    star: "시리우스",
    ra: 101.287,
    dec: -16.716,
    color: "#b896ff",
  },
  issue: {
    name: "화살 쾌속선",
    source: "이슈",
    star: "베가",
    ra: 279.235,
    dec: 38.784,
    color: "#6ee7d8",
  },
  review: {
    name: "갈고리 견인선",
    source: "코드 리뷰",
    star: "알타이르",
    ra: 297.696,
    dec: 8.868,
    color: "#ffb347",
  },
  doc: {
    name: "책장 화물선",
    source: "문서",
    star: "카펠라",
    ra: 79.172,
    dec: 45.998,
    color: "#7cb4ff",
  },
};

export const SHIP_KINDS: ShipKind[] = ["chat", "issue", "review", "doc"];

export function shipKindOf(sourceKind: string): ShipKind {
  return sourceKind === "issue" ||
    sourceKind === "review" ||
    sourceKind === "doc"
    ? sourceKind
    : "chat";
}

export function Ship({
  kind,
  width = 96,
  flame = true,
  className,
}: {
  kind: ShipKind;
  width?: number;
  /** 엔진 불꽃 */
  flame?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const c = SHIP[kind].color;
  return (
    <svg
      viewBox="0 0 120 60"
      width={width}
      height={width / 2}
      className={className}
      role="img"
      aria-label={SHIP[kind].name}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={c} stopOpacity="1" />
          <stop offset="1" stopColor="#141a2c" stopOpacity="1" />
        </linearGradient>
        <radialGradient id={`f${uid}`} cx="1" cy="0.5" r="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.35" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f6ff" />
          <stop offset="1" stopColor="#5f7aa8" />
        </linearGradient>
      </defs>
      {flame && (
        <g className="dk-flame">
          <ellipse
            cx="6"
            cy={kind === "issue" ? 27 : 27}
            rx="16"
            ry="5.5"
            fill={`url(#f${uid})`}
          />
        </g>
      )}
      {/* 도킹 어댑터: 포트에 꽂히는 짧은 목 */}
      <rect x="52" y="44" width="16" height="12" rx="2" fill="#56607c" />
      <rect x="49" y="54" width="22" height="4" rx="1.5" fill="#8a96b4" />
      {kind === "chat" && <ChatHull uid={uid} c={c} />}
      {kind === "issue" && <IssueHull uid={uid} c={c} />}
      {kind === "review" && <ReviewHull uid={uid} c={c} />}
      {kind === "doc" && <DocHull uid={uid} c={c} />}
    </svg>
  );
}

function ChatHull({ uid, c }: { uid: string; c: string }) {
  return (
    <g>
      {/* 꼬리 날개 */}
      <path d="M22 18 L10 6 L30 14 Z" fill={c} opacity="0.85" />
      <path d="M22 38 L10 50 L30 40 Z" fill={c} opacity="0.7" />
      <rect x="14" y="21" width="10" height="12" rx="3" fill="#3b4260" />
      <ellipse
        cx="62"
        cy="27"
        rx="42"
        ry="19"
        fill={`url(#b${uid})`}
        stroke="#1b2033"
        strokeWidth="1.5"
      />
      {/* 가운데 띠 */}
      <path
        d="M22 30 Q62 40 103 30"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="2"
        fill="none"
      />
      {/* 앞 유리 돔 */}
      <path
        d="M78 14 Q100 14 103 26 L80 26 Z"
        fill={`url(#g${uid})`}
        stroke="#1b2033"
        strokeWidth="1"
      />
      {/* 둥근 창 셋 */}
      {[38, 50, 62].map((x) => (
        <g key={x}>
          <circle cx={x} cy="24" r="4.2" fill="#1b2033" />
          <circle cx={x} cy="24" r="3" fill="#ffe9a8" opacity="0.9" />
        </g>
      ))}
      {/* 안테나 */}
      <path d="M58 8 L56 0" stroke="#c9d2ea" strokeWidth="1.2" />
      <circle cx="55.6" cy="0" r="1.8" fill={c} className="dk-blink" />
    </g>
  );
}

function IssueHull({ uid, c }: { uid: string; c: string }) {
  return (
    <g>
      {/* 등지느러미 */}
      <path d="M40 22 L56 6 L70 22 Z" fill={c} opacity="0.8" />
      {/* 납작한 화살 몸통 */}
      <path
        d="M14 20 L44 16 L118 28 L44 40 L14 36 L22 28 Z"
        fill={`url(#b${uid})`}
        stroke="#14202a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 아래 날개 */}
      <path
        d="M44 38 L30 50 L64 38 Z"
        fill={c}
        opacity="0.65"
        stroke="#14202a"
        strokeWidth="1"
      />
      {/* 줄무늬 */}
      <path d="M30 28 L104 28" stroke="#ffffff" strokeOpacity="0.5" />
      <path d="M48 24 L58 24 M48 32 L58 32" stroke="#14202a" strokeWidth="2" />
      {/* 좁은 조종석 창 */}
      <path
        d="M84 24 L104 27 L84 27 Z"
        fill={`url(#g${uid})`}
        stroke="#14202a"
        strokeWidth="0.8"
      />
      <rect x="14" y="23" width="9" height="10" rx="2" fill="#2d3a48" />
    </g>
  );
}

function ReviewHull({ uid, c }: { uid: string; c: string }) {
  return (
    <g>
      {/* 갈고리 팔 */}
      <path
        d="M84 18 L104 8 L112 14"
        stroke="#9aa3b8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M112 14 L112 28" stroke="#c9ced9" strokeWidth="1.4" />
      <path
        d="M112 28 Q112 36 106 35 Q102 34 103 30"
        stroke={c}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="104" cy="8" r="3" fill="#59627a" />
      {/* 네모난 몸통 */}
      <rect
        x="14"
        y="14"
        width="72"
        height="30"
        rx="6"
        fill="#3a4152"
        stroke="#141821"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="14"
        width="72"
        height="12"
        rx="6"
        fill={`url(#b${uid})`}
        opacity="0.55"
      />
      {/* 경고 줄무늬 */}
      <g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M${20 + i * 10} 44 L${26 + i * 10} 36 L${31 + i * 10} 36 L${25 + i * 10} 44 Z`}
            fill={c}
          />
        ))}
      </g>
      {/* 높은 조종실 */}
      <rect
        x="48"
        y="3"
        width="30"
        height="14"
        rx="3"
        fill="#2b313f"
        stroke="#141821"
        strokeWidth="1.2"
      />
      <rect
        x="52"
        y="6"
        width="22"
        height="7"
        rx="1.5"
        fill={`url(#g${uid})`}
      />
      <rect x="8" y="20" width="8" height="16" rx="2" fill="#262b38" />
      <circle cx="30" cy="25" r="2.4" fill="#ff5f5f" className="dk-blink" />
    </g>
  );
}

function DocHull({ uid, c }: { uid: string; c: string }) {
  const books = [
    "#ff8a7a",
    "#ffd36e",
    "#8fe3a1",
    "#9cc6ff",
    "#d9a6ff",
    "#ffb070",
    "#7fe0e0",
  ];
  return (
    <g>
      {/* 기다란 뼈대 */}
      <rect
        x="12"
        y="12"
        width="84"
        height="32"
        rx="3"
        fill="#24314d"
        stroke="#121a2c"
        strokeWidth="1.5"
      />
      {/* 책장 칸 셋 */}
      {[0, 1, 2].map((bay) => (
        <g key={bay}>
          <rect
            x={18 + bay * 25}
            y="15"
            width="22"
            height="26"
            fill="#121a2c"
          />
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 18 + ((bay * 5 + i * 7) % 7);
            return (
              <rect
                key={i}
                x={19.5 + bay * 25 + i * 4.1}
                y={40 - h}
                width="3.4"
                height={h}
                rx="0.6"
                fill={books[(bay * 3 + i) % books.length]}
              />
            );
          })}
          <rect
            x={18 + bay * 25}
            y="27"
            width="22"
            height="1.4"
            fill="#4b5a7c"
          />
        </g>
      ))}
      {/* 위아래 뼈대 띠 */}
      <rect x="12" y="10" width="84" height="4" rx="2" fill={c} />
      <rect x="12" y="42" width="84" height="4" rx="2" fill={c} />
      {/* 둥근 기수 */}
      <path
        d="M96 12 Q118 14 118 28 Q118 42 96 44 Z"
        fill={`url(#b${uid})`}
        stroke="#121a2c"
        strokeWidth="1.5"
      />
      <path d="M101 18 Q112 20 113 28 L101 28 Z" fill={`url(#g${uid})`} />
      <rect x="4" y="20" width="10" height="16" rx="2" fill="#2a3550" />
    </g>
  );
}
