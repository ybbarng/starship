"use client";

// 계기판: 유리창 아래 짜임새 있는 판. 장식 램프 없이, 등과 단추마다 뜻이 있다.
//   맨 위 차양(글레어실드) = 경고등 줄(등마다 글, 누르면 해당 목록)
//   왼쪽 = 승무원 상태판(업무/개인 두 줄, 프로젝트마다 작은 등)
//   가운데 = 주 표시창(지금 할 일 하나)
//   오른쪽 = 교신 수신등·칩, 항법 소형 표시(행성 단추·더 먼 곳·이동 중 속도)
import type { Context, Crew, CrewStatus, Hail, Task } from "@/protocol/v1";
import { formatSpeed } from "@/sky/telemetry";
import { useTelemetry } from "@/sky/useTelemetry";
import { useDestination, useVoyage } from "@/sky/voyage";
import { ago, CONTEXT_COLOR, CONTEXT_LABEL, sourceLabel } from "@/ui/kit";
import styles from "./cockpit.module.css";
import { MainDisplay } from "./MainDisplay";
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
    <button
      type="button"
      data-warn={id}
      data-lamp-state={lamp}
      title={hint}
      onClick={onClick}
      disabled={!onClick}
      className={`${styles.tile} ${tone} flex h-[24px] min-w-0 items-center justify-center gap-1.5 rounded-[3px] px-2.5 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap enabled:hover:brightness-125 disabled:cursor-default`}
    >
      <span className="truncate">{label}</span>
      {value && <span className="font-mono tabular-nums">{value}</span>}
    </button>
  );
}

