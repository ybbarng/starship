"use client";

import { useRef } from "react";
import { AU_KM } from "@/sky/astro";
import {
  DESTINATIONS,
  type Destination,
  type DestinationGroup,
  probePositionAU,
} from "@/sky/bodies";
// 여행 목적지 고르기(모달 안에 넣어 쓴다). 고르면 창밖이 그쪽으로 날아간다.
import { formatDistance } from "@/sky/telemetry";
import { useVoyage } from "@/sky/voyage";

const GROUPS: DestinationGroup[] = [
  "전망",
  "태양과 행성",
  "위성",
  "작은 천체",
  "혜성",
  "탐사선",
  "유명한 별",
];

export function DestinationPicker({
  onPick,
}: {
  onPick?: (id: string) => void;
}) {
  const current = useVoyage((s) => s.destinationId);
  const travelTo = useVoyage((s) => s.travelTo);
  const sections = useRef(new Map<DestinationGroup, HTMLElement>());
  return (
    <div className="relative space-y-4">
      {/* 목록이 길어 창 아래로 이어진다. 갈 수 있는 무리를 한눈에 보이고 누르면 그리로 옮긴다. */}
      <nav
        data-destination-groups
        className="sticky -top-5 z-10 -mx-5 -mt-5 flex flex-wrap gap-1.5 border-b border-white/10 bg-hull-900/95 px-5 py-2.5 backdrop-blur"
      >
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() =>
              sections.current
                .get(g)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/70 hover:border-white/40 hover:text-white"
          >
            {g}
          </button>
        ))}
      </nav>
      {GROUPS.map((g) => (
        <section
          key={g}
          ref={(el) => {
            if (el) sections.current.set(g, el);
          }}
          className="scroll-mt-14"
        >
          <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-white/50">
            {g}
          </h3>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {DESTINATIONS.filter((d) => d.group === g).map((d) => (
              <button
                key={d.id}
                type="button"
                data-destination={d.id}
                onClick={() => {
                  travelTo(d.id);
                  onPick?.(d.id);
                }}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  d.id === current
                    ? "border-glow-work/70 bg-glow-work/15"
                    : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-medium">
                  {d.ko}
                  {distanceOf(d) && (
                    <span className="ml-1.5 text-xs text-white/50">
                      {distanceOf(d)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-white/55">
                  {d.fact}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {/* 아래로 더 있다는 표시: 창 아래 끝이 흐려진다. */}
      <div
        aria-hidden
        className="pointer-events-none sticky -bottom-5 -mx-5 -mb-5 h-8 bg-gradient-to-t from-hull-900 to-transparent"
      />
    </div>
  );
}

/** 목적지 옆 거리. 탐사선은 지금 태양에서의 실제 거리. */
function distanceOf(d: Destination): string | undefined {
  if (d.distance) return d.distance;
  if (!d.probe) return undefined;
  const [x, y, z] = probePositionAU(d.probe, Date.now());
  return formatDistance(Math.hypot(x, y, z) * AU_KM);
}
