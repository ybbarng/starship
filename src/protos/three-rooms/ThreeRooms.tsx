"use client";

// 시안 2. 세 방을 오가는 선원.
// 첫 화면: 위 55% 창밖(오늘의 항로 띠) + 아래 계기판. 스크롤하면 계기판이 대기실 앞 문 위 창으로 줄고, 세 방이 나란히 보인다.
import { useEffect, useMemo, useState } from "react";
import { useBridge } from "@/data/hooks";
import { SpaceView } from "@/sky/SpaceView";
import { EventLayer } from "@/ui/events";
import {
  DestinationPicker,
  Modal,
  ProtoBadge,
  Toasts,
  useScrollStage,
} from "@/ui/kit";
import { CrewCard, TaskCard } from "./Cards";
import { Cockpit } from "./Cockpit";
import { Deck } from "./Deck";
import { FIGURE_CSS } from "./Figures";
import { DECK_H, DECK_W, ROOMS, WAIT_GEO } from "./layout";
import { buildRooms } from "./model";
import { RouteBand, WarpBanner } from "./RouteBand";
import { useRoute, useRouteTracker } from "./route";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const WINDOW_TOP = 0.55;
const WINDOW_INTERIOR = 0.3;

function useViewport() {
  const [vp, setVp] = useState({ w: 1372, h: 872 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

export function ThreeRooms() {
  const bridge = useBridge();
  const { tasks, now, next, hails, crew, crewById, gauges, isLoading } = bridge;
  useRouteTracker(tasks, !isLoading);
  const cleared = useRoute((s) => s.cleared);
  const model = useMemo(() => buildRooms(tasks, crew), [tasks, crew]);
  const { stage, progress: p, push, goTo } = useScrollStage();
  const { w: W, h: H } = useViewport();

  const [crewModal, setCrewModal] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const crewSel = crewModal ? crewById.get(crewModal) : undefined;
  const taskSel = taskModal ? tasks.find((t) => t.id === taskModal) : undefined;

  // 갑판 자리: 창밖 띠 아래를 채우도록 늘이고 줄인다
  const deckTop = H * WINDOW_INTERIOR + 8;
  const k = Math.min((W - 24) / DECK_W, (H - deckTop - 8) / DECK_H);
  const deckLeft = (W - DECK_W * k) / 2;
  // 계기판이 줄어 들어앉을 곳: 대기실 조종석 문 위 창
  const port = WAIT_GEO.porthole;
  const tx = deckLeft + (ROOMS.wait.x + port.x) * k;
  const ty = deckTop + port.y * k;
  const s = (port.w * k) / W;
  const panelTop = H * WINDOW_TOP;
  const winH = H * lerp(WINDOW_TOP, WINDOW_INTERIOR, p);
  const resist = stage === 0 ? push * 14 : 0;
  const deckOpacity = Math.min(1, Math.max(0, (p - 0.35) / 0.5));

  return (
    <main
      className="fixed inset-0 bg-hull-950 text-white"
      style={{ overflow: "clip" }}
    >
      <style>{FIGURE_CSS}</style>

      {/* 갑판(세 방) */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${deckLeft}px, ${deckTop + (1 - p) * 70}px) scale(${k})`,
          transformOrigin: "0 0",
          opacity: deckOpacity,
          pointerEvents: stage === 1 ? "auto" : "none",
        }}
        aria-hidden={stage !== 1}
      >
        <Deck model={model} active={stage === 1} onCockpit={() => goTo(0)} />
      </div>

      {/* 창밖 */}
      <div
        className="absolute inset-x-0 top-0 z-10 overflow-hidden"
        style={{ height: winH, transform: `translateY(${-resist}px)` }}
      >
        <div className="absolute inset-0">
          <SpaceView className="h-full w-full" labels="few" drift />
        </div>
        <div className="absolute inset-x-0 top-[78px] bottom-0">
          <EventLayer every={240} firstDelay={150} />
        </div>
        <WindowFrame />
        <RouteBand compact={stage === 1 && p > 0.6} />
        <WarpBanner />
      </div>

      {/* 계기판: 스크롤하면 대기실 문 위 작은 창으로 줄어든다 */}
      <div
        className="absolute top-0 left-0 z-20"
        style={{
          width: W,
          height: H - panelTop,
          transform: `translate(${lerp(0, tx, p)}px, ${lerp(panelTop, ty, p) - resist}px) scale(${lerp(1, s, p)})`,
          transformOrigin: "0 0",
          pointerEvents: stage === 0 && p < 0.05 ? "auto" : "none",
          borderRadius: p > 0.5 ? 40 : 0,
          overflow: "hidden",
        }}
      >
        <Cockpit
          model={model}
          now={now}
          next={next}
          tasks={tasks}
          hails={hails}
          gauges={gauges}
          cleared={cleared}
          onRoom={() => goTo(1)}
          onCrew={(c) => setCrewModal(c.id)}
          onTask={(t) => setTaskModal(t.id)}
          onNav={() => setNavOpen(true)}
        />
      </div>

      {stage === 1 && p > 0.9 && (
        <button
          type="button"
          onClick={() => goTo(0)}
          className="absolute right-4 z-30 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs text-white/70 backdrop-blur hover:text-white"
          style={{ top: H * WINDOW_INTERIOR - 34 }}
        >
          ↑ 조종석으로
        </button>
      )}

      <Modal
        open={!!crewSel}
        onClose={() => setCrewModal(null)}
        title="승무원"
        width={460}
      >
        {crewSel && <CrewCard crew={crewSel} />}
      </Modal>
      <Modal
        open={!!taskSel}
        onClose={() => setTaskModal(null)}
        title="교신 · 대기실 방문객"
        width={460}
      >
        {taskSel && <TaskCard task={taskSel} />}
      </Modal>
      <Modal
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="항법 · 목적지"
        width={720}
      >
        <p className="mb-3 text-xs text-white/55">
          오늘의 항로와 따로 아무 곳이나 들를 수 있어요. 다음에 하나 치우면
          항로의 다음 칸으로 워프해요.
        </p>
        <DestinationPicker onPick={() => setNavOpen(false)} />
      </Modal>

      <ProtoBadge name="2. 세 방을 오가는 선원" />
      <Toasts />
    </main>
  );
}

/** 창틀: 둥근 안쪽 모서리와 리벳 */
function WindowFrame() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 0 10px #1a2236, inset 0 0 0 12px #2c3a5c, inset 0 0 60px 20px rgba(0,0,0,.55)",
          borderRadius: "0 0 28px 28px",
        }}
      />
    </div>
  );
}
