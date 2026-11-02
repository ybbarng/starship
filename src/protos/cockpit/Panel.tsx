"use client";

import { useMemo, useState } from "react";
import type { Crew, CrewStatus, Hail, Link, Task } from "@/protocol/v1";
import { formatSpeed } from "@/sky/telemetry";
import { useTelemetry } from "@/sky/useTelemetry";
import { useDestination, useVoyage } from "@/sky/voyage";
import { ago, sourceLabel, Tip } from "@/ui/kit";
import { VERDICT_LABEL, verdictDetail } from "@/ui/link/model";
// 계기판: 유리창 아래 짜임새 있는 판. 장식 램프 없이, 등과 단추마다 뜻이 있다.
//   맨 위 차양(글레어실드) = 경고등 줄(등마다 글, 누르면 해당 목록)
//   왼쪽 = 승무원 목차(결재할 것이 있는 승무원부터, 나머지 승무원은 그 아래)
//   가운데 = 결재함(고른 승무원의 기다림을 모두 펼쳐 그 자리에서 처리). Inbox.tsx
//   (2026-11-02 "지금 할 일" 한 장과 승무원 상태판을 이 둘로 바꿈. 맥락이 같은 것끼리 처리하려고)
//   오른쪽 = 교신 수신등·칩, 항법 소형 표시(행성 단추·더 먼 곳·이동 중 속도)
import { FuelGauge } from "@/ui/usage/FuelGauge";
import styles from "./cockpit.module.css";
import { InboxIndex, InboxSheet } from "./Inbox";
import { inboxGroups, isNews, lastReplies, pickGroup } from "./inboxGroups";
import { type Lamp, PILE_WARN, selecting, type useWarnings } from "./util";

export type Warnings = ReturnType<typeof useWarnings>;

export type ListKind = "all" | "late" | "jobs";

/* ───────────── 경고등 줄 ───────────── */

function Tile({
  lamp,
  label,
  value,
  hint,
  onClick,
  id,
}: {
  lamp: Lamp;
  label: string;
  value?: string;
  hint: string;
  onClick?: () => void;
  id: string;
}) {
  const tone =
    lamp === "alert"
      ? styles.tileAlert
      : lamp === "warn"
        ? styles.tileWarn
        : "text-white/35";
  return (
    // 경고등 줄 바로 아래에 다음 할 일 탭이 겹쳐서 말풍선은 위(유리창 쪽)로 띄운다.
    <Tip text={hint} side="top" className="min-w-0">
      <button
        type="button"
        data-warn={id}
        data-lamp-state={lamp}
        onClick={onClick}
        disabled={!onClick}
        className={`${styles.tile} ${tone} flex h-[24px] min-w-0 items-center justify-center gap-1.5 rounded-[3px] px-2.5 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap enabled:hover:brightness-125 disabled:cursor-default`}
      >
        <span className="truncate">{label}</span>
        {value && <span className="font-mono tabular-nums">{value}</span>}
      </button>
    </Tip>
  );
}

/** 3초 전 · 2분 전 */
function agoShort(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 60 ? `${s}초 전` : `${Math.round(s / 60)}분 전`;
}

