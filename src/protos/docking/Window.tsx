"use client";

// 창밖: 실제 하늘 + 항구 별 넷의 이름표 + 이벤트 층 + 새 교신 안내.
import { useEffect, useRef } from "react";
import { projector } from "@/sky/projector";
import { SpaceView } from "@/sky/SpaceView";
import { useDestination, useVoyage } from "@/sky/voyage";
import { EventLayer } from "@/ui/events";
import { STRIP_H, useFlights } from "./Flights";
import { type Berth, starOnWindow } from "./model";
import { SHIP, SHIP_KINDS, Ship } from "./ships";

export function SpaceWindow({
  berths,
  stage,
}: {
  berths: Berth[];
  stage: number;
}) {
  return (
    <>
      {/* SpaceView는 스스로 position: relative를 두므로 바깥 상자로 크기를 준다 */}
      <div className="absolute inset-0">
        <SpaceView className="h-full w-full" labels="few" drift starScale={1} />
      </div>
      <PortStars berths={berths} hidden={stage > 0} />
      <div className="absolute inset-0" style={{ bottom: STRIP_H - 30 }}>
        <EventLayer every={100} firstDelay={40} enabled={stage === 0} />
      </div>
      <TopLine hidden={stage > 0} />
      <ArrivalBanner />
    </>
  );
}

function TopLine({ hidden }: { hidden: boolean }) {
  const dest = useDestination();
  const phase = useVoyage((s) => s.phase);
  return (
    <div
      className="pointer-events-none absolute top-2 right-4 text-right text-xs text-white/60 transition-opacity"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <span className="text-white/40">목적지 </span>
      <span className="font-medium text-white/85">{dest.ko}</span>
      <span className="ml-2">
        {phase === "travel" ? "이동 중…" : dest.fact}
      </span>
    </div>
  );
}

/** 항구 별 넷: 창 안이면 그 자리에, 창 밖이면 가장자리에 방향 화살표와 함께 */
function PortStars({ berths, hidden }: { berths: Berth[]; hidden: boolean }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const W = projector.width;
      const H = projector.height;
      const placed: { x: number; y: number }[] = [];
      for (const kind of SHIP_KINDS) {
        const el = refs.current[kind];
        if (!el) continue;
        const p = starOnWindow(SHIP[kind].ra, SHIP[kind].dec, {
          left: 28,
          top: 84,
          right: W - 28,
          bottom: H - STRIP_H - 16,
        });
        if (!p) {
          el.style.opacity = "0";
          continue;
        }
        let { y } = p;
        // 이름표끼리 겹치면 아래로 비킨다
        for (const q of placed) {
          if (Math.abs(q.x - p.x) < 170 && Math.abs(q.y - y) < 30) y = q.y + 30;
        }
        placed.push({ x: p.x, y });
        el.style.opacity = "1";
        el.style.transform = `translate(${p.x}px, ${y}px)`;
        el.dataset.inside = p.inside ? "1" : "0";
        const arrow = el.querySelector<SVGSVGElement>("[data-arrow]");
        if (arrow) {
          arrow.style.display = p.inside ? "none" : "block";
          arrow
            .querySelector("path")
            ?.setAttribute("transform", `rotate(${(p.angle * 180) / Math.PI})`);
        }
        const dot = el.querySelector<HTMLElement>("[data-dot]");
        if (dot) dot.style.display = p.inside ? "block" : "none";
        // 오른쪽 가장자리에 붙으면 글을 왼쪽으로
        const label = el.querySelector<HTMLElement>("[data-label]");
        if (label) {
          const flip = p.x > W - 220;
          label.style.left = flip ? "auto" : "12px";
          label.style.right = flip ? "12px" : "auto";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      {SHIP_KINDS.map((kind) => {
        const mine = berths.filter((b) => b.kind === kind);
        const services = [...new Set(mine.map((b) => b.source))];
        const c = SHIP[kind].color;
        return (
          <div
            key={kind}
            ref={(el) => {
              refs.current[kind] = el;
            }}
            className="absolute top-0 left-0"
            style={{ opacity: 0 }}
          >
            <div
              data-dot
              className="absolute -top-[7px] -left-[7px] h-[14px] w-[14px] rounded-full border-2"
              style={{ borderColor: c, boxShadow: `0 0 10px ${c}` }}
            />
            <svg
              data-arrow
              aria-hidden
              viewBox="-8 -8 16 16"
              className="absolute -top-[8px] -left-[8px] h-4 w-4"
              style={{ overflow: "visible" }}
            >
              <path d="M9 0 L-4 -4.5 L-4 4.5 Z" fill={c} />
            </svg>
            <div
              data-label
              className="absolute -top-[10px] flex items-center gap-1.5 whitespace-nowrap rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] leading-4 backdrop-blur-[1px]"
              style={{ left: 12, color: c }}
            >
              <Ship kind={kind} width={22} flame={false} />
              <span className="font-semibold">{SHIP[kind].star} 항구</span>
              <span className="text-white/60">
                {services.length ? services.join("·") : SHIP[kind].source}
              </span>
              {mine.length > 0 && (
                <span className="rounded bg-white/10 px-1 text-white/80">
                  {mine.length}척
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 교신선이 날아오는 동안 창 위쪽 가운데에 한 줄 */
function ArrivalBanner() {
  const flight = useFlights((s) =>
    s.flights.findLast((f) => f.mode === "arrive"),
  );
  const clamped = useFlights((s) => s.clamped);
  const docked = Object.keys(clamped).length > 0;
  if (!flight && !docked) return null;
  if (!flight) {
    return (
      <div className="dk-banner pointer-events-none absolute top-9 left-1/2 rounded-full border border-signal-ok/60 bg-black/70 px-4 py-1.5 text-sm text-white shadow-lg">
        <span className="font-semibold text-signal-ok">철컥 · 도킹 완료</span>
        <span className="ml-2 text-white/75">
          포트 이름표를 눌러 해치를 열어요
        </span>
      </div>
    );
  }
  const b = flight.berth;
  const c = SHIP[b.kind].color;
  return (
    <div
      key={flight.key}
      className="dk-banner pointer-events-none absolute top-9 left-1/2 flex max-w-[70%] items-center gap-2 rounded-full border bg-black/70 px-4 py-1.5 text-sm text-white shadow-lg"
      style={{ borderColor: `${c}aa` }}
    >
      <span
        className="dk-pulse h-2 w-2 shrink-0 rounded-full"
        style={{ background: c }}
      />
      <span className="shrink-0 font-semibold" style={{ color: c }}>
        새 교신
      </span>
      <span className="shrink-0 text-white/70">
        {SHIP[b.kind].star} 항구에서 {b.from}({b.source})
      </span>
      <span className="truncate text-white/90">— {b.line}</span>
    </div>
  );
}
