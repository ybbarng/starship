"use client";

// 시안 3. 도킹하는 교신선.
// 사람이 부르면 출처별 배가 그 출처의 항구 별 쪽에서 날아와 내 배 옆구리 포트에 붙는다.
// 첫 화면 = 조종석(창밖 + 옆구리 거울 띠 + 계기판), 스크롤 뒤 = 위에서 본 우주선 평면도.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Crew } from "@/protocol/v1";
import {
  DestinationPicker,
  Modal,
  ProtoBadge,
  Toasts,
  useScrollStage,
} from "@/ui/kit";
import { CrewPanel, GaugeRow, MainDisplay, PortPanel } from "./Console";
import { CrewDetail } from "./CrewDetail";
import { FlightLayer, STRIP_H, slotCenter, useFlights } from "./Flights";
import { HatchModal } from "./HatchModal";
import { type Berth, useBerths } from "./model";
import { PLAN_H, PLAN_W, PlanView } from "./PlanView";
import { PortStrip } from "./PortStrip";
import { SHIP } from "./ships";
import { DOCKING_CSS } from "./styles";
import { SpaceWindow } from "./Window";

const WINDOW_SHARE = 0.56;
const OBS_SHARE = 0.28;

function useViewport() {
  const [size, setSize] = useState({ w: 1372, h: 872 });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

function useClock(every = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

/** 새로 생긴 교신은 날아오고, 사라진 교신은 떠난다 */
function useArrivals(berths: Berth[], loading: boolean) {
  const add = useFlights((s) => s.add);
  const seen = useRef<Map<string, Berth> | null>(null);
  const rects = useRef(new Map<string, { x: number; y: number; w: number }>());

  useLayoutEffect(() => {
    for (const b of berths) {
      const r = slotCenter(b.id);
      if (r) rects.current.set(b.id, r);
    }
  });

  useEffect(() => {
    if (loading) return;
    const cur = new Map(berths.map((b) => [b.id, b]));
    if (!seen.current) {
      seen.current = cur;
      // ?arrive=1: 가장 최근 교신 하나가 처음부터 다시 날아온다(도착 연출 확인용)
      const newest = berths.at(-1);
      if (newest && new URLSearchParams(window.location.search).has("arrive")) {
        window.setTimeout(() => add({ berth: newest, mode: "arrive" }), 1500);
      }
      return;
    }
    for (const [id, b] of cur) {
      if (!seen.current.has(id)) add({ berth: b, mode: "arrive" });
    }
    for (const [id, b] of seen.current) {
      if (cur.has(id)) continue;
      const from = rects.current.get(id);
      if (from) add({ berth: b, mode: "depart", from });
    }
    seen.current = cur;
  }, [berths, loading, add]);
}

export function DockingProto() {
  const data = useBerths();
  const { berths, nowBerth } = data;
  const { stage, progress: p, push, goTo } = useScrollStage();
  const { w: vw, h: vh } = useViewport();
  const clock = useClock();
  const [hatchId, setHatchId] = useState<string | null>(null);
  const [crewId, setCrewId] = useState<string | null>(null);
  const [nav, setNav] = useState(false);
  useArrivals(berths, data.isLoading);

  const hatch = berths.find((b) => b.id === hatchId) ?? null;
  const hatchPort = hatch ? berths.indexOf(hatch) + 1 : 0;
  const crew = crewId ? data.crewById.get(crewId) : undefined;
  const openCrew = (c: Crew) => setCrewId(c.id);

  // 창 크기와 자리: 조종석에서는 위 56%, 평면도에서는 위 1/3의 둥근 관측창
  const winH = vh * WINDOW_SHARE;
  const s = OBS_SHARE / WINDOW_SHARE;
  const obsW = vw * s;
  const obsX = (vw - obsW) / 2;
  const obsY = 12;
  const scale = 1 - (1 - s) * p;
  const radius = (150 * p) / scale;

  const planTop = obsY + vh * OBS_SHARE + 4;
  const k = Math.min((vw - 24) / PLAN_W, (vh - planTop - 6) / PLAN_H);
  const planLeft = (vw - PLAN_W * k) / 2;
  // 조종석은 평면도 앞코의 조종석 자리로 줄어든다
  const bridgeX = planLeft + 96 * k;
  const bridgeY = planTop + 293 * k;

  return (
    <main className="fixed inset-0 overflow-hidden bg-hull-950 text-white select-none">
      <style>{DOCKING_CSS}</style>

      {/* 평면도 */}
      <div
        data-dk-active={stage === 1 ? "" : undefined}
        className="absolute"
        style={{
          left: planLeft,
          top: planTop,
          width: PLAN_W,
          height: PLAN_H,
          transform: `translateY(${(1 - p) * 60}px) scale(${k})`,
          transformOrigin: "0 0",
          opacity: p,
          pointerEvents: stage === 1 ? "auto" : "none",
        }}
      >
        <PlanView
          crew={data.crew}
          tasksByCrew={data.tasksByCrew}
          berths={berths}
          nowId={nowBerth?.id}
          clock={clock}
          onCrew={openCrew}
          onBerth={(b) => setHatchId(b.id)}
          onCockpit={() => goTo(0)}
          selectedId={stage === 1 ? (crewId ?? undefined) : undefined}
        />
      </div>
      {p > 0.02 && (
        <div
          className="absolute top-9 left-4 max-w-[19%] text-sm"
          style={{ opacity: p }}
        >
          <div className="font-semibold text-white/90">우주선 평면도</div>
          <div className="mt-0.5 text-xs leading-5 text-white/50">
            위에서 본 모습. 앞쪽 업무 · 뒤쪽 개인.
            <br />
            선원이나 교신선을 눌러 보세요.
          </div>
          <button
            type="button"
            onClick={() => goTo(0)}
            className="mt-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
          >
            ▴ 조종석으로
          </button>
        </div>
      )}

      {/* 창밖(관측창으로 옮겨 가며 작아진다) */}
      <div
        data-dk-window
        className="absolute top-0 left-0 overflow-hidden"
        style={{
          width: vw,
          height: winH,
          transform: `translate(${obsX * p}px, ${obsY * p}px) scale(${scale})`,
          transformOrigin: "0 0",
          borderRadius: radius,
          boxShadow:
            p > 0.02
              ? `0 0 0 ${8 / scale}px #1f2942, 0 0 0 ${11 / scale}px #0b0f1a`
              : undefined,
          zIndex: 5,
        }}
      >
        <SpaceWindow berths={berths} stage={stage} />
      </div>

      {/* 조종석(옆구리 거울 띠 + 계기판) */}
      <div
        data-dk-active={stage === 0 ? "" : undefined}
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          transform: `scale(${1 - 0.9 * p}) translateY(${-push * 6}px)`,
          transformOrigin: `${bridgeX}px ${bridgeY}px`,
          opacity: Math.max(0, 1 - p * 1.6),
          visibility: p > 0.98 ? "hidden" : "visible",
        }}
      >
        <div
          className="pointer-events-auto absolute right-0 left-0"
          style={{ top: winH - STRIP_H, height: STRIP_H }}
        >
          <PortStrip
            berths={berths}
            nowId={nowBerth?.id}
            onOpen={(b) => setHatchId(b.id)}
            now={clock}
          />
        </div>
        <div
          className="pointer-events-auto absolute right-0 bottom-0 left-0 flex flex-col gap-2 px-4 pt-3 pb-2"
          style={{
            top: winH,
            background:
              "linear-gradient(180deg,#2a3450 0%,#1a2135 6%,#121828 100%)",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,.12)",
          }}
        >
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(250px,22%)_1fr_minmax(270px,24%)] gap-3">
            <PortPanel
              berths={berths}
              nowId={nowBerth?.id}
              onOpen={(b) => setHatchId(b.id)}
              now={clock}
            />
            <MainDisplay
              now={data.now}
              next={data.next}
              berth={nowBerth}
              berths={berths}
              crewById={data.crewById}
              clock={clock}
            />
            <CrewPanel
              crew={data.crew}
              onCrew={openCrew}
              onNav={() => setNav(true)}
              onPlan={() => goTo(1)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <GaugeRow gauges={data.gauges} />
            <span className="shrink-0 text-[11px] text-white/35">
              ▾ 아래로 밀면 우주선 전경
            </span>
          </div>
        </div>
      </div>
      {stage === 0 && p < 0.05 && nowBerth && (
        <ConnectLine id={nowBerth.id} color={SHIP[nowBerth.kind].color} />
      )}

      {push > 0.05 && (
        <div className="pointer-events-none fixed bottom-14 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white/80">
          {stage === 0 ? "▾ 우주선 전경으로" : "▴ 조종석으로"}
          <span className="ml-2 inline-block h-1 w-16 overflow-hidden rounded bg-white/15 align-middle">
            <span
              className="block h-full bg-white/80"
              style={{ width: `${push * 100}%` }}
            />
          </span>
        </div>
      )}

      {/* 평면도에서 선원을 누르면 옆 서랍 */}
      {stage === 1 && crew && (
        <aside
          key={crew.id}
          className="dk-drawer fixed top-0 right-0 bottom-0 z-40 w-[380px] overflow-auto border-l border-white/15 bg-hull-900/95 p-5 shadow-2xl backdrop-blur"
          data-scroll-inside
        >
          <button
            type="button"
            onClick={() => setCrewId(null)}
            aria-label="닫기"
            className="absolute top-3 right-3 rounded-md px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
          <CrewDetail
            crew={crew}
            tasks={data.tasksByCrew.get(crew.id) ?? []}
            clock={clock}
          />
        </aside>
      )}

      <FlightLayer />

      <Modal
        open={stage === 0 && !!crew}
        onClose={() => setCrewId(null)}
        title="승무원"
        width={520}
      >
        {crew && (
          <CrewDetail
            crew={crew}
            tasks={data.tasksByCrew.get(crew.id) ?? []}
            clock={clock}
          />
        )}
      </Modal>
      <HatchModal
        berth={hatch}
        port={hatchPort}
        crewById={data.crewById}
        onClose={() => setHatchId(null)}
        clock={clock}
      />
      <Modal
        open={nav}
        onClose={() => setNav(false)}
        title="항법 · 목적지 고르기"
        width={760}
      >
        <DestinationPicker onPick={() => setNav(false)} />
      </Modal>
      <Toasts />
      <ProtoBadge name="3. 도킹하는 교신선" />
    </main>
  );
}

/** 지금 할 일이 교신이면, 그 포트 이름표와 주 표시창을 같은 색 선으로 잇는다 */
function ConnectLine({ id, color }: { id: string; color: string }) {
  const [d, setD] = useState<string | null>(null);
  useEffect(() => {
    const measure = () => {
      const tag = document.querySelector(`[data-dk-tag="${id}"]`);
      const md = document.querySelector("[data-main-display]");
      if (!tag || !md) return setD(null);
      const a = tag.getBoundingClientRect();
      const b = md.getBoundingClientRect();
      const sx = a.left + a.width / 2;
      const sy = a.bottom - 6;
      const ex = Math.min(b.right - 30, Math.max(b.left + 30, sx));
      const ey = b.top + 2;
      const my = sy + 8;
      setD(`M${sx} ${sy} V${my} H${ex} V${ey}`);
    };
    measure();
    const t = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", measure);
    };
  }, [id]);
  if (!d) return null;
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-20 h-full w-full"
      aria-hidden
    >
      <path
        d={d}
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="6"
        fill="none"
      />
      <path
        d={d}
        stroke={color}
        strokeWidth="2"
        fill="none"
        className="dk-dash"
      />
    </svg>
  );
}
