"use client";

import { useMemo, useState } from "react";
import {
  EVENT_KINDS,
  EVENT_LABELS,
  type EventInfo,
  type EventKind,
  EventLayer,
  useEventBus,
} from "@/ui/events";

const BUTTON_NAMES: Record<EventKind, string> = {
  moa: "모아",
  popo: "포포",
  dor: "도르",
  kkung: "끙",
  comet: "혜성",
  meteors: "유성우",
  station: "정거장",
  oumuamua: "성간 천체",
};

/** 서버와 브라우저가 같은 별을 그리도록 씨앗을 둔 무작위 */
function makeStars(count: number, seed: number) {
  let a = seed;
  const rand = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 100,
    r: rand() < 0.08 ? 1.6 : rand() * 0.9 + 0.4,
    o: rand() * 0.6 + 0.25,
  }));
}

function StarField({ count, seed }: { count: number; seed: number }) {
  const stars = useMemo(() => makeStars(count, seed), [count, seed]);
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      aria-hidden
      preserveAspectRatio="none"
    >
      {stars.map((s) => (
        <circle
          key={s.id}
          cx={`${s.x}%`}
          cy={`${s.y}%`}
          r={s.r}
          fill="#e8ecff"
          opacity={s.o}
        />
      ))}
    </svg>
  );
}

export default function EventsLabPage() {
  const trigger = useEventBus((s) => s.trigger);
  const current = useEventBus((s) => s.current);
  const [log, setLog] = useState<string[]>([]);

  const handleEvent = (info: EventInfo) => {
    const line = info.clicked
      ? `${BUTTON_NAMES[info.kind]}를 눌렀어요`
      : `${EVENT_LABELS[info.kind]}`;
    setLog((prev) => [line, ...prev].slice(0, 4));
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-hull-950 px-4 py-6 text-sm">
      <StarField count={360} seed={7} />
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-4">
        <div
          className="relative h-[520px] w-full overflow-hidden rounded-[28px] border border-hull-600/70 shadow-[0_0_0_6px_rgba(20,27,47,.9),0_20px_60px_rgba(0,0,0,.6)]"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, #10183a 0%, #070a18 60%, #04060d 100%)",
          }}
        >
          <StarField count={260} seed={42} />
          {/* 계기판 자리: 이벤트가 이 아래로는 내려오지 않는다 */}
          <div className="absolute inset-x-0 bottom-0 h-1/4 border-t border-dashed border-white/10 bg-gradient-to-t from-hull-900/70 to-transparent">
            <span className="absolute right-4 bottom-3 text-[11px] text-white/25">
              계기판 자리 (아래 25%)
            </span>
          </div>
          <EventLayer every={30} firstDelay={6} onEvent={handleEvent} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {EVENT_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => trigger(kind)}
              className={`rounded-full border px-3.5 py-1.5 transition-colors ${
                current?.kind === kind
                  ? "border-glow-work/70 bg-glow-work/15 text-white"
                  : "border-hull-600 bg-hull-800/80 text-white/75 hover:bg-hull-700"
              }`}
            >
              {BUTTON_NAMES[kind]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => trigger()}
            className="rounded-full border border-dashed border-hull-600 px-3.5 py-1.5 text-white/60 hover:bg-hull-800"
          >
            아무거나
          </button>
          <span className="ml-auto text-[12px] text-white/40">
            {log[0] ?? "손님을 눌러 보세요"}
          </span>
        </div>
      </div>
    </main>
  );
}
