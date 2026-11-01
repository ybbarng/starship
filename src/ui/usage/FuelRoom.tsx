"use client";

// 연료실: 오늘 쓴 연료(출력 토큰)를 탱크·배관·추진체로 그린다. 설계: docs/usage.md "연료실".
// 왼쪽 탱크 셋(업무·개인·기타)은 오늘 연소 몫만큼 차고, 배관의 점은 최근 15분 연소가 셀수록 빨리 흐르고,
// 오른쪽 추진체 불꽃은 그 영역의 지금 속도(분당 출력)만큼 길다. 위 속도계는 전체 속도, 아래는 시간별 속도 기록.
// 구석의 연료 기록 노트를 누르면 자세한 도표(/usage)로 간다. 이름마다 마우스를 올리면 실제 뜻이 보인다.
import Link from "next/link";
import { useUsage } from "@/data/hooks";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import { Tip } from "@/ui/kit/Tip";
import { AREA_LABEL, type Area, type UsageResponse } from "@/usage/model";
import { tokens, usd } from "./UsagePage";

const AREAS: Area[] = ["work", "personal", "other"];

const COLOR: Record<Area, string> = {
  work: "#6aa8ff",
  personal: "#ffb45c",
  other: "#8792a8",
};

/** 바늘 끝: 분당 2만 토큰. 세션 하나는 수백, 여럿이 바쁘면 수천이라 로그 눈금으로 그린다(2026-11-01 실측 7,927/분) */
const SPEED_FULL = 20_000;

