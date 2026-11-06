"use client";

// 길 찾기 서랍: 접힌 자리("+n")를 누르면 그 선원 목록, 도킹 베이 "베이 밖 +n척"을 누르면 교신 전체 목록.
// 한 선원의 결재·브리핑은 여기서 다시 그리지 않는다(2026-11-06, docs/crew-views.md). 선원을 누르면
// 결재가 있으면 조종석 결재함의 그 묶음으로, 없으면 선실(현황판)로 간다.
import type { Crew, Task } from "@/protocol/v1";
import { ago, CONTEXT_COLOR, CREW_STATUS_LABEL } from "@/ui/kit";
import type { Berth } from "./berths";
import { PORTS } from "./Dock";
import { SHIP } from "./ships";

export type DrawerState =
  | { type: "group"; title: string; ids: string[] }
  | { type: "hails" };

const STATUS_DOT: Record<Crew["status"], string> = {
  working: "#5ee08a",
  "needs-you": "#ffd84a",
  idle: "#6c7a99",
  off: "#3a4256",
};

export function Drawer({
  state,
  crewById,
  decisions,
  berths,
  clock,
  onSelect,
  onHatch,
  onClose,
}: {
  state: DrawerState;
  crewById: Map<string, Crew>;
  /** 승무원별 결재(decisionsByCrew) */
  decisions: ReadonlyMap<string, Task[]>;
  berths: Berth[];
  clock: number;
  /** 선원을 고르면: 결재함이나 선실로 */
  onSelect: (id: string) => void;
  onHatch: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={state.type === "hails" ? "교신 목록" : "선원 목록"}
      className="ib-drawer absolute top-2 right-2 bottom-2 z-30 flex w-[372px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b1020]/95 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 pt-3 pb-2.5">
        <div className="text-[15px] font-semibold">
          {state.type === "group" ? state.title : `교신 ${berths.length}척`}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="서랍 닫기"
          className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto px-4 py-3"
        data-scroll-inside
      >
        {state.type === "hails" ? (
          <HailList berths={berths} clock={clock} onHatch={onHatch} />
        ) : (
          <ul className="space-y-1">
            {state.ids.map((id) => {
              const c = crewById.get(id);
              if (!c) return null;
              const n = decisions.get(id)?.length ?? 0;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-left text-sm hover:bg-white/10"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_DOT[c.status] }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-auto text-xs text-white/50">
                      {n > 0 ? `결재 ${n}` : CREW_STATUS_LABEL[c.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** 교신 전체: 포트에 붙은 셋 다음 베이 밖에서 기다리는 배까지. 누르면 해치가 열린다 */
function HailList({
  berths,
  clock,
  onHatch,
}: {
  berths: Berth[];
  clock: number;
  onHatch: (id: string) => void;
}) {
  if (!berths.length)
    return <p className="text-sm text-white/50">들어온 교신이 없어요.</p>;
  return (
    <ul className="space-y-1.5">
      {berths.map((b, i) => (
        <li key={b.id}>
          <button
            type="button"
            data-hail-row={b.id}
            onClick={() => onHatch(b.id)}
            className="flex w-full items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-sm hover:bg-white/10"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: SHIP[b.kind].color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-white/50">
                {i < PORTS ? `포트 ${i + 1}` : "베이 밖"} · {b.source} ·{" "}
                {ago(b.since, clock)}
              </span>
              <b style={{ color: CONTEXT_COLOR[b.context] }}>{b.from}</b>
              <span className="ml-1 text-white/80">{b.line}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
