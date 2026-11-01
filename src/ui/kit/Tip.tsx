"use client";

// 빠른 말풍선. 브라우저 기본 툴팁(title)은 1초 넘게 걸려서, 마우스를 올리면 0.12초 만에 뜨는 것을 따로 둔다.
// 키보드로 안에 있는 단추에 포커스가 가도 뜬다. 화면 가장자리에서 잘리지 않게 붙는 쪽(align)을 고른다.
// 스크린 리더는 aria-describedby로 같은 글을 읽는다.
import { type ReactNode, useId } from "react";

export function Tip({
  text,
  children,
  align = "center",
  side = "bottom",
  className = "",
}: {
  /** 말풍선 글. 비면 감싸기만 한다 */
  text?: ReactNode;
  children: ReactNode;
  /** 말풍선을 어느 쪽에 맞출지. 화면 왼쪽 끝이면 start, 오른쪽 끝이면 end */
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  if (!text) return <>{children}</>;
  const x =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  const y = side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  return (
    <span
      className={`group/tip relative inline-flex ${className}`}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        data-tip
        className={`pointer-events-none absolute z-50 ${x} ${y} w-max max-w-[300px] rounded-md border border-white/15 bg-[#0b111c]/95 px-2.5 py-1.5 text-left text-[11.5px] leading-snug font-normal tracking-normal whitespace-pre-line text-white/90 opacity-0 shadow-lg shadow-black/50 transition-opacity duration-100 group-focus-within/tip:opacity-100 group-focus-within/tip:delay-0 group-hover/tip:opacity-100 group-hover/tip:delay-[120ms]`}
      >
        {text}
      </span>
    </span>
  );
}
