"use client";

// 왼쪽 위 작은 표시와 데이터 출처(데모일 때 "데모 데이터").
// 확정된 조종석(home)은 "STARSHIP · 옛 시안 ▸", 옛 시안은 "◂ 시안 목록 · 이름"으로 /proto에 돌아간다.
import Link from "next/link";
import { useBridge } from "@/data/hooks";

export function ProtoBadge({ name, home }: { name?: string; home?: boolean }) {
  const { notice } = useBridge();
  return (
    <div className="pointer-events-auto fixed top-2 left-3 z-40 flex items-center gap-2 text-[11px] text-white/45">
      {home ? (
        <>
          <span className="font-semibold tracking-[0.2em] text-white/55">
            STARSHIP
          </span>
          <span>·</span>
          <Link href="/proto" className="hover:text-white/80">
            옛 시안 ▸
          </Link>
        </>
      ) : (
        <>
          <Link href="/proto" className="hover:text-white/80">
            ◂ 시안 목록
          </Link>
          <span>·</span>
          <span>{name}</span>
        </>
      )}
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
