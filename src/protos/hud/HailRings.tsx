"use client";

// 교신: 사람이 부르면 투영 조준 고리가 창밖 하늘의 한 점(출처마다 정해 둔 항구 별 방향)에 걸린다.
// 고리 옆에 "누가 · 출처 · 한 줄 · 몇 분". 누르면 투영 카드가 커지며 할 일 버튼이 나온다.
// 창 밖(또는 뒤쪽)에 있으면 창 가장자리에 화살표로 붙는다.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Hail, SourceKind, Task } from "@/protocol/v1";
import { raDecToEcliptic, toThree } from "@/sky/astro";
import { projector } from "@/sky/projector";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import s from "./hud.module.css";

/** 출처마다 교신이 들어오는 하늘 방향(밝은 별 근처). */
const PORT: Partial<
  Record<SourceKind, { ra: number; dec: number; star: string }>
> = {
  chat: { ra: 101.29, dec: -16.72, star: "시리우스" },
  issue: { ra: 279.23, dec: 38.78, star: "베가" },
  review: { ra: 297.7, dec: 8.87, star: "알타이르" },
  doc: { ra: 79.17, dec: 46.0, star: "카펠라" },
};
const FALLBACK = { ra: 213.9, dec: 19.18, star: "아르크투루스" };

export const MAX_RINGS = 4;

const v = new THREE.Vector3();

export type HailView = { hail: Hail; task: Task | undefined };

