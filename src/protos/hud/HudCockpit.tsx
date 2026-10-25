"use client";

// 5. 앞 유리 투영 — 창밖을 가장 넓게 두고, 유리 위 투영 글로 지금 할 일을 읽고 누른다.
// 스크롤하면 시점이 아래로 기울며 바닥이 투명해져 발아래 선원 갑판을 내려다본다.
import { useEffect, useMemo, useState } from "react";
import { useBridge } from "@/data/hooks";
import type { Context, Crew } from "@/protocol/v1";
import { SpaceView } from "@/sky/SpaceView";
import { EventLayer } from "@/ui/events";
import { ProtoBadge, Toasts, useScrollStage } from "@/ui/kit";
import { Console } from "./Console";
import { Deck } from "./Deck";
import { GlassFloor, WindowFrame } from "./Frame";
import { HailRings, type HailView, MAX_RINGS } from "./HailRings";
import { HeadingBand } from "./HeadingBand";
import { AllTasksPanel, CrewPanel, NavPanel, RosterPanel } from "./Panels";
import {
  BRIGHTNESS,
  type Brightness,
  CompactProjection,
  Projection,
} from "./Projection";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const BRIGHT_KEY = "starship:hud:brightness";

function useClock(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

function useBrightness() {
  const [level, setLevel] = useState(1);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRIGHT_KEY);
      const v = raw === null ? Number.NaN : Number(raw);
      if (v >= 0 && v < BRIGHTNESS.length) setLevel(v);
    } catch {}
  }, []);
  const cycle = () =>
    setLevel((l) => {
      const n = (l + 1) % BRIGHTNESS.length;
      try {
        localStorage.setItem(BRIGHT_KEY, String(n));
      } catch {}
      return n;
    });
  return {
    b: (BRIGHTNESS[level] ?? BRIGHTNESS[1]) as Brightness,
    cycle,
  } as const;
}

export function HudCockpit() {
  const bridge = useBridge();
  const { now, next, tasks, hails, crew, crewById, tasksByCrew, gauges } =
    bridge;
  const {
    stage,
    progress: p,
    push,
    goTo,
  } = useScrollStage({ stages: 2, duration: 1400 });
  const clock = useClock();
  const { b: brightness, cycle } = useBrightness();

  const [crewId, setCrewId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Context | "all" | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [openHail, setOpenHail] = useState<string | null>(null);

  const hailViews: HailView[] = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return [...hails]
      .sort((a, c) => a.since - c.since)
      .slice(0, MAX_RINGS)
      .map((h) => ({
        hail: h,
        task: h.taskId ? byId.get(h.taskId) : undefined,
      }));
  }, [hails, tasks]);

  // 펼친 교신이 사라지면 닫는다
  useEffect(() => {
    if (openHail && !hails.some((h) => h.id === openHail)) setOpenHail(null);
  }, [hails, openHail]);

  const pickCrew = (c: Crew) => {
    setRoster(null);
    setCrewId(c.id);
  };

  // 장면 배치(%). p = 0 조종석, 1 갑판 내려다보기
  const winH = lerp(68, 33, p);
  const conH = lerp(32, 6, p);
  const tilt = Math.sin(Math.PI * p) * 9; // 기우는 도중에만 살짝
  const floorClear = smooth(0.4, 0.88, p); // 바닥이 투명해지는 정도
  const hudOut = clamp01(1 - p * 2.2);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#03050b] text-white select-none"
      style={{ perspective: "1600px" }}
    >
      <ProtoBadge name="5 · 앞 유리 투영" />

      {/* 발아래 갑판(바닥 아래층). 처음엔 바닥 판에 가려 있다가 기울며 드러난다. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: "38%",
          transformOrigin: "50% 100%",
          transform: `rotateX(${(1 - p) * 62}deg)`,
          opacity: smooth(0, 0.1, p),
          pointerEvents: stage === 1 ? "auto" : "none",
        }}
      >
        <Deck
          crew={crew}
          tasksByCrew={tasksByCrew}
          onPick={pickCrew}
          clock={clock}
        />
        <GlassFloor clear={floorClear} visible={p} />
        {stage === 1 && (
          <div className="pointer-events-none absolute top-2 right-4 left-4 flex items-center justify-between text-[11.5px] text-white/55">
            <span>
              발아래 선원 갑판 · 선원을 누르면 바닥 유리 위에 브리핑·할 일 체크
              판이 떠올라요
            </span>
            <button
              type="button"
              onClick={() => goTo(0)}
              className="pointer-events-auto rounded-full border border-[#a6fbff]/40 px-3 py-0.5 text-[#a6fbff] hover:bg-[#a6fbff]/10"
            >
              ▴ 고개 들기(조종석)
            </button>
          </div>
        )}
      </div>

      {/* 조종석: 창 + 계기판 */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: `${winH + conH}%`,
          transformOrigin: "50% 0%",
          transform: `translateY(${-push * 14}px) rotateX(${tilt}deg)`,
        }}
      >
        {/* 창밖 */}
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: `${(winH / (winH + conH)) * 100}%` }}
        >
          <SpaceView
            className="h-full w-full"
            labels="few"
            lookAround
            drift={!openHail}
            starScale={lerp(1, 0.8, p)}
          />
          <EventLayer />
          <WindowFrame />
          <div className="pointer-events-none absolute inset-0 z-20">
            <HeadingBand />
          </div>
          {p < 0.5 && (
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{ opacity: hudOut }}
            >
              <Projection
                now={now}
                next={next}
                crewById={crewById}
                brightness={brightness}
                clock={clock}
              />
            </div>
          )}
          {p < 0.5 && (
            <div
              className="pointer-events-none absolute inset-0 z-30"
              style={{ opacity: hudOut }}
            >
              <HailRings
                items={hailViews}
                open={openHail}
                onOpen={setOpenHail}
                clock={clock}
                safeBottom={0.6}
              />
            </div>
          )}
          {p >= 0.5 && (
            <div
              className="absolute inset-0 z-20 pointer-events-none [&>*]:pointer-events-auto"
              style={{ opacity: smooth(0.5, 0.9, p) }}
            >
              <CompactProjection
                now={now}
                crewById={crewById}
                brightness={brightness}
                clock={clock}
              />
            </div>
          )}
        </div>

        {/* 계기판 */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${(conH / (winH + conH)) * 100}%` }}
        >
          <Console
            crew={crew}
            gauges={gauges}
            hailCount={hails.length}
            taskCount={tasks.length}
            brightnessLabel={brightness.label}
            push={push}
            onCrew={pickCrew}
            onCrewList={(ctx) => setRoster(ctx)}
            onNav={() => setNavOpen(true)}
            onBrief={() => setRoster("all")}
            onAll={() => setAllOpen(true)}
            onBright={cycle}
            onDeck={() => goTo(1)}
            fade={p}
          />
        </div>
      </div>

      <CrewPanel
        crew={crewId ? crewById.get(crewId) : undefined}
        tasks={crewId ? (tasksByCrew.get(crewId) ?? []) : []}
        onClose={() => setCrewId(null)}
        clock={clock}
      />
      <RosterPanel
        open={roster !== null}
        onClose={() => setRoster(null)}
        crew={crew}
        only={roster === "all" ? null : roster}
        onPick={pickCrew}
      />
      <AllTasksPanel
        open={allOpen}
        onClose={() => setAllOpen(false)}
        tasks={tasks}
        crewById={crewById}
        clock={clock}
      />
      <NavPanel open={navOpen} onClose={() => setNavOpen(false)} />
      <Toasts />
    </main>
  );
}
