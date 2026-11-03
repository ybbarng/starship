"use client";

// 연료실 맨 앞의 주 연료통(T-0, 주간 연료). 계정 주간 한도를 연료실 탱크와 같은 그림 말로 그린다. 설계: docs/usage.md "주간 연료".
// 들여다보는 창 아래쪽에 남은 연료가 차 있고(쓴 만큼 위에서부터 비어 간다), 빈 자리에는 업무·개인·기타 색 층이
// 흐리게 쌓여 "각 탱크가 주 연료통에서 나눠 썼다"를 보인다. 오른쪽 배관이 T-1·T-2·T-3으로 이어진다.
// 영역 몫은 "7일" 기간 통계로 나눈 근사다(WeeklyFuel.tsx·src/usage/limits.ts의 splitUsed).
import { useUsage } from "@/data/hooks";
import { limitLabel, type UsageLimit } from "@/protocol/limits";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import { Tip } from "@/ui/kit/Tip";
import {
  AREAS,
  agoText,
  LEVEL_COLOR,
  levelOf,
  pctText,
  resetText,
  splitUsed,
  untilText,
} from "@/usage/limits";
import { AREA_LABEL, type Area } from "@/usage/model";
import {
  FUEL_COLOR,
  resetLine,
  SmallLimit,
  useShownLimits,
} from "./WeeklyFuel";

const TAG: Record<Area, string> = {
  work: "T-1",
  personal: "T-2",
  other: "T-3",
};

/** 남은 연료 색: 영역 색과 겹치지 않는 옅은 호박색 */
const FUEL = "#ffe2a0";

const W = 560;
const H = 310;
/** 주 연료통 자리. 연료실 탱크(96×248)보다 크고 넓다 */
const T = { x: 34, y: 38, w: 210, h: 236 };
const G = { x: T.x + T.w / 2 - 32, y: T.y + 34, w: 64, h: T.h - 68 };
/** 배관이 나가는 높이(위에서부터 업무·개인·기타) */
const OUT_Y = [92, 156, 220];
const OUT_X = 400;

