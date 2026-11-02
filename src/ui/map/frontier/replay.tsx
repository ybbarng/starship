"use client";

// 개척 되감기: 지도가 지나온 모습을 한 장씩 돌려 본다(2026-11-02 사용자).
// 장과 장 사이의 바뀐 것은 살아 있는 지도(seen.ts·alive.tsx)가 그대로 보여 준다: 승무원이 걷고, 완공된 땅에 폭죽.
// 기록은 GET /v1/crew/{id}/map/history(docs/protocol.md). 설계: docs/frontier.md "되감기".
import { useEffect, useState } from "react";
import type { MapFrame } from "@/protocol/v1";
import { markBusy } from "@/ui/kit/pace";

/** 한 번 돌려 보는 데 드는 시간(대략). 장이 많으면 장마다 짧게 */
const TOTAL_MS = 14_000;

export function stepMs(frames: number): number {
  if (frames < 2) return 1000;
  return Math.min(1500, Math.max(500, TOTAL_MS / (frames - 1)));
}

export type Replay = {
  /** 지금 보이는 장 차례 */
  k: number;
  playing: boolean;
  setK: (k: number) => void;
  toggle: () => void;
};

/** 열면 처음 장부터 재생한다. 마지막 장(지금)에 닿으면 멈춘다. */
export function useReplay(frames: MapFrame[], open: boolean): Replay {
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = frames.length;
  // 기록이 오면(또는 다시 열면) 처음부터
  useEffect(() => {
    if (open && n >= 2) {
      setK(0);
      setPlaying(true);
    } else setPlaying(false);
  }, [open, n]);
  useEffect(() => {
    if (!playing) return;
    const ms = stepMs(n);
    markBusy(ms + 100);
    const t = setTimeout(() => {
      if (k + 1 >= n - 1) {
        setK(n - 1);
        setPlaying(false);
      } else setK(k + 1);
    }, ms);
    return () => clearTimeout(t);
  }, [playing, k, n]);
  return {
    k: Math.min(k, Math.max(0, n - 1)),
    playing,
    setK: (x) => {
      setPlaying(false);
      setK(x);
    },
    toggle: () => {
      if (!playing && k >= n - 1) setK(0);
      setPlaying(!playing);
    },
  };
}

const DATE = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

export function ReplayBar({
  frames,
  replay,
  loading,
  onClose,
}: {
  frames: MapFrame[];
  replay: Replay;
  loading: boolean;
  onClose: () => void;
}) {
  const n = frames.length;
  const f = frames[replay.k];
  return (
    <div
      data-replay-bar
      data-camera="replay"
      className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-[#0a0a10]/90 px-2.5 py-1.5 text-[12px] text-white/80 shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {loading ? (
        <span>기록을 읽는 중…</span>
      ) : n < 2 ? (
        <span>아직 지나온 기록이 없어요</span>
      ) : (
        <>
          <button
            type="button"
            onClick={replay.toggle}
            aria-label={replay.playing ? "멈추기" : "재생"}
            className="w-6 rounded hover:bg-white/10"
          >
            {replay.playing ? "⏸" : "▶"}
          </button>
          <input
            type="range"
            min={0}
            max={n - 1}
            value={replay.k}
            onChange={(e) => replay.setK(Number(e.target.value))}
            aria-label="되감기 위치"
            className="w-40 accent-[#7ce0ff]"
          />
          <span
            data-replay-date
            className="w-[86px] font-semibold text-white tabular-nums"
          >
            {f ? DATE.format(f.at) : ""}
            {replay.k === n - 1 ? " · 지금" : ""}
          </span>
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="되감기 닫기"
        className="rounded px-1.5 text-white/55 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
