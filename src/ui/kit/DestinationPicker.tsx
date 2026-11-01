"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AU_KM } from "@/sky/astro";
import {
  type Destination,
  type DestinationGroup,
  probePositionAU,
} from "@/sky/bodies";
import { searchDestinations } from "@/sky/search";
import { loadSky } from "@/sky/sky3d";
// 여행 목적지 고르기(모달 안에 넣어 쓴다). 고르면 창밖이 그쪽으로 날아간다.
import { formatDistance } from "@/sky/telemetry";
import { useDestinations, useVoyage } from "@/sky/voyage";

const GROUPS: DestinationGroup[] = [
  "전망",
  "태양과 행성",
  "위성",
  "작은 천체",
  "혜성",
  "탐사선",
  "유명한 별",
  "이름 있는 별",
];

export function DestinationPicker({
  onPick,
}: {
  onPick?: (id: string) => void;
}) {
  const current = useVoyage((s) => s.destinationId);
  const travelTo = useVoyage((s) => s.travelTo);
  const destinations = useDestinations();
  const sections = useRef(new Map<DestinationGroup, HTMLElement>());
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(
    () => searchDestinations(query, destinations),
    [query, destinations],
  );

  // 창밖이 아직 하늘 자료를 받지 않았어도 이름 있는 별을 목록에 넣는다.
  useEffect(() => {
    loadSky().catch(() => {
      // 하늘 자료가 없으면 정해 둔 목적지만 보인다.
    });
  }, []);

  const pick = (id: string) => {
    travelTo(id);
    onPick?.(id);
  };

  return (
    <div className="relative space-y-4">
      {/* 목록이 길어 창 아래로 이어진다. 검색 칸과 무리 단추는 위에 붙어 있다. */}
      <div className="sticky -top-5 z-10 -mx-5 -mt-5 border-b border-white/10 bg-hull-900/95 px-5 pt-3 pb-2.5 backdrop-blur">
        <input
          type="search"
          data-destination-search
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              const d = results[active];
              if (d) pick(d.id);
            } else if (e.key === "Escape" && query) {
              e.stopPropagation();
              setQuery("");
            }
          }}
          placeholder="행성·위성·탐사선·별 이름 찾기 (예: 토성, Spica)"
          aria-label="목적지 찾기"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/35 focus:border-glow-work/60 focus:outline-none"
        />
        {!query && (
          <nav data-destination-groups className="mt-2 flex flex-wrap gap-1.5">
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
        )}
      </div>
      {query ? (
        <section data-destination-results>
          {results.length === 0 ? (
            <p className="text-sm text-white/50">
              “{query}”에 맞는 목적지가 없다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {results.map((d, i) => (
                <DestinationButton
                  key={d.id}
                  d={d}
                  current={d.id === current}
                  highlighted={i === active}
                  showGroup
                  onClick={() => pick(d.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        GROUPS.map((g) => (
          <section
            key={g}
            ref={(el) => {
              if (el) sections.current.set(g, el);
            }}
            className="scroll-mt-24"
          >
            <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-white/50">
              {g}
            </h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {destinations
                .filter((d) => d.group === g)
                .map((d) => (
                  <DestinationButton
                    key={d.id}
                    d={d}
                    current={d.id === current}
                    onClick={() => pick(d.id)}
                  />
                ))}
            </div>
          </section>
        ))
      )}
      {/* 아래로 더 있다는 표시: 창 아래 끝이 흐려진다. */}
      <div
        aria-hidden
        className="pointer-events-none sticky -bottom-5 -mx-5 -mb-5 h-8 bg-gradient-to-t from-hull-900 to-transparent"
      />
    </div>
  );
}

function DestinationButton({
  d,
  current,
  highlighted = false,
  showGroup = false,
  onClick,
}: {
  d: Destination;
  current: boolean;
  highlighted?: boolean;
  showGroup?: boolean;
  onClick: () => void;
}) {
  const distance = distanceOf(d);
  return (
    <button
      type="button"
      data-destination={d.id}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition ${
        current
          ? "border-glow-work/70 bg-glow-work/15"
          : highlighted
            ? "border-white/40 bg-white/10"
            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
      }`}
    >
      <div className="text-sm font-medium">
        {d.ko}
        {distance && (
          <span className="ml-1.5 text-xs text-white/50">{distance}</span>
        )}
      </div>
      {showGroup && (
        <div className="text-[11px] text-white/40">
          {d.group}
          {d.en && d.en !== d.ko ? ` · ${d.en}` : ""}
        </div>
      )}
      <div className="mt-0.5 line-clamp-2 text-xs text-white/55">{d.fact}</div>
    </button>
  );
}

/** 목적지 옆 거리. 탐사선은 지금 태양에서의 실제 거리. */
function distanceOf(d: Destination): string | undefined {
  if (d.distance) return d.distance;
  if (!d.probe) return undefined;
  const [x, y, z] = probePositionAU(d.probe, Date.now());
  return formatDistance(Math.hypot(x, y, z) * AU_KM);
}
