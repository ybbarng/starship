"use client";

// 창밖이 실제 축척이 아님을 알리는 작은 표. 마우스를 올리거나 누르면 규칙 전체를 위쪽에 보여 준다.
import { useState } from "react";
import { twMerge } from "tailwind-merge";

export function ScaleNote({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      data-scale-note
      className={twMerge(
        "pointer-events-auto relative inline-flex font-sans text-[10.5px]",
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
        크기 실제 비율 · 거리 두 배마다 한 칸
        <span
          aria-hidden
          className="grid size-3 place-items-center rounded-full border border-current text-[8px] leading-none"
        >
          i
        </span>
      </button>
      {open && (
        <span className="absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#05080f]/95 px-3 py-2.5 text-left text-[11.5px] leading-relaxed whitespace-normal text-white/75 shadow-xl backdrop-blur-md">
          <b className="font-semibold text-white/90">크기</b> 지구를 기준으로 한
          실제 비율. 태양만 1/3로 줄였고, 아주 작은 위성과 탐사선은 보이게
          키웠다.
          <br />
          <b className="font-semibold text-white/90">거리</b> 태양에서 거리가 두
          배가 될 때마다 같은 간격(로그). 위성 거리도 모행성 반지름을 기준으로
          같은 방식.
          <br />
          <span className="text-white/50">
            계기판의 거리·빛 지연·속도는 줄이지 않은 실제 값.
          </span>
        </span>
      )}
    </span>
  );
}
