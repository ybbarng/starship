"use client";

// 우주선 전경: 천천히 도는 원심 회전 고리. 나를 기다리는 선원 칸은 화면 아래 한가운데(내 앞)로 돌아와 멈추고,
// 나머지 칸만 계속 돈다. 칸을 누르면 고리가 그 칸을 내 앞으로 돌려 확대하고 옆에 상세를 편다.
import { useEffect, useMemo, useRef } from "react";
import { useAct, useBridge } from "@/data/hooks";
import type { Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, elapsed, KIND_LABEL, sourceLabel } from "@/ui/kit";
import { CrewDetail } from "./CrewDetail";
import { ContextChip } from "./common";
import {
  BOTTOM,
  freeU,
  type Pod,
  planRing,
  type RingPlan,
  waitAngle,
  wrapAngle,
} from "./model";

const POD_W = 88;
const POD_H = 104;
const SPIN = (Math.PI * 2) / 170; // 한 바퀴 170초

export type RingGeo = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  top: number;
  /** 선원을 고르면 고리가 왼쪽으로 비켜 가는 거리 */
  shift: number;
};

export function ringGeo(w: number, h: number): RingGeo {
  const top = h / 3;
  const left = w >= 1100 ? 316 : 0;
  const right = 400;
  const areaA = w - left - 32;
  const areaB = w - right - 32;
  const rx = Math.max(220, Math.min(areaA / 2 - 50, areaB / 2 - 40, 450));
  const areaH = h - top;
  const ry = Math.max(110, Math.min(areaH * 0.31, rx * 0.44));
  const cx = left + 16 + areaA / 2;
  const cxSel = 16 + areaB / 2;
  return { cx, cy: top + areaH * 0.5, rx, ry, top, shift: cxSel - cx };
}

