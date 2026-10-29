"use client";

// 선실: 승무원(프로젝트) 하나의 방. 가운데 지도 한 장, 위쪽 줄에 진행률·늘어난 구역·갱신 시각,
// 오른쪽 판에 고른 구역의 자세한 내용. 설계: docs/map.md "화면: 선실".
// 가운데 그림은 기본이 개척지(FrontierView, 끌고 확대해 다니는 육각 행성 지도. 설계: docs/frontier.md)다.
// 처음 treemap(MapView)은 /proto/cabin/treemap에 비교용으로 남아 있다.
import Link from "next/link";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useBridge, useCrewMap } from "@/data/hooks";
import {
  droppedIds,
  isForkForMe,
  type ProjectMap,
  type Region,
  type Sign,
  summarizeMap,
} from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { CrewHeader } from "@/protos/classic/CrewDetail";
import { Toasts } from "@/ui/kit";
import { FrontierView } from "./frontier/FrontierView";
import { agoLabel, SIGN_ICON } from "./labels";
import { MapView, type MapViewProps } from "./MapView";
import { RegionPanel } from "./RegionPanel";

export function Cabin({
  crewId,
  View = FrontierView,
  label,
  backHref = "/proto/cockpit",
}: {
  crewId: string;
  /** 가운데 지도 그림. 시안마다 바꿔 끼운다. */
  View?: ComponentType<MapViewProps>;
  /** 시안 이름(화면 구석에 작게) */
  label?: string;
  backHref?: string;
}) {
  const bridge = useBridge();
  const query = useCrewMap(crewId);
  const crew = bridge.crewById.get(crewId);
  const now = useMinuteClock();
  const data = query.data;
  const map = data?.map ?? null;

  return (
    <main className="flex h-dvh min-h-[560px] flex-col bg-hull-950 text-white">
      <header className="flex items-center gap-4 border-b border-white/[0.07] px-4 py-2.5">
        <Link
          href={backHref}
          className="shrink-0 rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          {backHref === "/proto/cockpit" ? "← 갑판으로" : "← 시안 목록"}
        </Link>
        {label && (
          <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/55">
            시안 · {label}
          </span>
        )}
        {crew ? (
          <div className="min-w-0 flex-1 overflow-hidden [&_.text-sm]:truncate">
            <CrewHeader crew={crew} now={now} />
          </div>
        ) : (
          <span className="font-semibold">{crewId}</span>
        )}
        {map && (
          <TopLine
            map={map}
            mapAt={data?.mapAt}
            stale={data?.stale}
            now={now}
          />
        )}
      </header>

      {data?.problems && data.problems.length > 0 && (
        <div
          data-map-problems
          className="border-b border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-1.5 text-[12px] text-[#ffd0d0]"
          title={data.problems.join("\n")}
        >
          지도 파일이 틀렸어요 ({data.problems.length}){" "}
          {map ? "· 마지막으로 맞았던 지도를 보여요" : ""} ·{" "}
          <span className="text-white/60">{data.problems[0]}</span>
        </div>
      )}

      {query.isLoading ? (
        <Center>지도를 펼치는 중…</Center>
      ) : query.error && !data ? (
        <Center>
          지도를 받아 오지 못했어요 · {String(query.error.message)}
        </Center>
      ) : map ? (
        <MapRoom key={crewId} map={map} crew={crew} now={now} View={View} />
      ) : (
        <Center>
          <div className="text-center">
            <div className="text-lg text-white/75">지도가 아직 없어요</div>
            <p className="mt-2 text-[13px] text-white/45">
              이 프로젝트 저장소에 <code>map.json</code>
              (starship-map/1)을 두면 여기에 펼쳐져요.
            </p>
          </div>
        </Center>
      )}
      <Toasts />
    </main>
  );
}

