"use client";

// 교신선이 항구 별 쪽에서 날아와 포트에 붙고(도착), 풀어주면 별 쪽으로 떠난다(출발).
// 화면 전체에 깔린 투명한 층에서 매 프레임 별 위치와 포트 위치를 다시 읽어 날린다.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { projector } from "@/sky/projector";
import { type Berth, starOnWindow } from "./model";
import { SHIP, Ship } from "./ships";

export const STRIP_H = 150;
const FLY_W = 92;
const ARRIVE_MS = 5600;
const DEPART_MS = 3400;

type Point = { x: number; y: number };

export type Flight = {
  key: string;
  berth: Berth;
  mode: "arrive" | "depart";
  /** 출발할 때 배가 있던 자리(화면 좌표 가운데) */
  from?: Point & { w: number };
};

type FlightStore = {
  flights: Flight[];
  /** 막 붙은 배: id → 붙은 시각(철컥 연출) */
  clamped: Record<string, number>;
  add: (f: Omit<Flight, "key">) => void;
  finish: (key: string) => void;
};

let seq = 0;

export const useFlights = create<FlightStore>((set, get) => ({
  flights: [],
  clamped: {},
  add: (f) =>
    set((s) => ({
      flights: [...s.flights, { ...f, key: `${f.berth.id}-${++seq}` }],
    })),
  finish: (key) => {
    const f = get().flights.find((x) => x.key === key);
    set((s) => ({ flights: s.flights.filter((x) => x.key !== key) }));
    if (f?.mode === "arrive") {
      const id = f.berth.id;
      set((s) => ({ clamped: { ...s.clamped, [id]: Date.now() } }));
      window.setTimeout(
        () =>
          set((s) => {
            const next = { ...s.clamped };
            delete next[id];
            return { clamped: next };
          }),
        2000,
      );
    }
  },
}));

/** 날아오는 중인 배 id들 */
export function useArriving(): Set<string> {
  const flights = useFlights((s) => s.flights);
  return new Set(
    flights.filter((f) => f.mode === "arrive").map((f) => f.berth.id),
  );
}

/** 별이 지금 화면(뷰포트) 어디에 있나. 창 밖이면 창 가장자리 바깥쪽. */
export function starOnScreen(berth: Berth): Point | null {
  const el = document.querySelector<HTMLElement>("[data-dk-window]");
  if (!el || !projector.width) return null;
  const r = el.getBoundingClientRect();
  const s = r.width / projector.width;
  const W = projector.width;
  const H = projector.height;
  const p = starOnWindow(SHIP[berth.kind].ra, SHIP[berth.kind].dec, {
    left: 0,
    top: 0,
    right: W,
    bottom: H - STRIP_H,
  });
  if (!p) return null;
  let { x, y } = p;
  if (!p.inside) {
    // 창 밖에서 들어오는 것처럼 조금 더 바깥에서
    x += Math.cos(p.angle) * 90;
    y += Math.sin(p.angle) * 90;
  }
  return { x: r.left + x * s, y: r.top + y * s };
}

