"use client";

// 갑판 4 왼쪽 도킹 베이: 사람이 부른 교신선이 포트에 붙어 있다. 포트를 누르면 해치가 열린다.
// 오른쪽 기관실: 원자로 옆 기관 계기판(정기 작업·서비스 상태 = gauges).
import { useEffect, useRef } from "react";
import type { Gauge } from "@/protocol/v1";
import { ago } from "@/ui/kit";
import type { Berth } from "./berths";
import { DECKS, FIXTURES, SLAB } from "./geometry";
import { SHIP, Ship } from "./ships";

const GAUGE_COLOR: Record<Gauge["status"], string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "#4a5468",
};

export const PORTS = 3;

export function DockDeck({
  berths,
  gauges,
  clock,
  openId,
  onHatch,
}: {
  berths: Berth[];
  gauges: Gauge[];
  clock: number;
  openId: string | null;
  onHatch: (id: string) => void;
}) {
  const d = DECKS.engine;
  const f = d.floor;
  const { x0, x1 } = FIXTURES.bay;
  const pitch = (x1 - x0 - 16) / PORTS;
  const docked = berths.slice(0, PORTS);
  const waiting = berths.length - docked.length;
  // 처음 그린 뒤 새로 들어온 배만 베이 문에서 미끄러져 들어온다
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (seen.current) {
    for (const b of docked) if (!seen.current.has(b.id)) fresh.add(b.id);
  }
  useEffect(() => {
    seen.current = new Set(berths.map((b) => b.id));
  }, [berths]);

  const e = FIXTURES.engine;
  return (
    <>
      {Array.from({ length: PORTS }, (_, i) => i).map((i) => {
        const cx = x0 + 16 + pitch * (i + 0.5);
        const b = docked[i];
        const c = b ? SHIP[b.kind].color : "#4a5468";
        return (
          <div key={`port-${i + 1}`}>
            {/* 포트 번호(바닥 판) */}
            <div
              className="pointer-events-none absolute text-center font-mono text-[9px] leading-[11px] font-bold"
              style={{
                left: cx - 30,
                width: 60,
                top: f + 1,
                height: SLAB - 1,
                color: b ? c : "#5a6478",
              }}
            >
              포트 {i + 1}
            </div>
            {/* 받침대 */}
            <div
              className="pointer-events-none absolute rounded-t-sm"
              style={{
                left: cx - 26,
                width: 52,
                top: f - 6,
                height: 6,
                background: "#3a4152",
                boxShadow: b ? `0 -2px 8px ${c}55` : undefined,
              }}
            />
            {b ? (
              <button
                type="button"
                data-port={i + 1}
                data-berth={b.id}
                onClick={() => onHatch(b.id)}
                aria-label={`포트 ${i + 1}: ${b.from} · ${b.line}`}
                className="group absolute flex flex-col items-center rounded-md outline-none hover:bg-white/[0.05]"
                style={{
                  left: cx - pitch / 2 + 3,
                  width: pitch - 6,
                  top: d.top + 16,
                  height: f - d.top - 16,
                  boxShadow:
                    openId === b.id
                      ? `0 0 0 2px ${c}, 0 0 14px ${c}66`
                      : undefined,
                }}
              >
                <span className="mt-0.5 w-full truncate px-0.5 text-[10px] leading-[12px] font-semibold text-white">
                  {b.from}
                </span>
                <span
                  className="w-full truncate px-0.5 text-[9px] leading-[11px]"
                  style={{ color: c }}
                >
                  {b.source} · {ago(b.since, clock)}
                </span>
                <span
                  className={`absolute bottom-[4px] ${fresh.has(b.id) ? "ib-dock" : "ib-bob"}`}
                  style={{ ["--d" as string]: `${-i * 0.9}s` }}
                >
                  <Ship kind={b.kind} width={Math.min(92, pitch - 10)} />
                </span>
                <span className="absolute -top-1 right-1 h-2 w-2 rounded-full bg-[#ffcf5c] ib-blink" />
              </button>
            ) : (
              <div
                className="pointer-events-none absolute flex items-end justify-center rounded-md border border-dashed border-white/10 pb-3 text-[9px] text-white/30"
                style={{
                  left: cx - pitch / 2 + 6,
                  width: pitch - 12,
                  top: d.top + 34,
                  height: f - d.top - 42,
                }}
              >
                빈 포트
              </div>
            )}
          </div>
        );
      })}
      {waiting > 0 && (
        <div
          className="absolute rounded bg-black/70 px-1.5 text-[9.5px] leading-[15px] font-semibold text-[#ffd84a]"
          style={{ left: x0 - 4, top: d.top + 2 }}
        >
          베이 밖 대기 +{waiting}척
        </div>
      )}

      {/* 기관 계기판 */}
      <div
        className="absolute overflow-hidden px-1.5 py-1"
        style={{
          left: e.x1 - 118,
          top: d.top + 18,
          width: 112,
          height: f - d.top - 30,
        }}
      >
        <div className="text-[8.5px] leading-[11px] font-semibold tracking-wider text-white/45">
          기관 계기
        </div>
        <ul data-scroll-inside className="max-h-[70px] overflow-auto">
          {gauges.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-1 text-[9px] leading-[11.5px]"
              title={g.detail}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.status === "error" ? "ib-blink" : ""}`}
                style={{ background: GAUGE_COLOR[g.status] }}
              />
              <span className="min-w-0 flex-1 truncate text-white/75">
                {g.label}
              </span>
              {g.value && (
                <span className="shrink-0 font-mono text-white/45">
                  {g.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="pointer-events-none absolute text-[8.5px] text-[#6fe3ff]/60"
        style={{ left: e.x0 + 60, top: d.top + 18 }}
      >
        원자로
      </div>
    </>
  );
}