export function Annunciators({
  tasks,
  hails,
  warnings,
  connected,
  lastAt,
  now,
  link,
  onList,
  onHail,
}: {
  tasks: Task[];
  hails: Hail[];
  warnings: Warnings;
  connected: boolean;
  lastAt: number;
  now: number;
  link?: Link;
  onList: (k: ListKind) => void;
  onHail: () => void;
}) {
  const w = warnings;
  const jobsLabel = w.failed.length
    ? `정기 작업 실패 ${w.failed.length}`
    : w.warned.length
      ? `정기 작업 경고 ${w.warned.length}`
      : "정기 작업 정상";
  return (
    <div className="flex items-center gap-1.5" data-annunciators>
      <span className="mr-1 shrink-0 text-[9.5px] font-semibold tracking-[0.22em] text-white/30">
        경고등
      </span>
      <Tile
        id="pile"
        lamp={w.pile}
        label={w.pile === "off" ? "내 차례" : "일이 쌓임 · 내 차례"}
        value={String(tasks.length)}
        hint={`내 차례 = 나를 기다리는 할 일(세션 질문·리뷰·멘션 등)의 수.\n${PILE_WARN}개 이상이면 켜져요. 누르면 전체 할 일`}
        onClick={() => onList("all")}
      />
      <Tile
        id="late"
        lamp={w.late}
        label="1시간 넘게 기다림"
        value={String(w.old.length)}
        hint="한 시간 넘게 기다린 일. 4시간을 넘기면 빨강. 누르면 그 목록"
        onClick={w.old.length ? () => onList("late") : undefined}
      />
      <Tile
        id="jobs"
        lamp={w.jobs}
        label={jobsLabel}
        hint="정기 작업(브리핑·백업·점검 등) 상태. 누르면 계기 목록"
        onClick={() => onList("jobs")}
      />
      <Tile
        id="hail"
        lamp={w.hail}
        label="교신 대기"
        value={String(hails.length)}
        hint="사람이 부른 교신. 누르면 화상 창"
        onClick={hails.length ? onHail : undefined}
      />
      <Tile
        id="link"
        lamp={connected ? "off" : "alert"}
        label={connected ? "본부 연결 정상" : "본부 연결 끊김"}
        hint={[
          "본부 = 비서 서버. 선원·할 일·교신·관제 링크 데이터를 받아 오는 곳(5초마다).",
          lastAt > 0
            ? `마지막으로 받은 때: ${agoShort(lastAt, now)}`
            : "아직 한 번도 받지 못했어요",
          connected
            ? ""
            : "15초 넘게 받지 못해 켜졌어요. 지금 화면은 마지막으로 받은 때의 데이터예요. 다시 받으면 저절로 꺼져요.",
        ]
          .filter(Boolean)
          .join("\n")}
      />
      {link && link.verdict !== "ok" && (
        <Tile
          id="relay"
          lamp={link.verdict === "down" ? "alert" : "warn"}
          label={VERDICT_LABEL[link.verdict]}
          hint={`${verdictDetail(link)}\n유리창 왼쪽 위에 자세히 보여요`}
        />
      )}
      {link?.vpn &&
        (link.vpn.status === "warn" || link.vpn.status === "error") && (
          <Tile
            id="vpn"
            lamp={link.vpn.status === "error" ? "alert" : "warn"}
            label={`함대 통신망 ${link.vpn.status === "error" ? "끊김" : "주의"}`}
            hint={`함대 통신망 = 회사 VPN(Tailscale).${link.vpn.cause ? `\n${link.vpn.cause}` : ""}\n유리창 왼쪽 위 관제 링크에 자세히 보여요`}
          />
        )}
    </div>
  );
}

/* ───────────── 승무원 상태판 ───────────── */

const STATUS_ORDER: Record<CrewStatus, number> = {
  "needs-you": 0,
  working: 1,
  idle: 2,
  off: 3,
};

export function sortCrew(list: Crew[]): Crew[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.name.localeCompare(b.name),
  );
}

