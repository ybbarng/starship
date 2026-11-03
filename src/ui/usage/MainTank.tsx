"use client";

// 연료실 계통도 맨 왼쪽의 주 연료통(T-0, 주간 연료)과 주 연료통 → 업무·개인·기타 탱크 배관. 설계: docs/usage.md "주간 연료".
// 계통도(FuelRoom.tsx)와 같은 SVG 안에 그려서 그 defs(fr-metal 등)를 함께 쓴다.
// - 주 연료통: 탱크 셋과 같은 금속 원통, 키가 조금 더 크다. 들여다보는 창에는 남은 연료만 한 가지 색으로 찬다.
// - 배관: 굵기·흐르는 점의 밝기가 그 영역이 나눠 쓴 몫(splitUsed, "7일" 추정 비용 비율로 나눈 근사)을 따른다.
// - 이름판: "주간 47% 남음 · 리셋 수 02:00(6시간 뒤)", 5시간 한도가 있으면 둘째 줄.
// 한도 값이 없으면(본부 없음·404) useWeeklyFeed가 null이라 계통도는 탱크부터 시작한다.
import type { CSSProperties } from "react";
import { useUsage } from "@/data/hooks";
import { limitLabel, type UsageLimit } from "@/protocol/limits";
import {
  AREAS,
  agoText,
  feedShares,
  LEVEL_COLOR,
  levelOf,
  pctText,
  resetShort,
  splitUsed,
  untilText,
} from "@/usage/limits";
import { AREA_LABEL, type Area } from "@/usage/model";
import { FUEL_COLOR, resetLine, useShownLimits } from "./WeeklyFuel";

/** 남은 연료 색: 영역 색과 겹치지 않는 옅은 호박색 */
export const MAIN_FUEL = "#ffe2a0";

/** 주 연료통이 있을 때 탱크·엔진 계통도를 오른쪽·아래로 미는 거리(SVG 단위) */
export const MAIN_SHIFT = { x: 210, y: 96 };

/** 주 연료통 자리(계통도 전체 좌표). 탱크(96×248)보다 조금 넓고 키가 크다 */
export const MAIN = { x: 70, y: 124, w: 124, h: 272 };
const GLASS = {
  x: MAIN.x + MAIN.w / 2 - 15,
  y: MAIN.y + 30,
  w: 30,
  h: MAIN.h - 60,
};

export type WeeklyFeed = {
  /** 주간 한도(리셋이 지나 비었으면 없다) */
  main?: UsageLimit;
  /** 그 밖의 한도(5시간 등) */
  rest: UsageLimit[];
  now: number;
  at?: number;
  stale: boolean;
  demo: boolean;
  split?: ReturnType<typeof splitUsed>;
  /** 영역마다 나눠 쓴 몫 0..1(배관 굵기) */
  shares?: Record<Area, number>;
};

/** 본부 한도 값과 "7일" 통계를 합친 주 연료통 자료. 본부가 없으면 null */
export function useWeeklyFeed(): WeeklyFeed | null {
  const shown = useShownLimits();
  // 영역 몫은 "7일" 기간(오늘 포함 7일, 자정 기준)으로 근사한다. 리셋 구간(리셋 7일 전 ~ 지금)과 몇 시간 어긋난다
  const usage = useUsage("7d").data;
  if (!shown.ready) return null;
  const [main, ...rest] = shown.limits;
  const split =
    main && usage ? splitUsed(main.usedPct, usage.areas) : undefined;
  return {
    main,
    rest,
    now: shown.now,
    at: shown.at,
    stale: shown.stale,
    demo: shown.demo,
    split,
    shares: split ? feedShares(split.parts) : undefined,
  };
}

