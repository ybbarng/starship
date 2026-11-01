"use client";

// 조종석에 두는 작은 연료 계기: 지금 속도(최근 15분 분당 출력)와 오늘 연소. 누르면 연료실로 간다.
import Link from "next/link";
import { useUsage } from "@/data/hooks";
import { Tip } from "@/ui/kit/Tip";
import { tokens } from "./UsagePage";

export function FuelChip() {
  const { data } = useUsage("today");
  const speed = data ? Math.round(data.burn.total) : undefined;
  return (
    <Tip
      align="end"
      text={
        data
          ? `연료실 = 토큰 사용량을 연료로 본 방.\n지금 속도: 최근 ${data.burn.windowMin}분 분당 ${tokens(speed ?? 0)} 토큰\n오늘 연소: ${tokens(data.total.output)} 토큰\n누르면 연료실로 가요`
          : "연료실 = 토큰 사용량을 연료로 본 방. 누르면 연료실로 가요"
      }
    >
      <Link
        href="/fuel"
        data-fuel-chip
        className="flex items-center gap-1.5 tracking-normal text-white/45 hover:text-white/85"
      >
        <span className="text-[#ffb45c]/80">연료실</span>
        {speed !== undefined && (
          <span className="font-mono tabular-nums">
            {tokens(speed)}/분 · 오늘 {tokens(data?.total.output ?? 0)}
          </span>
        )}
        <span>▸</span>
      </Link>
    </Tip>
  );
}