export function CrewLamp({ status }: { status: CrewStatus }) {
  const cls =
    status === "working"
      ? "bg-[#5ee08a] shadow-[0_0_6px_#5ee08a]"
      : status === "needs-you"
        ? `bg-[#ffcf5c] shadow-[0_0_8px_#ffcf5c] ${styles.wait}`
        : status === "idle"
          ? "bg-[#5d6677]"
          : "border border-white/25 bg-transparent";
  return (
    <span
      className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${cls}`}
    />
  );
}

/** 승무원 이름 옆의 작은 지도 요약: 진행률과 내가 정할 갈림길 수. 지도가 없으면 비운다. */
/** compact면 진행률을 글 대신 버튼 아래쪽 얇은 막대로 그린다(부모가 relative여야 한다). */
export function MapBadge({
  crew,
  compact = false,
}: {
  crew: Crew;
  compact?: boolean;
}) {
  const m = crew.map;
  const waiting = crew.desk?.waiting ?? 0;
  if (!m && waiting === 0) return null;
  const pct = m ? Math.round(m.progress * 100) : 0;
  const title = [
    waiting > 0 && `책상에서 기다리는 것 ${waiting}`,
    m &&
      `지도 진행 ${pct}% · 내가 정할 갈림길 ${m.forksForMe}${m.stale ? " · 지도가 오래됨" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      data-map-badge
      className="ml-auto flex shrink-0 items-center gap-1 text-[10px] tabular-nums"
      title={title}
    >
      {waiting > 0 && (
        <span
          data-desk-badge
          className="rounded-full bg-[#ffd84a] px-1 leading-[14px] font-bold text-hull-950"
        >
          {waiting}
        </span>
      )}
      {!m ? null : compact ? (
        <span className="pointer-events-none absolute inset-x-1.5 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
          <span
            className={`absolute inset-y-0 left-0 ${m.stale ? "bg-[#ffd84a]/60" : "bg-[#5ee08a]/80"}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      ) : (
        <span className={m.stale ? "text-[#ffd84a]/70" : "text-white/45"}>
          {pct}%
        </span>
      )}
      {m && m.forksForMe > 0 && (
        <span className="font-semibold text-[#ffd84a]">⑂{m.forksForMe}</span>
      )}
    </span>
  );
}

function Heading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.22em] text-white/35">
      <span>{title}</span>
      <span className="h-px flex-1 bg-white/[0.07]" />
      {right}
    </div>
  );
}

/* ───────────── 교신 수신 ───────────── */

export function HailReceiver({
  hails,
  seen,
  now,
  onOpen,
}: {
  hails: Hail[];
  seen: Set<string>;
  now: number;
  onOpen: (id: string) => void;
}) {
  const fresh = hails.some((h) => !seen.has(h.id));
  const first = hails[0];
  return (
    <section
      aria-label="교신 수신"
      className={`${styles.bay} flex min-h-0 flex-col gap-1.5 rounded-lg px-2.5 pt-2 pb-2`}
    >
      <Heading title="교신 수신" />
      <div className="flex min-h-0 items-start gap-2.5">
        <button
          type="button"
          data-lamp="hail"
          aria-label={`교신 수신등 ${hails.length}`}
          disabled={!first}
          onClick={() => first && onOpen(first.id)}
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-black/70 text-[17px] font-bold tabular-nums ${
            hails.length
              ? `bg-[radial-gradient(circle_at_40%_35%,#fff3b0,#ffb020_55%,#a86800)] text-[#3a2400] shadow-[0_0_14px_rgba(255,176,32,0.6)] ${fresh ? styles.breathe : ""}`
              : "bg-[#232833] text-white/25"
          }`}
        >
          {hails.length}
        </button>
        <div className="min-w-0 flex-1">
          {hails.length === 0 ? (
            <p className="pt-2.5 text-[11.5px] text-white/35">
              조용함 · 부르는 사람이 없어요
            </p>
          ) : (
            <ul className="space-y-1">
              {hails.slice(0, 2).map((h) => (
                <li key={h.id}>
                  {/* biome-ignore lint/a11y/useSemanticElements: 글을 드래그해 고를 수 있게 div */}
                  <div
                    role="button"
                    tabIndex={0}
                    data-hail-chip={h.id}
                    onClick={() => !selecting() && onOpen(h.id)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(h.id)}
                    className="cursor-pointer rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 transition hover:border-white/20"
                  >
                    <div className="flex items-baseline gap-1 text-[10.5px]">
                      {!seen.has(h.id) && (
                        <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-[#ffc478]" />
                      )}
                      <span className="font-semibold text-white/85">
                        {h.from.name}
                      </span>
                      <span className="truncate text-white/35">
                        · {sourceLabel(h.source)}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-white/35 tabular-nums">
                        {ago(h.since, now)}
                      </span>
                    </div>
                    <div className="truncate text-[11.5px] text-white/65">
                      {h.line}
                    </div>
                  </div>
                </li>
              ))}
              {hails.length > 2 && (
                <li className="text-[10.5px] text-white/40">
                  <button
                    type="button"
                    onClick={() => onOpen(hails[2]?.id ?? "")}
                    className="hover:text-white"
                  >
                    교신 {hails.length - 2}통 더 ▸
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── 항법 소형 표시 ───────────── */

const PLANETS: { id: string; ko: string; color: string; size: number }[] = [
  { id: "mercury", ko: "수성", color: "#b5afa8", size: 6 },
  { id: "venus", ko: "금성", color: "#e8d3a2", size: 8 },
  { id: "earth", ko: "지구", color: "#4a8ad6", size: 8 },
  { id: "mars", ko: "화성", color: "#d0643f", size: 7 },
  { id: "jupiter", ko: "목성", color: "#d8b48a", size: 12 },
  { id: "saturn", ko: "토성", color: "#e3cf98", size: 10 },
  { id: "uranus", ko: "천왕성", color: "#9fd8e0", size: 9 },
  { id: "neptune", ko: "해왕성", color: "#5a7ce0", size: 9 },
];

export function NavMini({ onPicker }: { onPicker: () => void }) {
  const dest = useDestination();
  const travelTo = useVoyage((s) => s.travelTo);
  const t = useTelemetry(4);
  return (
    <section
      aria-label="항법"
      className={`${styles.bay} flex flex-col gap-1.5 rounded-lg px-2.5 pt-2 pb-2`}
    >
      <Heading
        title="항법"
        right={
          <button
            type="button"
            data-planet="more"
            onClick={onPicker}
            className="rounded px-1 tracking-normal text-white/55 hover:bg-white/10 hover:text-white"
          >
            더 먼 곳…
          </button>
        }
      />
      <div className="flex items-baseline gap-2 text-[12px]">
        <span className="shrink-0 whitespace-nowrap text-white/40">
          {t.traveling ? "이동 중 →" : "머무는 곳"}
        </span>
        <b className="shrink-0 font-semibold whitespace-nowrap text-white">
          {dest.ko}
        </b>
        {t.traveling ? (
          <span className="ml-auto font-mono text-[11px] text-[#9fe3ff] tabular-nums">
            {formatSpeed(t.speedKmS)}
          </span>
        ) : (
          <span className="ml-auto truncate text-[11px] text-white/35">
            {dest.fact}
          </span>
        )}
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-black/50">
        <div
          className="h-full rounded-full bg-[#7fd0ff] transition-[width] duration-200"
          style={{
            width: `${(t.traveling ? t.progress : 1) * 100}%`,
            opacity: t.traveling ? 1 : 0.25,
          }}
        />
      </div>
      <nav
        aria-label="행성으로 이동"
        className="flex items-end justify-between"
      >
        <PlanetKey
          id="overview"
          ko="전경"
          on={dest.id === "overview"}
          onClick={() => travelTo("overview")}
        >
          <span className="h-3 w-3 rounded-full border border-dashed border-white/40" />
        </PlanetKey>
        {PLANETS.map((p) => (
          <PlanetKey
            key={p.id}
            id={p.id}
            ko={p.ko}
            on={dest.id === p.id}
            onClick={() => travelTo(p.id)}
          >
            <span
              className="rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle at 35% 35%, #fff8 0, ${p.color} 45%, #0008 120%)`,
              }}
            />
          </PlanetKey>
        ))}
      </nav>
    </section>
  );
}

