"use client";

// 주간 연료: 계정 사용 한도(본부 값)를 연료통 위에 보인다. 설계: docs/usage.md "주간 연료".
// - WeeklyFuelBand: 연료 기록 노트(/usage) 위쪽의 큰 띠(연료실은 WeeklyTank.tsx의 주 연료통). 쓴 부분을 업무·개인·기타 몫으로 나눠 칠한다.
// - useFuelLimitLines: 조종석 연료 계기의 짧은 줄과 말풍선 글.
// 본부가 없거나(ok:false) 아직 모르면 아무것도 그리지 않는다.
import { useUsage } from "@/data/hooks";
import { useMinuteClock, useUsageLimits } from "@/data/limits";
import { limitLabel, type UsageLimit } from "@/protocol/limits";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import { Tip } from "@/ui/kit/Tip";
import {
  AREAS,
  agoText,
  isExpired,
  isStale,
  LEVEL_COLOR,
  levelOf,
  pctText,
  resetText,
  splitUsed,
  untilText,
} from "@/usage/limits";
import { AREA_LABEL, type Area } from "@/usage/model";

/** 조종석 연료 계기·연료실 탱크와 같은 색 */
export const FUEL_COLOR: Record<Area, string> = {
  work: "#6aa8ff",
  personal: "#ffb45c",
  other: "#9aa6bd",
};

export type Shown = {
  /** 본부 값을 보일 수 있나(ok:true, 시계가 돎) */
  ready: boolean;
  /** 리셋이 지나지 않은 한도. 주간이 맨 앞 */
  limits: UsageLimit[];
  /** 본부가 값을 받은 때 */
  at?: number;
  stale: boolean;
  now: number;
  demo: boolean;
};

export function useShownLimits(): Shown {
  const { data } = useUsageLimits();
  const now = useMinuteClock();
  if (!data?.ok || now === 0)
    return { ready: false, limits: [], stale: false, now, demo: false };
  const limits = data.limits
    .filter((l) => !isExpired(l.resetsAt, now))
    .sort((a, b) => (a.id === "week" ? -1 : b.id === "week" ? 1 : 0));
  return {
    ready: true,
    limits,
    at: data.at,
    stale: isStale(data.at, now),
    now,
    demo: data.source === "demo",
  };
}

export function resetLine(l: UsageLimit, now: number): string {
  return l.resetsAt === undefined
    ? "리셋 시각 모름"
    : `리셋 ${resetText(l.resetsAt)}(${untilText(l.resetsAt, now)})`;
}

/* ───────────── 큰 띠(연료실·연료 기록 노트) ───────────── */