function PodBody({ pod, wide }: { pod: Pod; wide: number }) {
  const c = pod.crew;
  if (!c) {
    return (
      <div
        className="absolute inset-x-[10px] top-[6px] bottom-[22px] rounded-[14px] border-2 border-[#1f2942]"
        style={{
          background: "linear-gradient(180deg,#0d1322,#080c16)",
        }}
      >
        <div className="absolute inset-[9px] rounded-[9px] bg-[#04060c] shadow-[inset_0_2px_6px_#000]" />
      </div>
    );
  }
  const wall = c.context === "work" ? "#3f8fe6" : "#e8913a";
  const wallLight = c.context === "work" ? "#8cc8ff" : "#ffc58a";
  const waiting = c.status === "needs-you";
  const lit = c.status === "working" || waiting;
  const inside = waiting
    ? "radial-gradient(120% 90% at 50% 10%, #fff3c4 0%, #e8c46a 35%, #3a2c14 100%)"
    : c.status === "working"
      ? "radial-gradient(120% 90% at 50% 0%, #ffe9b8 0%, #b88a4a 40%, #20160c 100%)"
      : c.status === "idle"
        ? "radial-gradient(120% 90% at 50% 0%, #2a3a64 0%, #121a30 60%, #070a14 100%)"
        : "linear-gradient(180deg,#0a0e18,#05070c)";
  return (
    <div
      className={`absolute inset-x-[6px] top-[4px] bottom-[20px] rounded-[16px] ${waiting ? "ring-pulse" : ""}`}
      style={{
        background: `linear-gradient(90deg, ${wall} 0 9px, ${wallLight}33 9px calc(100% - 9px), ${wall} calc(100% - 9px))`,
        boxShadow: `inset 0 3px 0 ${wallLight}aa, inset 0 -4px 0 #0008, 0 4px 10px #0009`,
      }}
    >
      {/* 천장 불 */}
      <div
        className="absolute top-[5px] left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full"
        style={{
          background: lit ? "#fff6d8" : "#2c3a5c",
          boxShadow: lit ? "0 0 8px #ffe9a8" : undefined,
        }}
      />
      {/* 창 */}
      <div
        className="absolute inset-x-[12px] top-[12px] bottom-[8px] overflow-hidden rounded-[10px]"
        style={{
          background: inside,
          boxShadow: "inset 0 2px 6px rgba(0,0,0,.7), 0 0 0 2px #0b1020",
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: waiting ? -6 : -4,
            opacity: c.status === "off" ? 0.35 : 1,
          }}
        >
          <Animal
            kind={animalFor(c.id)}
            pose={poseFor(c.status)}
            context={c.context}
            size={waiting ? 60 * wide : 52 * wide}
            furniture={c.status === "working"}
            label={`${c.name}, ${c.status}`}
          />
        </div>
        {/* 유리 반사 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(125deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,.08) 100%)",
          }}
        />
      </div>
    </div>
  );
}

export function RingView({
  w,
  h,
  selectedId,
  onSelect,
  onBridge,
}: {
  w: number;
  h: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBridge: () => void;
}) {
  const { crew, tasksByCrew, loose, crewById } = useBridge();
  const act = useAct();
  const plan = useMemo(() => planRing(crew, tasksByCrew), [crew, tasksByCrew]);
  const geo = ringGeo(w, h);
  const k = Math.min(1, 26 / plan.slots);
  const selected = selectedId ? crewById.get(selectedId) : undefined;

  const podRefs = useRef(new Map<string, HTMLDivElement>());
  const spinRef = useRef<SVGGElement>(null);
  const clampRefs = useRef<(HTMLDivElement | null)[]>([]);
  const latest = useRef({ plan, geo, selectedId, k });
  latest.current = { plan, geo, selectedId, k };

  useEffect(() => {
    const st = {
      phi: 0,
      R: 0,
      last: performance.now(),
      disp: new Map<string, number>(),
      prevU: new Map<string, number>(),
      zoom: new Map<string, number>(),
    };
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    const targetsOf = (p: RingPlan, phi: number) => {
      const out = new Map<string, { a: number; u?: number; fade: number }>();
      for (const pod of p.waiting)
        out.set(pod.key, { a: waitAngle(p, pod.rank ?? 0), fade: 1 });
      const M = p.free.length || 1;
      const spacing = p.arcLength / M;
      for (const [i, pod] of p.free.entries()) {
        const u = freeU(p, i, phi);
        const edge = Math.min(u, p.arcLength - u);
        const fade = p.waiting.length
          ? Math.max(0, Math.min(1, edge / (spacing * 0.55)))
          : 1;
        out.set(pod.key, { a: p.arcStart + u, u, fade });
      }
      return out;
    };
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - st.last) / 1000);
      st.last = t;
      const { plan: p, geo: g, selectedId: sel, k: kk } = latest.current;
      if (!sel && !reduced) st.phi += SPIN * dt;
      const targets = targetsOf(p, st.phi);
      const selT = sel ? targets.get(sel) : undefined;
      const Rt = selT ? wrapAngle(BOTTOM - selT.a) : 0;
      st.R += wrapAngle(Rt - st.R) * Math.min(1, dt * 3.2);

      for (const [key, tg] of targets) {
        const el = podRefs.current.get(key);
        if (!el) continue;
        const final = tg.a + st.R;
        const prevU = st.prevU.get(key);
        const wrapped =
          tg.u !== undefined &&
          prevU !== undefined &&
          tg.u < prevU - p.arcLength / 2;
        if (tg.u !== undefined) st.prevU.set(key, tg.u);
        else st.prevU.delete(key);
        let da = st.disp.get(key);
        if (da === undefined || wrapped) da = final;
        else da += wrapAngle(final - da) * Math.min(1, dt * 2.6);
        st.disp.set(key, da);
        const zt = key === sel ? 1.42 : 1;
        let z = st.zoom.get(key) ?? 1;
        z += (zt - z) * Math.min(1, dt * 5);
        st.zoom.set(key, z);
        const x = g.cx + Math.cos(da) * g.rx;
        const y = g.cy + Math.sin(da) * g.ry;
        const depth = (Math.sin(da) + 1) / 2;
        const s = kk * (0.6 + 0.4 * depth) * z;
        el.style.transform = `translate(${x - POD_W / 2}px, ${y - POD_H * 0.62}px) scale(${s})`;
        el.style.zIndex = String(Math.round(y) + (key === sel ? 2000 : 0));
        el.style.opacity = String(key === sel ? 1 : tg.fade);
        el.style.setProperty("--d", depth.toFixed(3));
        el.style.pointerEvents = tg.fade < 0.4 ? "none" : "auto";
      }
      if (spinRef.current)
        spinRef.current.style.transform = `rotate(${((st.phi + st.R) * 180) / Math.PI}deg)`;
      // 기다리는 칸 양옆의 붙잡개
      const W = p.waiting.length;
      const ends = [
        p.arcStart - p.step * 0.5,
        p.arcStart + p.arcLength + p.step * 0.5,
      ];
      for (const [i, a0] of ends.entries()) {
        const el = clampRefs.current[i];
        if (!el) continue;
        const a = a0 + st.R;
        el.style.display = W ? "block" : "none";
        el.style.transform = `translate(${g.cx + Math.cos(a) * g.rx - 5}px, ${g.cy + Math.sin(a) * g.ry - 16}px)`;
        el.style.zIndex = String(Math.round(g.cy + Math.sin(a) * g.ry) - 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pods = [...plan.waiting, ...plan.free];
  const first = plan.waiting[0];
  const shift = selected ? geo.shift : 0;
  const { cx, cy, rx, ry, top } = geo;

  return (
    <div className="absolute inset-0">
      {/* 고리 무대 */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={{ transform: `translateX(${shift}px)` }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={w}
          height={h}
          aria-hidden
        >
          <title>회전 고리</title>
          <defs>
            <linearGradient id="ring-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4a72" />
              <stop offset=".5" stopColor="#222d4a" />
              <stop offset="1" stopColor="#141b2f" />
            </linearGradient>
            <linearGradient id="ring-shaft" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0d1324" />
              <stop offset=".5" stopColor="#2c3a5c" />
              <stop offset="1" stopColor="#0d1324" />
            </linearGradient>
            <radialGradient id="ring-glow" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#6cb6ff" stopOpacity=".12" />
              <stop offset="1" stopColor="#6cb6ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 1.25}
            ry={ry * 1.35}
            fill="url(#ring-glow)"
          />
          {/* 축: 함교에서 위 창까지 */}
          <path
            d={`M${cx - 22} ${cy} L${cx - 46} ${top} L${cx + 46} ${top} L${cx + 22} ${cy} Z`}
            fill="url(#ring-shaft)"
            opacity=".7"
          />
          {/* 고리 그림자와 두께 */}
          <ellipse
            cx={cx}
            cy={cy + 30}
            rx={rx + 24}
            ry={ry + 18}
            fill="#000"
            opacity=".35"
          />
          <ellipse
            cx={cx}
            cy={cy + 12}
            rx={rx + 18}
            ry={ry + 12}
            fill="#0b1120"
            stroke="#1f2942"
          />
          <path
            fillRule="evenodd"
            d={`M${cx - rx - 18} ${cy} a${rx + 18} ${ry + 11} 0 1 0 ${2 * (rx + 18)} 0 a${rx + 18} ${ry + 11} 0 1 0 ${-2 * (rx + 18)} 0 Z M${cx - rx + 18} ${cy} a${rx - 18} ${ry - 9} 0 1 0 ${2 * (rx - 18)} 0 a${rx - 18} ${ry - 9} 0 1 0 ${-2 * (rx - 18)} 0 Z`}
            fill="url(#ring-band)"
            stroke="#4a5a80"
            strokeWidth="1"
          />
          {/* 도는 부분: 바퀴살과 눈금 */}
          <g transform={`translate(${cx} ${cy}) scale(1 ${ry / rx})`}>
            <g ref={spinRef}>
              {Array.from({ length: 6 }, (_, i) => {
                const a = (i * Math.PI) / 3 + 0.26;
                return (
                  <g key={`s${a}`}>
                    <line
                      x1={Math.cos(a) * 70}
                      y1={Math.sin(a) * 70}
                      x2={Math.cos(a) * (rx - 18)}
                      y2={Math.sin(a) * (rx - 18)}
                      stroke="#18213a"
                      strokeWidth="9"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={Math.cos(a) * 70}
                      y1={Math.sin(a) * 70}
                      x2={Math.cos(a) * (rx - 18)}
                      y2={Math.sin(a) * (rx - 18)}
                      stroke="#3a4a72"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
              {Array.from({ length: 72 }, (_, i) => {
                const a = (i * Math.PI * 2) / 72;
                return (
                  <line
                    key={`t${a}`}
                    x1={Math.cos(a) * (rx - 14)}
                    y1={Math.sin(a) * (rx - 14)}
                    x2={Math.cos(a) * (rx - 8)}
                    y2={Math.sin(a) * (rx - 8)}
                    stroke="#6cb6ff"
                    strokeOpacity={i % 6 === 0 ? 0.7 : 0.25}
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          </g>
          {/* 내 자리 표시: 아래 한가운데 */}
          <path
            d={`M${cx - 70} ${cy + ry + 26} Q${cx} ${cy + ry + 40} ${cx + 70} ${cy + ry + 26}`}
            fill="none"
            stroke="#ffcf5c"
            strokeOpacity={plan.waiting.length ? 0.55 : 0.15}
            strokeWidth="2"
            strokeDasharray="3 5"
          />
        </svg>

        {/* 붙잡개 */}
        {[0, 1].map((i) => (
          <div
            key={i}
            ref={(el) => {
              clampRefs.current[i] = el;
            }}
            className="pointer-events-none absolute top-0 left-0 h-8 w-2.5 rounded-sm"
            style={{
              background: "linear-gradient(180deg,#ffe28a,#c9922a)",
              boxShadow: "0 0 10px #ffcf5c99",
              display: "none",
            }}
          />
        ))}

        {/* 함교 */}
        <button
          type="button"
          onClick={onBridge}
          aria-label="조종석으로 돌아가기"
          className="group absolute flex flex-col items-center"
          style={{
            left: cx - 60,
            top: cy - 60,
            width: 120,
            zIndex: Math.round(cy),
          }}
        >
          <div
            className="relative h-[120px] w-[120px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 40% 30%, #4a5a80 0%, #1f2942 45%, #0b1020 100%)",
              boxShadow:
                "0 0 0 3px #0a0f1c, 0 0 0 5px #3a4a72, 0 10px 30px #000c",
            }}
          >
            <div
              className="absolute inset-[22px] overflow-hidden rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, #1d3a6a 0%, #0a1428 70%)",
                boxShadow: "inset 0 3px 8px #000, 0 0 14px #6cb6ff55",
              }}
            >
              {/* 작게 줄어든 조종석 */}
              <div className="absolute inset-x-[10px] top-[12px] h-[24px] rounded-t-[14px] border border-[#6cb6ff]/50 bg-[#0d1d3a]" />
              <div className="absolute inset-x-[8px] bottom-[12px] flex h-[18px] items-center justify-center gap-[3px] rounded bg-[#141b2f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffcf5c]" />
                <span className="h-1.5 w-5 rounded-sm bg-[#6cb6ff]/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#5ee08a]" />
              </div>
            </div>
          </div>
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] text-white/70 group-hover:text-white">
            함교 · 조종석으로 ▲
          </div>
        </button>

        {/* 칸 */}
        {pods.map((pod) => {
          const waiting = pod.rank !== undefined;
          const c = pod.crew;
          return (
            <div
              key={pod.key}
              ref={(el) => {
                if (el) podRefs.current.set(pod.key, el);
                else podRefs.current.delete(pod.key);
              }}
              className="absolute top-0 left-0"
              style={{
                width: POD_W,
                height: POD_H,
                transformOrigin: `${POD_W / 2}px ${POD_H * 0.62}px`,
                willChange: "transform",
              }}
            >
              {c ? (
                <button
                  type="button"
                  data-pod={c.id}
                  onClick={() => onSelect(selectedId === c.id ? null : c.id)}
                  aria-label={`${c.name} 칸 열기`}
                  className="absolute inset-0 cursor-pointer"
                >
                  <PodBody pod={pod} wide={1} />
                  {waiting && (
                    <span className="absolute -top-1 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#fff3c4] bg-[#ffcf5c] text-[12px] font-black text-[#2a1d00] shadow-[0_0_10px_#ffcf5c]">
                      {(pod.rank ?? 0) + 1}
                    </span>
                  )}
                  <span
                    className="absolute inset-x-[-14px] bottom-0 truncate text-center text-[11px] leading-[18px] font-medium"
                    style={{
                      opacity: "clamp(0, calc((var(--d, 1) - 0.42) * 3), 1)",
                      color: waiting ? "#ffe08a" : "rgba(255,255,255,.72)",
                      textShadow: "0 1px 3px #000",
                    }}
                  >
                    {c.name}
                    {waiting && pod.waitSince ? ` · ${ago(pod.waitSince)}` : ""}
                  </span>
                </button>
              ) : (
                <PodBody pod={pod} wide={1} />
              )}
              {/* 먼 칸은 어둡게 */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[#05070d]"
                style={{ opacity: "calc((1 - var(--d, 1)) * 0.5)" }}
              />
            </div>
          );
        })}

        {/* 가장 오래 기다린 칸의 첫 줄 */}
        {first?.crew && !selected && (
          <button
            type="button"
            onClick={() => first.crew && onSelect(first.crew.id)}
            className="ring-float absolute max-w-[340px] -translate-x-1/2 -translate-y-full rounded-xl border border-[#ffcf5c]/60 bg-[#1a1608]/90 px-3 py-1.5 text-left shadow-[0_0_20px_#ffcf5c33] backdrop-blur-sm"
            style={{
              left: cx,
              top: cy + ry - POD_H * 0.62 * k - 14,
              zIndex: 1500,
            }}
          >
            <span className="block text-[11px] text-[#ffcf5c]">
              1 · {first.crew.name}
              {first.top ? ` · ${KIND_LABEL[first.top.kind]}` : ""}
              {first.waitSince ? ` · ${elapsed(first.waitSince)}` : ""}
            </span>
            <span className="line-clamp-2 block text-[13px] leading-snug text-white/90">
              {first.top?.title ?? "나를 기다리고 있어요"}
            </span>
            <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-[#ffcf5c]/60 bg-[#1a1608]" />
          </button>
        )}
      </div>

      {/* 왼쪽 목록: 내 앞에 멈춘 칸 + 칸 없는 일 */}
      {w >= 1100 && (
        <div
          data-scroll-inside
          className={`absolute left-4 w-[296px] overflow-y-auto rounded-2xl border border-white/10 bg-[#070b16]/80 p-3 backdrop-blur transition-opacity duration-500 ${selected ? "pointer-events-none opacity-0" : "opacity-100"}`}
          style={{ top: top + 16, bottom: 16, zIndex: 3000 }}
        >
          <h3 className="text-[11px] font-semibold tracking-widest text-[#ffcf5c]/90">
            내 앞에 멈춘 칸 {plan.waiting.length}
          </h3>
          {plan.waiting.length === 0 && (
            <p className="mt-1 text-xs text-white/45">
              기다리는 선원이 없어 고리가 멈추지 않고 돌아요.
            </p>
          )}
          <ul className="mt-1.5 space-y-1">
            {plan.waiting.map((p) =>
              p.crew ? (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => p.crew && onSelect(p.crew.id)}
                    className="flex w-full gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/5"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ffcf5c] text-[11px] font-black text-[#2a1d00]">
                      {(p.rank ?? 0) + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                        <ContextChip context={p.crew.context} />
                        <b className="truncate font-semibold text-white/90">
                          {p.crew.name}
                        </b>
                        {p.waitSince && (
                          <span className="ml-auto shrink-0">
                            {ago(p.waitSince)}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-[12.5px] leading-snug text-white/80">
                        {p.top?.title ?? "나를 기다리고 있어요"}
                      </span>
                    </span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
          <h3 className="mt-3 border-t border-white/10 pt-2.5 text-[11px] font-semibold tracking-widest text-white/50">
            칸 없는 일 {loose.length}
          </h3>
          {loose.length === 0 && (
            <p className="mt-1 text-xs text-white/40">없어요.</p>
          )}
          <ul className="mt-1.5 space-y-1">
            {loose.map((t: Task) => (
              <li key={t.id}>
                <label className="flex cursor-pointer gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5">
                  <input
                    type="checkbox"
                    data-check={t.id}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#5ee08a]"
                    onChange={() => act.task(t, "dismiss")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-white/50">
                      {t.from === sourceLabel(t.source)
                        ? t.from
                        : `${t.from} · ${sourceLabel(t.source)}`}{" "}
                      · {ago(t.since)}
                    </span>
                    <span className="line-clamp-2 block text-[12.5px] leading-snug text-white/80">
                      {t.title}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 오른쪽 상세 */}
      {selected && (
        <div
          data-scroll-inside
          className="absolute right-4 w-[384px] overflow-y-auto rounded-2xl border bg-[#0b1020]/92 p-4 text-white shadow-2xl backdrop-blur"
          style={{
            top: top + 16,
            bottom: 16,
            zIndex: 3000,
            borderColor:
              selected.context === "work" ? "#6cb6ff66" : "#ffb86c66",
          }}
        >
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="닫기"
            className="absolute top-2.5 right-3 rounded px-2 text-white/55 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
          <CrewDetail crew={selected} />
        </div>
      )}

      {/* 범례 */}
      {!selected && (
        <div
          className="pointer-events-none absolute right-4 bottom-3 flex items-center gap-3 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/60"
          style={{ zIndex: 3000 }}
        >
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-sm bg-[#3f8fe6]" />
            업무 칸
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-sm bg-[#e8913a]" />
            개인 칸
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-full bg-[#ffe9b8]" />불 켜짐
            일하는 중
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-full bg-[#ffcf5c] shadow-[0_0_6px_#ffcf5c]" />
            나를 기다림
          </span>
        </div>
      )}
    </div>
  );
}