function PlanetKey({
  id,
  ko,
  on,
  onClick,
  children,
}: {
  id: string;
  ko: string;
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-planet={id}
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-[30px] flex-col items-center gap-0.5 rounded py-0.5 text-[9.5px] transition ${
        on
          ? "bg-white/[0.12] text-white"
          : "text-white/45 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span className="flex h-3 items-center">{children}</span>
      {ko}
    </button>
  );
}

/* ───────────── 판 전체 ───────────── */

export function Dashboard({
  tasks,
  hails,
  seen,
  crew,
  crewById,
  warnings,
  connected,
  lastAt,
  link,
  now,
  push,
  onList,
  onHail,
  onCrew,
  onPicker,
  onInterior,
}: {
  tasks: Task[];
  hails: Hail[];
  seen: Set<string>;
  crew: Crew[];
  crewById: Map<string, Crew>;
  warnings: Warnings;
  connected: boolean;
  /** 본부에서 상태를 마지막으로 받은 때 */
  lastAt: number;
  link?: Link;
  now: number;
  push: number;
  onList: (k: ListKind) => void;
  onHail: (id?: string) => void;
  onCrew: (id: string) => void;
  onPicker: () => void;
  onInterior: () => void;
}) {
  const groups = useMemo(
    () => inboxGroups(tasks, crewById, now),
    [tasks, crewById, now],
  );
  const replies = useMemo(() => lastReplies(tasks), [tasks]);
  const decisions = useMemo(() => tasks.filter((t) => !isNews(t)), [tasks]);
  const [picked, setPicked] = useState<string | null>(null);
  const group = pickGroup(groups, picked);
  return (
    <div className={`relative flex h-full flex-col ${styles.panel}`}>
      {/* 차양(글레어실드): 유리 바로 아래 둥근 턱 + 경고등 줄 */}
      <div className="relative z-10 -mt-[2px] flex h-[38px] shrink-0 items-center justify-center rounded-t-[22px] border-t border-white/[0.13] bg-[linear-gradient(180deg,#1b212c,#10141b)] px-5 shadow-[0_-8px_22px_rgba(0,0,0,0.55),0_4px_10px_rgba(0,0,0,0.5)]">
        <Annunciators
          tasks={decisions}
          hails={hails}
          warnings={warnings}
          connected={connected}
          lastAt={lastAt}
          now={now}
          link={link}
          onList={onList}
          onHail={() => onHail()}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(290px,350px)_minmax(0,1fr)_minmax(250px,300px)] grid-rows-[minmax(0,1fr)] gap-3 px-4 pt-[26px] pb-[22px]">
        <InboxIndex
          groups={groups}
          selected={group?.key}
          crew={crew}
          now={now}
          onSelect={setPicked}
          onCrew={onCrew}
        />
        <InboxSheet
          group={group}
          reply={group ? replies.get(group.key) : undefined}
          now={now}
          onCrew={onCrew}
        />
        <div className="flex min-h-0 flex-col gap-2">
          <HailReceiver
            hails={hails}
            seen={seen}
            now={now}
            onOpen={(id) => onHail(id)}
          />
          <div className="mt-auto flex flex-col gap-2">
            <FuelGauge />
            <NavMini onPicker={onPicker} />
          </div>
        </div>
      </div>
      {/* 아래 가장자리: 선내로 */}
      <button
        type="button"
        onClick={onInterior}
        className="absolute bottom-[3px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] transition hover:text-white"
        style={{ color: `rgba(255,255,255,${0.3 + push * 0.6})` }}
      >
        아래로 밀면 선내
        <span
          className="inline-block"
          style={{ transform: `translateY(${push * 3}px)` }}
        >
          ▾
        </span>
      </button>
    </div>
  );
}
