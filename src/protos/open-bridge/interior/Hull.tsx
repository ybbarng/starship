"use client";

// 바탕 그림: 선체(곡면 벽·리벳·창), 갑판 넷, 바닥 판, 천장 배관, 환기구, 칸막이와 해치, 가운데 사다리,
// 고정 시설(휴게석·주방·침상·도킹 베이·원자로·엔진). 글자와 누르는 것은 위에 HTML로 얹는다.
import { useId } from "react";
import {
  DECK_ORDER,
  DECKS,
  type Deck,
  FIXTURES,
  H,
  HULL,
  halfWidth,
  hullPath,
  LADDER,
  SLAB,
  W,
} from "./geometry";

const TINT: Record<Deck["id"], [string, string]> = {
  bridge: ["#1a2440", "#0d1324"],
  work: ["#18284a", "#0c1529"],
  home: ["#30251f", "#17110e"],
  engine: ["#1e2228", "#0d0f13"],
};

export function Hull() {
  const uid = useId().replace(/:/g, "");
  const inner = `ib-in-${uid}`;
  const metal = `ib-metal-${uid}`;
  const glass = `ib-glass-${uid}`;
  const flame = `ib-flame-${uid}`;
  const core = `ib-core-${uid}`;
  const outer = hullPath(0);
  const innerPath = hullPath(HULL.skin);
  const bottom = HULL.cy + HULL.b;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      <defs>
        <clipPath id={inner}>
          <path d={innerPath} />
        </clipPath>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a4254" />
          <stop offset="0.18" stopColor="#7d879b" />
          <stop offset="0.5" stopColor="#5b6478" />
          <stop offset="0.85" stopColor="#434b5d" />
          <stop offset="1" stopColor="#262b36" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd0ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#1a2a4a" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={flame} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#a8dcff" />
          <stop offset="1" stopColor="#3b7bff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={core} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e9fbff" />
          <stop offset="0.4" stopColor="#6fe3ff" />
          <stop offset="1" stopColor="#1d6fff" stopOpacity="0" />
        </radialGradient>
        {DECK_ORDER.map((id) => (
          <linearGradient
            key={id}
            id={`ib-deck-${id}-${uid}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stopColor={TINT[id][1]} />
            <stop offset="0.35" stopColor={TINT[id][0]} />
            <stop offset="1" stopColor={TINT[id][1]} />
          </linearGradient>
        ))}
      </defs>

      {/* 엔진: 선체 바닥 아래로 분사 */}
      {[HULL.cx - 92, HULL.cx, HULL.cx + 92].map((x, i) => {
        const big = i === 1;
        const top = bottom - (big ? 8 : 6);
        const tw = big ? 16 : 11;
        const bw = big ? 30 : 20;
        const h = big ? 30 : 22;
        return (
          <g key={x}>
            <rect
              className="ib-thrust"
              x={x - bw / 2 + 2}
              y={top + h}
              width={bw - 4}
              height={big ? 60 : 40}
              rx={bw / 2}
              fill={`url(#${flame})`}
            />
            <path
              d={`M${x - tw},${top} L${x + tw},${top} L${x + bw},${top + h} L${x - bw},${top + h} Z`}
              fill="#3a4050"
              stroke="#11141b"
              strokeWidth={2}
            />
            <path
              d={`M${x - tw + 3},${top + 4} L${x - bw + 6},${top + h - 2}`}
              stroke="#8b95a8"
              strokeOpacity={0.6}
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* 바깥 장비: 위 안테나, 옆 자세 제어 분사기 */}
      <g stroke="#7a8496" strokeWidth={3} fill="none">
        <path d={`M${HULL.cx + 150},${HULL.cy - HULL.b + 22} l26,-30`} />
        <path d={`M${HULL.cx - 210},${HULL.cy - HULL.b + 40} v-34`} />
      </g>
      <ellipse
        cx={HULL.cx + 182}
        cy={HULL.cy - HULL.b - 14}
        rx={18}
        ry={7}
        transform={`rotate(-40 ${HULL.cx + 182} ${HULL.cy - HULL.b - 14})`}
        fill="#cfd6e4"
        stroke="#4a5262"
        strokeWidth={2}
      />
      <circle
        cx={HULL.cx - 210}
        cy={HULL.cy - HULL.b + 4}
        r={3.5}
        fill="#ff6b6b"
        className="ib-blink"
      />
      {[HULL.cy - 30, HULL.cy + 130].map((y) =>
        [-1, 1].map((side) => {
          const x = HULL.cx + side * halfWidth(y);
          return (
            <g key={`${y}${side}`}>
              <rect
                x={side < 0 ? x - 12 : x}
                y={y - 9}
                width={12}
                height={18}
                rx={2}
                fill="#3a4152"
                stroke="#11141b"
                strokeWidth={1.5}
              />
              <path
                d={`M${x + side * 12},${y - 6} l${side * 6},-4 M${x + side * 12},${y + 6} l${side * 6},4`}
                stroke="#6b7488"
                strokeWidth={2}
              />
            </g>
          );
        }),
      )}

      {/* 선체 외피 */}
      <path
        d={outer}
        fill={`url(#${metal})`}
        stroke="#0b0d12"
        strokeWidth={3}
      />
      {/* 외피 판 이음새 */}
      <g stroke="#1b1f28" strokeOpacity={0.6} strokeWidth={1}>
        {Array.from({ length: 13 }, (_, i) => HULL.cx - 540 + i * 90).map(
          (x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={H} />
          ),
        )}
      </g>
      {/* 리벳: 외피 가장자리를 따라 */}
      <Rivets />

      {/* 안쪽 */}
      <path d={innerPath} fill="#070a12" stroke="#0b0d12" strokeWidth={2} />
      <g clipPath={`url(#${inner})`}>
        {/* 관측 돔: 함교 위 유리 */}
        <rect
          x={0}
          y={0}
          width={W}
          height={DECKS.bridge.top - 4}
          fill={`url(#${glass})`}
        />
        <g stroke="#2a3346" strokeWidth={5}>
          {[-260, -160, -60, 60, 160, 260].map((dx) => (
            <line
              key={dx}
              x1={HULL.cx + dx}
              y1={0}
              x2={HULL.cx + dx * 1.05}
              y2={DECKS.bridge.top - 4}
            />
          ))}
        </g>
        <rect
          x={0}
          y={DECKS.bridge.top - 6}
          width={W}
          height={6}
          fill="#2c3445"
        />

        {DECK_ORDER.map((id) => (
          <DeckShell key={id} deck={DECKS[id]} fill={`ib-deck-${id}-${uid}`} />
        ))}

        {/* 기관실 아래: 엔진으로 가는 배관 */}
        <rect
          x={0}
          y={DECKS.engine.floor + SLAB}
          width={W}
          height={H}
          fill="#0b0e14"
        />
        <g stroke="#3d4658" strokeWidth={6} fill="none">
          <path
            d={`M${FIXTURES.engine.x0 + 150},${DECKS.engine.floor + SLAB} V${bottom - 18} H${HULL.cx + 92}`}
          />
          <path
            d={`M${HULL.cx - 92},${bottom - 14} H${HULL.cx + 92}`}
            strokeWidth={4}
          />
        </g>

        <Ladder />
        <BridgeFixtures />
        <Lounge />
        <Galley />
        <Bunks />
        <Bay />
        <EngineRoom core={core} />
      </g>

      {/* 창: 갑판 끝 둥근 창 */}
      {(["work", "home"] as const).map((id) =>
        [-1, 1].map((side) => {
          const d = DECKS[id];
          const y = d.top + 40;
          const x = HULL.cx + side * (halfWidth(y) - HULL.skin / 2);
          return <Porthole key={`${id}${side}`} x={x} y={y} />;
        }),
      )}
    </svg>
  );
}

function Rivets() {
  const pts: { x: number; y: number }[] = [];
  const { cx, cy, a, b, n } = HULL;
  for (let i = 0; i < 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push({
      x: Math.round(cx + (a - 5) * Math.sign(c) * Math.abs(c) ** (2 / n)),
      y: Math.round(cy + (b - 5) * Math.sign(s) * Math.abs(s) ** (2 / n)),
    });
  }
  return (
    <g fill="#c3cad8" opacity={0.55}>
      {pts.map((p) => (
        <circle
          key={`${p.x.toFixed(0)}-${p.y.toFixed(0)}`}
          cx={p.x}
          cy={p.y}
          r={1.5}
        />
      ))}
    </g>
  );
}

function Porthole({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={11}
        fill="#1d2230"
        stroke="#9aa3b4"
        strokeWidth={2.5}
      />
      <circle cx={x} cy={y} r={7.5} fill="#050913" />
      <circle cx={x - 2} cy={y - 2} r={0.9} fill="#fff" />
      <circle cx={x + 3} cy={y + 2} r={0.6} fill="#fff" opacity={0.7} />
      <path
        d={`M${x - 5},${y - 3} a6,6 0 0 1 4,-3`}
        stroke="#fff"
        strokeOpacity={0.35}
        fill="none"
      />
    </g>
  );
}

/** 갑판 하나: 벽 색, 판 이음새, 천장 배관과 등, 환기구, 바닥 판 */
function DeckShell({ deck, fill }: { deck: Deck; fill: string }) {
  const { top, floor } = deck;
  const left = HULL.cx - halfWidth((top + floor) / 2, HULL.skin);
  const right = HULL.cx + halfWidth((top + floor) / 2, HULL.skin);
  const seams = [];
  for (let x = HULL.cx - 48 - 96 * 6; x < W; x += 96) seams.push(x);
  const lights = [];
  for (let x = HULL.cx - 470; x <= HULL.cx + 470; x += 156) lights.push(x);
  const vents = [HULL.cx - 300, HULL.cx + 240].filter(
    (x) => x > deck.x0 + 40 && x < deck.x1 - 40,
  );
  return (
    <g>
      <rect
        x={0}
        y={top}
        width={W}
        height={floor - top}
        fill={`url(#${fill})`}
      />
      {/* 벽 판 이음새 */}
      <g stroke="#ffffff" strokeOpacity={0.04}>
        {seams.map((x) => (
          <line key={x} x1={x} y1={top + 14} x2={x} y2={floor} />
        ))}
        <line x1={0} y1={floor - 30} x2={W} y2={floor - 30} />
      </g>
      {/* 갑판 번호(벽에 칠한 큰 글자) */}
      <text
        x={deck.x0 + 8}
        y={floor - 8}
        fontSize={44}
        fontWeight={800}
        fill="#ffffff"
        fillOpacity={0.035}
        fontFamily="ui-monospace, monospace"
      >
        {`0${deck.no}`}
      </text>
      {/* 천장 배관 두 줄과 받침 */}
      <g>
        <rect x={0} y={top} width={W} height={4} fill="#262d3b" />
        <line
          x1={0}
          y1={top + 7}
          x2={W}
          y2={top + 7}
          stroke="#56607a"
          strokeWidth={3}
        />
        <line
          x1={0}
          y1={top + 11.5}
          x2={W}
          y2={top + 11.5}
          stroke={deck.id === "engine" ? "#8a5a3a" : "#3e6a6a"}
          strokeWidth={2.5}
        />
        {seams.map((x) => (
          <rect
            key={x}
            x={x - 2}
            y={top + 4}
            width={4}
            height={10}
            fill="#20262f"
          />
        ))}
      </g>
      {/* 천장 등 */}
      {lights.map((x) => (
        <g key={x}>
          <rect
            x={x - 14}
            y={top + 14}
            width={28}
            height={3}
            rx={1.5}
            fill="#fff3d6"
            opacity={0.85}
          />
          <path
            d={`M${x - 14},${top + 17} L${x - 40},${floor} L${x + 40},${floor} L${x + 14},${top + 17} Z`}
            fill="#fff3d6"
            opacity={0.025}
          />
        </g>
      ))}
      {/* 환기구 */}
      {vents.map((x) => (
        <g key={x}>
          <rect
            x={x - 16}
            y={top + 24}
            width={32}
            height={14}
            rx={2}
            fill="#0b0f18"
            stroke="#3a4356"
          />
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={x - 13}
              y1={top + 27 + i * 3}
              x2={x + 13}
              y2={top + 27 + i * 3}
              stroke="#4a5468"
            />
          ))}
        </g>
      ))}
      {/* 벽쪽 세로 배관 */}
      <g stroke="#3a4356" strokeWidth={4}>
        <line x1={left + 8} y1={top} x2={left + 8} y2={floor} />
        <line x1={right - 8} y1={top} x2={right - 8} y2={floor} />
      </g>
      {/* 바닥 판: 격자와 아래 그림자 */}
      <rect x={0} y={floor} width={W} height={SLAB} fill="#2a3242" />
      <rect x={0} y={floor} width={W} height={2} fill="#5a6478" />
      <g stroke="#1a1f2a" strokeWidth={1}>
        {Array.from({ length: 70 }, (_, i) => i * 20).map((x) => (
          <line key={x} x1={x} y1={floor + 3} x2={x + 6} y2={floor + SLAB} />
        ))}
      </g>
    </g>
  );
}

