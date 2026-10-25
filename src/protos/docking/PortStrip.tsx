"use client";

// 창 아래 가장자리: 내 배 옆구리를 거울처럼 비추는 띠. 포트 여섯 칸에 교신선이 붙는다.
import { ago, CONTEXT_COLOR, CONTEXT_LABEL } from "@/ui/kit";
import { STRIP_H, useArriving, useFlights } from "./Flights";
import { type Berth, PORT_COUNT } from "./model";
import { SHIP, Ship } from "./ships";

const PAD = 18;

export function PortStrip({
  berths,
  nowId,
  onOpen,
  now,
}: {
  berths: Berth[];
  nowId?: string;
  onOpen: (b: Berth) => void;
  now: number;
}) {
  const arriving = useArriving();
  const clamped = useFlights((s) => s.clamped);
  const docked = berths.slice(0, PORT_COUNT);
  const waiting = berths.length - docked.length;
  const slot = (i: number) =>
    `calc(${PAD}px + ${i} * (100% - ${PAD * 2}px) / ${PORT_COUNT})`;
  const slotW = `calc((100% - ${PAD * 2}px) / ${PORT_COUNT})`;

  return (
    <div
      className="absolute right-0 left-0"
      style={{ height: STRIP_H, bottom: 0 }}
    >
      {/* 거울 테두리 */}
      <div
        className="pointer-events-none absolute inset-x-1.5 top-1 bottom-0 rounded-t-[22px]"
        style={{
          border: "5px solid #0c111d",
          borderBottom: 0,
          boxShadow:
            "inset 0 0 0 1px rgba(160,190,255,.18), 0 0 0 1px rgba(255,255,255,.06)",
        }}
      />
      <div className="pointer-events-none absolute top-[-9px] left-7 rounded-t-md bg-[#0c111d] px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.18em] text-white/55">
        옆구리 거울 · 도킹 포트 {PORT_COUNT}
        <span className="ml-2 font-normal tracking-normal text-white/35">
          ◂ 앞쪽일수록 오래 기다림
        </span>
      </div>
      {/* 선체 띠 */}
      <div
        className="absolute inset-x-1.5 bottom-0"
        style={{
          top: 58,
          background:
            "linear-gradient(180deg,#5b6889 0%,#3a4562 7%,#262f47 40%,#1a2135 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,.18)",
        }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 6px 6px, rgba(255,255,255,.35) 1px, transparent 1.6px), linear-gradient(90deg, rgba(0,0,0,.35) 1px, transparent 1px)",
            backgroundSize: "60px 30px, 120px 100%",
          }}
        />
        {/* 거울 반사 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, transparent 20%, rgba(255,255,255,.06) 32%, transparent 44%, transparent 70%, rgba(255,255,255,.05) 78%, transparent 86%)",
          }}
        />
      </div>
      {/* 포트 고리(늘 그 자리에) */}
      {Array.from({ length: PORT_COUNT }, (_, i) => {
        const b = docked[i];
        const lit = !!b && !arriving.has(b.id);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 포트는 자리 번호가 곧 이름
            key={i}
            className="pointer-events-none absolute"
            style={{ left: slot(i), width: slotW, top: 50, height: 16 }}
          >
            <div
              className="absolute left-1/2 h-4 w-[54px] -translate-x-1/2 rounded-t-full border-2 border-b-0"
              style={{
                borderColor: lit ? SHIP[b.kind].color : "#4b5674",
                background: "#0c111d",
                boxShadow: lit ? `0 0 10px ${SHIP[b.kind].color}66` : "none",
              }}
            />
            <div
              className="absolute top-[3px] left-[calc(50%-38px)] h-1.5 w-1.5 rounded-full"
              style={{ background: lit ? "#5ee08a" : "#2d354b" }}
            />
            <div
              className="absolute top-[3px] left-[calc(50%+32px)] h-1.5 w-1.5 rounded-full"
              style={{ background: lit ? "#5ee08a" : "#2d354b" }}
            />
            {!b && (
              <div className="absolute top-[26px] left-0 w-full text-center text-[11px] text-white/30">
                포트 {i + 1} · 비어 있음
              </div>
            )}
          </div>
        );
      })}
      {/* 붙어 있는 배와 이름표(자리가 바뀌면 미끄러져 옮긴다) */}
      {docked.map((b, i) => {
        const isArriving = arriving.has(b.id);
        const isClamped = !!clamped[b.id];
        const isNow = b.id === nowId;
        const c = SHIP[b.kind].color;
        const mins = (now - b.since) / 60_000;
        return (
          <button
            key={b.id}
            type="button"
            data-dk-slot={i}
            data-dk-tag={b.id}
            onClick={() => onOpen(b)}
            className="group absolute top-0 bottom-0 cursor-pointer text-left transition-[left] duration-700 ease-out"
            style={{ left: slot(i), width: slotW }}
            aria-label={`포트 ${i + 1}: ${b.from}, ${b.line}`}
          >
            <div
              data-dk-ship={b.id}
              className={`absolute left-1/2 -translate-x-1/2 ${isClamped ? "" : ""}`}
              style={{
                top: 11,
                width: 92,
                height: 46,
                opacity: isArriving ? 0 : 1,
              }}
            >
              <div
                className={isClamped ? "dk-clamp" : "dk-bob"}
                style={{ "--d": `${-i * 0.7}s` } as React.CSSProperties}
              >
                <Ship kind={b.kind} width={92} flame={false} />
              </div>
            </div>
            {isNow && !isArriving && (
              <div
                className="dk-pulse pointer-events-none absolute top-[49px] left-2 rounded px-1.5 text-[10px] leading-4 font-bold text-hull-950"
                style={{ background: c }}
              >
                지금 할 일
              </div>
            )}
            {isClamped && (
              <>
                <div
                  className="dk-ring pointer-events-none absolute top-[44px] left-1/2 -ml-[30px] h-[60px] w-[60px] rounded-full border-2"
                  style={{ borderColor: c }}
                />
                <div className="dk-pop pointer-events-none absolute top-[4px] left-1/2 rounded-md bg-white px-1.5 text-xs font-black text-hull-950">
                  철컥!
                </div>
              </>
            )}
            <div
              className={`absolute right-1.5 bottom-2 left-1.5 overflow-hidden rounded-lg border bg-[#0b1020]/90 px-2 py-1.5 transition group-hover:bg-[#141b2f] ${isArriving ? "opacity-60" : ""} ${isClamped ? "dk-tag-in" : ""}`}
              style={{
                top: 66,
                borderColor: isNow ? c : "rgba(255,255,255,.12)",
                boxShadow: isNow
                  ? `0 0 0 1px ${c}, 0 0 18px ${c}77`
                  : "inset 0 1px 0 rgba(255,255,255,.05)",
              }}
            >
              <div
                className="absolute top-0 bottom-0 left-0 w-1"
                style={{ background: CONTEXT_COLOR[b.context] }}
              />
              {isArriving ? (
                <div className="dk-pulse pl-1 text-[12px] leading-5 text-white/70">
                  포트 {i + 1} · {b.from} 배 접근 중…
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 pl-1 text-[12.5px] leading-4">
                    <span className="truncate font-semibold text-white">
                      {b.from}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: c }}>
                      · {b.source}
                    </span>
                    <span
                      className={`ml-auto shrink-0 text-[11px] font-semibold ${mins >= 60 ? "text-signal-warn" : "text-white/70"}`}
                    >
                      {ago(b.since, now)}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 pl-1 text-[12px] leading-[15px] text-white/80">
                    {b.line}
                  </div>
                </>
              )}
              <span className="sr-only">{CONTEXT_LABEL[b.context]}</span>
            </div>
          </button>
        );
      })}
      {waiting > 0 && (
        <div className="absolute top-2 right-6 rounded-full border border-signal-warn/60 bg-black/70 px-3 py-1 text-xs font-semibold text-signal-warn">
          +{waiting}척 대기
        </div>
      )}
    </div>
  );
}
