"use client";

// 모듈 안의 선원들. 자리(책상)는 누르는 단추, 선원 그림은 그 위에 얹혀 상태가 바뀌면 걸어서 옮긴다.
// 일함 = 책상에 앉아 작업 / 결재가 있음 = 일어나 사다리 쪽에 서서 손짓 + 머리 위 첫 결재 /
// 쉼 = 휴게석·침상에서 잠 / 자리 비움 = 빈 책상. 기다리는 것이 마지막 답변(소식)뿐이면 책상 옆에 서 있기만 한다.
// 숫자 딱지·손짓·말풍선은 모두 결재(소식 뺀 할 일, decisionsByCrew)로 센다(docs/crew-views.md).
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, type Pose } from "@/ui/crew";
import { CONTEXT_COLOR, CREW_STATUS_LABEL, elapsed } from "@/ui/kit";
import { type Deck, FIXTURES, SLAB } from "./geometry";
import type { ModuleLayout } from "./layout";

/** 글을 끌어 고르는 중이면 누름으로 치지 않는다 */
export function selecting(): boolean {
  return (window.getSelection()?.toString() ?? "").length > 0;
}

const STATUS_LIGHT: Record<Crew["status"], string> = {
  working: "#5ee08a",
  "needs-you": "#ffcf5c",
  idle: "#6c7a99",
  off: "#2a3142",
};

type Spot = {
  crew: Crew;
  x: number;
  /** 발끝 높이 */
  y: number;
  size: number;
  pose: Pose;
  flip?: boolean;
  furniture?: boolean;
  /** 가장 오래된 결재가 온 때(손짓하는 선원만) */
  since?: number;
};

/** 결재가 온 지 30분이면 가장 급하게(슬쩍 돌아봄 → 몸 기울여 손짓). */
function urgencyOf(since: number | undefined): number {
  if (!since) return 0.6;
  const minutes = (Date.now() - since) / 60_000;
  return Math.max(0.15, Math.min(1, minutes / 30));
}

/** 자리 등 색: 결재가 있으면 "나를 기다림", 소식뿐인 "나를 기다림"은 쉼 색으로 */
function lightOf(crew: Crew, calling: boolean): Crew["status"] {
  if (calling) return "needs-you";
  return crew.status === "needs-you" ? "idle" : crew.status;
}

/** 이름표 글자: 장면이 줄어도 화면에서 8px 밑으로 내려가지 않게 한다(--ib-s = Interior의 장면 배율) */
export function tagFont(px: number): string {
  return `max(${px}px, calc(8px / var(--ib-s, 1)))`;
}

