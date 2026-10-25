"use client";

// 갑판 1 함교·통신실의 글과 단추. 왼쪽 = 내 자리(조종석 축소판, 여기서 조종석으로 돌아간다),
// 오른쪽 = 통신 콘솔(실제 교신 지연·지구까지 거리, 들어온 교신 줄 → 누르면 도킹 베이 해치가 열린다).
import type { Task } from "@/protocol/v1";
import { formatDistance, formatLightTime } from "@/sky/telemetry";
import { useKoreaTime, useTelemetry } from "@/sky/useTelemetry";
import { useDestination } from "@/sky/voyage";
import { ago, CONTEXT_COLOR } from "@/ui/kit";
import type { Berth } from "./berths";
import { selecting } from "./Figures";
import { DECKS, LADDER } from "./geometry";
import { SHIP } from "./ships";

export function BridgeDeck({
  now,
  mine,
  hailCount,
  berths,
  clock,
  onCockpit,
  onHatch,
}: {
  now: Task | undefined;
  /** 내 차례(할 일 전부) 수 */
  mine: number;
  hailCount: number;
  berths: Berth[];
  clock: number;
  onCockpit: () => void;
  onHatch: (id: string) => void;
}) {
  const d = DECKS.bridge;
  const f = d.floor;
  const dest = useDestination();
  const tm = useTelemetry(2);
  const { time } = useKoreaTime();
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
            <span className="font-mono text-white/60">{time}</span>
          </div>
          <div className="text-white/85">
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
        <div className="flex justify-between gap-2 border-b border-white/10 px-1.5 text-[9px] leading-[14px] text-[#cbb6ff]">
          <span>통신 · 도킹 {berths.length}척</span>
          <span className="truncate text-white/55">
            지구 {formatDistance(tm.earthKm)} · 지연{" "}
            {formatLightTime(tm.earthKm)}
          </span>
        </div>
        {berths.length === 0 ? (
          <div className="px-1.5 pt-2 text-[10px] text-white/40">
            조용함 — 들어온 교신 없음
          </div>
        ) : (
          <ul className="px-0.5 pt-0.5">
            {berths.slice(0, 3).map((b) => (
              <li key={b.id}>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: 도킹 베이 포트 단추가 같은 일을 키보드로 받는다 */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: 글을 끌어 고를 수 있게 단추로 감싸지 않는다 */}
                <div
                  data-hail={b.id}
                  onClick={() => !selecting() && onHatch(b.id)}
                  className="flex cursor-pointer items-center gap-1 rounded px-1 text-[10px] leading-[14px] hover:bg-white/10"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: SHIP[b.kind].color }}
                  />
                  <b
                    className="shrink-0"
                    style={{ color: CONTEXT_COLOR[b.context] }}
                  >
                    {b.from}
                  </b>
                  <span className="min-w-0 flex-1 truncate text-white/75">
                    {b.line}
                  </span>
                  <span className="shrink-0 text-white/40">
                    {ago(b.since, clock)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        className="pointer-events-none absolute text-[8.5px] text-white/40"
        style={{ left: commsX + 8, top: f - 27 }}
      >
        통신 콘솔 · 줄을 누르면 도킹 베이 해치가 열려요
      </div>
    </>
  );
}
