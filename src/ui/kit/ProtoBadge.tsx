"use client";

// 왼쪽 위 시안 이름과 데이터 출처(데모일 때 "데모 데이터").
import Link from "next/link";
import { useBridge } from "@/data/hooks";

export function ProtoBadge({ name }: { name: string }) {
  const { notice } = useBridge();
  return (
    <div className="pointer-events-auto fixed top-2 left-3 z-40 flex items-center gap-2 text-[11px] text-white/45">
      <Link href="/" className="hover:text-white/80">
        ◂ 시안
      </Link>
      <span>·</span>
      <span>{name}</span>
      {notice && (
        <span
          data-notice
          className="flex items-center gap-1.5 rounded-full border border-signal-warn/60 bg-signal-warn/15 px-2 py-0.5 font-medium text-[12px] text-signal-warn"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-signal-warn" />
          {notice}
        </span>
      )}
    </div>
  );
}
