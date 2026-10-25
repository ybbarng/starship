"use client";

// 계기판: 왼쪽 포트 점유, 가운데 주 표시창(지금 할 일), 오른쪽 승무원 상태와 항법.
import type { Crew, Gauge, Task } from "@/protocol/v1";
import { useDestination } from "@/sky/voyage";
import { Animal, animalFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import { useArriving } from "./Flights";
import { type Berth, PORT_COUNT } from "./model";
import { SHIP, SHIP_KINDS, Ship } from "./ships";

export function Panel({
  children,
  className = "",
  title,
  aside,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section
      className={`relative rounded-xl border border-black/60 p-3 ${className}`}
      style={{
        background: "linear-gradient(180deg,#1b2338 0%,#131a2b 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 6px rgba(0,0,0,.4), 0 2px 0 rgba(0,0,0,.35)",
      }}
    >
      {title && (
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold tracking-[0.2em] text-white/50">
            {title}
          </h3>
          {aside && <div className="text-[11px] text-white/55">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const GAUGE_COLOR: Record<Gauge["status"], string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "#3a4258",
};

export function GaugeRow({ gauges }: { gauges: Gauge[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      <span className="tracking-[0.2em] text-white/40">계기 등</span>
      {gauges.map((g) => (
        <span
          key={g.id}
          className="flex items-center gap-1.5"
          title={g.detail ?? g.label}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${g.status === "error" ? "dk-blink" : ""}`}
            style={{
              background: GAUGE_COLOR[g.status],
              boxShadow:
                g.status === "off"
                  ? "none"
                  : `0 0 8px ${GAUGE_COLOR[g.status]}`,
            }}
          />
          <span className="text-white/75">{g.label}</span>
          {g.value && <span className="text-white/45">{g.value}</span>}
        </span>
      ))}
    </div>
  );
}

export function PortPanel({
  berths,
  nowId,
  onOpen,
  now,
}: {
  berths: Berth[];
  nowId?: string;
  onOpen: (b: Berth) => void;
  now: number;
}) {
  const arriving = useArriving();
  const docked = berths.slice(0, PORT_COUNT);
  const used = docked.filter((b) => !arriving.has(b.id)).length;
  const oldest = berths[0];
  return (
    <Panel
      title="도킹 포트"
      aside={
        <>
          <b className="text-white">{used}</b> / {PORT_COUNT} 사용
        </>
      }
      className="flex flex-col"
    >
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: PORT_COUNT }, (_, i) => {
          const b = docked[i];
          const lit = b && !arriving.has(b.id);
          const c = b ? SHIP[b.kind].color : "#3a4258";
          const isNow = !!b && b.id === nowId;
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 포트는 자리 번호가 곧 이름
              key={i}
              type="button"
              disabled={!b}
              onClick={() => b && onOpen(b)}
              className="flex min-w-0 items-center gap-1.5 rounded-md border border-black/50 bg-black/30 px-1.5 py-1 text-left enabled:hover:bg-white/5"
              style={isNow ? { boxShadow: `0 0 0 1px ${c}` } : undefined}
            >
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${b && !lit ? "dk-blink" : ""} ${isNow ? "dk-pulse" : ""}`}
                style={{
                  background: b ? c : "#222a3d",
                  boxShadow: lit ? `0 0 8px ${c}` : "inset 0 1px 2px #000",
                }}
              />
              <span className="min-w-0">
                <span className="block text-[10px] leading-3 text-white/40">
                  포트 {i + 1}
                </span>
                <span
                  className={`block truncate text-[11.5px] leading-4 ${b ? "text-white/85" : "text-white/25"}`}
                >
                  {b ? (lit ? b.from : "접근 중") : "빔"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-0.5 text-[12px] leading-[17px] text-white/65">
        {oldest ? (
          <>
            <div>
              가장 오래 붙은 배{" "}
              <b className="text-white/90">
                {oldest.from} · {ago(oldest.since, now)}
              </b>
            </div>
            <div>
              교신 <b className="text-white/90">{berths.length}척</b>
              {berths.length > PORT_COUNT && (
                <span className="text-signal-warn">
                  {" "}
                  · {berths.length - PORT_COUNT}척 포트 밖 대기
                </span>
              )}
            </div>
          </>
        ) : (
          <div>붙은 배가 없어요. 부르는 사람이 없는 조용한 항해.</div>
        )}
      </div>
      <div className="mt-auto border-t border-white/10 pt-1.5">
        <div className="mb-0.5 text-[10px] tracking-[0.15em] text-white/35">
          항구 별 · 교신이 오는 방향
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          {SHIP_KINDS.map((k) => {
            const n = berths.filter((b) => b.kind === k).length;
            return (
              <div
                key={k}
                className="flex items-center gap-1 text-[11.5px] leading-[18px]"
              >
                <Ship kind={k} width={20} flame={false} />
                <span style={{ color: SHIP[k].color }}>{SHIP[k].star}</span>
                <span className="truncate text-white/40">{SHIP[k].source}</span>
                <b
                  className={`ml-auto ${n ? "text-white/90" : "text-white/25"}`}
                >
                  {n}
                </b>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="text-white/60">{children}</span>;
}

export function MainDisplay({
  now: task,
  next,
  berth,
  berths,
  crewById,
  clock,
}: {
  now?: Task;
  next: Task[];
  berth?: Berth;
  berths: Berth[];
  crewById: Map<string, Crew>;
  clock: number;
}) {
  const portOf = (t: Task) => {
    const i = berths.findIndex((b) => b.task?.id === t.id);
    return i >= 0 && i < PORT_COUNT ? i + 1 : undefined;
  };
  return (
    <section
      data-main-display
      className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 p-4"
      style={{
        borderColor: berth ? SHIP[berth.kind].color : "#2c3a5c",
        background:
          "radial-gradient(120% 90% at 50% 0%, #10203a 0%, #070c18 70%)",
        boxShadow: berth
          ? `0 0 24px ${SHIP[berth.kind].color}44, inset 0 0 40px rgba(0,0,0,.6)`
          : "inset 0 0 40px rgba(0,0,0,.6)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)",
        }}
      />
      {task ? (
        <>
          <div className="relative flex items-center gap-2 text-[13px]">
            <span
              className="rounded px-1.5 py-px text-[12px] font-bold text-hull-950"
              style={{ background: CONTEXT_COLOR[task.context] }}
            >
              {CONTEXT_LABEL[task.context]}
            </span>
            <span className="font-semibold text-white">
              {task.crewId
                ? (crewById.get(task.crewId)?.name ?? task.crewId)
                : task.from}
            </span>
            <Meta>· {KIND_LABEL[task.kind]}</Meta>
            <Meta>· {sourceLabel(task.source)}</Meta>
            {berth && (
              <span
                className="flex items-center gap-1 rounded-full px-2 text-[12px]"
                style={{
                  color: SHIP[berth.kind].color,
                  background: `${SHIP[berth.kind].color}1f`,
                }}
              >
                <Ship kind={berth.kind} width={20} flame={false} />
                포트 {portOf(task)} 교신선
              </span>
            )}
            <span
              className={`ml-auto shrink-0 font-semibold ${clock - task.since >= 3_600_000 ? "text-signal-warn" : "text-white/80"}`}
            >
              {ago(task.since, clock)} 기다림
            </span>
          </div>
          <div className="relative mt-1 truncate text-[13px] text-white/55">
            {task.crewId ? task.from : "새 일 · 아직 승무원 없음"}
            {task.detail && (
              <span className="ml-2 text-white/40">— {task.detail}</span>
            )}
          </div>
          <h2
            className="relative mt-1.5 line-clamp-2 text-[25px] leading-[1.28] font-bold text-white"
            style={{ textWrap: "balance" }}
          >
            {task.title}
          </h2>
          <TaskActions
            task={task}
            className="relative mt-3 flex flex-wrap items-center gap-2"
            renderButton={(b) => (
              <button
                key={b.key}
                type="button"
                data-action={b.action}
                onClick={b.onClick}
                className={
                  b.primary
                    ? "rounded-lg border border-white/30 bg-white px-3.5 py-1.5 text-sm font-semibold text-hull-950 shadow-[0_2px_0_#7f8aa8] hover:bg-white/90 active:translate-y-px"
                    : "rounded-lg border border-white/15 bg-white/[0.07] px-3 py-1.5 text-sm text-white/90 shadow-[0_2px_0_#05070d] hover:bg-white/15 active:translate-y-px"
                }
              >
                {b.label}
              </button>
            )}
          />
          <div className="relative mt-auto pt-2">
            <div className="mb-1 text-[11px] tracking-[0.2em] text-white/35">
              다음 차례
            </div>
            <ol className="space-y-0.5">
              {next.length === 0 && (
                <li className="text-[13px] text-white/35">다음 차례 없음</li>
              )}
              {next.map((t) => {
                const p = portOf(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 text-[13px] leading-5 text-white/60"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: CONTEXT_COLOR[t.context] }}
                    />
                    <span className="max-w-[9rem] shrink-0 truncate text-white/75">
                      {t.crewId ?? t.from}
                    </span>
                    {p && (
                      <span className="shrink-0 text-[11px] text-white/45">
                        포트 {p}
                      </span>
                    )}
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-white/40">
                      {ago(t.since, clock)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-[26px] font-bold text-white/90">
            지금 할 일이 없어요
          </div>
          <div className="mt-2 text-sm text-white/50">
            포트는 비어 있고, 선원들은 각자 자리에서 일하는 중이에요.
            <br />
            창밖 여행을 즐기세요.
          </div>
        </div>
      )}
    </section>
  );
}

const STATUS_COLOR: Record<Crew["status"], string> = {
  "needs-you": "#ffcf5c",
  working: "#5ee08a",
  idle: "#7d8db3",
  off: "#2a3248",
};
const STATUS_ORDER: Crew["status"][] = ["needs-you", "working", "idle", "off"];
const SHORT: Record<Crew["status"], string> = {
  "needs-you": "기다림",
  working: "일함",
  idle: "쉼",
  off: "비움",
};

export function CrewPanel({
  crew,
  onCrew,
  onNav,
  onPlan,
}: {
  crew: Crew[];
  onCrew: (c: Crew) => void;
  onNav: () => void;
  onPlan: () => void;
}) {
  const dest = useDestination();
  const waiting = crew.filter((c) => c.status === "needs-you");
  return (
    <Panel
      title="승무원"
      aside={`${crew.length}명`}
      className="flex min-w-0 flex-col"
    >
      <div className="space-y-1.5">
        {(["work", "personal"] as const).map((ctx) => {
          const mine = crew.filter((c) => c.context === ctx);
          return (
            <div key={ctx}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span style={{ color: CONTEXT_COLOR[ctx] }}>
                  {CONTEXT_LABEL[ctx]}{" "}
                  <span className="text-white/50">{mine.length}</span>
                </span>
                <span className="text-[11px] text-white/50">
                  {STATUS_ORDER.map((s) => {
                    const n = mine.filter((c) => c.status === s).length;
                    return n ? (
                      <span key={s} className="ml-1.5">
                        {SHORT[s]}{" "}
                        <b
                          className={
                            s === "needs-you"
                              ? "text-signal-warn"
                              : "text-white/80"
                          }
                        >
                          {n}
                        </b>
                      </span>
                    ) : null;
                  })}
                </span>
              </div>
              <div className="mt-0.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-black/50 p-[1px]">
                {STATUS_ORDER.flatMap((s) =>
                  mine
                    .filter((c) => c.status === s)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={`${c.name} · ${CREW_STATUS_LABEL[c.status]}`}
                        onClick={() => onCrew(c)}
                        className={`h-full flex-1 rounded-[2px] ${s === "needs-you" ? "dk-pulse" : ""}`}
                        style={{ background: STATUS_COLOR[s] }}
                      />
                    )),
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] tracking-[0.15em] text-white/40">
        나를 기다리는 선원
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {waiting.length === 0 && (
          <div className="col-span-2 text-[12px] text-white/35">없음</div>
        )}
        {waiting.slice(0, 4).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCrew(c)}
            className="dk-wait flex min-w-0 items-center gap-1 rounded-md border border-signal-warn/40 bg-signal-warn/[0.07] pr-1.5 text-left hover:bg-signal-warn/15"
          >
            <span className="-my-1 shrink-0">
              <Animal
                kind={animalFor(c.id)}
                pose="wave"
                context={c.context}
                size={24}
              />
            </span>
            <span className="truncate text-[12px] text-white/90">{c.name}</span>
          </button>
        ))}
        {waiting.length > 4 && (
          <div className="col-span-2 text-[11px] text-white/45">
            그 밖에 {waiting.length - 4}명
          </div>
        )}
      </div>
      <div className="mt-auto flex gap-1.5 pt-2">
        <button
          type="button"
          onClick={onNav}
          className="min-w-0 flex-1 rounded-lg border border-glow-work/40 bg-glow-work/10 px-2 py-1.5 text-left text-[12px] hover:bg-glow-work/20"
        >
          <span className="block text-[10px] tracking-[0.15em] text-glow-work/80">
            항법
          </span>
          <span className="block truncate text-white/90">
            {dest.ko} · 목적지 고르기
          </span>
        </button>
        <button
          type="button"
          onClick={onPlan}
          className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10"
        >
          <span className="block text-[10px] tracking-[0.15em] text-white/45">
            전경
          </span>
          <span className="block text-white/90">우주선 ▾</span>
        </button>
      </div>
    </Panel>
  );
}