export function HailRings({
  items,
  open,
  onOpen,
  clock,
  safeBottom,
}: {
  items: HailView[];
  open: string | null;
  onOpen: (id: string | null) => void;
  clock: number;
  /** 창 높이 중 고리가 내려올 수 있는 아래 끝(투영판 위) 비율 */
  safeBottom: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const openRef = useRef(open);
  openRef.current = open;
  const safeRef = useRef(safeBottom);
  safeRef.current = safeBottom;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cam = projector.camera;
      const el = box.current;
      if (!cam || !el) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const top = 112;
      const bottom = Math.max(top + 40, H * safeRef.current - 30);
      const left = 70;
      const right = W - 70;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const sameKind = new Map<string, number>();
      const placed: { x: number; y: number }[] = [];
      for (const [id, node] of refs.current) {
        const kind = node.dataset.kind as SourceKind;
        const n = sameKind.get(kind) ?? 0;
        sameKind.set(kind, n + 1);
        const port = PORT[kind] ?? FALLBACK;
        const [x, y, z] = toThree(
          raDecToEcliptic(port.ra + n * 7, port.dec - n * 4),
        );
        v.set(x, y, z).multiplyScalar(1000).add(cam.position).project(cam);
        const behind = v.z > 1;
        const nx = behind ? -v.x : v.x;
        const ny = behind ? -v.y : v.y;
        let px = (nx * 0.5 + 0.5) * W;
        let py = (-ny * 0.5 + 0.5) * H;
        const inside =
          !behind && px >= left && px <= right && py >= top && py <= bottom;
        let angle = 0;
        if (!inside) {
          // 가운데에서 그 방향으로 뻗은 선이 안전 사각형과 만나는 곳
          let dx = px - cx;
          const dy = py - cy;
          if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dx = 1;
          const t = Math.min(
            (right - cx) / Math.max(1e-3, Math.abs(dx)),
            (bottom - cy) / Math.max(1e-3, Math.abs(dy)),
          );
          px = cx + dx * t;
          py = cy + dy * t;
          angle = Math.atan2(dy, dx);
        }
        // 이름표가 서로 겹치지 않게 아래로 민다
        let ly = 0;
        for (let guard = 0; guard < 6; guard++) {
          const hit = placed.find(
            (p) => Math.abs(p.x - px) < 300 && Math.abs(p.y - (py + ly)) < 58,
          );
          if (!hit) break;
          ly += 60;
        }
        if (py + ly > bottom + 20) ly = -ly;
        placed.push({ x: px, y: py + ly });
        node.style.transform = `translate(${px}px, ${py + ly}px)`;
        node.dataset.edge = inside ? "" : "1";
        node.dataset.flip = px > W - 470 ? "1" : "";
        const arrow = node.querySelector<HTMLElement>("[data-arrow]");
        if (arrow) {
          arrow.style.display = inside ? "none" : "block";
          arrow.style.transform = `rotate(${angle}rad)`;
        }
        const label = node.querySelector<HTMLElement>("[data-label]");
        if (label) {
          const flip = px > W - 470;
          label.style.left = flip ? "auto" : "40px";
          label.style.right = flip ? "40px" : "auto";
          label.style.textAlign = flip ? "right" : "left";
        }
        node.style.zIndex = openRef.current === id ? "5" : "1";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      {items.map(({ hail, task }) => {
        const port = PORT[hail.source.kind] ?? FALLBACK;
        const expanded = open === hail.id;
        return (
          <div
            key={hail.id}
            ref={(el) => {
              if (el) refs.current.set(hail.id, el);
              else refs.current.delete(hail.id);
            }}
            data-kind={hail.source.kind}
            className="absolute top-0 left-0"
            style={{ transform: "translate(-999px,-999px)" }}
          >
            {/* 고리: 기준점이 고리 가운데 */}
            <button
              type="button"
              data-hail-ring={hail.id}
              aria-label={`교신 ${hail.from.name}: ${hail.line}`}
              onClick={() => onOpen(expanded ? null : hail.id)}
              className="pointer-events-auto absolute -top-7 -left-7 h-14 w-14 cursor-pointer rounded-full"
            >
              <svg
                viewBox="-30 -30 60 60"
                className="h-full w-full"
                aria-hidden
              >
                <circle
                  r="27"
                  fill="none"
                  stroke="#ffcf5c"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  className={s.pulse}
                />
                <g className={s.spin}>
                  <circle
                    r="21"
                    fill="none"
                    stroke="#ffcf5c"
                    strokeWidth="2"
                    strokeDasharray="22 11"
                  />
                </g>
                <g className={s.spinBack}>
                  <path
                    d="M-13 -13 l6 0 M-13 -13 l0 6 M13 -13 l-6 0 M13 -13 l0 6 M-13 13 l6 0 M-13 13 l0 -6 M13 13 l-6 0 M13 13 l0 -6"
                    stroke="#ffe2a0"
                    strokeWidth="1.6"
                  />
                </g>
                <circle r="2.4" fill="#fff2cc" />
                <path
                  d="M-30 0 h6 M24 0 h6 M0 -30 v6 M0 24 v6"
                  stroke="#ffcf5c"
                  strokeWidth="1.4"
                />
              </svg>
              <span
                data-arrow
                className="absolute inset-0 hidden"
                style={{ transformOrigin: "50% 50%" }}
              >
                <svg
                  viewBox="-30 -30 60 60"
                  className="h-full w-full overflow-visible"
                  aria-hidden
                >
                  <path d="M33 -7 L44 0 L33 7 Z" fill="#ffcf5c" />
                </svg>
              </span>
            </button>

            {/* 이름표 또는 펼친 카드 */}
            <div
              data-label
              className="pointer-events-auto absolute -top-6"
              style={{ left: 40 }}
            >
              {expanded ? (
                <div
                  className={`${s.rise} w-[420px] rounded-md border border-[#ffcf5c]/70 bg-[#1a1204]/80 p-4 text-left shadow-[0_0_30px_rgb(255_207_92/0.25)] backdrop-blur-md`}
                  style={{ color: "#ffe9b8" }}
                >
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="font-mono tracking-wide text-[#ffcf5c]">
                      교신 수신
                    </span>
                    <span
                      className="rounded-sm px-1.5 text-[11.5px] font-bold text-black"
                      style={{ background: CONTEXT_COLOR[hail.context] }}
                    >
                      {CONTEXT_LABEL[hail.context]}
                    </span>
                    <span className="ml-auto font-mono">
                      {ago(hail.since, clock)} 전
                    </span>
                    <button
                      type="button"
                      aria-label="교신 카드 닫기"
                      onClick={() => onOpen(null)}
                      className="rounded px-1.5 text-[#ffe2a0]/70 hover:bg-white/10"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 text-[15px] font-semibold text-[#fff2cc]">
                    {hail.from.name}
                    <span className="font-normal text-[#ffe2a0]/80">
                      {" "}
                      · {hail.from.where ?? sourceLabel(hail.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-[18px] leading-snug font-semibold text-white">
                    {hail.line}
                  </p>
                  <div className="mt-1 text-[11.5px] text-[#ffe2a0]/60">
                    {port.star} 방향에서 교신 · {sourceLabel(hail.source)}
                  </div>
                  {task ? (
                    <TaskActions
                      task={task}
                      className="mt-3 flex flex-wrap gap-1.5"
                      buttonClassName={s.hailButton}
                      primaryClassName={s.hailPrimary}
                    />
                  ) : hail.url ? (
                    <a
                      href={hail.url}
                      target="_blank"
                      rel="noopener"
                      className={`${s.hailPrimary} mt-3 inline-block`}
                    >
                      원본 열기
                    </a>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(hail.id)}
                  className="block max-w-[300px] rounded-sm border-l-2 border-[#ffcf5c] bg-black/55 px-2.5 py-1 text-left backdrop-blur-sm"
                >
                  <div className="truncate text-[12px] font-semibold text-[#ffcf5c]">
                    {hail.from.name} ·{" "}
                    {hail.from.where ?? sourceLabel(hail.source)}
                    <span className="ml-1.5 font-mono font-normal text-[#ffe2a0]/75">
                      {ago(hail.since, clock)}
                    </span>
                  </div>
                  <div className="truncate text-[13.5px] font-medium text-[#fff4d6]">
                    {hail.line}
                  </div>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
