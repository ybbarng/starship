"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useBridge,
  useBridgeStatus,
  useCrewDesk,
  useCrewDesks,
  useCrewMap,
  useRelays,
} from "@/data/hooks";
import { useSent } from "@/data/sent";
// 선실: 승무원(프로젝트) 하나의 방. 가운데 지도 한 장, 위쪽 줄에 진행률·늘어난 구역·갱신 시각,
// 오른쪽 판에 고른 구역의 자세한 내용. 설계: docs/map.md "화면: 선실".
// 가운데 그림은 기본이 개척지(FrontierView, 끌고 확대해 다니는 육각 행성 지도. 설계: docs/frontier.md)다.
// 처음 treemap(MapView)은 /proto/cabin/treemap에 비교용으로 남아 있다.
import { parseWhen } from "@/protocol/common";
import type { Desk } from "@/protocol/desk";
import {
  droppedIds,
  isForkForMe,
  type ProjectMap,
  type Region,
  type Sign,
  summarizeMap,
} from "@/protocol/map";
import type { Crew, Task } from "@/protocol/v1";
import { CrewBrief, CrewHeader } from "@/protos/classic/CrewDetail";
import { HQ_CLOCK_MS, hqConnected } from "@/protos/cockpit/hqLink";
import { foldRelays, stalledCount } from "@/relay/fold";
import { CrewTasks, crewTaskCount } from "@/ui/desk/CrewTasks";
import { FacilityBoard } from "@/ui/hq/FacilityBoard";
import { RelayBoard } from "@/ui/hq/RelayBoard";
import { Toasts } from "@/ui/kit";
import { agoLabel } from "@/ui/kit/labels";
import { cabinTabs, type SideTab, TAB_LABEL } from "./cabinTabs";
import { FrontierView } from "./frontier/FrontierView";
import { MAX_TEAMS, type TeamOnMap } from "./frontier/teams";
import { SIGN_ICON } from "./labels";
import { MapView, type MapViewProps } from "./MapView";
import { RegionPanel } from "./RegionPanel";

type CabinProps = {
  crewId: string;
  /** 가운데 지도 그림. 시안마다 바꿔 끼운다. */
  View?: ComponentType<MapViewProps>;
  /** 시안 이름(화면 구석에 작게) */
  label?: string;
  backHref?: string;
  /**
   * 본부 승무원 id(src/relay/hq.ts). 이 승무원의 선실만 본부 방으로 넓힌다:
   * 현황판이 할 일 · 나르기 · 시설 · 지도 네 판이 된다(docs/hq.md). 안 주면 본부 방이 없다(시안 화면).
   */
  hqCrewId?: string;
};

/** 승무원이 바뀌면 고른 판·구역을 처음으로 돌린다 */
export function Cabin(props: CabinProps) {
  return <CabinRoom key={props.crewId} {...props} />;
}

