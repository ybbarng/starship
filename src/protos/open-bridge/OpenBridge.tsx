"use client";

// 2차 시안 "트인 함교". 방향: docs/prototypes/direction-round2.md
// 첫 장면 = 창틀 없이 트인 우주(끌어서 둘러보기, 천체를 눌러 날아가기) 위에 얇은 계기와 접히는 패널.
// 아래로 밀면 창밖이 위쪽 띠로 줄고, 층층이 구조화된 우주선 내부가 드러난다.
import { SpaceView } from "@/sky/SpaceView";
import { EventLayer } from "@/ui/events";
import { ProtoBadge, Toasts, useScrollStage } from "@/ui/kit";
import { Cockpit } from "./cockpit/Cockpit";
import { Interior } from "./interior/Interior";

/** 내부 장면에서 창밖 띠가 차지하는 높이(화면 비율) */
export const BAND_SHARE = 0.3;

export function OpenBridge() {
  const { stage, progress: p, push, goTo } = useScrollStage();
  const bandScale = 1 - (1 - BAND_SHARE) * p;

  return (
    <main className="fixed inset-0 overflow-hidden bg-hull-950 text-white">
      {/* 창밖: 첫 장면에선 화면 전체, 내부 장면에선 위쪽 띠 */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{
          height: `${100 * bandScale}%`,
          borderBottom:
            p > 0.02 ? "1px solid rgba(255,255,255,.12)" : undefined,
        }}
      >
        <SpaceView
          className="absolute inset-0"
          labels="few"
          lookAround
          clickToFly
          drift
        />
        <EventLayer every={150} enabled={stage === 0} />
      </div>

      {/* 첫 장면의 계기와 패널(창밖 위에 겹친다) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: Math.max(0, 1 - p * 2),
          visibility: p > 0.98 ? "hidden" : "visible",
        }}
      >
        <Cockpit active={stage === 0} push={push} onInterior={() => goTo(1)} />
      </div>

      {/* 내부 장면(창밖 띠 아래) */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: `${100 * BAND_SHARE}%`,
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px)`,
          pointerEvents: stage === 1 ? "auto" : "none",
          visibility: p < 0.02 ? "hidden" : "visible",
        }}
      >
        <Interior active={stage === 1} onCockpit={() => goTo(0)} />
      </div>

      <Toasts />
      <ProtoBadge name="트인 함교 (2차)" />
    </main>
  );
}