/** 주 연료통 말풍선 글: 한도 뜻, 근사라는 설명, 다른 한도, 값의 나이 */
export function mainTankTip(f: WeeklyFeed): string {
  const age =
    f.at !== undefined
      ? `\n\n${f.demo ? "데모 · 지어낸 값" : "계정 한도 · 본부 값"} · ${agoText(f.at, f.now)} 값${f.stale ? "(오래된 값)" : ""}`
      : "";
  if (!f.main)
    return `주 연료통(T-0) = 계정 주간 한도.\n리셋되어 본부가 새 값을 기다리는 중이에요.${age}`;
  const pct = pctText(f.main.usedPct);
  const basis =
    f.split?.basis === "cost"
      ? "추정 비용"
      : f.split?.basis === "output"
        ? "출력 토큰"
        : "사용량";
  const split = f.split
    ? `\n\n배관 굵기 = 업무·개인·기타가 이 통에서 나눠 쓴 몫(근사).\n이 컴퓨터 기록의 "7일"(오늘 포함, 자정 기준) 영역별 ${basis} 비율로 나눴어요.\n리셋 구간(리셋 7일 전부터 지금)과 몇 시간 어긋나고, 웹·다른 기기에서 쓴 것은 빠져요.\n${AREAS.map((a) => `${AREA_LABEL[a]} ${f.split?.parts[a].toFixed(1)}%`).join(" · ")}`
    : "\n\n영역 몫은 사용량 통계를 읽으면 배관 굵기로 보여요";
  const rest = f.rest
    .map((l) => {
      const p = pctText(l.usedPct);
      return `\n${limitLabel(l)} ${p.used} 사용 · ${p.left} 남음 · ${resetLine(l, f.now)}`;
    })
    .join("");
  return `주 연료통(T-0) = 계정 ${limitLabel(f.main)} 한도. 리셋되면 가득 차요.\n${pct.used} 사용 · ${pct.left} 남음 · ${resetLine(f.main, f.now)}${rest}${split}${age}`;
}

/** 배관 굵기(겉지름): 몫 0..1 → 8..18 */
function feedWidth(share: number | undefined): number {
  return 8 + 10 * (share ?? 0);
}

/** 탱크 i로 가는 배관이 지나는 높이: 먼 탱크일수록 위로(서로 엇갈리지 않게) */
function feedLevel(i: number, topY: number): number {
  return topY - 40 - 20 * i;
}

/** 주 연료통 뚜껑에서 배관이 나가는 x: 가까운 탱크(i=0)일수록 오른쪽 */
function outletX(i: number): number {
  return MAIN.x + MAIN.w / 2 + 28 - 28 * i;
}

export function feedPath(i: number, to: { x: number; y: number }): string {
  const ly = feedLevel(i, to.y);
  return `M ${outletX(i)} ${MAIN.y + 10} V ${ly} H ${to.x} V ${to.y + 4}`;
}