export function FuelRoom() {
  const query = useUsage("today");
  const data = query.data;
  return (
    <main className={`min-h-dvh text-white ${cockpit.panel}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/50 px-4 py-2.5">
        <Link
          href="/"
          className="rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          ← 갑판으로
        </Link>
        <h1 className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-[#ffb45c]/80">
            FUEL ROOM
          </span>
          <span className="text-[15px] font-semibold">연료실</span>
          <span className="text-[12px] text-white/45">
            · 오늘의 연료와 추력
          </span>
        </h1>
        {data?.meta.source === "demo" && (
          <span className="ml-auto rounded bg-[#ffd84a]/15 px-1.5 py-0.5 text-[11.5px] font-semibold text-[#ffd84a]">
            데모 · 지어낸 숫자예요
          </span>
        )}
      </header>
      {query.isLoading || !data ? (
        <p className="p-8 text-white/55">연료실 계기를 켜는 중…</p>
      ) : (
        <Room data={data} />
      )}
    </main>
  );
}

function Room({ data }: { data: UsageResponse }) {
  const total = data.total.output || 1;
  const maxBurn = Math.max(1, ...AREAS.map((a) => data.burn.perMin[a]));
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* 연료 흐름도 */}
        <section
          data-fuel-flow
          className={`relative rounded-xl px-4 py-4 ${cockpit.bay}`}
        >
          <h2 className="mb-3 text-[10.5px] font-semibold tracking-[0.18em] text-white/40">
            연료 흐름도
          </h2>
          <div className="flex flex-col gap-4">
            {AREAS.map((a) => (
              <Line
                key={a}
                area={a}
                share={data.areas[a].output / total}
                today={data.areas[a].output}
                cost={data.areas[a].cost}
                perMin={data.burn.perMin[a]}
                flame={data.burn.perMin[a] / maxBurn}
                windowMin={data.burn.windowMin}
              />
            ))}
          </div>
        </section>

        {/* 속도계와 노트 */}
        <div className="flex flex-col gap-4">
          <Speedometer data={data} />
          <Tip
            align="end"
            text={
              "연료 기록 노트 = 자세한 도표.\n오늘·7일·30일, 업무·개인 합계, 승무원(프로젝트)·세션 순위, 날마다 연소, 엔진(모델)별"
            }
          >
            <Link
              href="/usage"
              data-fuel-notebook
              className="group flex w-full items-center gap-3 rounded-lg border border-[#ffb45c]/30 bg-[#2a1f12]/60 px-3 py-3 hover:border-[#ffb45c]/60"
            >
              <Notebook />
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-[#ffd9a8]">
                  연료 기록 노트
                </span>
                <span className="text-[11.5px] text-white/50">
                  펼치면 자세한 도표 ▸
                </span>
              </span>
            </Link>
          </Tip>
        </div>
      </div>

      <HourLog data={data} />
    </div>
  );
}

/** 탱크 → 배관 → 추진체 한 줄 */
function Line({
  area,
  share,
  today,
  cost,
  perMin,
  flame,
  windowMin,
}: {
  area: Area;
  share: number;
  today: number;
  cost: number;
  perMin: number;
  flame: number;
  windowMin: number;
}) {
  const c = COLOR[area];
  const label = AREA_LABEL[area];
  // 흐름 점이 한 바퀴 도는 시간: 셀수록 짧게(0.6초~), 안 쓰면 멈춤
  const flowSecs = perMin > 0 ? Math.max(0.6, 4 - 3.4 * flame) : 0;
  return (
    <div data-fuel-line={area} className="flex items-center gap-3">
      <Tip
        align="start"
        text={`${label} 탱크 = ${label} 프로젝트 세션이 오늘 쓴 연료(출력 토큰).\n오늘 ${tokens(today)} · 오늘 연소의 ${Math.round(share * 100)}% · 연료비 추정 ${usd(cost)}`}
      >
        <button
          type="button"
          className="flex w-[130px] shrink-0 cursor-default items-center gap-2 outline-none"
        >
          <span className="relative h-[54px] w-[22px] overflow-hidden rounded-[6px] border border-white/20 bg-black/40">
            <span
              className="absolute inset-x-0 bottom-0 transition-[height] duration-700"
              style={{
                height: `${Math.max(3, share * 100)}%`,
                background: `linear-gradient(180deg, ${c}, ${c}88)`,
                boxShadow: `0 0 10px ${c}66`,
              }}
            />
          </span>
          <span className="flex flex-col text-left">
            <span className="text-[12px] font-semibold" style={{ color: c }}>
              {label} 탱크
            </span>
            <span className="font-mono text-[12px] text-white/80">
              {tokens(today)}
            </span>
          </span>
        </button>
      </Tip>

      {/* 배관: 점이 흐른다 */}
      <Tip
        text={`${label} 배관 = 탱크에서 추진체로 가는 연료. 점이 빨리 흐를수록 최근 ${windowMin}분에 많이 썼어요.`}
        className="min-w-0 flex-1"
      >
        <button
          type="button"
          className="relative h-[10px] w-full cursor-default overflow-hidden rounded-full border border-white/10 bg-black/40 outline-none"
        >
          {flowSecs > 0 && (
            <span
              className="fuel-flow absolute inset-0"
              style={
                {
                  backgroundImage: `radial-gradient(circle, ${c} 0 2px, transparent 2.5px)`,
                  backgroundSize: "18px 10px",
                  animationDuration: `${flowSecs}s`,
                } as React.CSSProperties
              }
            />
          )}
        </button>
      </Tip>

      {/* 추진체 */}
      <Tip
        align="end"
        text={`${label} 추진체 = 지금 ${label} 쪽 속도.\n최근 ${windowMin}분 동안 분당 ${tokens(Math.round(perMin))} 토큰을 태웠어요.`}
      >
        <button
          type="button"
          className="flex w-[170px] shrink-0 cursor-default items-center gap-2 outline-none"
        >
          <span className="relative flex h-[30px] w-[26px] items-center justify-center rounded-l-md border border-white/20 bg-[#1b212c]">
            <span className="h-[14px] w-[6px] rounded-sm bg-white/20" />
          </span>
          <span
            className="fuel-flame h-[14px] rounded-r-full"
            style={{
              width: `${perMin > 0 ? 12 + flame * 70 : 0}px`,
              background: `linear-gradient(90deg, #fff6e0, ${c}, transparent)`,
              boxShadow: perMin > 0 ? `0 0 12px ${c}` : undefined,
            }}
          />
          <span className="ml-auto font-mono text-[11px] text-white/60">
            {tokens(Math.round(perMin))}/분
          </span>
        </button>
      </Tip>
    </div>
  );
}