export function Annunciators({
  tasks,
  hails,
  warnings,
  connected,
  onList,
  onHail,
}: {
  tasks: Task[];
  hails: Hail[];
  warnings: Warnings;
  connected: boolean;
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
        hint={`내 차례가 ${PILE_WARN}개 이상이면 켜져요. 누르면 전체 할 일`}
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
        hint="상태를 5초마다 받아 와요"
      />
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
  if (!m) return null;
  const pct = Math.round(m.progress * 100);
  return (
    <span
      data-map-badge
      className="ml-auto flex shrink-0 items-center gap-1 text-[10px] tabular-nums"
      title={`지도 진행 ${pct}% · 내가 정할 갈림길 ${m.forksForMe}${m.stale ? " · 지도가 오래됨" : ""}`}
    >
      {compact ? (
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
      {m.forksForMe > 0 && (
        <span className="font-semibold text-[#ffd84a]">⑂{m.forksForMe}</span>
      )}
    </span>
  );
}

/** 한 줄(업무·개인)에 보이는 등 수: 3칸 × 3줄. 넘치면 "+n 모두" */
const ROW_SLOTS = 9;

function CrewRow({
  context,
  crew,
  onCrew,
  onMore,
}: {
  context: Context;
  crew: Crew[];
  onCrew: (id: string) => void;
  onMore: () => void;
}) {
  const sorted = sortCrew(crew);
  const overflow = sorted.length > ROW_SLOTS;
  const shown = overflow ? sorted.slice(0, ROW_SLOTS - 1) : sorted;
  const waiting = crew.filter((c) => c.status === "needs-you").length;
  return (
    <div className="min-h-0">
      <div className="flex items-center gap-1.5 pb-1 text-[10.5px]">
        <span
          className="h-2.5 w-[3px] rounded-sm"
          style={{ background: CONTEXT_COLOR[context] }}
        />
        <span className="font-semibold tracking-wide text-white/75">
          {CONTEXT_LABEL[context]}
        </span>
        <span className="text-white/35">{crew.length}</span>
        {waiting > 0 && (
          <span className="ml-auto font-semibold text-[#ffd84a]">
            나를 기다림 {waiting}
          </span>
        )}
      </div>
      {crew.length === 0 ? (
        <p className="py-1.5 text-[11px] text-white/30">탑승한 승무원 없음</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-1 gap-y-[3px]">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              data-crew-lamp={c.id}
              data-status={c.status}
              title={`${c.name} · ${c.activity ?? ""}`}
              onClick={() => onCrew(c.id)}
              className={`relative flex min-w-0 items-center gap-1.5 rounded px-1.5 py-[3px] text-left text-[11px] transition hover:bg-white/[0.07] ${
                c.status === "needs-you"
                  ? "bg-[#ffcf5c]/[0.07] text-white"
                  : c.status === "off"
                    ? "text-white/35"
                    : "text-white/70"
              }`}
            >
              <CrewLamp status={c.status} />
              <span className="truncate">{c.name}</span>
              <MapBadge crew={c} compact />
            </button>
          ))}
          {overflow && (
            <button
              type="button"
              onClick={onMore}
              className="rounded border border-dashed border-white/15 px-1.5 py-[3px] text-[11px] text-white/55 hover:bg-white/[0.06]"
            >
              +{sorted.length - shown.length} 모두
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CrewBoard({
  crew,
  onCrew,
  onMore,
}: {
  crew: Crew[];
  onCrew: (id: string) => void;
  onMore: (ctx: Context) => void;
}) {
  return (
    <section
      aria-label="승무원 상태판"
      className={`${styles.bay} flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-lg px-2.5 pt-2 pb-2`}
    >
      <Heading title="승무원" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <CrewRow
          context="work"
          crew={crew.filter((c) => c.context === "work")}
          onCrew={onCrew}
          onMore={() => onMore("work")}
        />
        <div className="h-px bg-white/[0.06]" />
        <CrewRow
          context="personal"
          crew={crew.filter((c) => c.context === "personal")}
          onCrew={onCrew}
          onMore={() => onMore("personal")}
        />
      </div>
      <div className="flex items-center gap-2.5 border-t border-white/[0.06] pt-1.5 text-[10px] text-white/35">
        <Legend status="working" label="일함" />
        <Legend status="needs-you" label="나를 기다림" />
        <Legend status="idle" label="쉼" />
        <Legend status="off" label="비움" />
      </div>
    </section>
  );
}

function Legend({ status, label }: { status: CrewStatus; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <CrewLamp status={status} />
      {label}
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
  now,
  drawerOpen,
  push,
  onDrawer,
  onMore,
  onList,
  onHail,
  onCrew,
  onCrewMore,
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
  now: number;
  drawerOpen: boolean;
  push: number;
  onDrawer: () => void;
  onMore: (t: Task) => void;
  onList: (k: ListKind) => void;
  onHail: (id?: string) => void;
  onCrew: (id: string) => void;
  onCrewMore: (ctx: Context) => void;
  onPicker: () => void;
  onInterior: () => void;
}) {
  const [task, ...rest] = tasks;
  return (
    <div className={`relative flex h-full flex-col ${styles.panel}`}>
      {/* 차양(글레어실드): 유리 바로 아래 둥근 턱 + 경고등 줄 */}
      <div className="relative z-10 -mt-[2px] flex h-[38px] shrink-0 items-center justify-center rounded-t-[22px] border-t border-white/[0.13] bg-[linear-gradient(180deg,#1b212c,#10141b)] px-5 shadow-[0_-8px_22px_rgba(0,0,0,0.55),0_4px_10px_rgba(0,0,0,0.5)]">
        <Annunciators
          tasks={tasks}
          hails={hails}
          warnings={warnings}
          connected={connected}
          onList={onList}
          onHail={() => onHail()}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(270px,320px)] gap-3 px-4 pt-[26px] pb-[22px]">
        <CrewBoard crew={crew} onCrew={onCrew} onMore={onCrewMore} />
        <MainDisplay
          task={task}
          rest={rest}
          total={tasks.length}
          crewById={crewById}
          crewCount={crew.length}
          now={now}
          drawerOpen={drawerOpen}
          onDrawer={onDrawer}
          onMore={onMore}
        />
        <div className="flex min-h-0 flex-col gap-2">
          <HailReceiver
            hails={hails}
            seen={seen}
            now={now}
            onOpen={(id) => onHail(id)}
          />
          <div className="mt-auto">
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