export function WeeklyTank() {
  const shown = useShownLimits();
  const usage = useUsage("7d").data;
  if (!shown.ready) return null;
  const [main, ...rest] = shown.limits;
  const { now, at, stale } = shown;
  const used = main?.usedPct ?? 0;
  const split = main && usage ? splitUsed(used, usage.areas) : undefined;
  const level = levelOf(used);
  const pct = pctText(used);
  const basis =
    split?.basis === "cost"
      ? "추정 비용"
      : split?.basis === "output"
        ? "출력 토큰"
        : "사용량";
  const tip = main
    ? `주 연료통(T-0) = 계정 ${limitLabel(main)} 한도. 리셋되면 가득 찬다.\n${pct.used} 사용 · ${pct.left} 남음 · ${resetLine(main, now)}${
        split
          ? `\n\n빈 자리의 색 층 = 업무·개인·기타가 나눠 쓴 몫(근사).\n이 컴퓨터 기록의 "7일"(오늘 포함, 자정 기준) 영역별 ${basis} 비율로 나눴어요.\n리셋 구간(리셋 7일 전부터 지금)과 몇 시간 어긋나고, 웹·다른 기기에서 쓴 것은 빠져요.\n${AREAS.map((a) => `${AREA_LABEL[a]} ${split.parts[a].toFixed(1)}%`).join(" · ")}`
          : ""
      }`
    : "주 연료통(T-0) = 계정 주간 한도. 리셋되어 본부가 새 값을 기다리는 중이에요";

  // 창 안의 높이: 위에서부터 쓴 몫(색 층), 그 아래 남은 연료
  const fuelTop = G.y + (G.h * used) / 100;
  let y = fuelTop;
  const layers = AREAS.map((a) => {
    const h = (G.h * (split?.parts[a] ?? 0)) / 100;
    y -= h;
    return { a, y, h };
  });

  return (
    <section
      data-weekly-tank
      data-level={level}
      className={`relative overflow-hidden rounded-xl border border-white/10 ${cockpit.screen} ${stale ? "opacity-55" : ""}`}
    >
      <div className="pointer-events-none absolute top-2.5 left-4 z-10 font-mono text-[10px] tracking-[0.25em] text-[#7ce0ff]/55">
        MAIN TANK · 주간 연료
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pr-4 pb-3">
        <Tip
          text={tip}
          side="bottom"
          align="start"
          className="w-full max-w-[600px] flex-[1_1_380px]"
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={
              main
                ? `주 연료통: ${limitLabel(main)} ${pct.left} 남음`
                : "주 연료통: 리셋됨"
            }
          >
            <TankDefs />
            {/* 배관: 주 연료통 → T-1·T-2·T-3 */}
            {AREAS.map((a, i) => {
              const oy = OUT_Y[i] ?? 100;
              const part = split?.parts[a] ?? 0;
              return (
                <g key={a} data-weekly-feed={a}>
                  <path
                    d={`M ${T.x + T.w} ${oy} H ${OUT_X}`}
                    stroke="url(#wt-pipe)"
                    strokeWidth="9"
                    fill="none"
                  />
                  <path
                    d={`M ${T.x + T.w} ${oy} H ${OUT_X}`}
                    stroke={FUEL_COLOR[a]}
                    strokeOpacity={part > 0 ? 0.75 : 0.15}
                    strokeWidth="2"
                    strokeDasharray="2 10"
                    fill="none"
                  >
                    {part > 0 && (
                      <animate
                        attributeName="stroke-dashoffset"
                        from="24"
                        to="0"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                  {/* 플랜지 */}
                  <rect
                    x={T.x + T.w}
                    y={oy - 8}
                    width="6"
                    height="16"
                    rx="1"
                    fill="#5a687f"
                  />
                  <rect
                    x={OUT_X - 6}
                    y={oy - 8}
                    width="6"
                    height="16"
                    rx="1"
                    fill="#5a687f"
                  />
                  <rect
                    x={OUT_X + 4}
                    y={oy - 15}
                    width={W - OUT_X - 12}
                    height="30"
                    rx="3"
                    fill="#0d1118"
                    stroke={FUEL_COLOR[a]}
                    strokeOpacity="0.4"
                  />
                  <text
                    x={OUT_X + 14}
                    y={oy + 4}
                    fontSize="12"
                    fontWeight="600"
                    fill={FUEL_COLOR[a]}
                  >
                    {TAG[a]} {AREA_LABEL[a]}
                  </text>
                  <text
                    x={W - 16}
                    y={oy + 4}
                    textAnchor="end"
                    fontFamily="ui-monospace, monospace"
                    fontSize="12"
                    fill="#e8edf7"
                    fillOpacity="0.85"
                  >
                    {split ? `${Math.round(part)}%` : "-"}
                  </text>
                </g>
              );
            })}
            {/* 받침 */}
            <rect
              x={T.x + 16}
              y={T.y + T.h - 2}
              width={T.w - 32}
              height="12"
              rx="2"
              fill="#11161f"
              stroke="#ffffff"
              strokeOpacity="0.08"
            />
            {/* 몸통·뚜껑 */}
            <rect
              x={T.x}
              y={T.y + 14}
              width={T.w}
              height={T.h - 28}
              fill="url(#wt-metal)"
            />
            <ellipse
              cx={T.x + T.w / 2}
              cy={T.y + 14}
              rx={T.w / 2}
              ry="15"
              fill="url(#wt-cap)"
            />
            <ellipse
              cx={T.x + T.w / 2}
              cy={T.y + T.h - 14}
              rx={T.w / 2}
              ry="15"
              fill="#1a212c"
            />
            {[0.24, 0.5, 0.76].map((f) => (
              <g key={f}>
                <rect
                  x={T.x}
                  y={T.y + T.h * f - 3}
                  width={T.w}
                  height="6"
                  fill="#000"
                  fillOpacity="0.28"
                />
                {[0.07, 0.93].map((r) => (
                  <circle
                    key={r}
                    cx={T.x + T.w * r}
                    cy={T.y + T.h * f}
                    r="2.2"
                    fill="#8a97ad"
                    fillOpacity="0.7"
                  />
                ))}
              </g>
            ))}
            {/* 들여다보는 창 */}
            <rect
              x={G.x - 4}
              y={G.y - 4}
              width={G.w + 8}
              height={G.h + 8}
              rx="7"
              fill="#0b0f16"
              stroke="#8a97ad"
              strokeOpacity="0.5"
            />
            <rect
              x={G.x}
              y={G.y}
              width={G.w}
              height={G.h}
              rx="4"
              fill="url(#wt-glass)"
            />
            {/* 쓴 몫: 영역 색 층(흐리게, 빗금) */}
            {split &&
              layers.map(({ a, y: ly, h }) =>
                h > 0 ? (
                  <g key={a} data-weekly-layer={a}>
                    <rect
                      x={G.x}
                      y={ly}
                      width={G.w}
                      height={h}
                      fill={FUEL_COLOR[a]}
                      fillOpacity="0.28"
                    />
                    <rect
                      x={G.x}
                      y={ly}
                      width={G.w}
                      height={h}
                      fill={`url(#wt-hatch-${a})`}
                    />
                    <line
                      x1={G.x}
                      x2={G.x + G.w}
                      y1={ly}
                      y2={ly}
                      stroke={FUEL_COLOR[a]}
                      strokeOpacity="0.6"
                      strokeWidth="0.8"
                    />
                  </g>
                ) : null,
              )}
            {/* 남은 연료 */}
            <rect
              data-weekly-fuel
              x={G.x}
              y={fuelTop}
              width={G.w}
              height={G.y + G.h - fuelTop}
              rx="3"
              fill={FUEL}
              fillOpacity="0.88"
              style={{ filter: `drop-shadow(0 0 8px ${FUEL})` }}
            />
            {used < 100 && (
              <line
                x1={G.x}
                x2={G.x + G.w}
                y1={fuelTop}
                y2={fuelTop}
                stroke="#fff"
                strokeWidth="1.2"
              />
            )}
            {/* 눈금(남은 양) */}
            {[0, 25, 50, 75, 100].map((p) => {
              const ty = G.y + G.h * (1 - p / 100);
              return (
                <g key={p}>
                  <line
                    x1={G.x + G.w + 4}
                    x2={G.x + G.w + 12}
                    y1={ty}
                    y2={ty}
                    stroke="#cfd8e8"
                    strokeOpacity="0.5"
                  />
                  <text
                    x={G.x + G.w + 15}
                    y={ty + 3}
                    fontSize="8.5"
                    fontFamily="ui-monospace, monospace"
                    fill="#cfd8e8"
                    fillOpacity="0.55"
                  >
                    {p}
                  </text>
                </g>
              );
            })}
            {/* 이름판 */}
            <rect
              x={T.x + 20}
              y={T.y + T.h + 12}
              width={T.w - 40}
              height="22"
              rx="2"
              fill="#0d1118"
              stroke="#ffffff"
              strokeOpacity="0.12"
            />
            <text
              x={T.x + T.w / 2}
              y={T.y + T.h + 27}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={FUEL}
            >
              T-0 · 주 연료통({main ? limitLabel(main) : "주간"})
            </text>
          </svg>
        </Tip>
        <div className="flex min-w-[240px] flex-[1_1_260px] flex-col gap-1.5 pl-4">
          {main ? (
            <>
              <p
                data-weekly-left
                className="font-mono text-[22px] font-semibold"
                style={{ color: level === "ok" ? FUEL : LEVEL_COLOR[level] }}
              >
                {pct.left} 남음
              </p>
              <p className="text-[13px] text-white/70">
                {limitLabel(main)} {pct.used} 사용
              </p>
              <ResetLine limit={main} now={now} />
            </>
          ) : (
            <p
              data-weekly-reset
              className="font-mono text-[15px] text-white/65"
            >
              리셋됨 · 새 값 기다리는 중
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-white/40">
            각 탱크(업무·개인·기타)는 이 주 연료통에서 나눠 써요. 빈 자리의 색
            층이 그 몫이에요(근사).
          </p>
          <p className="font-mono text-[10.5px] text-white/35">
            {shown.demo ? "데모 · 지어낸 값" : "계정 한도 · 본부 값"}
            {at !== undefined && ` · ${agoText(at, now)} 값`}
            {stale && " · 오래된 값이에요"}
          </p>
          {rest.map((l) => (
            <SmallLimit key={l.id} limit={l} now={now} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ResetLine({ limit, now }: { limit: UsageLimit; now: number }) {
  if (limit.resetsAt === undefined)
    return <p className="text-[13px] text-white/55">리셋 시각 모름</p>;
  return (
    <p className="text-[13px] text-white/55">
      리셋 {resetText(limit.resetsAt)}
      <span className="text-white/80">({untilText(limit.resetsAt, now)})</span>
    </p>
  );
}

function TankDefs() {
  return (
    <defs>
      <linearGradient id="wt-metal" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#1c2330" />
        <stop offset="0.18" stopColor="#3a4558" />
        <stop offset="0.42" stopColor="#5a687f" />
        <stop offset="0.6" stopColor="#3a4558" />
        <stop offset="1" stopColor="#161c27" />
      </linearGradient>
      <linearGradient id="wt-cap" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6b7a92" />
        <stop offset="1" stopColor="#2a3342" />
      </linearGradient>
      <linearGradient id="wt-pipe" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#4c586c" />
        <stop offset="0.5" stopColor="#2a3240" />
        <stop offset="1" stopColor="#141922" />
      </linearGradient>
      <linearGradient id="wt-glass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#05080d" />
        <stop offset="0.5" stopColor="#0d1420" />
        <stop offset="1" stopColor="#05080d" />
      </linearGradient>
      {AREAS.map((a) => (
        <pattern
          key={a}
          id={`wt-hatch-${a}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke={FUEL_COLOR[a]}
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        </pattern>
      ))}
    </defs>
  );
}