/** 가운데 사다리: 함교에서 기관실까지. 바닥 판마다 해치가 열려 있다. */
function Ladder() {
  const { x, w } = LADDER;
  const top = DECKS.bridge.floor - 54;
  const bot = DECKS.engine.floor;
  const rungs = [];
  for (let y = top + 6; y < bot; y += 11) rungs.push(y);
  return (
    <g>
      <rect
        x={x}
        y={DECKS.bridge.floor}
        width={w}
        height={bot - DECKS.bridge.floor}
        fill="#06080e"
        opacity={0.55}
      />
      {/* 바닥 판의 구멍 + 경고 줄무늬 */}
      {(["bridge", "work", "home"] as const).map((id) => {
        const f = DECKS[id].floor;
        return (
          <g key={id}>
            <rect x={x} y={f} width={w} height={SLAB} fill="#06080e" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M${x + i * 8},${f} l6,0 l-4,4 l-6,0 Z`}
                fill={i % 2 ? "#1a1a1a" : "#e8b93a"}
              />
            ))}
            {/* 열린 해치 뚜껑 */}
            <path
              d={`M${x + w},${f} l16,-22 l5,3 l-15,21 Z`}
              fill="#4a5468"
              stroke="#1a1f2a"
            />
            <circle
              cx={x + w + 12}
              cy={f - 11}
              r={3.5}
              fill="none"
              stroke="#9aa3b4"
              strokeWidth={1.4}
            />
          </g>
        );
      })}
      <g stroke="#9aa3b4" strokeWidth={2.4}>
        <line x1={x + 9} y1={top} x2={x + 9} y2={bot} />
        <line x1={x + w - 9} y1={top} x2={x + w - 9} y2={bot} />
      </g>
      <g stroke="#7a8496" strokeWidth={2}>
        {rungs.map((y) => (
          <line key={y} x1={x + 9} y1={y} x2={x + w - 9} y2={y} />
        ))}
      </g>
      {/* 함교 위로 솟은 손잡이 */}
      <path
        d={`M${x + 9},${top} q0,-8 8,-8 M${x + w - 9},${top} q0,-8 -8,-8`}
        stroke="#9aa3b4"
        strokeWidth={2.4}
        fill="none"
      />
    </g>
  );
}

/** 칸막이 벽과 열린 해치 문 */
function Bulkhead({ x, deck }: { x: number; deck: Deck }) {
  const { top, floor } = deck;
  const doorTop = floor - 74;
  return (
    <g>
      <rect
        x={x - 5}
        y={top + 4}
        width={10}
        height={doorTop - top - 4}
        fill="#2e3646"
        stroke="#151922"
      />
      <rect
        x={x - 6}
        y={doorTop - 6}
        width={12}
        height={floor - doorTop + 6}
        rx={6}
        fill="none"
        stroke="#5a6478"
        strokeWidth={3}
      />
      <rect
        x={x - 3}
        y={doorTop + 6}
        width={6}
        height={10}
        rx={2}
        fill="#ffcf5c"
        opacity={0.5}
      />
      <circle cx={x} cy={top + 30} r={3} fill="#5ee08a" opacity={0.7} />
    </g>
  );
}

function BridgeFixtures() {
  const d = DECKS.bridge;
  const f = d.floor;
  const cx = (d.x0 + LADDER.x) / 2;
  return (
    <g>
      {/* 내 자리: 경사진 콘솔과 빈 함장 의자(왼쪽을 본다) */}
      <path
        d={`M${d.x0 + 18},${f} L${d.x0 + 18},${f - 34} L${d.x0 + 190},${f - 46} L${d.x0 + 196},${f - 34} L${d.x0 + 196},${f} Z`}
        fill="#2b3346"
        stroke="#121621"
        strokeWidth={2}
      />
      <g transform={`translate(${cx + 58} ${f})`}>
        <rect x={-4} y={-12} width={8} height={12} fill="#20252f" />
        <rect x={-22} y={-14} width={44} height={6} rx={3} fill="#20252f" />
        <path
          d="M-20,-16 h34 q6,0 6,-6 v-4 h-40 z"
          fill="#5a3b48"
          stroke="#1c1218"
        />
        <path
          d="M10,-26 q16,-2 14,-38 q-2,-6 -8,-4 q-4,20 -8,38 z"
          fill="#6b4655"
          stroke="#1c1218"
        />
        <rect x={-24} y={-34} width={18} height={4} rx={2} fill="#3a2a32" />
      </g>
      {/* 통신 콘솔과 접시 안테나 받침 */}
      <path
        d={`M${LADDER.x + LADDER.w + 26},${f} V${f - 40} L${d.x1 - 70},${f - 52} L${d.x1 - 66},${f - 40} V${f} Z`}
        fill="#2b3346"
        stroke="#121621"
        strokeWidth={2}
      />
      <g transform={`translate(${d.x1 - 34} ${f})`}>
        <rect
          x={-14}
          y={-60}
          width={28}
          height={60}
          rx={3}
          fill="#232a38"
          stroke="#121621"
        />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x={-10}
              y={-54 + i * 13}
              width={20}
              height={8}
              rx={1.5}
              fill="#0b1018"
            />
            <circle
              cx={-5 + (i % 2) * 6}
              cy={-50 + i * 13}
              r={1.6}
              fill={i === 1 ? "#ffcf5c" : "#5ee08a"}
              className={i === 1 ? "ib-blink" : undefined}
            />
          </g>
        ))}
      </g>
    </g>
  );
}

function Lounge() {
  const d = DECKS.work;
  const { x0, x1 } = FIXTURES.lounge;
  const f = d.floor;
  return (
    <g>
      <Bulkhead x={x0 - 6} deck={d} />
      {/* 소파 */}
      <rect
        x={x0 + 10}
        y={f - 22}
        width={x1 - x0 - 40}
        height={10}
        rx={4}
        fill="#3b4f7a"
      />
      <rect
        x={x0 + 10}
        y={f - 40}
        width={x1 - x0 - 40}
        height={20}
        rx={6}
        fill="#2f4066"
      />
      <rect x={x0 + 14} y={f - 12} width={6} height={12} fill="#1a2238" />
      <rect x={x1 - 40} y={f - 12} width={6} height={12} fill="#1a2238" />
      {/* 커피 기계 */}
      <g transform={`translate(${x1 - 22} ${f})`}>
        <rect
          x={-10}
          y={-50}
          width={20}
          height={50}
          rx={2}
          fill="#3a4152"
          stroke="#151922"
        />
        <rect x={-6} y={-44} width={12} height={8} rx={1} fill="#0b1018" />
        <circle cx={0} cy={-40} r={1.5} fill="#ff9a5c" />
        <rect x={-4} y={-22} width={8} height={7} rx={1} fill="#e8e2d6" />
        <path
          className="ib-steam"
          d="M0,-24 q-3,-5 0,-9 q3,-4 0,-8"
          stroke="#fff"
          strokeOpacity={0.5}
          fill="none"
        />
      </g>
      <text
        x={x0 + 12}
        y={d.top + 30}
        fontSize={9}
        fill="#9cc8ff"
        fillOpacity={0.5}
      >
        휴게석
      </text>
    </g>
  );
}

function Galley() {
  const d = DECKS.home;
  const { x0, x1 } = FIXTURES.galley;
  const f = d.floor;
  return (
    <g>
      <Bulkhead x={x1 + 4} deck={d} />
      {/* 위 찬장 */}
      <rect
        x={x0 + 22}
        y={d.top + 22}
        width={x1 - x0 - 40}
        height={22}
        rx={2}
        fill="#5a4636"
        stroke="#21180f"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={x0 + 46 + i * 40}
          cy={d.top + 33}
          r={1.6}
          fill="#c9a77a"
        />
      ))}
      {/* 조리대와 냉장고 */}
      <rect
        x={x0 + 22}
        y={f - 36}
        width={x1 - x0 - 76}
        height={36}
        fill="#4a3a2e"
        stroke="#21180f"
      />
      <rect
        x={x0 + 20}
        y={f - 40}
        width={x1 - x0 - 72}
        height={5}
        fill="#a99b8a"
      />
      <rect
        x={x1 - 52}
        y={f - 74}
        width={34}
        height={74}
        rx={3}
        fill="#c8ccd4"
        stroke="#4a4f5a"
      />
      <line
        x1={x1 - 52}
        y1={f - 46}
        x2={x1 - 18}
        y2={f - 46}
        stroke="#4a4f5a"
      />
      <rect x={x1 - 24} y={f - 66} width={2} height={12} fill="#4a4f5a" />
      {/* 주전자와 김, 화분 */}
      <g transform={`translate(${x0 + 60} ${f - 40})`}>
        <path d="M-8,0 q0,-12 8,-12 q8,0 8,12 z" fill="#e06a4a" />
        <path
          className="ib-steam"
          d="M2,-14 q-3,-5 0,-9 q3,-4 0,-8"
          stroke="#fff"
          strokeOpacity={0.5}
          fill="none"
        />
      </g>
      <g transform={`translate(${x0 + 100} ${f - 40})`}>
        <rect x={-6} y={-10} width={12} height={10} fill="#8a5a3a" />
        <path
          d="M0,-10 q-10,-8 -6,-18 M0,-10 q2,-12 8,-16 M0,-10 q-2,-14 0,-20"
          stroke="#5ec46a"
          strokeWidth={3}
          fill="none"
        />
      </g>
      <text
        x={x0 + 24}
        y={d.top + 58}
        fontSize={9}
        fill="#ffb86c"
        fillOpacity={0.55}
      >
        주방
      </text>
    </g>
  );
}

function Bunks() {
  const d = DECKS.home;
  const { x0, x1 } = FIXTURES.bunks;
  const f = d.floor;
  const colW = (x1 - x0 - 30) / 2;
  return (
    <g>
      <Bulkhead x={x0 - 6} deck={d} />
      {[0, 1].map((col) => {
        const bx = x0 + 12 + col * (colW + 6);
        return (
          <g key={col}>
            {/* 기둥 */}
            <rect
              x={bx}
              y={d.top + 16}
              width={4}
              height={f - d.top - 16}
              fill="#6b5a4a"
            />
            <rect
              x={bx + colW - 4}
              y={d.top + 16}
              width={4}
              height={f - d.top - 16}
              fill="#6b5a4a"
            />
            {/* 아래·위 침대 */}
            {[f - 10, f - 64].map((y) => (
              <g key={y}>
                <rect
                  x={bx}
                  y={y}
                  width={colW}
                  height={6}
                  rx={1}
                  fill="#6b5a4a"
                />
                <rect
                  x={bx + 4}
                  y={y - 6}
                  width={colW - 8}
                  height={7}
                  rx={3}
                  fill="#c9b8e8"
                  opacity={0.75}
                />
                <rect
                  x={bx + colW - 22}
                  y={y - 10}
                  width={16}
                  height={6}
                  rx={3}
                  fill="#f0ecff"
                />
              </g>
            ))}
            {/* 커튼 */}
            <path
              d={`M${bx + 4},${d.top + 18} q6,10 0,22 M${bx + 9},${d.top + 18} q6,10 0,22`}
              stroke="#8a6fb8"
              strokeWidth={2}
              fill="none"
              opacity={0.7}
            />
          </g>
        );
      })}
      <text
        x={x0 + 14}
        y={d.top + 14}
        fontSize={9}
        fill="#ffb86c"
        fillOpacity={0.55}
      >
        침상
      </text>
    </g>
  );
}

function Bay() {
  const d = DECKS.engine;
  const { x0, x1 } = FIXTURES.bay;
  const f = d.floor;
  return (
    <g>
      {/* 베이 바닥 표시선 */}
      <rect
        x={x0}
        y={f - 3}
        width={x1 - x0}
        height={3}
        fill="#e8b93a"
        opacity={0.35}
      />
      {/* 왼쪽 선체 벽의 베이 문(줄무늬 판) */}
      <g>
        {Array.from({ length: 7 }, (_, i) => i).map((i) => (
          <rect
            key={i}
            x={x0 - 30}
            y={d.top + 16 + i * 13}
            width={22}
            height={10}
            fill={i % 2 ? "#2a2f3a" : "#e8b93a"}
            opacity={0.8}
          />
        ))}
        <rect
          x={x0 - 8}
          y={d.top + 14}
          width={4}
          height={f - d.top - 14}
          fill="#5ee08a"
          opacity={0.35}
          className="ib-pulse"
        />
      </g>
      {/* 기관실과 나누는 벽 */}
      <rect
        x={x1 + 2}
        y={d.top + 4}
        width={6}
        height={f - d.top - 4}
        fill="#2e3646"
      />
    </g>
  );
}

function EngineRoom({ core }: { core: string }) {
  const d = DECKS.engine;
  const { x0, x1 } = FIXTURES.engine;
  const f = d.floor;
  const rx = x0 + 150;
  return (
    <g>
      {/* 원자로 */}
      <rect
        x={rx - 26}
        y={d.top + 18}
        width={52}
        height={f - d.top - 18}
        rx={10}
        fill="#2a303c"
        stroke="#11141b"
        strokeWidth={2}
      />
      <rect
        className="ib-core"
        x={rx - 14}
        y={d.top + 28}
        width={28}
        height={f - d.top - 44}
        rx={12}
        fill={`url(#${core})`}
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={rx - 28}
          y={d.top + 30 + i * 18}
          width={56}
          height={4}
          fill="#4a5468"
        />
      ))}
      {/* 배관과 밸브 바퀴 */}
      <g stroke="#8a5a3a" strokeWidth={5} fill="none">
        <path d={`M${rx + 26},${d.top + 40} H${rx + 70} V${f}`} />
        <path
          d={`M${rx - 26},${d.top + 60} H${x0 + 30} V${f}`}
          stroke="#3e6a6a"
        />
      </g>
      <g transform={`translate(${rx + 70} ${d.top + 66})`}>
        <circle r={9} fill="none" stroke="#c9483a" strokeWidth={3} />
        <path d="M-9,0 H9 M0,-9 V9" stroke="#c9483a" strokeWidth={2} />
      </g>
      <g transform={`translate(${x0 + 30} ${d.top + 80})`}>
        <circle r={7} fill="none" stroke="#c9483a" strokeWidth={3} />
        <path d="M-7,0 H7 M0,-7 V7" stroke="#c9483a" strokeWidth={2} />
      </g>
      {/* 기관 계기판 받침(글은 HTML) */}
      <rect
        x={x1 - 118}
        y={d.top + 18}
        width={112}
        height={f - d.top - 30}
        rx={4}
        fill="#151a24"
        stroke="#2c3445"
      />
    </g>
  );
}