/** 반원 속도계: 바늘이 전체 분당 출력을 가리킨다 */
function Speedometer({ data }: { data: UsageResponse }) {
  const v = data.burn.total;
  const r = Math.min(1, Math.log10(1 + v) / Math.log10(1 + SPEED_FULL));
  const angle = -90 + r * 180;
  return (
    <Tip
      align="end"
      text={`속도 = 최근 ${data.burn.windowMin}분 동안 분당 태운 연료(출력 토큰), 모든 탱크 합.\n눈금은 로그(1·10·100·1천·1만), 바늘 끝은 분당 ${tokens(SPEED_FULL)}. 기록은 최대 5분 늦어요.`}
    >
      <button
        type="button"
        data-fuel-speed
        className={`flex w-full cursor-default flex-col items-center rounded-xl px-4 pt-3 pb-3 outline-none ${cockpit.screen}`}
      >
        <svg viewBox="-60 -60 120 70" className="w-[220px]" aria-hidden>
          <path
            d="M -50 0 A 50 50 0 0 1 50 0"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="7"
          />
          <path
            d="M -50 0 A 50 50 0 0 1 50 0"
            fill="none"
            stroke="#ffb45c"
            strokeWidth="7"
            strokeDasharray={`${r * 157} 157`}
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-42"
            stroke="#fff"
            strokeWidth="2"
            transform={`rotate(${angle})`}
          />
          <circle r="4" fill="#fff" />
        </svg>
        <span className="font-mono text-[26px] leading-none font-semibold">
          {tokens(Math.round(v))}
        </span>
        <span className="mt-1 text-[11.5px] text-white/50">
          분당 토큰 · 지금 속도
        </span>
        <span className="mt-2 text-[11.5px] text-white/60">
          오늘 연소 {tokens(data.total.output)} · 연료비 추정{" "}
          {usd(data.total.cost)}
        </span>
      </button>
    </Tip>
  );
}

/** 시간별 속도 기록: 오늘 시간마다 분당 출력(시간 합 ÷ 60), 영역별로 쌓는다 */
function HourLog({ data }: { data: UsageResponse }) {
  const perMin = data.hours.map((h) => ({
    at: h.at,
    work: h.work / 60,
    personal: h.personal / 60,
    other: h.other / 60,
  }));
  const max = Math.max(1, ...perMin.map((h) => h.work + h.personal + h.other));
  return (
    <section data-fuel-hours>
      <Tip
        align="start"
        text="시간별 속도 = 그 시간 동안 평균 분당 출력 토큰. 언제 일을 많이 시켰는지(시간당 업무량) 보여요."
      >
        <button
          type="button"
          className="mb-2 cursor-default text-[10.5px] font-semibold tracking-[0.18em] text-white/40 outline-none"
        >
          속도 기록 · 오늘 시간별
        </button>
      </Tip>
      <div
        className={`flex h-[130px] items-end gap-[3px] rounded-lg border border-white/10 px-3 pt-3 pb-1 ${cockpit.screen}`}
      >
        {perMin.map((h) => {
          const sum = h.work + h.personal + h.other;
          const hour = new Date(h.at).getHours();
          return (
            <div
              key={h.at}
              className="flex min-w-0 flex-1 flex-col items-stretch"
              title={`${hour}시 · 분당 ${tokens(Math.round(sum))} (업무 ${tokens(Math.round(h.work))} · 개인 ${tokens(Math.round(h.personal))})`}
            >
              <div
                className="flex flex-col-reverse"
                style={{ height: `${(sum / max) * 96}px` }}
              >
                {AREAS.map((a) =>
                  h[a] > 0 ? (
                    <div
                      key={a}
                      style={{
                        height: `${(h[a] / sum) * 100}%`,
                        background: COLOR[a],
                      }}
                      className="opacity-80"
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-1 text-center text-[9.5px] text-white/35">
                {hour}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Notebook() {
  return (
    <svg viewBox="0 0 40 46" className="h-[46px] w-[40px] shrink-0" aria-hidden>
      <rect x="4" y="2" width="32" height="42" rx="3" fill="#8a5a2b" />
      <rect x="8" y="2" width="28" height="42" rx="2" fill="#c98b4a" />
      <rect x="12" y="10" width="20" height="2" fill="#5a3a1a" opacity="0.6" />
      <rect x="12" y="16" width="16" height="2" fill="#5a3a1a" opacity="0.5" />
      <rect x="12" y="22" width="18" height="2" fill="#5a3a1a" opacity="0.5" />
      <path
        d="M 8 30 L 14 26 L 20 29 L 26 22 L 32 25"
        stroke="#2a1a0a"
        strokeWidth="1.5"
        fill="none"
      />
      {[8, 16, 24, 32, 40].map((y) => (
        <circle key={y} cx="6" cy={y} r="1.6" fill="#2a1f12" />
      ))}
    </svg>
  );
}