export function slotCenter(id: string): (Point & { w: number }) | null {
  const el = document.querySelector<HTMLElement>(
    `[data-dk-active] [data-dk-ship="${id}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}

export function FlightLayer() {
  const flights = useFlights((s) => s.flights);
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {flights.map((f) => (
        <FlyingShip key={f.key} flight={f} />
      ))}
    </div>
  );
}

const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;

function FlyingShip({ flight }: { flight: Flight }) {
  const shipRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const glintRef = useRef<HTMLDivElement>(null);
  const finish = useFlights((s) => s.finish);

  useEffect(() => {
    const start = performance.now();
    const trail: Point[] = [];
    let raf = 0;
    let lastAngle = 0;
    // 출발점(별 쪽)이 잠깐 안 잡히면 처음 잡은 값을 쓴다
    let lastStar: Point | null = null;
    const step = (now: number) => {
      const dur = flight.mode === "arrive" ? ARRIVE_MS : DEPART_MS;
      const k = Math.min(1, (now - start) / dur);
      const star = starOnScreen(flight.berth) ?? lastStar;
      if (star) lastStar = star;
      let pos: Point | null = null;
      let scale = 1;
      let opacity = 1;
      let angle = 0;
      if (flight.mode === "arrive") {
        const to = slotCenter(flight.berth.id);
        if (star && to) {
          const endScale = to.w / FLY_W;
          const glint = 0.1;
          if (k < glint) {
            pos = star;
            scale = 0.12;
            opacity = k / glint;
          } else {
            const t = easeInOut((k - glint) / (1 - glint));
            // 마지막엔 왼쪽에서 오른쪽으로 미끄러지듯(코가 오른쪽) 붙는다
            const c = { x: to.x - 280, y: to.y - 70 };
            const u = 1 - t;
            pos = {
              x: u * u * star.x + 2 * u * t * c.x + t * t * to.x,
              y: u * u * star.y + 2 * u * t * c.y + t * t * to.y,
            };
            const dx = 2 * u * (c.x - star.x) + 2 * t * (to.x - c.x);
            const dy = 2 * u * (c.y - star.y) + 2 * t * (to.y - c.y);
            const a = Math.atan2(dy, dx);
            // 코가 오른쪽인 그림이라 왼쪽으로 갈 때는 뒤집지 않고 기울기만
            angle = Math.abs(a) > Math.PI / 2 ? a - Math.sign(a) * Math.PI : a;
            angle *= 1 - t ** 3;
            scale = 0.12 + (endScale - 0.12) * t ** 1.6;
          }
        }
      } else if (flight.from) {
        const from = flight.from;
        const startScale = from.w / FLY_W;
        const release = 0.16;
        if (k < release) {
          const t = k / release;
          pos = { x: from.x, y: from.y - 18 * easeInOut(t) };
          scale = startScale;
        } else {
          const t = ((k - release) / (1 - release)) ** 2;
          const a = { x: from.x, y: from.y - 18 };
          const b = star ?? { x: from.x + 600, y: -200 };
          pos = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          const raw = Math.atan2(b.y - a.y, b.x - a.x);
          angle =
            Math.abs(raw) > Math.PI / 2 ? raw - Math.sign(raw) * Math.PI : raw;
          angle *= Math.min(1, t * 4);
          scale = startScale * (1 - 0.88 * t);
          opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
        }
      }
      lastAngle = angle;
      const el = shipRef.current;
      if (el && pos) {
        el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) rotate(${lastAngle}rad) scale(${scale})`;
        el.style.opacity = String(opacity);
        if (labelRef.current) {
          labelRef.current.style.transform = `translate(${pos.x}px, ${pos.y + 26 * Math.max(0.5, scale)}px) translate(-50%, 0)`;
          labelRef.current.style.opacity = String(
            flight.mode === "arrive"
              ? Math.min(1, k * 6) * (k > 0.88 ? (1 - k) / 0.12 : 1)
              : opacity * (k < 0.6 ? 1 : 0),
          );
        }
        trail.push(pos);
        if (trail.length > 36) trail.shift();
        trailRef.current?.setAttribute(
          "points",
          trail.map((p) => `${p.x},${p.y}`).join(" "),
        );
      }
      if (glintRef.current && star) {
        const g =
          flight.mode === "arrive"
            ? Math.max(0, 1 - k * 4)
            : k > 0.8
              ? (k - 0.8) * 5
              : 0;
        glintRef.current.style.transform = `translate(${star.x}px, ${star.y}px) translate(-50%, -50%) scale(${0.6 + g})`;
        glintRef.current.style.opacity = String(g);
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else finish(flight.key);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [flight, finish]);

  const c = SHIP[flight.berth.kind].color;
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        <polyline
          ref={trailRef}
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeOpacity="0.55"
          strokeLinecap="round"
          strokeDasharray="1 6"
        />
      </svg>
      <div
        ref={glintRef}
        className="absolute top-0 left-0 h-10 w-10 rounded-full"
        style={{
          opacity: 0,
          background: `radial-gradient(circle, #fff 0%, ${c} 30%, transparent 70%)`,
        }}
      />
      <div
        ref={shipRef}
        className="absolute top-0 left-0"
        style={{ opacity: 0, filter: `drop-shadow(0 0 8px ${c}aa)` }}
      >
        <Ship kind={flight.berth.kind} width={FLY_W} />
      </div>
      <div
        ref={labelRef}
        className="absolute top-0 left-0 whitespace-nowrap rounded-full border bg-black/70 px-2.5 py-0.5 text-xs text-white"
        style={{ opacity: 0, borderColor: `${c}99` }}
      >
        {flight.mode === "arrive"
          ? `${flight.berth.from} · ${flight.berth.source} 접근 중`
          : `${flight.berth.from} 배를 풀어 줬어요`}
      </div>
    </>
  );
}
