"use client";

// 동작 결과 한 줄을 잠깐 띄운다. data-toast는 클릭 확인 스크립트가 읽는다.
import { useToast } from "@/data/toast";

const TONE = {
  ok: "border-signal-ok/50",
  error: "border-signal-alert/60",
  info: "border-white/25",
} as const;

export function Toasts({ className = "" }: { className?: string }) {
  const items = useToast((s) => s.items);
  return (
    <div
      className={`pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 ${className}`}
    >
      {items.map((t) => (
        <div
          key={t.id}
          data-toast
          className={`rounded-full border bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur ${TONE[t.tone]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