export function WeeklyFuelBand() {
  const shown = useShownLimits();
  // 영역 몫은 "7일" 기간(오늘 포함 7일, 자정 기준)으로 근사한다. 리셋 구간(리셋 7일 전 ~ 지금)과 몇 시간 어긋난다
  const usage = useUsage("7d").data;
  if (!shown.ready) return null;
  const [main, ...rest] = shown.limits;
  const { now, stale, at } = shown;

  return (
    <section
      data-weekly-fuel
      className={`relative overflow-hidden rounded-xl border border-white/10 px-4 py-3 ${cockpit.screen} ${stale ? "opacity-55" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] tracking-[0.25em] text-[#7ce0ff]/55">
          WEEKLY FUEL · 주간 연료
        </span>
        <span className="ml-auto font-mono text-[10.5px] text-white/35">
          {shown.demo ? "데모 · 지어낸 값" : "계정 한도 · 본부 값"}
          {at !== undefined && ` · ${agoText(at, now)} 값`}
          {stale && " · 오래된 값이에요"}
        </span>
      </div>
      {!main ? (
        <p data-weekly-reset className="font-mono text-[13px] text-white/60">
          리셋됨 · 새 값 기다리는 중
        </p>
      ) : (
        <MainLimit limit={main} now={now} usage={usage?.areas} />
      )}
      {rest.map((l) => (
        <SmallLimit key={l.id} limit={l} now={now} />
      ))}
    </section>
  );
}

function MainLimit({
  limit,
  now,
  usage,
}: {
  limit: UsageLimit;
  now: number;
  usage: Parameters<typeof splitUsed>[1] | undefined;
}) {
  const level = levelOf(limit.usedPct);
  const pct = pctText(limit.usedPct);
  const split = usage ? splitUsed(limit.usedPct, usage) : undefined;
  const basis =
    split?.basis === "cost"
      ? "추정 비용"
      : split?.basis === "output"
        ? "출력 토큰"
        : undefined;
  const tip = split
    ? `쓴 몫을 영역마다 나눈 것은 근사예요.\n이 컴퓨터 기록의 "7일"(오늘 포함, 자정 기준) 영역별 ${basis ?? "사용량"} 비율로 나눴어요.\n리셋 구간(리셋 7일 전부터 지금)과 몇 시간 어긋나고, 웹·다른 기기에서 쓴 것은 빠져요.\n${AREAS.map((a) => `${AREA_LABEL[a]} ${split.parts[a].toFixed(1)}%`).join(" · ")}`
    : "영역 몫은 사용량 통계를 읽으면 나눠 칠해요";
  return (
    <div data-weekly-main data-level={level}>
      <p
        className="mb-2 font-mono text-[14px] font-semibold"
        style={{ color: LEVEL_COLOR[level] }}
      >
        {limitLabel(limit)} {pct.used} 사용 · {pct.left} 남음
        <span className="font-normal text-white/55">
          {" "}
          · {resetLine(limit, now)}
        </span>
      </p>
      <Tip text={tip} side="bottom" align="start" className="w-full">
        <span
          className="relative flex h-4 w-full overflow-hidden rounded-md bg-white/[0.06] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
          style={
            level === "ok"
              ? undefined
              : { boxShadow: `0 0 0 1px ${LEVEL_COLOR[level]}` }
          }
          role="img"
          aria-label={`${limitLabel(limit)} ${pct.used} 사용`}
        >
          {split ? (
            AREAS.map((a) => (
              <span
                key={a}
                data-weekly-part={a}
                className="h-full"
                style={{
                  width: `${split.parts[a]}%`,
                  background: FUEL_COLOR[a],
                  boxShadow: `0 0 6px ${FUEL_COLOR[a]}80`,
                }}
              />
            ))
          ) : (
            <span
              className="h-full bg-white/50"
              style={{ width: `${limit.usedPct}%` }}
            />
          )}
          {/* 25% 눈금 */}
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-black/40"
              style={{ left: `${t}%` }}
            />
          ))}
        </span>
      </Tip>
      {split && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-white/50">
          {AREAS.map((a) => (
            <span key={a} className="flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-sm"
                style={{ background: FUEL_COLOR[a] }}
              />
              {AREA_LABEL[a]} {Math.round(split.parts[a])}%
            </span>
          ))}
          <span className="text-white/30">
            · 남은 {pct.left}를 업무·개인·기타가 나눠 써요(몫은 근사)
          </span>
        </p>
      )}
    </div>
  );
}

export function SmallLimit({ limit, now }: { limit: UsageLimit; now: number }) {
  const level = levelOf(limit.usedPct);
  const pct = pctText(limit.usedPct);
  return (
    <div
      data-weekly-extra={limit.id}
      className="mt-2 flex items-center gap-2 text-[11px]"
    >
      <span
        className="w-24 shrink-0 font-mono"
        style={{ color: LEVEL_COLOR[level] }}
      >
        {limitLabel(limit)} {pct.used}
      </span>
      <span className="relative h-[5px] w-40 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${limit.usedPct}%`,
            background: LEVEL_COLOR[level],
          }}
        />
      </span>
      <span className="text-white/45">{resetLine(limit, now)}</span>
    </div>
  );
}

/* ───────────── 조종석 계기의 짧은 줄 ───────────── */

export type FuelLimitLine = { id: string; text: string; color: string };

/**
 * 조종석 계기용: 줄(짧게, "주간 50% · 리셋 7시간 뒤")과 말풍선에 덧붙일 자세한 글.
 * 본부가 없으면 lines가 빈다. 오래된 값이면 stale.
 */
export function useFuelLimitLines(): {
  lines: FuelLimitLine[];
  tip?: string;
  stale: boolean;
} {
  const shown = useShownLimits();
  if (!shown.ready) return { lines: [], stale: false };
  const { now, at, stale } = shown;
  const ago = at !== undefined ? ` · ${agoText(at, now)} 값` : "";
  if (shown.limits.length === 0)
    return {
      lines: [
        { id: "reset", text: "주간 리셋됨 · 새 값 기다림", color: "#cfd8e8" },
      ],
      tip: `계정 한도: 리셋됨, 새 값 기다리는 중${ago}`,
      stale,
    };
  const shortReset = (l: UsageLimit) =>
    l.resetsAt === undefined ? "" : ` · 리셋 ${untilText(l.resetsAt, now)}`;
  // 좁으니 주간과 5시간까지 두 줄만
  const pick = shown.limits
    .filter((l, i) => i === 0 || l.id === "five-hour")
    .slice(0, 2);
  const lines = pick.map((l) => ({
    id: l.id,
    text: `${limitLabel(l)} ${pctText(l.usedPct).used}${shortReset(l)}`,
    color: LEVEL_COLOR[levelOf(l.usedPct)],
  }));
  const tip = `계정 한도${shown.demo ? "(데모)" : ""}${ago}${stale ? " · 오래된 값" : ""}\n${shown.limits
    .map((l) => {
      const p = pctText(l.usedPct);
      return `${limitLabel(l)} ${p.used} 사용 · ${p.left} 남음 · ${resetLine(l, now)}`;
    })
    .join("\n")}`;
  return { lines, tip, stale };
}
