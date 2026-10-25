"use client";

// 조종석 층: 평소엔 우주가 주인공. 창틀·큰 계기판 없이 가장자리에 얇은 것들만 둔다.
//   왼쪽 위 = 항법 계기(진짜 값), 아래 가운데 = 행성 단추 줄, 아래 왼쪽 = 일 신호 띠 → 할 일 패널,
//   오른쪽 가장자리 = 교신 칩 → "교신 수신 중" 화상 창, 오른쪽 위 = 승무원·계기 등 단추.
// 이 층 전체는 pointer-events:none 위에 있고, 부품만 pointer-events:auto라 빈 하늘은 그대로 끌어 둘러본다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBridge } from "@/data/hooks";
import type { Task } from "@/protocol/v1";
import { CrewButtons, CrewPanel, type CrewTab } from "./CrewPanel";
import { HailChips, HailScreen } from "./Hails";
import { NavInstrument } from "./NavInstrument";
import { PlanetBar } from "./PlanetBar";
import { type PanelState, TaskPanel, WorkStrip } from "./Tasks";
import { useNow, usePersisted } from "./ui";

export function Cockpit({
  active,
  push,
  onInterior,
  grid,
  onGrid,
}: {
  /** 적도 좌표 격자가 켜져 있나 */
  grid: boolean;
  onGrid: () => void;
  /** 첫 장면일 때만 true. false면 키보드 단축키 등을 꺼 둔다. */
  active: boolean;
  /** 스크롤 문턱까지 밀린 정도(0..1) */
  push: number;
  /** 내부 장면으로 가기 */
  onInterior: () => void;
}) {
  const bridge = useBridge();
  const now = useNow();
  const [panel, setPanel] = usePersisted<PanelState>("open-bridge:tasks", {
    open: false,
    w: 400,
    h: 440,
  });
  const [crewTab, setCrewTab] = useState<CrewTab | null>(null);

  const hails = useMemo(
    () => [...bridge.hails].sort((a, b) => b.since - a.since),
    [bridge.hails],
  );
  const taskById = useMemo(
    () => new Map<string, Task>(bridge.tasks.map((t) => [t.id, t])),
    [bridge.tasks],
  );
  const hail = useHailScreen(hails.map((h) => h.id));
  const current = hails.find((h) => h.id === hail.openId);

  const togglePanel = useCallback(
    () => setPanel((p) => ({ ...p, open: !p.open })),
    [setPanel],
  );

  // 단축키: T = 할 일 패널, Esc = 맨 위에 열린 것부터 닫기
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t" || e.key === "T" || e.key === "ㅅ") {
        e.preventDefault();
        togglePanel();
      } else if (e.key === "Escape") {
        if (document.querySelector('[role="dialog"]')) return;
        if (hail.openId) hail.close();
        else if (crewTab) setCrewTab(null);
        else if (panel.open) setPanel((p) => ({ ...p, open: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, togglePanel, hail, crewTab, panel.open, setPanel]);

  const openHail = (id: string) => {
    setCrewTab(null);
    hail.open(id);
  };
  const openCrew = (t: CrewTab | null) => {
    if (t) hail.close();
    setCrewTab(t);
  };

  return (
    <div className="absolute inset-0 text-white">
      {/* 왼쪽 위: 항법 계기 */}
      <div className="absolute top-9 left-4">
        <NavInstrument grid={grid} onGrid={onGrid} />
      </div>

      {/* 오른쪽 위: 승무원·계기 등 */}
      <div className="absolute top-3 right-4 flex flex-col items-end gap-2">
        <CrewButtons
          crew={bridge.crew}
          gauges={bridge.gauges}
          open={crewTab}
          onOpen={openCrew}
        />
        {crewTab && (
          <CrewPanel
            tab={crewTab}
            crew={bridge.crew}
            gauges={bridge.gauges}
            tasksByCrew={bridge.tasksByCrew}
            now={now}
            onTab={setCrewTab}
            onClose={() => setCrewTab(null)}
          />
        )}
        {current && !crewTab && (
          <HailScreen
            hail={current}
            task={current.taskId ? taskById.get(current.taskId) : undefined}
            index={hails.indexOf(current)}
            count={hails.length}
            now={now}
            onStep={(d) => hail.step(d)}
            onClose={hail.close}
          />
        )}
      </div>

      {/* 오른쪽 가장자리: 교신 칩(화상 창이 열려 있으면 숨긴다) */}
      {!current && !crewTab && (
        <div className="absolute top-1/2 right-4 -translate-y-1/2">
          <HailChips
            hails={hails}
            seen={hail.seen}
            now={now}
            onOpen={openHail}
          />
        </div>
      )}

      {/* 아래 왼쪽: 할 일 패널 + 일 신호 띠 */}
      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
        {panel.open && (
          <TaskPanel
            tasks={bridge.tasks}
            crewById={bridge.crewById}
            size={panel}
            now={now}
            onResize={(w, h) => setPanel((p) => ({ ...p, w, h }))}
            onClose={() => setPanel((p) => ({ ...p, open: false }))}
          />
        )}
        <WorkStrip
          tasks={bridge.tasks}
          hailCount={hails.length}
          open={panel.open}
          now={now}
          onToggle={togglePanel}
        />
      </div>

      {/* 아래 가운데: 행성 단추 줄 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <PlanetBar />
      </div>

      {/* 아래 오른쪽: 선내로 */}
      <button
        type="button"
        onClick={onInterior}
        className="pointer-events-auto absolute right-4 bottom-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition hover:bg-white/10"
        style={{
          color: `rgba(255,255,255,${0.4 + push * 0.55})`,
          background:
            push > 0.05 ? `rgba(108,182,255,${push * 0.18})` : undefined,
        }}
      >
        선내로 내려가기
        <span
          className="inline-block transition-transform"
          style={{ transform: `translateY(${push * 3}px)` }}
        >
          ▾
        </span>
      </button>
    </div>
  );
}

/** 교신 화상 창: 무엇을 열었나, 무엇을 이미 봤나. 보던 교신이 치워지면 다음 것으로, 없으면 닫는다. */
function useHailScreen(ids: string[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const key = ids.join("|");

  // 보던 교신이 치워지면 다음 것으로, 없으면 닫는다
  useEffect(() => {
    const list = key ? key.split("|") : [];
    setOpenId((id) => (!id || list.includes(id) ? id : (list[0] ?? null)));
  }, [key]);

  useEffect(() => {
    if (openId && !seen.has(openId)) setSeen((s) => new Set(s).add(openId));
  }, [openId, seen]);

  return useMemo(
    () => ({
      openId,
      seen,
      open: (id: string) => setOpenId(id),
      close: () => setOpenId(null),
      step: (d: number) =>
        setOpenId((id) => {
          const list = idsRef.current;
          if (!list.length) return null;
          const i = Math.max(0, list.indexOf(id ?? ""));
          return list[(i + d + list.length) % list.length] ?? null;
        }),
    }),
    [openId, seen],
  );
}
