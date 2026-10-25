"use client";

// 내부 층: 로켓처럼 선 우주선의 단면도. 위에서 아래로 함교·통신실 → 업무 모듈 → 거주 모듈 → 기관실·도킹 베이.
// 네 갑판은 가운데 사다리와 바닥 해치로 이어지고, 선체 곡면·리벳·창·배관·환기구가 단면을 감싼다.
// 선원(프로젝트)은 자리와 자세로 상태를 보이고, 사람이 부른 교신선은 도킹 베이 포트에 붙는다.
// 설계 좌표(W × H)로 그린 장면을 화면 크기에 맞춰 통째로 늘이고 줄인다. 서랍·해치 모달은 늘이지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBridge } from "@/data/hooks";
import type { Crew } from "@/protocol/v1";
import { BridgeDeck } from "./Bridge";
import { useBerths } from "./berths";
import { DockDeck, PORTS } from "./Dock";
import { Drawer, type DrawerState } from "./Drawer";
import { ModuleCrew } from "./Figures";
import { DECK_ORDER, DECKS, FIXTURES, H, LADDER, W } from "./geometry";
import { HatchModal } from "./HatchModal";
import { Hull } from "./Hull";
import { layoutModule, type Wing } from "./layout";
import { INTERIOR_CSS } from "./styles";

const DRAWER_W = 384;

const WINGS: Record<"work" | "home", Wing[]> = {
  work: [
    { x0: DECKS.work.x0 + 18, x1: LADDER.x - 10, side: "left" },
    {
      x0: LADDER.x + LADDER.w + 26,
      x1: FIXTURES.lounge.x0 - 14,
      side: "right",
    },
  ],
  home: [
    { x0: FIXTURES.galley.x1 + 14, x1: LADDER.x - 10, side: "left" },
    { x0: LADDER.x + LADDER.w + 26, x1: FIXTURES.bunks.x0 - 14, side: "right" },
  ],
};

