import { useEffect, useState } from "react";
import {
  Bubble,
  between,
  type Direction,
  pick,
  type SceneProps,
  Traveler,
  useSvgId,
} from "./common";

/** 누른 뒤 반응을 잠깐 보여 주는 상태. 다시 누르면 처음부터 다시 보여 준다. */
function usePoke(onPoke: () => void, ms = 2600) {
  const [poke, setPoke] = useState(0);
  useEffect(() => {
    if (!poke) return;
    const t = window.setTimeout(() => setPoke(0), ms);
    return () => window.clearTimeout(t);
  }, [poke, ms]);
  return {
    poked: poke > 0,
    pokeKey: poke,
    handle: () => {
      setPoke(Date.now());
      onPoke();
    },
  };
}

function flip(dir: Direction) {
  return dir === "rtl" ? { transform: "scaleX(-1)" } : undefined;
}

/* ───────────── 모아: 소라껍데기 배를 탄 투명한 해파리 ───────────── */

const MOA_TENTACLES = [74, 87, 100, 116, 129, 142];
const MOA_COLORS = [
  "#ff7eb6",
  "#ffb35c",
  "#ffe066",
  "#7ee8a1",
  "#7cc8ff",
  "#b89cff",
];

export function MoaScene({ durationMs, rand, reduced, onPoke }: SceneProps) {
  const [cfg] = useState(() => ({
    dir: pick(rand, ["ltr", "rtl"] as const),
    y: between(rand, 0.1, 0.75),
    drift: between(rand, -30, 30),
  }));
  const { poked, pokeKey, handle } = usePoke(onPoke);
  const id = useSvgId("moa");
  const W = 170;
  const bubbleSide = cfg.dir === "ltr" ? { left: 120 } : { right: 120 };

  return (
    <Traveler
      width={W}
      height={200}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      <Bubble
        key={pokeKey}
        top={-8}
        tail={cfg.dir === "ltr" ? "left" : "right"}
        {...bubbleSide}
      >
        {poked ? (
          <span className="ev-hue inline-block" style={{ color: "#d0428f" }}>
            뽀록뽀록! 반가워요
          </span>
        ) : (
          <span className="flex items-center gap-[5px] py-[3px]">
            {MOA_COLORS.map((c, i) => (
              <span
                key={c}
                className="ev-glow inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: c, animationDelay: `${i * 0.22}s` }}
              />
            ))}
          </span>
        )}
      </Bubble>
      <button
        type="button"
        className="ev-poke"
        aria-label="모아에게 인사하기"
        onClick={handle}
      >
        <div
          key={pokeKey}
          className={poked ? "ev-flash" : undefined}
          style={{ filter: "drop-shadow(0 0 10px rgba(255,170,230,.45))" }}
        >
          <svg
            width={W}
            height={200}
            viewBox="0 0 170 200"
            style={flip(cfg.dir)}
            aria-hidden
          >
            <defs>
              <radialGradient id={id("bell")} cx="40%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
                <stop offset="45%" stopColor="#ff9ad5" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#9d7bff" stopOpacity="0.32" />
              </radialGradient>
              <linearGradient id={id("hull")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff3e4" />
                <stop offset="55%" stopColor="#f6bf9b" />
                <stop offset="100%" stopColor="#d4876c" />
              </linearGradient>
            </defs>

            {/* 지나간 자리에 남는 작은 물방울 */}
            {[0, 0.7, 1.4].map((d, i) => (
              <circle
                key={d}
                className="ev-trail"
                cx={14 + i * 6}
                cy={132 - i * 6}
                r={3 - i * 0.6}
                fill="#ffe2f2"
                style={{ animationDelay: `${d}s` }}
              />
            ))}

            <g className="ev-rock">
              {/* 소라껍데기 배 */}
              <path
                d="M8 150 C 18 132 40 124 70 124 L 150 124 C 163 124 167 133 160 145 C 150 170 118 183 84 183 C 48 183 22 172 8 150 Z"
                fill={`url(#${id("hull")})`}
                stroke="#b9705a"
                strokeOpacity="0.5"
              />
              <path
                d="M40 152 m -14 0 a 14 14 0 1 1 14 14 a 9 9 0 1 1 -9 -9 a 4.5 4.5 0 1 1 4.5 4.5"
                fill="none"
                stroke="#c27b62"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.75"
              />
              {[78, 98, 118, 138].map((x) => (
                <path
                  key={x}
                  d={`M${x} 127 C ${x - 4} 148 ${x - 2} 166 ${x + 4} ${180 - (x - 78) / 6}`}
                  fill="none"
                  stroke="#c98068"
                  strokeWidth="1.4"
                  opacity="0.5"
                />
              ))}
              <ellipse cx="108" cy="125" rx="44" ry="5" fill="#e79a8e" />
              <path
                d="M62 124 L 152 124"
                stroke="#fff7ee"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* 모아 */}
              <g className="ev-bob">
                <g className="ev-hue">
                  {MOA_TENTACLES.map((x, i) => (
                    <path
                      key={x}
                      className={
                        poked && i === MOA_TENTACLES.length - 1
                          ? "ev-wave"
                          : "ev-sway"
                      }
                      style={{ animationDelay: `${-i * 0.37}s` }}
                      d={`M${x} 88 c -5 10 5 18 0 28 c -5 10 5 16 1 ${22 + (i % 2) * 6}`}
                      fill="none"
                      stroke="#f07fd2"
                      strokeOpacity="0.75"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                    />
                  ))}
                  <path
                    d="M66 88 C 64 50 82 26 108 26 C 134 26 152 50 150 88 C 143 94 136 94 129 89 C 122 95 115 95 108 89 C 101 95 94 95 87 89 C 80 95 73 94 66 88 Z"
                    fill={`url(#${id("bell")})`}
                    stroke="#ffe0f4"
                    strokeOpacity="0.85"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M78 82 C 78 58 92 42 108 42 C 124 42 138 58 138 82"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                  />
                </g>
                <ellipse
                  cx="88"
                  cy="44"
                  rx="10"
                  ry="5.5"
                  transform="rotate(-32 88 44)"
                  fill="#ffffff"
                  opacity="0.6"
                />
                <g className="ev-eyeblink">
                  <circle cx="97" cy="64" r="4.4" fill="#2b1840" />
                  <circle cx="121" cy="64" r="4.4" fill="#2b1840" />
                </g>
                <circle cx="98.5" cy="62.4" r="1.5" fill="#fff" />
                <circle cx="122.5" cy="62.4" r="1.5" fill="#fff" />
                <ellipse
                  cx="89"
                  cy="73"
                  rx="5"
                  ry="2.6"
                  fill="#ff6fae"
                  opacity="0.5"
                />
                <ellipse
                  cx="129"
                  cy="73"
                  rx="5"
                  ry="2.6"
                  fill="#ff6fae"
                  opacity="0.5"
                />
                <path
                  d={
                    poked
                      ? "M103 71 Q 109 79 115 71 Z"
                      : "M104 72 Q 109 76 114 72"
                  }
                  fill={poked ? "#2b1840" : "none"}
                  stroke="#2b1840"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          </svg>
        </div>
      </button>
    </Traveler>
  );
}