/** 배관 말풍선 자리(탱크 위로 내려가는 세로 토막) */
export function feedZone(
  i: number,
  to: { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const ly = feedLevel(i, to.y);
  return { x: to.x - 14, y: ly - 12, w: 28, h: to.y - ly + 4 };
}

/** 주 연료통 → 탱크 배관 셋. to는 탱크마다 뚜껑 가운데(계통도 전체 좌표) */
export function FeedPipes({
  feed,
  to,
}: {
  feed: WeeklyFeed;
  to: Record<Area, { x: number; y: number }>;
}) {
  return (
    <g style={{ opacity: feed.stale ? 0.5 : 1 }}>
      {AREAS.map((a, i) => {
        const d = feedPath(i, to[a]);
        const share = feed.shares?.[a];
        const w = feedWidth(share);
        const flowing = feed.main && share !== undefined && share > 0;
        const c = FUEL_COLOR[a];
        const ly = feedLevel(i, to[a].y);
        return (
          <g key={a} data-weekly-feed={a}>
            <path
              d={d}
              fill="none"
              stroke="#0a0d13"
              strokeWidth={w}
              strokeLinejoin="round"
            />
            <path
              d={d}
              fill="none"
              stroke="#3d4758"
              strokeWidth={w - 4}
              strokeLinejoin="round"
            />
            <path
              d={d}
              fill="none"
              stroke="#0f141c"
              strokeWidth={Math.max(1, w - 7)}
              strokeLinejoin="round"
            />
            {flowing && (
              <path
                d={d}
                fill="none"
                stroke={c}
                strokeOpacity={0.35 + 0.65 * (share ?? 0)}
                strokeWidth={Math.max(1.6, w - 8)}
                strokeLinecap="round"
                strokeDasharray="4 16"
                className="fuel-dash"
                style={
                  {
                    animationDuration: "2.2s",
                    filter: `drop-shadow(0 0 3px ${c})`,
                  } as CSSProperties
                }
              />
            )}
            {/* 플랜지: 꺾이는 곳과 탱크 위 */}
            <rect
              x={outletX(i) - 8}
              y={ly + 12}
              width="16"
              height="4"
              fill="#6b7a92"
              fillOpacity="0.8"
            />
            <rect
              x={to[a].x - 8}
              y={to[a].y - 16}
              width="16"
              height="4"
              fill="#6b7a92"
              fillOpacity="0.8"
            />
          </g>
        );
      })}
    </g>
  );
}

/** 주 연료통(T-0)과 이름판 */
export function MainTank({ feed }: { feed: WeeklyFeed }) {
  const t = MAIN;
  const g = GLASS;
  const cx = t.x + t.w / 2;
  const main = feed.main;
  const left = main ? 100 - main.usedPct : 0;
  const level = main ? levelOf(main.usedPct) : "ok";
  const fy = g.y + g.h * (1 - left / 100);
  const pct = main ? pctText(main.usedPct) : undefined;
  const second = feed.rest.find((l) => l.id === "five-hour") ?? feed.rest[0];
  const lines: { text: string; color: string; size: number; bold?: boolean }[] =
    [];
  if (main && pct) {
    lines.push({
      text: `${limitLabel(main)} ${pct.left} 남음${
        main.resetsAt === undefined
          ? ""
          : ` · 리셋 ${resetShort(main.resetsAt, feed.now)}(${untilText(main.resetsAt, feed.now)})`
      }`,
      color: level === "ok" ? MAIN_FUEL : LEVEL_COLOR[level],
      size: 10.5,
      bold: true,
    });
  } else {
    lines.push({
      text: "리셋됨 · 새 값 기다리는 중",
      color: "#cfd8e8",
      size: 10.5,
      bold: true,
    });
  }
  if (second) {
    const p = pctText(second.usedPct);
    lines.push({
      text: `${limitLabel(second)} ${p.left} 남음${
        second.resetsAt === undefined
          ? ""
          : ` · 리셋 ${untilText(second.resetsAt, feed.now)}`
      }`,
      color: LEVEL_COLOR[levelOf(second.usedPct)],
      size: 9.5,
    });
  }
  if (feed.stale && feed.at !== undefined)
    lines.push({
      text: `${agoText(feed.at, feed.now)} 값`,
      color: "#cfd8e8",
      size: 9,
    });
  const plateY = t.y + t.h + 12;
  const plateH = 12 + lines.length * 14;
  return (
    <g
      data-weekly-tank
      data-level={level}
      style={{ opacity: feed.stale ? 0.5 : 1 }}
    >
      {/* 받침 */}
      <rect
        x={t.x + 12}
        y={t.y + t.h - 2}
        width={t.w - 24}
        height="10"
        rx="2"
        fill="#11161f"
        stroke="#ffffff"
        strokeOpacity="0.08"
      />
      {/* 몸통·뚜껑 */}
      <rect
        x={t.x}
        y={t.y + 10}
        width={t.w}
        height={t.h - 20}
        fill="url(#fr-metal)"
      />
      <ellipse cx={cx} cy={t.y + 10} rx={t.w / 2} ry="12" fill="url(#fr-cap)" />
      <ellipse
        cx={cx}
        cy={t.y + t.h - 10}
        rx={t.w / 2}
        ry="12"
        fill="#1a212c"
      />
      {/* 이음 띠와 리벳 */}
      {[0.3, 0.7].map((f) => (
        <g key={f}>
          <rect
            x={t.x}
            y={t.y + t.h * f - 3}
            width={t.w}
            height="6"
            fill="#000"
            fillOpacity="0.28"
          />
          {[0.1, 0.9].map((r) => (
            <circle
              key={r}
              cx={t.x + t.w * r}
              cy={t.y + t.h * f}
              r="1.8"
              fill="#8a97ad"
              fillOpacity="0.7"
            />
          ))}
        </g>
      ))}
      {/* 몸통에 칠한 번호 */}
      <text
        x={t.x + 14}
        y={t.y + 40}
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fontWeight="700"
        fill="#e8edf7"
        fillOpacity="0.35"
      >
        T-0
      </text>
      {/* 들여다보는 창: 남은 연료만 */}
      <rect
        x={g.x - 3}
        y={g.y - 3}
        width={g.w + 6}
        height={g.h + 6}
        rx="6"
        fill="#0b0f16"
        stroke="#8a97ad"
        strokeOpacity="0.45"
      />
      <rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        rx="4"
        fill="url(#fr-glass)"
      />
      {main && left > 0 && (
        <>
          <rect
            data-weekly-fuel
            x={g.x}
            y={fy}
            width={g.w}
            height={g.y + g.h - fy}
            rx="4"
            fill={MAIN_FUEL}
            fillOpacity="0.85"
            style={{ filter: `drop-shadow(0 0 6px ${MAIN_FUEL})` }}
          />
          <line
            x1={g.x}
            x2={g.x + g.w}
            y1={fy}
            y2={fy}
            stroke="#fff"
            strokeOpacity="0.85"
          />
        </>
      )}
      {/* 눈금(남은 양) */}
      {[0, 50, 100].map((p) => {
        const ty = g.y + g.h * (1 - p / 100);
        return (
          <g key={p}>
            <line
              x1={g.x + g.w + 3}
              x2={g.x + g.w + 10}
              y1={ty}
              y2={ty}
              stroke="#cfd8e8"
              strokeOpacity="0.45"
            />
            <text
              x={g.x + g.w + 13}
              y={ty + 3}
              fontSize="8"
              fontFamily="ui-monospace, monospace"
              fill="#cfd8e8"
              fillOpacity="0.5"
            >
              {p}
            </text>
          </g>
        );
      })}
      {[25, 75].map((p) => (
        <line
          key={p}
          x1={g.x + g.w + 3}
          x2={g.x + g.w + 7}
          y1={g.y + g.h * (1 - p / 100)}
          y2={g.y + g.h * (1 - p / 100)}
          stroke="#cfd8e8"
          strokeOpacity="0.35"
        />
      ))}
      {/* 이름판 */}
      <rect
        x={cx - 116}
        y={plateY}
        width="232"
        height={plateH}
        rx="2"
        fill="#0d1118"
        stroke="#ffffff"
        strokeOpacity="0.1"
      />
      {lines.map((l, n) => (
        <text
          key={l.text}
          data-weekly-line={n}
          x={cx}
          y={plateY + 16 + n * 14}
          textAnchor="middle"
          fontSize={l.size}
          fontWeight={l.bold ? 600 : 400}
          fontFamily={l.bold ? undefined : "ui-monospace, monospace"}
          fill={l.color}
          fillOpacity={l.bold ? 1 : 0.8}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

/** 주 연료통 말풍선 자리(통과 이름판) */
export const MAIN_ZONE = {
  x: MAIN.x - 8,
  y: MAIN.y - 12,
  w: MAIN.w + 16,
  h: MAIN.h + 70,
};
