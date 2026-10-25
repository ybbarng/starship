"use client";

// 창 위쪽 띠: 오늘의 항로 10칸과 지금 칸. 치울 때마다 한 칸 워프한 것을 크게 알린다.
import { useEffect, useState } from "react";
import { useDestination, useVoyage } from "@/sky/voyage";
import { ROUTE, START, stopName, useRoute } from "./route";

export function RouteBand({ compact }: { compact: boolean }) {
  const cleared = useRoute((s) => s.cleared);
  const lastWarp = useRoute((s) => s.lastWarp);
  const phase = useVoyage((s) => s.phase);
  const dest = useDestination();
  const step = Math.min(cleared, ROUTE.length);
  const stops = [START, ...ROUTE];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center pt-2.5">
      <div className="flex items-center gap-0 rounded-full border border-white/12 bg-black/45 px-4 py-1.5 backdrop-blur-sm">
        <span className="mr-3 text-[10.5px] font-semibold tracking-widest text-white/50">
          오늘의 항로
        </span>
        {stops.map((id, i) => {
          const here = i === step;
          const passed = i < step;
          const nextOne = i === step + 1;
          return (
            <span key={id} className="flex items-center">
              {i > 0 && (
                <span
                  className={`h-[2px] w-9 ${passed || here ? "bg-emerald-300/80" : nextOne ? "bg-amber-200/50" : "bg-white/15"}`}
                />
              )}
              <span className="relative flex flex-col items-center">
                <span
                  key={here ? `h-${lastWarp?.id ?? 0}` : id}
                  className={`grid place-items-center rounded-full ${
                    here
                      ? "tr-cell-hit size-[18px] bg-emerald-300 text-[10px] text-hull-950 shadow-[0_0_10px_#5ee08a]"
                      : passed
                        ? "size-2.5 bg-emerald-300/70"
                        : nextOne
                          ? "size-2.5 border border-amber-200 bg-amber-200/20"
                          : "size-2 bg-white/25"
                  }`}
                >
                  {here ? "▶" : ""}
                </span>
                {!compact && (
                  <span
                    className={`absolute top-full mt-0.5 text-[10.5px] whitespace-nowrap ${
                      here
                        ? "font-bold text-emerald-200"
                        : nextOne
                          ? "text-amber-100/80"
                          : passed
                            ? "text-white/50"
                            : "text-white/35"
                    }`}
                  >
                    {stopName(id)}
                  </span>
                )}
              </span>
            </span>
          );
        })}
        <span className="ml-3 text-[11px] text-white/60 tabular-nums">
          {step}/{ROUTE.length}
        </span>
      </div>
      {!compact && (
        <div className="mt-5 text-[11.5px] text-white/55">
          {phase === "travel" ? (
            <span className="text-emerald-200">워프 중 → {dest.ko}</span>
          ) : (
            <>
              <b className="text-white/80">{dest.ko}</b> · {dest.fact}
            </>
          )}
          {step < ROUTE.length && phase !== "travel" && (
            <span className="ml-2 text-amber-100/70">
              · 하나 치우면 {stopName(ROUTE[step] ?? START)}(으)로 한 칸
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function WarpBanner() {
  const lastWarp = useRoute((s) => s.lastWarp);
  const [shown, setShown] = useState<typeof lastWarp>(null);
  useEffect(() => {
    if (!lastWarp) return;
    setShown(lastWarp);
    const t = setTimeout(() => setShown(null), 3800);
    return () => clearTimeout(t);
  }, [lastWarp]);
  if (!shown) return null;
  return (
    <div
      key={shown.id}
      data-warp
      className="pointer-events-none absolute top-[40%] left-1/2 z-20 rounded-2xl border border-emerald-300/50 bg-black/60 px-6 py-3 text-center shadow-[0_0_40px_rgba(94,224,138,.25)] backdrop-blur"
      style={{ animation: "tr-warp-in 3.8s ease-out both" }}
    >
      <div className="text-[12px] font-semibold tracking-widest text-emerald-200/90">
        치웠어요 · 한 칸 워프!
      </div>
      <div className="mt-0.5 text-[26px] font-black text-white">
        → {stopName(shown.to)}
      </div>
      <div className="text-[12px] text-white/60">
        오늘의 항로 {shown.step}/{ROUTE.length}칸
      </div>
    </div>
  );
}
