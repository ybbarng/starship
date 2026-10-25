"use client";

// 창틀(가장자리만 얇게)과, 갑판을 내려다볼 때 투명해지는 조종석 바닥 유리.

/** 앞 유리 테두리: 위 모서리를 둥글게 깎은 얇은 틀과 유리 반사. 창을 최대한 넓게 둔다. */
export function WindowFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden>
      {/* 유리 반사 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgb(160 220 255 / 0.05) 0%, transparent 22%, transparent 64%, rgb(160 220 255 / 0.035) 72%, transparent 80%)",
        }}
      />
      {/* 가장자리 그늘 */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 120px rgb(0 0 0 / 0.55), inset 0 -40px 60px -20px rgb(0 0 0 / 0.5)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="hud-strut" x1="0" x2="1">
            <stop offset="0" stopColor="#0a0f1c" />
            <stop offset="0.6" stopColor="#1c2640" />
            <stop offset="1" stopColor="#0d1324" />
          </linearGradient>
        </defs>
        {/* 왼쪽·오른쪽 기둥: 아래로 갈수록 넓어지는 좁은 띠 */}
        <path d="M0 0 H22 Q10 300 30 600 H0 Z" fill="url(#hud-strut)" />
        <path
          d="M1000 0 H978 Q990 300 970 600 H1000 Z"
          fill="url(#hud-strut)"
        />
        <path
          d="M22 0 Q10 300 30 600"
          fill="none"
          stroke="#a6fbff"
          strokeOpacity="0.18"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M978 0 Q990 300 970 600"
          fill="none"
          stroke="#a6fbff"
          strokeOpacity="0.18"
          vectorEffect="non-scaling-stroke"
        />
        {/* 위 테 */}
        <rect x="0" y="0" width="1000" height="4" fill="#0d1324" />
      </svg>
    </div>
  );
}

/**
 * 조종석 바닥: 처음엔 불투명한 금속 판이고, 고개를 숙이면 유리처럼 투명해진다.
 * clear 0 = 금속, 1 = 거의 투명(틀만 남음).
 */
export function GlassFloor({
  clear,
  visible,
}: {
  clear: number;
  visible: number;
}) {
  const metal = 1 - clear;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ opacity: Math.min(1, visible * 2) }}
      aria-hidden
    >
      {/* 금속 판 */}
      <div
        className="absolute inset-0"
        style={{
          opacity: metal,
          background:
            "repeating-linear-gradient(90deg, #121a2c 0 340px, #0a0f1c 340px 343px), linear-gradient(180deg, #161f35, #0b101d)",
        }}
      />
      {/* 유리 반사 띠 */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.25 + clear * 0.35,
          background:
            "linear-gradient(105deg, transparent 8%, rgb(166 251 255 / 0.07) 14%, transparent 22%, transparent 58%, rgb(166 251 255 / 0.05) 63%, transparent 70%)",
        }}
      />
      {/* 바닥 유리 틀: 가장자리 + 가운데 기둥 */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        <rect
          x="4"
          y="4"
          width="992"
          height="392"
          rx="14"
          fill="none"
          stroke="#a6fbff"
          strokeOpacity={0.12 + clear * 0.2}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <rect x="495" y="0" width="10" height="400" fill="#0b1221" />
        <line
          x1="495"
          x2="495"
          y1="0"
          y2="400"
          stroke="#a6fbff"
          strokeOpacity="0.25"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="505"
          x2="505"
          y1="0"
          y2="400"
          stroke="#a6fbff"
          strokeOpacity="0.25"
          vectorEffect="non-scaling-stroke"
        />
        {/* 판 이음새 나사 */}
        {[30, 200, 370].map((y) => (
          <g key={y}>
            <circle cx="500" cy={y} r="2.2" fill="#a6fbff" fillOpacity="0.4" />
            <circle cx="14" cy={y} r="1.6" fill="#a6fbff" fillOpacity="0.3" />
            <circle cx="986" cy={y} r="1.6" fill="#a6fbff" fillOpacity="0.3" />
          </g>
        ))}
      </svg>
    </div>
  );
}