/** 위쪽 줄: 진행률 · 처음 → 지금 +발견 · 지도 갱신 시각 · 오래됨 */
function TopLine({
  map,
  mapAt,
  stale,
  now,
}: {
  map: ProjectMap;
  mapAt?: number;
  stale?: boolean;
  now: number;
}) {
  const s = summarizeMap(map);
  const pct = Math.round(s.progress * 100);
  const updated = map.updatedAt ? Date.parse(map.updatedAt) : mapAt;
  return (
    <div
      data-map-topline
      className="ml-auto flex shrink-0 items-center gap-x-4 text-[12.5px] whitespace-nowrap text-white/60"
    >
      <span className="max-w-[16rem] truncate font-semibold text-white/85">
        {map.title}
      </span>
      <span
        className="flex items-center gap-2"
        title="완공 크기 ÷ 버림을 뺀 전체 크기"
      >
        진행 <b className="font-semibold text-white tabular-nums">{pct}%</b>
        <span className="relative h-[7px] w-28 overflow-hidden rounded-full bg-white/10">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[#5ee08a]"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
      <span className="tabular-nums" data-map-growth>
        처음 {s.regions - s.found} → 지금 {s.regions}
        {s.found > 0 && (
          <span className="text-[#7ce0ff]"> (+{s.found} 발견)</span>
        )}
      </span>
      {updated !== undefined && !Number.isNaN(updated) && (
        <span>지도 갱신 {agoLabel(updated, now)}</span>
      )}
      {stale && (
        <span
          data-map-stale
          className="rounded bg-[#ffcf5c]/15 px-1.5 py-0.5 text-[11.5px] font-semibold text-[#ffd84a]"
          title="저장소의 일이 지도보다 2일 넘게 앞서 있어요"
        >
          지도가 오래됨
        </span>
      )}
    </div>
  );
}

function MapRoom({
  map,
  crew,
  now,
  View,
}: {
  map: ProjectMap;
  crew?: Crew;
  now: number;
  View: ComponentType<MapViewProps>;
}) {
  const [selected, setSelected] = useState<string | null>(map.here ?? null);
  const [showDropped, setShowDropped] = useState(false);
  const dropped = useMemo(() => droppedIds(map), [map]);
  const region = map.regions.find((r) => r.id === selected);
  // 버린 구역을 숨겼는데 그 구역을 고르고 있었다면 풀어 준다.
  const visibleSelected =
    region && (showDropped || !dropped.has(region.id)) ? region : undefined;

  const live = map.regions.filter((r) => !dropped.has(r.id));
  const signs = live.flatMap((r) => (r.signs ?? []).map((s) => ({ r, s })));
  const forks = signs.filter(({ s }) => isForkForMe(s));
  const talks = signs.filter(
    ({ s }) => s.type === "talk" && s.status !== "done",
  );
  const blocked = live.filter((r) => r.status === "blocked");

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 p-3">
          <View
            map={map}
            crew={crew}
            selected={visibleSelected?.id ?? null}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            showDropped={showDropped}
            now={now}
          />
        </div>
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.07] px-4 py-2 text-[12px] text-white/55">
          <span>
            내가 정할 것 {SIGN_ICON.fork}{" "}
            <b className="text-[#ffd84a]">{forks.length}</b>
          </span>
          <span>
            교신 {SIGN_ICON.talk}{" "}
            <b className="text-white/85">{talks.length}</b>
          </span>
          <span>
            막힘 ⛔ <b className="text-[#ff8f8f]">{blocked.length}</b>
          </span>
          {/* 범례는 treemap에서만. 개척지는 땅 모습이 곧 범례다 */}
          {View === MapView && <Legend />}
          {dropped.size > 0 && (
            <label className="ml-auto flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showDropped}
                onChange={(e) => setShowDropped(e.target.checked)}
              />
              버린 구역 보기 ({dropped.size})
            </label>
          )}
        </footer>
      </div>
      <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-white/[0.07] px-4 py-4">
        {visibleSelected ? (
          <RegionPanel
            map={map}
            region={visibleSelected}
            dropped={dropped.has(visibleSelected.id)}
            now={now}
          />
        ) : (
          <Overview
            map={map}
            forks={forks}
            talks={talks}
            onSelect={setSelected}
          />
        )}
      </aside>
    </div>
  );
}

type Found = { r: Region; s: Sign };

/** 아무 구역도 고르지 않았을 때: 목표와 내가 볼 것 */
function Overview({
  map,
  forks,
  talks,
  onSelect,
}: {
  map: ProjectMap;
  forks: Found[];
  talks: Found[];
  onSelect: (id: string) => void;
}) {
  const here = map.regions.find((r) => r.id === map.here);
  const row = ({ r, s }: Found) => (
    <li key={`${r.id}/${s.id}`}>
      <button
        type="button"
        onClick={() => onSelect(r.id)}
        className="w-full rounded px-2 py-1.5 text-left hover:bg-white/[0.06]"
      >
        <div className="text-white/85">{s.title}</div>
        <div className="text-[11.5px] text-white/45">{r.title}</div>
      </button>
    </li>
  );
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div>
        <h2 className="text-[17px] font-semibold">{map.title}</h2>
        {map.goal && (
          <p className="mt-1 text-white/65">
            <span className="text-white/40">목표 · </span>
            {map.goal}
          </p>
        )}
      </div>
      {here && (
        <button
          type="button"
          onClick={() => onSelect(here.id)}
          className="rounded-md border border-[#7ce0ff]/30 bg-[#7ce0ff]/[0.06] px-3 py-2 text-left hover:bg-[#7ce0ff]/[0.1]"
        >
          <div className="text-[11px] text-[#7ce0ff]/80">지금 여기</div>
          <div className="text-white/90">{here.title}</div>
          {here.next && (
            <div className="mt-0.5 text-[12px] text-white/55">
              다음: {here.next}
            </div>
          )}
        </button>
      )}
      <section>
        <h3 className="mb-1 text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
          내가 정할 갈림길 {forks.length}
        </h3>
        {forks.length ? (
          <ul>{forks.map(row)}</ul>
        ) : (
          <p className="text-white/40">없어요</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
          진행 중인 교신 {talks.length}
        </h3>
        {talks.length ? (
          <ul>{talks.map(row)}</ul>
        ) : (
          <p className="text-white/40">없어요</p>
        )}
      </section>
      <p className="text-[12px] text-white/35">구역을 누르면 자세히 보여요.</p>
    </div>
  );
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-3.5 rounded-sm ${cls}`} />
      {label}
    </span>
  );
  return (
    <span className="flex items-center gap-2.5 text-[11px] text-white/45">
      {item("border border-dashed border-white/30 bg-[#1a2132]", "안개")}
      {item(
        "bg-[repeating-linear-gradient(135deg,#ffcf5c88_0_3px,#ffcf5c22_3px_6px)]",
        "공사중",
      )}
      {item("bg-[#214a3f] border border-[#5ee08a]/40", "완공")}
      {item("border-2 border-[#ff6b6b] bg-[#3a1d22]", "막힘")}
    </span>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-white/55">
      {children}
    </div>
  );
}

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