/** 선원 그림 하나. 자리가 바뀌면 옛 자리에서 걸어온다. 누름은 아래 자리 단추가 받는다. */
function Walker({ spot }: { spot: Spot }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<{ x: number; y: number } | null>(null);
  const [walking, setWalking] = useState(false);
  const { x, y, size } = spot;
  const h = size * 1.25;

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { x, y };
    const el = ref.current;
    if (!p || !el || (p.x === x && p.y === y)) return;
    const dx = p.x - x;
    const dy = p.y - y;
    setWalking(true);
    const a = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx * 0.1}px, 0px)`, offset: 0.9 },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: Math.min(4000, Math.max(900, Math.abs(dx) * 9)),
        easing: "linear",
      },
    );
    a.onfinish = () => setWalking(false);
    a.oncancel = () => setWalking(false);
    return () => a.cancel();
  }, [x, y]);

  const pose: Pose = walking ? "walk" : spot.pose;
  const flip = walking ? (prev.current?.x ?? x) < x : spot.flip;
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{ left: x - size / 2, top: y - h * 0.96, width: size, height: h }}
    >
      <div style={{ transform: flip ? "scaleX(-1)" : undefined }}>
        <Animal
          kind={animalFor(spot.crew.id)}
          pose={pose}
          context={spot.crew.context}
          size={size}
          furniture={walking ? false : spot.furniture}
          urgency={urgencyOf(spot.since)}
          label={`${spot.crew.name}, ${CREW_STATUS_LABEL[spot.crew.status]}`}
        />
      </div>
    </div>
  );
}

/** 이름표: 바닥 판에 붙은 작은 글 */
function NameTag({
  x0,
  x1,
  floor,
  children,
  title,
  tone,
}: {
  x0: number;
  x1: number;
  floor: number;
  children: ReactNode;
  title: string;
  tone?: "warn" | "dim";
}) {
  return (
    <div
      title={title}
      data-nametag
      className={`absolute truncate text-center font-mono leading-[11px] ${tone === "warn" ? "font-bold text-[#ffd84a]" : tone === "dim" ? "text-white/35" : "text-white/80"}`}
      style={{
        left: x0,
        width: x1 - x0,
        top: floor + 1,
        height: SLAB - 1,
        fontSize: tagFont(9),
      }}
    >
      {children}
    </div>
  );
}

function Bubble({
  x0,
  x1,
  top,
  bottom,
  tailX,
  text,
  wait,
  onOpen,
}: {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  tailX: number;
  text: string;
  wait: string;
  onOpen: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 같은 동작을 아래 자리 단추가 키보드로 받는다
    // biome-ignore lint/a11y/noStaticElementInteractions: 글을 끌어 고를 수 있게 단추로 감싸지 않는다
    <div
      data-bubble
      onClick={() => !selecting() && onOpen()}
      className="absolute z-20 flex cursor-pointer flex-col justify-end"
      style={{ left: x0, width: x1 - x0, top, height: bottom - top }}
    >
      <div className="relative rounded-md bg-[#fffbea] px-1.5 py-1 text-left text-[#1d1a14] shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
        <div className="line-clamp-2 text-[10.5px] leading-[1.25] font-medium">
          {text}
        </div>
        {wait && (
          <div className="text-[9px] leading-tight font-semibold text-[#a06e00]">
            {wait} 기다림
          </div>
        )}
        <span
          className="absolute -bottom-[4px] h-2 w-2 rotate-45 bg-[#fffbea]"
          style={{ left: tailX - x0 - 4 }}
        />
      </div>
    </div>
  );
}

/** 업무·거주 모듈 한 층의 선원 전부 */
export function ModuleCrew({
  deck,
  layout,
  decisions,
  clock,
  selectedId,
  onSelect,
  onGroup,
}: {
  deck: Deck;
  layout: ModuleLayout;
  /** 승무원별 결재(decisionsByCrew) */
  decisions: ReadonlyMap<string, Task[]>;
  clock: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGroup: (title: string, crew: Crew[]) => void;
}) {
  const { size, desks, stubs, rest } = layout;
  const f = deck.floor;
  const headTop = f - size * 1.25 * 0.78;
  const spots: Spot[] = [];
  for (const d of desks) {
    if (d.standX !== undefined) {
      const list = decisions.get(d.crew.id) ?? [];
      spots.push({
        crew: d.crew,
        x: d.standX,
        y: f,
        size,
        pose: "wave",
        flip: d.facing < 0,
        since: list.length ? Math.min(...list.map((t) => t.since)) : undefined,
      });
    } else if (d.crew.status === "working") {
      spots.push({
        crew: d.crew,
        x: d.deskX,
        y: f,
        size,
        pose: "work",
        furniture: true,
      });
    } else if (d.crew.status === "needs-you") {
      // 소식(마지막 답변)만 남은 선원: 손짓하지 않고 책상 옆에 서 있기만
      spots.push({
        crew: d.crew,
        x: d.deskX,
        y: f,
        size,
        pose: "stand",
        flip: d.facing < 0,
      });
    }
  }
  const restSpots = restLayout(deck, rest);
  spots.push(...restSpots.spots);

  return (
    <>
      {/* 자리(책상) 단추 */}
      {desks.map((d) => {
        const sel = d.crew.id === selectedId;
        const count = decisions.get(d.crew.id)?.length ?? 0;
        const waiting = count > 0;
        const light = STATUS_LIGHT[lightOf(d.crew, waiting)];
        return (
          <button
            key={d.key}
            type="button"
            data-seat={d.crew.id}
            onClick={() => onSelect(d.crew.id)}
            aria-label={`${d.crew.name} · ${CREW_STATUS_LABEL[d.crew.status]}`}
            title={d.crew.activity ?? CREW_STATUS_LABEL[d.crew.status]}
            className="group absolute rounded-md outline-none"
            style={{
              left: d.x0 + 1,
              width: d.x1 - d.x0 - 2,
              top: deck.top + 16,
              height: f - deck.top - 16 + SLAB,
              boxShadow: sel
                ? `0 0 0 2px ${CONTEXT_COLOR[d.crew.context]}, 0 0 16px ${CONTEXT_COLOR[d.crew.context]}55`
                : undefined,
              background: sel ? "rgba(255,255,255,0.05)" : undefined,
            }}
          >
            <span className="absolute inset-0 rounded-md bg-white/0 transition group-hover:bg-white/[0.05]" />
            {/* 자리 위 상태 등 */}
            <span
              className={`absolute top-1 h-1.5 w-1.5 rounded-full ${waiting ? "ib-blink" : ""}`}
              style={{
                left: d.deskX - d.x0 - 4,
                background: light,
                boxShadow:
                  d.crew.status === "working" || waiting
                    ? `0 0 6px ${light}`
                    : undefined,
              }}
            />
            {count > 0 && (
              <span
                data-count={count}
                title={`결재 ${count}건`}
                className="absolute top-0 rounded-full bg-[#ffd84a] px-1 leading-[13px] font-bold text-black"
                style={{ left: d.deskX - d.x0 + 6, fontSize: tagFont(9) }}
              >
                {count}
              </span>
            )}
            {/* 빈 책상(일하는 선원은 그림이 이 위를 덮는다) */}
            {d.crew.status !== "working" && (
              <span
                className={`absolute ${d.crew.status === "off" ? "opacity-45" : ""}`}
                style={{
                  left: d.deskX - d.x0 - size / 2 - 1,
                  top: f - deck.top - 16 - size * 1.25 * 0.96,
                }}
              >
                <Animal
                  kind={animalFor(d.crew.id)}
                  pose="off"
                  furniture
                  size={size}
                  label={`${d.crew.name}의 빈 자리`}
                />
              </span>
            )}
          </button>
        );
      })}

      {/* 이름표(바닥 판) */}
      {desks.map((d) => (
        <NameTag
          key={`n-${d.key}`}
          x0={d.x0}
          x1={d.x1}
          floor={f}
          title={d.crew.name}
          tone={
            decisions.has(d.crew.id)
              ? "warn"
              : d.crew.status === "off"
                ? "dim"
                : undefined
          }
        >
          {d.crew.name}
          {d.crew.status === "off" ? " · 비움" : ""}
        </NameTag>
      ))}

      {/* 접힌 자리 "+n" */}
      {stubs.map((s) => (
        <button
          key={s.key}
          type="button"
          data-stub={s.label}
          onClick={() =>
            onGroup(`${deck.name} · ${s.label} ${s.crew.length}`, s.crew)
          }
          className="absolute flex flex-col items-center justify-end rounded-md border border-dashed border-white/20 bg-white/[0.03] pb-1 text-white/60 hover:bg-white/[0.08] hover:text-white"
          style={{
            left: s.x0 + 3,
            width: s.x1 - s.x0 - 6,
            top: f - 62,
            height: 60,
          }}
        >
          <span className="text-[15px] leading-none font-bold">
            +{s.crew.length}
          </span>
          <span className="mt-1 text-[9px]">{s.label}</span>
        </button>
      ))}

      {/* 쉬는 선원 자리 단추 */}
      {restSpots.spots.map((s) => (
        <button
          key={`r-${s.crew.id}`}
          type="button"
          data-seat={s.crew.id}
          onClick={() => onSelect(s.crew.id)}
          aria-label={`${s.crew.name} · 쉬는 중`}
          className="absolute rounded-md hover:bg-white/[0.06]"
          style={{
            left: s.x - s.size / 2 - 2,
            width: s.size + 4,
            top: s.y - s.size * 1.2,
            height: s.size * 1.2 + 4,
            boxShadow:
              s.crew.id === selectedId
                ? `0 0 0 2px ${CONTEXT_COLOR[s.crew.context]}`
                : undefined,
          }}
        />
      ))}
      {restSpots.tags.map((t) => (
        <div
          key={t.key}
          title={t.text}
          data-nametag
          className="absolute truncate text-center font-mono leading-[10px] text-white/55"
          style={{
            left: t.x - t.w / 2,
            width: t.w,
            top: t.y,
            fontSize: tagFont(8.5),
          }}
        >
          {t.text}
        </div>
      ))}
      {restSpots.more.length > 0 && (
        <button
          type="button"
          data-stub="쉼"
          onClick={() =>
            onGroup(`${deck.name} · 쉬는 선원 ${rest.length}`, rest)
          }
          className="absolute rounded bg-black/60 px-1.5 text-[10px] leading-4 font-semibold text-white/80 hover:text-white"
          style={{ left: restSpots.moreAt.x, top: restSpots.moreAt.y }}
        >
          +{restSpots.more.length} 쉼
        </button>
      )}

      {/* 선원 그림 */}
      {spots.map((s) => (
        <Walker key={s.crew.id} spot={s} />
      ))}

      {/* 기다리는 선원의 말풍선 */}
      {desks
        .filter((d) => d.standX !== undefined)
        .map((d) => {
          // 결재함과 같은 첫 결재, 기다린 시간도 그 결재의 것
          const t = decisions.get(d.crew.id)?.[0];
          return (
            <Bubble
              key={`b-${d.key}`}
              x0={d.x0 + 3}
              x1={d.x1 - 3}
              top={deck.top + 16}
              bottom={headTop - 4}
              tailX={d.standX ?? d.deskX}
              text={t?.title ?? d.crew.activity ?? "불러요"}
              wait={t ? elapsed(t.since, clock) : ""}
              onOpen={() => onSelect(d.crew.id)}
            />
          );
        })}
    </>
  );
}

/** 쉬는 선원: 업무 모듈은 휴게석 소파, 거주 모듈은 침상 */
function restLayout(deck: Deck, rest: Crew[]) {
  const f = deck.floor;
  const spots: Spot[] = [];
  const tags: { key: string; x: number; y: number; w: number; text: string }[] =
    [];
  let slots: { x: number; y: number; size: number; tagY: number }[] = [];
  let tagW = 52;
  let moreAt = { x: 0, y: 0 };
  if (deck.id === "work") {
    const { x0, x1 } = FIXTURES.lounge;
    // 소파 자리 둘: 셋이면 이름표 폭이 35px쯤이라 이름이 "billin…"처럼 잘렸다(2026-11-03). 넘치면 "+n 쉼"
    const n = 2;
    const w = (x1 - x0 - 30) / n;
    slots = Array.from({ length: n }, (_, i) => ({
      x: x0 + 10 + w * (i + 0.5),
      y: f - 18,
      size: 40,
      tagY: f + 1,
    }));
    moreAt = { x: x0 + 12, y: deck.top + 34 };
    tagW = w - 2;
  } else if (deck.id === "home") {
    const { x0, x1 } = FIXTURES.bunks;
    const colW = (x1 - x0 - 30) / 2;
    const col = (c: number) => x0 + 12 + c * (colW + 6) + colW / 2 - 6;
    slots = [
      { x: col(0), y: f - 14, size: 38, tagY: f + 1 },
      { x: col(1), y: f - 14, size: 38, tagY: f + 1 },
      { x: col(0), y: f - 68, size: 38, tagY: f - 62 },
      { x: col(1), y: f - 68, size: 38, tagY: f - 62 },
    ];
    tagW = colW - 4;
    moreAt = { x: x1 - 52, y: deck.top + 4 };
  }
  const shown = rest.slice(0, slots.length);
  for (const [i, c] of shown.entries()) {
    const s = slots[i];
    if (!s) continue;
    spots.push({ crew: c, x: s.x, y: s.y, size: s.size, pose: "sleep" });
    tags.push({ key: c.id, x: s.x, y: s.tagY, w: tagW, text: c.name });
  }
  return { spots, tags, more: rest.slice(slots.length), moreAt };
}
