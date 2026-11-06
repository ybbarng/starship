"use client";

// 갑판 1 함교·통신실의 글과 단추. 왼쪽 = 내 자리(조종석 축소판, 여기서 조종석으로 돌아간다),
// 오른쪽 = 통신 콘솔(실제 교신 지연·지구까지 거리, 도킹 베이에 붙은 교신선 수).
// 교신 줄은 두지 않는다. 교신은 갑판 4 도킹 베이 한 곳에서 본다(docs/crew-views.md, 2026-11-06).
// 시계·거리는 선내가 보일 때(active)만 돈다. 조종석에서는 선내가 display:none으로 숨어도 마운트돼 있어서다.
import type { Task } from "@/protocol/v1";
import { formatDistance, formatLightTime } from "@/sky/telemetry";
import { useKoreaTime, useTelemetry } from "@/sky/useTelemetry";
import { useDestination } from "@/sky/voyage";
import { DECKS, LADDER } from "./geometry";

/** 한국 시각(1초마다). 선내가 보일 때만 마운트한다 */
function KoreaClock() {
  const { time } = useKoreaTime();
  return <>{time}</>;
}

/** 지구까지 거리·지연(초당 2번). 선내가 보일 때만 마운트한다 */
function EarthLink() {
  const tm = useTelemetry(2);
  return (
    <>
      지구 {formatDistance(tm.earthKm)} · 지연 {formatLightTime(tm.earthKm)}
    </>
  );
}

export function BridgeDeck({
  active,
  now,
  mine,
  hailCount,
  docked,
  onCockpit,
}: {
  /** 선내가 보일 때만 true. false면 시계·거리를 멈춘다 */
  active: boolean;
  /** 맨 앞 결재(소식 뺀 것) */
  now: Task | undefined;
  /** 내 차례 = 결재 수(decisionCount). 조종석 결재함과 같다 */
  mine: number;
  hailCount: number;
  /** 도킹 베이에 붙은 교신선 수 */
  docked: number;
  onCockpit: () => void;
}) {
  const d = DECKS.bridge;
  const f = d.floor;
  const dest = useDestination();
  const consoleX = d.x0 + 18;
  const commsX = LADDER.x + LADDER.w + 26;
  const commsW = d.x1 - 70 - commsX;
  return (
    <>
      {/* 내 자리: 조종석 축소판 화면 */}
      <div
        className="absolute overflow-hidden rounded-md border border-[#3a4a6a] bg-[#050a16] shadow-[inset_0_0_14px_rgba(108,182,255,0.18)]"
        style={{ left: consoleX + 4, top: d.top + 16, width: 200, height: 50 }}
      >
        <span className="ib-scan pointer-events-none absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-[#6cb6ff]/10 to-transparent" />
        <div className="relative px-1.5 py-1 text-[10px] leading-[13px]">
          <div className="flex justify-between text-[#9cc8ff]">
            <span>
              창밖 · <b className="text-white">{dest.ko}</b>
            </span>
            <span className="font-mono text-white/60">
              {active ? <KoreaClock /> : null}
            </span>
          </div>
          <div className="text-white/85" data-bridge-mine={mine}>
            내 차례 <b className="text-[#ffd84a]">{mine}</b> · 교신{" "}
            <b className="text-[#b896ff]">{hailCount}</b>
          </div>
          <div className="truncate text-white/60">
            {now ? `지금: ${now.title}` : "기다리는 일 없음"}
          </div>
        </div>
      </div>
      <button
        type="button"
        data-cockpit
        onClick={onCockpit}
        className="absolute rounded-[4px] border border-[#6cb6ff]/60 bg-[#14233f] px-2 text-[10px] leading-[16px] font-semibold text-[#cfe6ff] shadow-[0_0_10px_rgba(108,182,255,0.35)] hover:bg-[#1d3260] hover:text-white"
        style={{ left: consoleX + 10, top: f - 30 }}
      >
        ▲ 조종석으로
      </button>
      <div
        className="pointer-events-none absolute text-[8.5px] text-white/40"
        style={{ left: consoleX + 104, top: f - 27 }}
      >
        내 자리
      </div>

      {/* 통신 콘솔 */}
      <div
        className="absolute overflow-hidden rounded-md border border-[#4a3a6a] bg-[#0a0716] shadow-[inset_0_0_14px_rgba(184,150,255,0.18)]"
        style={{
          left: commsX + 4,
          top: d.top + 14,
          width: commsW - 8,
          height: 60,
        }}
      >
        <div className="border-b border-white/10 px-1.5 text-[9px] leading-[14px] text-[#cbb6ff]">
          통신 · 지구 회선
        </div>
        <div className="px-1.5 pt-1 text-[10.5px] leading-[15px] text-white/80">
          {active ? <EarthLink /> : null}
        </div>
        <div className="px-1.5 text-[10px] leading-[14px] text-white/55">
          {docked > 0 ? (
            <>
              도킹 베이에 교신선 <b className="text-[#b896ff]">{docked}</b>척 ▾
            </>
          ) : (
            "조용함 — 들어온 교신 없음"
          )}
        </div>
      </div>
      <div
        className="pointer-events-none absolute text-[8.5px] text-white/40"
        style={{ left: commsX + 8, top: f - 27 }}
      >
        통신 콘솔 · 교신은 아래 도킹 베이에서
      </div>
    </>
  );
}
