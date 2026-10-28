"use client";

// 홈의 승무원 목록: 누르면 그 승무원의 선실(지도)로 들어간다. 이름 옆에 진행률과 내가 정할 갈림길 수.
import Link from "next/link";
import { useBridge } from "@/data/hooks";
import { CrewLamp, MapBadge, sortCrew } from "@/protos/cockpit/Panel";

export function CrewCabins() {
  const bridge = useBridge();
  if (bridge.isLoading) return null;
  const crew = sortCrew(bridge.crew);
  if (crew.length === 0)
    return (
      <p className="mt-2 text-sm text-white/40">탑승한 승무원이 없어요.</p>
    );
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
      {crew.map((c) => (
        <li key={c.id}>
          <Link
            href={`/crew/${encodeURIComponent(c.id)}`}
            data-cabin-link={c.id}
            className="flex items-center gap-2 rounded px-2 py-1 text-sm text-white/75 hover:bg-white/[0.06] hover:text-white"
          >
            <CrewLamp status={c.status} />
            <span className="truncate">{c.name}</span>
            <MapBadge crew={c} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