/* ───────────── 포포: 눈 하나 달린 하늘색 젤리 방울 떼 ───────────── */

function PopoBlob({
  uid,
  startled,
  scale,
}: {
  uid: (n: string) => string;
  startled: boolean;
  scale: number;
}) {
  return (
    <svg width={48 * scale} height={56 * scale} viewBox="0 0 48 56" aria-hidden>
      <defs>
        <linearGradient id={uid("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d2f1ff" />
          <stop offset="45%" stopColor="#7fcfff" />
          <stop offset="100%" stopColor="#3f97e6" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 C 31 15 44 25 44 37 A 20 18 0 0 1 4 37 C 4 25 17 15 24 3 Z"
        fill={`url(#${uid("body")})`}
        fillOpacity="0.93"
        stroke="#e8f8ff"
        strokeOpacity="0.8"
      />
      <ellipse
        cx="15"
        cy="25"
        rx="3.4"
        ry="6"
        transform="rotate(25 15 25)"
        fill="#fff"
        opacity="0.65"
      />
      <circle cx="24" cy="36" r={startled ? 11 : 9.5} fill="#fff" />
      <g className="ev-eyeblink">
        <circle cx="25" cy="37" r={startled ? 3.6 : 5} fill="#14213d" />
      </g>
      <circle cx="27.4" cy="34.4" r="1.8" fill="#fff" />
      <ellipse
        cx="10.5"
        cy="45"
        rx="3.4"
        ry="1.8"
        fill="#ff8fc6"
        opacity="0.5"
      />
      <ellipse
        cx="37.5"
        cy="45"
        rx="3.4"
        ry="1.8"
        fill="#ff8fc6"
        opacity="0.5"
      />
      <path
        d={
          startled
            ? "M22 49.5 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0"
            : "M21 49 Q 24 51.6 27 49"
        }
        fill="none"
        stroke="#14213d"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Popo({
  index,
  scale,
  offsetY,
  onPoke,
}: {
  index: number;
  scale: number;
  offsetY: number;
  onPoke: () => void;
}) {
  const { poked, pokeKey, handle } = usePoke(onPoke, 2000);
  const uid = useSvgId(`popo${index}`);
  return (
    <div
      className="absolute"
      style={{
        left: index * 58,
        bottom: offsetY,
        width: 48 * scale,
        height: 56 * scale,
      }}
    >
      {poked && (
        <Bubble key={pokeKey} top={-112} left={-2}>
          뿅!
        </Bubble>
      )}
      <div
        key={pokeKey}
        className={poked ? "ev-bighop" : "ev-hop"}
        style={{
          animationDelay: poked ? "0s" : `${-index * 0.27}s`,
          filter: poked ? "hue-rotate(125deg) saturate(1.3)" : undefined,
          transformOrigin: "50% 100%",
        }}
      >
        <button
          type="button"
          className="ev-poke"
          aria-label="포포 콕 찌르기"
          onClick={handle}
        >
          <PopoBlob uid={uid} startled={poked} scale={scale} />
        </button>
      </div>
    </div>
  );
}

export function PopoScene({ durationMs, rand, reduced, onPoke }: SceneProps) {
  const [cfg] = useState(() => {
    const count = 5 + Math.floor(rand() * 3);
    return {
      dir: pick(rand, ["ltr", "rtl"] as const),
      y: between(rand, 0.1, 0.85),
      drift: between(rand, -20, 20),
      members: Array.from({ length: count }, () => ({
        scale: between(rand, 0.78, 1.1),
        offsetY: between(rand, 0, 14),
      })),
    };
  });
  const width = cfg.members.length * 58;
  return (
    <Traveler
      width={width}
      height={130}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      {cfg.members.map((m, i) => (
        <Popo
          // biome-ignore lint/suspicious/noArrayIndexKey: 떼의 순서가 곧 자리라 바뀌지 않는다
          key={i}
          index={i}
          scale={m.scale}
          offsetY={m.offsetY}
          onPoke={onPoke}
        />
      ))}
    </Traveler>
  );
}

/* ───────────── 도르: 외바퀴 동그란 청소 로봇 ───────────── */

export function DorScene({ durationMs, rand, reduced, onPoke }: SceneProps) {
  const [cfg] = useState(() => ({
    dir: pick(rand, ["ltr", "rtl"] as const),
    y: between(rand, 0.15, 0.8),
    drift: between(rand, -40, 40),
  }));
  const { poked, pokeKey, handle } = usePoke(onPoke);
  const id = useSvgId("dor");
  const W = 140;
  return (
    <Traveler
      width={W}
      height={130}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      {poked && (
        <Bubble
          key={pokeKey}
          top={-26}
          tail={cfg.dir === "ltr" ? "left" : "right"}
          {...(cfg.dir === "ltr" ? { left: 76 } : { right: 76 })}
        >
          삐빅! 먼지 발견!
        </Bubble>
      )}
      <button
        type="button"
        className="ev-poke"
        aria-label="도르 불러 세우기"
        onClick={handle}
      >
        <div key={pokeKey} className={poked ? "ev-jump" : undefined}>
          <svg
            width={W}
            height={130}
            viewBox="0 0 140 130"
            style={flip(cfg.dir)}
            aria-hidden
          >
            <defs>
              <radialGradient id={id("body")} cx="38%" cy="30%" r="80%">
                <stop offset="0%" stopColor={poked ? "#eafff6" : "#f7f9fd"} />
                <stop offset="55%" stopColor={poked ? "#9fe8c8" : "#cdd6e5"} />
                <stop offset="100%" stopColor={poked ? "#4fae8c" : "#8592ab"} />
              </radialGradient>
              <clipPath id={id("clip")}>
                <circle cx="74" cy="52" r="32" />
              </clipPath>
            </defs>

            {/* 뒤쪽 분사구와 뿜어 나오는 김 */}
            {[0, 0.3, 0.6].map((d) => (
              <circle
                key={d}
                className="ev-puff"
                cx="30"
                cy="56"
                r="6"
                fill="#d6ecff"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
            <rect x="34" y="49" width="10" height="13" rx="3" fill="#6d7a96" />
            <rect
              x="32"
              y="51"
              width="4"
              height="9"
              rx="1.5"
              fill="#ffb37a"
              className="ev-glow"
            />

            {/* 외바퀴 */}
            <rect x="68" y="80" width="12" height="16" rx="3" fill="#7b88a3" />
            <g className="ev-spin">
              <circle
                cx="74"
                cy="104"
                r="14"
                fill="#29324d"
                stroke="#4d5878"
                strokeWidth="3"
              />
              <path
                d="M74 92 L 74 116 M62 104 L 86 104"
                stroke="#8592ab"
                strokeWidth="2"
              />
            </g>
            <circle cx="74" cy="104" r="3.4" fill="#cdd6e5" />

            {/* 몸통 */}
            <circle cx="74" cy="52" r="32" fill={`url(#${id("body")})`} />
            <rect
              x="40"
              y="64"
              width="70"
              height="7"
              fill={poked ? "#ff7eb6" : "#ff9f43"}
              clipPath={`url(#${id("clip")})`}
            />
            <ellipse
              cx="62"
              cy="34"
              rx="9"
              ry="5"
              fill="#fff"
              opacity="0.7"
              transform="rotate(-25 62 34)"
            />

            {/* 안테나 */}
            <path
              d="M74 20 L 74 10"
              stroke="#7b88a3"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle
              cx="74"
              cy="8"
              r="3.6"
              fill="#ff6b9a"
              className="ev-blink"
            />

            {/* 얼굴 창 */}
            <rect x="54" y="38" width="46" height="20" rx="10" fill="#1d2b4a" />
            {poked ? (
              <path
                d="M62 50 l 4 -5 l 4 5 M80 50 l 4 -5 l 4 5"
                fill="none"
                stroke="#6ff3ff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <g className="ev-eyeblink">
                <rect
                  x="63"
                  y="42.5"
                  width="6.5"
                  height="10"
                  rx="3.25"
                  fill="#6ff3ff"
                />
                <rect
                  x="81"
                  y="42.5"
                  width="6.5"
                  height="10"
                  rx="3.25"
                  fill="#6ff3ff"
                />
              </g>
            )}

            {/* 앞으로 내민 작은 먼지떨이 */}
            <path
              d="M102 62 L 118 74"
              stroke="#7b88a3"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M116 70 l 12 2 M116 72 l 11 6 M116 74 l 8 9 M117 75 l 3 11"
              stroke="#ffd166"
              strokeWidth="2.4"
              strokeLinecap="round"
              className="ev-sway"
            />
          </svg>
        </div>
      </button>
    </Traveler>
  );
}

/* ───────────── 끙: 한숨 쉬는 낡은 정비 로봇 ───────────── */

export function KkungScene({ durationMs, rand, reduced, onPoke }: SceneProps) {
  const [cfg] = useState(() => ({
    dir: pick(rand, ["ltr", "rtl"] as const),
    y: between(rand, 0.15, 0.75),
    drift: between(rand, -25, 25),
  }));
  const { poked, pokeKey, handle } = usePoke(onPoke, 3200);
  const id = useSvgId("kkung");
  const W = 140;
  const side = cfg.dir === "ltr" ? { left: 86 } : { right: 86 };
  const tail = cfg.dir === "ltr" ? "left" : "right";
  return (
    <Traveler
      width={W}
      height={170}
      y={cfg.y}
      dir={cfg.dir}
      durationMs={durationMs}
      drift={cfg.drift}
      reduced={reduced}
    >
      {poked ? (
        <Bubble key={pokeKey} top={-22} tail={tail} {...side}>
          끙… 반가워요
        </Bubble>
      ) : (
        <Bubble top={-22} tail={tail} className="ev-sigh" {...side}>
          끙…
        </Bubble>
      )}
      <button
        type="button"
        className="ev-poke"
        aria-label="끙 토닥이기"
        onClick={handle}
      >
        <div className="ev-float">
          <svg
            width={W}
            height={170}
            viewBox="0 0 140 170"
            style={flip(cfg.dir)}
            aria-hidden
          >
            <defs>
              <linearGradient id={id("metal")} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bdb39b" />
                <stop offset="100%" stopColor="#857c69" />
              </linearGradient>
              <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a39981" />
                <stop offset="100%" stopColor="#6f6756" />
              </linearGradient>
            </defs>

            {/* 한숨 김 */}
            {!poked && (
              <g className="ev-sigh">
                <circle cx="102" cy="58" r="4" fill="#dfe6f0" opacity="0.7" />
                <circle
                  cx="110"
                  cy="53"
                  r="5.5"
                  fill="#dfe6f0"
                  opacity="0.55"
                />
                <circle cx="120" cy="49" r="3.4" fill="#dfe6f0" opacity="0.4" />
              </g>
            )}

            {/* 휜 안테나 */}
            <path
              d="M66 30 L 63 15 L 76 8"
              fill="none"
              stroke="#6b6457"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="78" cy="8" r="3.2" fill="#e0b04a" className="ev-glow" />

            {/* 뒤쪽 팔 */}
            <path
              d="M32 86 Q 20 100 22 118"
              stroke="#6f6756"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="22" cy="121" r="5" fill="#5d564a" />

            {/* 다리 */}
            <rect x="44" y="128" width="12" height="18" rx="3" fill="#6f6756" />
            <rect
              x="74"
              y="128"
              width="12"
              height="15"
              rx="3"
              fill="#6f6756"
              transform="rotate(8 80 130)"
            />
            <rect
              x="41"
              y="144"
              width="18"
              height="7"
              rx="3.5"
              fill="#5d564a"
            />
            <rect
              x="74"
              y="141"
              width="18"
              height="7"
              rx="3.5"
              fill="#5d564a"
              transform="rotate(8 80 130)"
            />

            {/* 몸통 */}
            <rect
              x="30"
              y="74"
              width="72"
              height="58"
              rx="10"
              fill={`url(#${id("body")})`}
              stroke="#4f493e"
              strokeWidth="2"
            />
            <path
              d="M36 118 C 42 112 50 116 52 124 C 46 128 38 126 36 118 Z"
              fill="#a0643c"
              opacity="0.6"
            />
            <path
              d="M88 80 C 96 80 99 86 96 92 C 92 90 88 86 88 80 Z"
              fill="#a0643c"
              opacity="0.5"
            />
            <rect
              x="68"
              y="92"
              width="22"
              height="17"
              rx="2"
              fill="#948e7f"
              stroke="#4f493e"
              strokeWidth="1.2"
            />
            {[
              [71, 95],
              [87, 95],
              [71, 106],
              [87, 106],
            ].map(([cx, cy]) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="1.3"
                fill="#4f493e"
              />
            ))}
            <circle
              cx="48"
              cy="98"
              r="9"
              fill="#2d2a24"
              stroke="#4f493e"
              strokeWidth="1.5"
            />
            <path
              d={poked ? "M48 98 L 53 91" : "M48 98 L 42 103"}
              stroke="#ff8a5c"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* 목과 머리 */}
            <rect x="58" y="66" width="16" height="9" fill="#5d564a" />
            <rect
              x="38"
              y="28"
              width="58"
              height="40"
              rx="8"
              fill={`url(#${id("metal")})`}
              stroke="#4f493e"
              strokeWidth="2"
            />
            <path
              d="M84 30 L 90 40"
              stroke="#4f493e"
              strokeWidth="1.2"
              opacity="0.6"
            />
            <circle
              cx="56"
              cy="47"
              r="6.5"
              fill={poked ? "#fff2b0" : "#ffe08a"}
              className={poked ? undefined : "ev-eyeblink"}
            />
            <circle
              cx="78"
              cy="47"
              r="6.5"
              fill={poked ? "#fff2b0" : "#c9a75a"}
              opacity={poked ? 1 : 0.75}
            />
            {!poked && (
              <>
                <path
                  d="M48.5 46 Q 56 39 63.5 46 L 63.5 39.5 L 48.5 39.5 Z"
                  fill="#a69c85"
                />
                <path
                  d="M70.5 46 Q 78 39 85.5 46 L 85.5 39.5 L 70.5 39.5 Z"
                  fill="#a69c85"
                />
              </>
            )}
            <path
              d={
                poked
                  ? "M58 58 Q 67 63 76 58"
                  : "M58 60 L 76 60 M60 57 L 60 63 M67 57 L 67 63 M74 57 L 74 63"
              }
              fill="none"
              stroke="#4f493e"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* 앞쪽 팔과 렌치 */}
            <g key={pokeKey} className={poked ? "ev-armwave" : undefined}>
              <path
                d="M100 86 Q 112 98 114 112"
                stroke="#857c69"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M114 112 L 122 132"
                stroke="#9aa3ad"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M118 132 a 7 7 0 1 0 10 -2 l -3 4 l -4 -1 l -1 -4 z"
                fill="#9aa3ad"
                stroke="#6b737d"
                strokeWidth="1"
              />
              <circle cx="114" cy="113" r="5" fill="#5d564a" />
            </g>
          </svg>
        </div>
      </button>
    </Traveler>
  );
}
