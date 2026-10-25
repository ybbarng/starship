"use client";

import { useEffect } from "react";
import { DESTINATIONS } from "@/sky/bodies";
import { SpaceView } from "@/sky/SpaceView";
import { useDestination, useVoyage } from "@/sky/voyage";

// 창밖 우주 확인판. ?to=saturn 처럼 주면 그 목적지에서 시작한다(스크린숏용).
export default function SkyLab() {
  const travelTo = useVoyage((s) => s.travelTo);
  const phase = useVoyage((s) => s.phase);
  const dest = useDestination();

  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get("to");
    if (to) useVoyage.setState({ destinationId: to });
  }, []);

  return (
    <main className="flex h-screen flex-col bg-hull-950">
      <SpaceView className="flex-1" labels="few" lookAround />
      <div className="flex flex-wrap gap-1.5 border-t border-white/10 p-3 text-sm">
        <span className="mr-3 text-white/70">
          {dest.ko} · {phase === "travel" ? "이동 중" : dest.fact}
        </span>
        {DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => travelTo(d.id)}
            className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
          >
            {d.ko}
          </button>
        ))}
      </div>
    </main>
  );
}