export function Interior({
  active,
  onCockpit,
}: {
  /** 내부 장면일 때만 true */
  active: boolean;
  /** 조종석으로 돌아가기 */
  onCockpit: () => void;
}) {
  const bridge = useBridge();
  const berths = useBerths(bridge.hails, bridge.tasks);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [hatchId, setHatchId] = useState<string | null>(null);
  const clock = useClock();
  const box = useRef<HTMLDivElement>(null);
  const size = useSize(box);

  // 내부 장면을 떠나면 서랍을 닫는다
  useEffect(() => {
    if (!active) {
      setDrawer(null);
      setHatchId(null);
    }
  }, [active]);
  useEffect(() => {
    if (!active || !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]"))
        setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, drawer]);

  const layouts = useMemo(() => {
    const of = (ctx: Crew["context"]) =>
      bridge.crew.filter((c) => c.context === ctx);
    return {
      work: layoutModule(of("work"), WINGS.work),
      home: layoutModule(of("personal"), WINGS.home),
    };
  }, [bridge.crew]);

  // 조종석 일 신호 띠와 같은 정의: 내 차례 = 할 일 전부, 교신 = 들어온 교신 수
  const mine = bridge.tasks.length;
  const selectedId = drawer?.type === "crew" ? drawer.id : null;
  const select = useCallback((id: string) => {
    setDrawer({ type: "crew", id });
  }, []);
  const group = useCallback((title: string, crew: Crew[]) => {
    setDrawer({ type: "group", title, ids: crew.map((c) => c.id) });
  }, []);

  // 서랍이 열리면 배를 왼쪽으로 비켜 준다. 글이 너무 작아지지 않게 원래 크기의 85%까지만 줄이고,
  // 그래도 모자라면 배 오른쪽 끝(휴게석·침상)이 서랍 밑으로 조금 들어간다.
  const full = Math.max(0.2, Math.min(size.w / W, size.h / H));
  const availW = Math.max(200, size.w - (drawer ? DRAWER_W : 0));
  const scale = drawer
    ? Math.min(full, Math.max(availW / W, full * 0.85))
    : full;
  const left = Math.max(4, (availW - W * scale) / 2);
  const top = Math.max(0, (size.h - H * scale) / 2);

  const hatchBerth = berths.find((b) => b.id === hatchId) ?? null;
  const hatchPort = hatchBerth ? berths.indexOf(hatchBerth) + 1 : 0;

  return (
    <div
      ref={box}
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(70% 90% at 50% 40%, #0d1630 0%, #04060d 75%)",
      }}
    >
      <style>{INTERIOR_CSS}</style>
      <OuterStars />

      {/* 단면도 */}
      <div
        className="absolute origin-top-left transition-[left] duration-300"
        style={{
          left,
          top,
          width: W,
          height: H,
          transform: `scale(${scale})`,
        }}
      >
        <Hull />

        {/* 갑판 이름표 */}
        {DECK_ORDER.map((id) => {
          const d = DECKS[id];
          const count =
            id === "work"
              ? bridge.crew.filter((c) => c.context === "work").length
              : id === "home"
                ? bridge.crew.filter((c) => c.context === "personal").length
                : null;
          const waiting =
            id === "work" || id === "home"
              ? bridge.crew.filter(
                  (c) =>
                    c.context === (id === "work" ? "work" : "personal") &&
                    c.status === "needs-you",
                ).length
              : 0;
          return (
            <div
              key={id}
              data-deck={id}
              className="absolute flex items-center gap-1.5 rounded-sm bg-[#0b0f18]/85 px-1.5 text-[9.5px] leading-[13px] text-white/80 ring-1 ring-white/10"
              style={{ left: d.x0 + (id === "home" ? 4 : 18), top: d.top + 1 }}
            >
              <b className="font-mono text-[#e8b93a]">갑판 {d.no}</b>
              <span className="font-semibold text-white">{d.name}</span>
              {count !== null && (
                <span className="text-white/50">
                  선원 {count}
                  {waiting > 0 && (
                    <b className="text-[#ffd84a]"> · 기다림 {waiting}</b>
                  )}
                </span>
              )}
              {id === "engine" && (
                <span className="text-white/50">교신선 {berths.length}척</span>
              )}
            </div>
          );
        })}

        <BridgeDeck
          now={bridge.now}
          mine={mine}
          hailCount={bridge.hails.length}
          berths={berths}
          clock={clock}
          onCockpit={onCockpit}
          onHatch={setHatchId}
        />
        <ModuleCrew
          deck={DECKS.work}
          layout={layouts.work}
          tasksByCrew={bridge.tasksByCrew}
          clock={clock}
          selectedId={selectedId}
          onSelect={select}
          onGroup={group}
        />
        <ModuleCrew
          deck={DECKS.home}
          layout={layouts.home}
          tasksByCrew={bridge.tasksByCrew}
          clock={clock}
          selectedId={selectedId}
          onSelect={select}
          onGroup={group}
        />
        <DockDeck
          berths={berths}
          gauges={bridge.gauges}
          clock={clock}
          openId={hatchId}
          onHatch={setHatchId}
        />
        {bridge.crew.length === 0 && !bridge.isLoading && (
          <div
            className="pointer-events-none absolute text-center text-[11px] text-white/45"
            style={{
              left: DECKS.work.x0,
              width: DECKS.work.x1 - DECKS.work.x0,
              top: DECKS.work.top + 56,
            }}
          >
            아직 탄 선원이 없어요 — 프로젝트 세션이 생기면 자기 자리에 앉아요.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCockpit}
        className="absolute top-2 left-3 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/70 hover:text-white"
      >
        ▲ 위로 밀면 조종석
      </button>

      {drawer && (
        <Drawer
          state={drawer}
          crewById={bridge.crewById}
          tasksByCrew={bridge.tasksByCrew}
          clock={clock}
          onSelect={select}
          onClose={() => setDrawer(null)}
        />
      )}

      <HatchModal
        berth={active ? hatchBerth : null}
        port={hatchPort <= PORTS ? hatchPort : 0}
        crewById={bridge.crewById}
        onClose={() => setHatchId(null)}
        clock={clock}
      />
    </div>
  );
}

function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: W, h: H });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function OuterStars() {
  const stars = useMemo(() => {
    let a = 7;
    const rand = () => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    };
    return Array.from({ length: 90 }, (_, i) => ({
      i,
      x: rand() * 100,
      y: rand() * 100,
      r: rand() < 0.1 ? 2 : 1,
      o: 0.25 + rand() * 0.6,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <span
          key={s.i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            opacity: s.o,
          }}
        />
      ))}
    </div>
  );
}