function CabinRoom({
  crewId,
  View = FrontierView,
  label,
  backHref = "/",
  hqCrewId,
}: CabinProps) {
  const bridge = useBridge();
  const hq = hqCrewId !== undefined && crewId === hqCrewId;
  const crew = bridge.crewById.get(crewId);
  // 작업팀이면 지도는 소장 것을 같이 쓴다(소장 id로 읽는다). 할 일·브리핑은 작업팀 자기 것(docs/crew-views.md "작업팀")
  const foremanId =
    crew?.foreman && crew.foreman !== crewId ? crew.foreman : undefined;
  const mapCrewId = foremanId ?? crewId;
  const mapCrew = foremanId ? bridge.crewById.get(foremanId) : crew;
  const query = useCrewMap(mapCrewId);
  const teams = useMapTeams(mapCrewId, bridge.crew);
  const now = useMinuteClock();
  const data = query.data;
  const map = data?.map ?? null;
  const deskQuery = useCrewDesk(crewId);
  const desk = deskQuery.data?.desk ?? null;
  const deskProblems = deskQuery.data?.problems ?? [];
  const tasks = bridge.tasksByCrew.get(crewId) ?? [];

  // 현황판 판 고르기. 고르기 전에는 기다리는 것이 있으면 할 일, 없으면 지도(본부 방은 나르기). 책상이 늦게 와도 따라간다.
  const [pickedTab, setTab] = useState<SideTab | null>(null);
  // 읽음을 구독해야 "읽음"을 누른 순간 배지도 줄어든다(전에는 다음 폴링까지 그대로였다)
  const read = useSent((s) => s.read);
  const waiting = crewTaskCount(crewId, desk, tasks, read);
  const { tabs, tab } = cabinTabs({
    hq,
    hasMap: !!map,
    hasBrief: !!crew?.brief,
    waiting,
    picked: pickedTab,
  });

  const relays = useRelays(hq);
  const relayData = relays.data;
  const board = useMemo(
    () => foldRelays(relayData?.log.relays ?? [], now),
    [relayData, now],
  );
  const stalled = stalledCount(board);
  const hqName = crew?.name ?? crewId;
  const hqBoard = (t: SideTab): ReactNode =>
    t === "relays" ? (
      <RelayBoard
        data={relayData}
        error={relays.error}
        board={board}
        hqName={hqName}
        now={now}
      />
    ) : t === "facility" ? (
      <Facility gauges={bridge.gauges} link={bridge.link} />
    ) : null;
  const tabBar = (
    <SideTabs
      tabs={tabs}
      tab={tab}
      setTab={setTab}
      waiting={waiting}
      relays={board.active.length}
      stalled={stalled}
    />
  );

  return (
    <main className="flex h-dvh min-h-[560px] flex-col bg-hull-950 text-white">
      <header className="flex items-center gap-4 border-b border-white/[0.07] px-4 py-2.5">
        <Link
          href={backHref}
          className="shrink-0 rounded px-2 py-1 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          {backHref === "/" ? "← 갑판으로" : "← 시안 목록"}
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
        {foremanId && (
          <span
            data-team-of={foremanId}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e9b872]/30 bg-[#e9b872]/[0.08] px-2.5 py-0.5 text-[12px] text-white/70"
          >
            작업팀 · 소장 {mapCrew?.name ?? foremanId}
            <Link
              href={`/crew/${encodeURIComponent(foremanId)}`}
              data-foreman-link={foremanId}
              className="font-semibold text-[#f3d3a0] hover:underline"
            >
              소장 선실로 →
            </Link>
          </span>
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
          {map ? "· 틀린 곳만 빼고 보여요" : ""} ·{" "}
          <span className="text-white/60">{data.problems[0]}</span>
        </div>
      )}

      {deskProblems.length > 0 && (
        <div
          data-desk-problems
          className="border-b border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-1.5 text-[12px] text-[#ffd0d0]"
          title={deskProblems.join("\n")}
        >
          책상 파일이 틀렸어요 ({deskProblems.length}){" "}
          {desk ? "· 틀린 곳만 빼고 보여요" : ""} ·{" "}
          <span className="text-white/60">{deskProblems[0]}</span>
        </div>
      )}

      {hq && stalled > 0 && (
        <button
          type="button"
          data-relay-stalled-banner
          onClick={() => setTab("relays")}
          className="border-b border-[#ffcf5c]/30 bg-[#ffcf5c]/10 px-4 py-1.5 text-left text-[12.5px] text-[#ffe9a8] hover:bg-[#ffcf5c]/15"
        >
          멈춘 나르기 <b className="text-[#ffd84a]">{stalled}</b>건 · 하루 넘게
          소식이 없어요 <span className="text-white/55">· 나르기 판 보기</span>
        </button>
      )}

      {query.isLoading ? (
        <Center>지도를 펼치는 중…</Center>
      ) : map ? (
        <MapRoom
          key={crewId}
          map={map}
          crew={crew}
          crewId={crewId}
          mapCrew={mapCrew}
          mapCrewId={mapCrewId}
          teams={teams}
          desk={desk}
          tasks={tasks}
          now={now}
          View={View}
          tab={tab}
          setTab={setTab}
          tabBar={tabBar}
          extraBoard={hqBoard}
        />
      ) : hq ? (
        // 본부 방에 지도가 없으면 지도 판을 숨기고, 현황판을 가운데 한 줄로 넓게 편다(휴대폰에서도 가로로 넘치지 않게)
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
          <div data-hq-room className="w-full max-w-[680px] px-4 py-4">
            {tabBar}
            {tab === "tasks" ? (
              <CrewTasks
                crewId={crewId}
                desk={desk}
                tasks={tasks}
                now={now}
                off={crew?.status === "off"}
              />
            ) : (
              hqBoard(tab)
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Center>
            {query.error && !data ? (
              <>지도를 받아 오지 못했어요 · {String(query.error.message)}</>
            ) : (
              <div className="text-center">
                <div className="text-lg text-white/75">
                  {foremanId ? "소장 지도가 아직 없어요" : "지도가 아직 없어요"}
                </div>
                <p className="mt-2 text-[13px] text-white/45">
                  이 프로젝트 저장소에 <code>map.json</code>
                  (starship-map/1)을 두면 여기에 펼쳐져요.
                </p>
              </div>
            )}
          </Center>
          <SidePanel className="flex flex-col gap-5">
            <CrewTasks
              crewId={crewId}
              desk={desk}
              tasks={tasks}
              now={now}
              off={crew?.status === "off"}
            />
            {crew?.brief && <CrewBrief brief={crew.brief} now={now} />}
          </SidePanel>
        </div>
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
  const updated = map.updatedAt ? parseWhen(map.updatedAt) : mapAt;
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

function SideTabs({
  tabs,
  tab,
  setTab,
  waiting,
  relays,
  stalled,
}: {
  tabs: SideTab[];
  tab: SideTab;
  setTab: (t: SideTab) => void;
  waiting: number;
  /** 나르는 중인 일 수 */
  relays: number;
  /** 그 가운데 멈춘 것 */
  stalled: number;
}) {
  return (
    <div
      data-side-tabs
      className="mb-4 flex gap-1 rounded-md bg-white/[0.04] p-0.5 text-[12.5px]"
    >
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          data-side-tab={t}
          aria-pressed={tab === t}
          onClick={() => setTab(t)}
          className={`flex-1 rounded px-2 py-1 whitespace-nowrap ${
            tab === t
              ? "bg-white/[0.1] font-semibold text-white"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {TAB_LABEL[t]}
          {t === "tasks" && waiting > 0 && (
            <b className="ml-1.5 rounded-full bg-[#ffd84a] px-1.5 text-[11px] text-hull-950">
              {waiting}
            </b>
          )}
          {t === "relays" && relays > 0 && (
            <b
              className={`ml-1.5 rounded-full px-1.5 text-[11px] ${stalled > 0 ? "bg-[#ffd84a] text-hull-950" : "bg-white/[0.12] text-white/80"}`}
              title={stalled > 0 ? `멈춤 ${stalled}` : undefined}
            >
              {relays}
            </b>
          )}
        </button>
      ))}
    </div>
  );
}

/** 시설 판. 본부 연결 상태는 5초마다 바뀌니 이 부품만 다시 그린다(src/data/hooks.ts useBridgeStatus) */
function Facility({
  gauges,
  link,
}: {
  gauges: Parameters<typeof FacilityBoard>[0]["gauges"];
  link: Parameters<typeof FacilityBoard>[0]["link"];
}) {
  const status = useBridgeStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), HQ_CLOCK_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <FacilityBoard
      gauges={gauges}
      link={link}
      connected={hqConnected(!!status.error, status.updatedAt, now)}
      lastAt={status.updatedAt}
      now={now}
    />
  );
}

function MapRoom({
  map,
  crew,
  crewId,
  mapCrew,
  mapCrewId,
  teams,
  desk,
  tasks,
  now,
  View,
  tab,
  setTab,
  tabBar,
  extraBoard,
}: {
  map: ProjectMap;
  crew?: Crew;
  crewId: string;
  /** 지도 주인(작업팀 선실이면 소장, 아니면 이 승무원) */
  mapCrew?: Crew;
  mapCrewId: string;
  /** 이 지도를 같이 쓰는 작업팀과 그 책상 */
  teams: TeamOnMap[];
  desk: Desk | null;
  tasks: Task[];
  now: number;
  View: ComponentType<MapViewProps>;
  /** 고른 판(선실이 정한다) */
  tab: SideTab;
  setTab: (t: SideTab) => void;
  /** 판 고르기 단추 줄 */
  tabBar: ReactNode;
  /** 본부 방의 나르기·시설 판. 그 밖의 판이면 null */
  extraBoard: (t: SideTab) => ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(map.here ?? null);
  const select = (id: string) => {
    setTab("map");
    setSelected(id);
  };
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
            crew={mapCrew}
            teams={teams}
            selected={visibleSelected?.id ?? null}
            onSelect={(id) => {
              setTab("map");
              setSelected((cur) => (cur === id ? null : id));
            }}
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
      <SidePanel>
        {tabBar}
        {tab === "tasks" ? (
          <CrewTasks
            crewId={crewId}
            desk={desk}
            tasks={tasks}
            now={now}
            off={crew?.status === "off"}
          />
        ) : tab === "brief" && crew?.brief ? (
          <CrewBrief brief={crew.brief} now={now} />
        ) : tab === "relays" || tab === "facility" ? (
          extraBoard(tab)
        ) : visibleSelected ? (
          <RegionPanel
            map={map}
            region={visibleSelected}
            dropped={dropped.has(visibleSelected.id)}
            now={now}
            crewId={mapCrewId}
          />
        ) : (
          <Overview map={map} forks={forks} talks={talks} onSelect={select} />
        )}
      </SidePanel>
    </div>
  );
}

const SIDE_COLLAPSED = "starship.cabin.side-collapsed";

/**
 * 오른쪽 현황판. 1100px 아래 창에서는 380px → 320px로 줄이고, 접으면 얇은 띠만 남아 지도가 넓어진다.
 * 접힘은 이 브라우저에 기억한다(저장소를 못 쓰면 기억하지 않는다).
 */
function SidePanel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDE_COLLAPSED) === "1");
    } catch {
      // 저장소를 못 쓰면 늘 펼친다
    }
  }, []);
  const set = (v: boolean) => {
    setCollapsed(v);
    try {
      if (v) localStorage.setItem(SIDE_COLLAPSED, "1");
      else localStorage.removeItem(SIDE_COLLAPSED);
    } catch {
      // 기억하지 못해도 지금 화면은 바뀐다
    }
  };
  if (collapsed)
    return (
      <aside className="flex w-8 shrink-0 flex-col items-center border-l border-white/[0.07] py-3">
        <button
          type="button"
          data-side-expand
          onClick={() => set(false)}
          title="현황판 펼치기"
          aria-label="현황판 펼치기"
          className="rounded px-1 py-2 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          «
        </button>
      </aside>
    );
  return (
    <aside
      className={`relative w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.07] px-4 py-4 min-[1100px]:w-[380px] ${className}`}
    >
      <button
        type="button"
        data-side-collapse
        onClick={() => set(true)}
        title="현황판 접기: 지도를 넓게"
        aria-label="현황판 접기"
        className="absolute top-1 left-0.5 z-10 rounded px-1 text-[12px] leading-tight text-white/30 hover:bg-white/[0.06] hover:text-white"
      >
        »
      </button>
      {children}
    </aside>
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

/**
 * 이 지도를 같이 쓰는 작업팀(foreman이 지도 주인인 승무원, 스냅숏 차례로 넷까지)과 그 책상.
 * 책상은 선실이 쓰는 엔드포인트(/v1/crew/{id}/desk)로 읽는다.
 */
function useMapTeams(mapCrewId: string, crew: readonly Crew[]): TeamOnMap[] {
  const members = useMemo(
    () =>
      crew
        .filter((c) => c.foreman === mapCrewId && c.id !== mapCrewId)
        .slice(0, MAX_TEAMS),
    [crew, mapCrewId],
  );
  const desks = useCrewDesks(members.map((c) => c.id));
  return members.map((c, i) => ({ crew: c, desk: desks[i]?.data?.desk }));
}

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
