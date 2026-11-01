"use client";

// 조종석 계기판의 연료·속도 계기. 작은 속도계(지금 속도), 엔진별 막대, 오늘 연소·연료비. 누르면 연료실.
// 숫자는 연료실과 같다(최근 15분 분당 출력 토큰, 로그 눈금).
import Link from "next/link";
import { useUsage } from "@/data/hooks";
import cockpit from "@/protos/cockpit/cockpit.module.css";
import { Tip } from "@/ui/kit/Tip";
import { AREA_LABEL, type Area } from "@/usage/model";
import { SPEED_FULL, speedRatio } from "./FuelRoom";
import { tokens, usd } from "./UsagePage";

const AREAS: Area[] = ["work", "personal", "other"];
const COLOR: Record<Area, string> = {
  work: "#6aa8ff",
  personal: "#ffb45c",
  other: "#9aa6bd",
};

export function FuelGauge() {
  const { data } = useUsage("today");
  const total = data?.burn.total ?? 0;
  const r = speedRatio(total);
  const angle = -120 + r * 240;
  const tip = data
    ? `연료·속도 = 토큰 사용량을 연료로 본 계기.\n지금 속도: 최근 ${data.burn.windowMin}분 분당 ${tokens(Math.round(total))} 토큰(로그 눈금, 끝 ${tokens(SPEED_FULL)})\n오늘 연소 ${tokens(data.total.output)} · 연료비 추정 ${usd(data.total.cost)}\n누르면 연료실로 가요`
    : "연료·속도 = 토큰 사용량을 연료로 본 계기. 누르면 연료실로 가요";
  return (
    <Tip text={tip} side="top" align="end" className="w-full">
      <Link
        href="/fuel"
        data-fuel-gauge
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:brightness-125 ${cockpit.bay}`}
      >
        <svg viewBox="-30 -30 60 60" width="60" aria-hidden>
          <circle r="27" fill="#0a0e15" stroke="#3a4558" strokeWidth="2" />
          <path
            d="M -18.19 10.5 A 21 21 0 1 1 18.19 10.5"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.1"
            strokeWidth="3"
          />
          <line
            x1="0"
            y1="3"
            x2="0"
            y2="-19"
            stroke="#ffd9a8"
            strokeWidth="1.6"
            strokeLinecap="round"
            transform={`rotate(${angle})`}
          />
          <circle r="2.5" fill="#cfd8e8" />
          <text
            y="16"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
            fill="#f4f6fa"
          >
            {tokens(Math.round(total))}
          </text>
        </svg>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between text-[9.5px] font-semibold tracking-[0.22em] text-white/35">
            연료 · 속도
            <span className="font-mono tracking-normal text-[#ffc46b] [text-shadow:0_0_6px_rgba(255,180,92,0.5)]">
              오늘 {data ? tokens(data.total.output) : "-"}
            </span>
          </span>
          {AREAS.map((a) => {
            const v = data?.burn.perMin[a] ?? 0;
            return (
              <span key={a} className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 text-[9.5px] text-white/45">
                  {AREA_LABEL[a]}
                </span>
                <span className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${speedRatio(v) * 100}%`,
                      background: COLOR[a],
                      boxShadow: v > 0 ? `0 0 5px ${COLOR[a]}` : undefined,
                    }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[9.5px] text-white/55">
                  {tokens(Math.round(v))}/분
                </span>
              </span>
            );
          })}
        </span>
      </Link>
    </Tip>
  );
}
