"use client";

// 창밖 축척 안내와 전환 단추. 안내에 마우스를 올리거나 누르면 규칙 전체를 위쪽에 보여 준다.
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { useScale } from "./scale";

export function ScaleNote({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mode = useScale((s) => s.mode);
  const setMode = useScale((s) => s.setMode);
  const real = mode === "real";
  return (
    <span
      data-scale-note
      className={twMerge(
        "pointer-events-auto relative inline-flex items-center gap-1.5 font-sans text-[10.5px]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 whitespace-nowrap text-white/40 transition hover:text-white/75"
      >
        <span className="text-white/30">축척</span>
        {real ? "실제 그대로" : "크기 실제 비율 · 거리 두 배마다 한 칸"}
        <span
          aria-hidden
          className="grid size-3 place-items-center rounded-full border border-current text-[8px] leading-none"
        >
          i
        </span>
      </button>
      <button
        type="button"
        data-scale-toggle
        aria-pressed={real}
        onClick={() => setMode(real ? "compressed" : "real")}
        className={`rounded-full border px-1.5 py-px whitespace-nowrap transition ${
          real
            ? "border-[#9fe3ff]/50 bg-[#9fe3ff]/10 text-[#c9f1ff] hover:bg-[#9fe3ff]/20"
            : "border-white/15 text-white/55 hover:border-white/35 hover:text-white"
        }`}
      >
        {real ? "줄여서 보기" : "실제 축척으로"}
      </button>
      {open && (
        <span className="absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#05080f]/95 px-3 py-2.5 text-left text-[11.5px] leading-relaxed whitespace-normal text-white/75 shadow-xl backdrop-blur-md">
          {real ? (
            <>
              <b className="font-semibold text-white/90">실제 축척</b> 크기와
              거리를 모두 같은 비율로 줄였다. 지구가 지름 1cm 구슬이면 태양은
              117m 떨어진 1.1m 공, 해왕성은 3.5km 밖이다. 그래서 행성은 대부분
              빛점으로만 보인다.
              <br />
              <span className="text-white/50">
                탐사선만 보이게 크게 그렸다.
              </span>
            </>
          ) : (
            <>
              <b className="font-semibold text-white/90">크기</b> 지구를
              기준으로 한 실제 비율. 태양만 1/3로 줄였고, 아주 작은 위성과
              탐사선은 보이게 키웠다.
              <br />
              <b className="font-semibold text-white/90">거리</b> 태양에서
              거리가 두 배가 될 때마다 같은 간격(로그). 위성 거리는 덜
              줄였다(달은 실제의 약 1/3).
            </>
          )}
          <br />
          <span className="text-white/50">
            계기판의 거리·빛 지연·속도는 어느 축척이든 실제 값.
          </span>
        </span>
      )}
    </span>
  );
}
