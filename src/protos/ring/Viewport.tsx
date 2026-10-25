"use client";

// 창밖: 위에서 본 오늘의 태양계와 행성 근접을 오간다. 아래 띠의 행성 단추로 궤도 전이처럼 날아간다.
import type { Hail } from "@/protocol/v1";
import { DESTINATION_BY_ID } from "@/sky/bodies";
import { SpaceView } from "@/sky/SpaceView";
import { useDestination, useVoyage } from "@/sky/voyage";
import { EventLayer } from "@/ui/events";
import { ago, sourceLabel } from "@/ui/kit";

const PLANETS: { id: string; ko: string; color: string; size: number }[] = [
  { id: "mercury", ko: "수성", color: "#b5afa8", size: 7 },
  { id: "venus", ko: "금성", color: "#e8d3a2", size: 9 },
  { id: "earth", ko: "지구", color: "#4a8ad6", size: 9 },
  { id: "mars", ko: "화성", color: "#d0643f", size: 8 },
  { id: "jupiter", ko: "목성", color: "#d8b48a", size: 13 },
  { id: "saturn", ko: "토성", color: "#e3cf98", size: 11 },
  { id: "uranus", ko: "천왕성", color: "#9fd8e0", size: 10 },
  { id: "neptune", ko: "해왕성", color: "#5a7ce0", size: 10 },
];

function PlanetDot({
  color,
  size,
  ringed,
}: {
  color: string;
  size: number;
  ringed?: boolean;
}) {
  return (
    <span className="relative inline-block" style={{ width: 14, height: 14 }}>
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 35%, #fff8 0, ${color} 45%, #0008 120%)`,
        }}
      />
      {ringed && (
        <span
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border"
          style={{
            width: 18,
            height: 6,
            borderColor: `${color}cc`,
            transform: "translate(-50%,-50%) rotate(-18deg)",
          }}
        />
      )}
    </span>
  );
}

export function Viewport({
  compact,
  hail,
  hailCount,
  onHail,
  onNav,
}: {
  /** 전경 장면일 때(창이 작아짐) */
  compact: number;
  hail?: Hail;
  hailCount: number;
  onHail: (id?: string) => void;
  onNav: () => void;
}) {
  const dest = useDestination();
  const phase = useVoyage((s) => s.phase);
  const progress = useVoyage((s) => s.progress);
  const previousId = useVoyage((s) => s.previousId);
  const travelTo = useVoyage((s) => s.travelTo);
  const prev = previousId ? DESTINATION_BY_ID.get(previousId) : undefined;
  const traveling = phase === "travel";
  const isOverview = dest.id === "overview";

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <SpaceView className="h-full w-full" labels="few" drift starScale={1} />
      <EventLayer every={100} firstDelay={35} />

      {/* 창틀: 고리 축 위의 둥근 관측창 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: `${28 - compact * 10}px ${28 - compact * 10}px 48px 48px`,
          boxShadow:
            "inset 0 0 0 10px #10172a, inset 0 0 0 12px #2c3a5c, inset 0 0 0 14px #0a0f1c, inset 0 0 60px 20px rgba(0,0,0,.55)",
        }}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <title>창틀</title>
        {[0.25, 0.5, 0.75].map((x) => (
          <g key={x}>
            <circle cx={`${x * 100}%`} cy="7" r="2" fill="#4a5a80" />
          </g>
        ))}
        <line
          x1="20%"
          x2="80%"
          y1="3"
          y2="3"
          stroke="#6cb6ff"
          strokeOpacity=".25"
          strokeWidth="1"
        />
      </svg>

      {/* 왼쪽 위 안내 */}
      <div
        className="pointer-events-none absolute left-6 text-[11px] leading-snug text-white/55"
        style={{ top: 30 }}
      >
        <div>오늘 날짜의 실제 행성 자리 · 거리는 줄여서</div>
      </div>

      {/* 가운데 위: 지금 목적지 */}
      <div className="pointer-events-none absolute top-4 left-1/2 w-[min(560px,60%)] -translate-x-1/2 text-center">
        {traveling ? (
          <>
            <div className="text-sm font-semibold tracking-wide text-white/90">
              궤도 전이 중 · {prev?.ko ?? "출발"} → {dest.ko}
            </div>
            <div className="mx-auto mt-1.5 h-1 w-48 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#6cb6ff]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold tracking-wide text-white/90">
              {isOverview ? "위에서 본 태양계" : dest.ko}
              {dest.distance && (
                <span className="ml-2 font-normal text-white/50">
                  {dest.distance}
                </span>
              )}
            </div>
            {compact < 0.5 && (
              <div className="mt-0.5 truncate text-xs text-white/55">
                {dest.fact}
              </div>
            )}
          </>
        )}
      </div>

      {/* 교신해 오는 배: 오른쪽 위에서 빛 신호 */}
      {hail && (
        <button
          type="button"
          onClick={() => onHail(hail.id)}
          className="absolute right-6 flex max-w-[300px] items-center gap-2.5 rounded-xl border border-[#ffcf5c]/40 bg-black/55 py-1.5 pr-3 pl-2 text-left backdrop-blur-sm hover:border-[#ffcf5c]/80"
          style={{ top: 30 + compact * -8 }}
        >
          <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden>
            <title>교신선</title>
            <path
              d="M4 15 L16 8 L30 9 L38 15 L30 21 L16 22 Z"
              fill="#2b3550"
              stroke="#9fb3e0"
              strokeWidth="1"
            />
            <circle cx="30" cy="15" r="2.4" fill="#ffcf5c" />
            <path d="M4 15 L1 11 L1 19 Z" fill="#6cb6ff" />
            <circle
              className="ring-wave"
              cx="40"
              cy="15"
              r="4"
              fill="none"
              stroke="#ffcf5c"
            />
          </svg>
          <span className="min-w-0">
            <span className="block text-[11px] text-[#ffcf5c]">
              교신 {hailCount > 1 ? `${hailCount}통` : ""} · {hail.from.name} ·{" "}
              {sourceLabel(hail.source)} · {ago(hail.since)}
            </span>
            <span className="block truncate text-xs text-white/85">
              {hail.line}
            </span>
          </span>
        </button>
      )}

      {/* 아래 띠: 행성 단추 */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#070b16]/75 px-1.5 py-1 backdrop-blur-sm">
        <button
          type="button"
          data-planet="overview"
          onClick={() => travelTo("overview")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            isOverview
              ? "bg-[#6cb6ff] text-[#06101e]"
              : "text-white/75 hover:bg-white/10"
          }`}
        >
          전경
        </button>
        <span className="mx-0.5 h-4 w-px bg-white/15" />
        {PLANETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-planet={p.id}
            onClick={() => travelTo(p.id)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition ${
              dest.id === p.id
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            <PlanetDot
              color={p.color}
              size={p.size}
              ringed={p.id === "saturn"}
            />
            {p.ko}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={onNav}
          className="rounded-full px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          더 먼 곳…
        </button>
      </div>
    </div>
  );
}
