"use client";

// 첫 화면 아래쪽 계기판. 왼쪽 세 방 인원판 · 가운데 지금 할 일(대기실 줄 맨 앞) · 오른쪽 교신 수신기와 항로.
import type { ReactNode } from "react";
import type { Crew, Gauge, Hail, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, KIND_LABEL, sourceLabel } from "@/ui/kit";
import { ActionRow } from "./Actions";
import { ContextChip } from "./Cards";
import { Robot, SUIT, Visitor } from "./Figures";
import {
  entryName,
  type QueueEntry,
  ROOM_HINT,
  ROOM_LABEL,
  type Room,
  type RoomsModel,
} from "./model";
import { ROUTE, START, stopAt, stopName } from "./route";

const ROOM_COLOR: Record<Room, string> = {
  work: "#6cb6ff",
  wait: "#ffcf5c",
  lounge: "#c58cff",
};

function EntryFace({ entry, size }: { entry: QueueEntry; size: number }) {
  if (entry.who === "crew")
    return (
      <Animal
        kind={animalFor(entry.crew.id)}
        pose="wave"
        context={entry.crew.context}
        size={size}
        furniture={false}
      />
    );
  if (entry.who === "visitor")
    return (
      <Visitor
        source={entry.task.source.kind}
        service={entry.task.source.service}
        size={size}
        pose="wave"
      />
    );
  return <Robot source={entry.task.source.kind} size={size} />;
}

const LAMP: Record<Gauge["status"], string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "#3a4258",
};

function Gauges({ gauges }: { gauges: Gauge[] }) {
  return (
    <div className="flex items-center gap-4 overflow-hidden px-1 text-[11px] text-white/60">
      {gauges.map((g) => (
        <span
          key={g.id}
          className="flex shrink-0 items-center gap-1.5"
          title={g.detail}
        >
          <span
            className={`size-2.5 rounded-full ${g.status === "error" ? "tr-blink" : ""}`}
            style={{
              background: LAMP[g.status],
              boxShadow:
                g.status === "off" ? "none" : `0 0 8px ${LAMP[g.status]}`,
            }}
          />
          <span className="text-white/75">{g.label}</span>
          {g.value && <span className="text-white/45">{g.value}</span>}
        </span>
      ))}
    </div>
  );
}

function RoomBoard({
  model,
  onRoom,
  onCrew,
}: {
  model: RoomsModel;
  onRoom: () => void;
  onCrew: (c: Crew) => void;
}) {
  const rows: {
    room: Room;
    faces: { key: string; node: ReactNode; crew?: Crew }[];
    n: number;
  }[] = [
    {
      room: "work",
      n: model.work.length,
      faces: model.work.map((c) => ({
        key: c.id,
        crew: c,
        node: (
          <Animal
            kind={animalFor(c.id)}
            pose="stand"
            context={c.context}
            size={22}
            furniture={false}
          />
        ),
      })),
    },
    {
      room: "wait",
      n: model.queue.length,
      faces: model.queue.map((e) => ({
        key: e.key,
        crew: e.who === "crew" ? e.crew : undefined,
        node: <EntryFace entry={e} size={22} />,
      })),
    },
    {
      room: "lounge",
      n: model.lounge.length,
      faces: model.lounge.map((c) => ({
        key: c.id,
        crew: c,
        node: (
          <span style={{ opacity: c.status === "off" ? 0.4 : 1 }}>
            <Animal
              kind={animalFor(c.id)}
              pose={poseFor(c.status)}
              context={c.context}
              size={22}
              furniture={false}
            />
          </span>
        ),
      })),
    },
  ];
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[11px] font-semibold tracking-widest text-white/45">
          세 방 인원판
        </span>
        <button
          type="button"
          onClick={onRoom}
          className="text-[11px] text-white/45 hover:text-white"
        >
          방 보기 ↓
        </button>
      </div>
      {rows.map((r) => {
        const max = r.faces.length > 5 ? 4 : 5;
        const shown = r.faces.slice(0, max);
        return (
          // biome-ignore lint/a11y/useSemanticElements: 안에 선원 버튼이 있어 button으로 감쌀 수 없다
          <div
            key={r.room}
            role="button"
            tabIndex={0}
            data-room-row={r.room}
            onClick={onRoom}
            onKeyDown={(e) => e.key === "Enter" && onRoom()}
            className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 transition hover:bg-white/5 ${
              r.room === "wait" && r.n > 0
                ? "tr-glow border-amber-300/40 bg-amber-300/[.04]"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="w-[60px] shrink-0">
              <div className="text-[13px] font-semibold text-white/90">
                {ROOM_LABEL[r.room]}
              </div>
              <div className="text-[9.5px] leading-tight whitespace-nowrap text-white/45">
                {ROOM_HINT[r.room]}
              </div>
            </div>
            <div
              className="w-10 shrink-0 text-right text-[30px] leading-none font-black tabular-nums"
              style={{ color: r.n ? ROOM_COLOR[r.room] : "#4a5470" }}
            >
              {r.n}
            </div>
            <div className="flex min-w-0 flex-1 items-end gap-px overflow-hidden">
              {shown.map((f) =>
                f.crew ? (
                  <button
                    key={f.key}
                    type="button"
                    title={f.crew.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (f.crew) onCrew(f.crew);
                    }}
                    className="shrink-0 rounded hover:bg-white/10"
                  >
                    {f.node}
                  </button>
                ) : (
                  <span key={f.key} className="shrink-0">
                    {f.node}
                  </span>
                ),
              )}
              {r.faces.length > max && (
                <span className="mb-1 shrink-0 pl-1 text-[11px] text-white/50">
                  +{r.faces.length - max}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NowDisplay({
  model,
  now,
  next,
  cleared,
}: {
  model: RoomsModel;
  now?: Task;
  next: Task[];
  cleared: number;
}) {
  const front = model.queue[0];
  if (!now || !front) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="flex items-end gap-2">
          <Animal kind="cat" pose="sleep" size={70} />
          <Animal kind="otter" pose="sleep" size={64} context="personal" />
        </div>
        <div className="text-[24px] font-bold text-white">
          대기실이 비었어요
        </div>
        <div className="text-sm text-white/60">
          지금 할 일이 없어요 · 오늘 {cleared}개 치움 · 창밖은 자유 비행
        </div>
      </div>
    );
  }
  const who =
    front.who === "crew"
      ? front.crew.name
      : `${now.from} · ${sourceLabel(now.source)}`;
  const queueNext = model.queue.slice(1, 4);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-amber-200/80">
        <span className="size-1.5 rounded-full bg-amber-300 tr-blink" />
        지금 할 일 · 대기실 줄 맨 앞
      </div>
      <div key={now.id} className="tr-rise mt-2 flex min-h-0 flex-1 gap-4">
        <div className="relative w-[104px] shrink-0">
          <div className="relative flex flex-col items-center">
            <EntryFace entry={front} size={96} />
            <div className="-mt-1.5 h-2.5 w-20 rounded-full bg-amber-300/25 blur-[3px]" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-white/70">
            <ContextChip context={now.context} />
            <b className="text-white">{who}</b>
            <span className="text-white/35">·</span>
            <span>{KIND_LABEL[now.kind]}</span>
            <span className="text-white/35">·</span>
            <span className="font-semibold text-amber-200">
              {ago(now.since)} 기다림
            </span>
          </div>
          <div
            className="mt-1.5 line-clamp-2 text-[25px] leading-[1.28] font-bold text-white"
            title={now.title}
          >
            {now.title}
          </div>
          <ActionRow task={now} className="mt-2.5" />
        </div>
      </div>
      <div className="mt-2 border-t border-white/10 pt-2">
        <div className="mb-1 text-[10.5px] font-semibold tracking-widest text-white/40">
          다음 차례 · 줄 둘째부터
        </div>
        {next.length === 0 && (
          <div className="text-xs text-white/40">줄에 더 없어요</div>
        )}
        <ul className="space-y-0.5">
          {next.slice(0, 3).map((t, i) => {
            const e = queueNext.find((q) => q.task?.id === t.id);
            return (
              <li
                key={t.id}
                className="flex items-center gap-2 text-[13px] leading-6 text-white/75"
              >
                <span className="w-7 shrink-0 text-[11px] text-white/40">
                  {["둘째", "셋째", "넷째"][i]}
                </span>
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: CONTEXT_COLOR[t.context] }}
                />
                <span className="shrink-0 font-semibold text-white/90">
                  {e ? entryName(e) : t.from}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-[12px] text-white/45">
                  {ago(t.since)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Receiver({
  hails,
  tasks,
  onOpen,
}: {
  hails: Hail[];
  tasks: Task[];
  onOpen: (t: Task) => void;
}) {
  const list = hails
    .map((h) => ({ h, t: tasks.find((t) => t.id === h.taskId) }))
    .filter((x): x is { h: Hail; t: Task } => !!x.t);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold tracking-widest text-white/45">
          교신 수신기 · 방문객
        </span>
        <span
          className={`rounded-full px-2 text-[11px] font-bold ${list.length ? "bg-violet-400/20 text-violet-200 tr-blink" : "text-white/30"}`}
        >
          {list.length}
        </span>
      </div>
      {list.length === 0 && (
        <div className="grid flex-1 place-items-center rounded-xl border border-white/10 bg-black/20 text-xs text-white/40">
          들어온 교신이 없어요
        </div>
      )}
      <ul className="space-y-1">
        {list.slice(0, 3).map(({ h, t }) => (
          <li key={h.id}>
            <button
              type="button"
              data-hail={h.id}
              onClick={() => onOpen(t)}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-left hover:border-violet-300/50 hover:bg-white/5"
            >
              <span className="shrink-0">
                <Visitor
                  source={h.source.kind}
                  service={h.source.service}
                  size={24}
                  pose="wave"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[11px] text-white/55">
                  <b className="text-white/90">{h.from.name}</b>
                  <span style={{ color: SUIT[h.source.kind].suit }}>
                    {sourceLabel(h.source)}
                  </span>
                  <span className="ml-auto shrink-0 text-amber-200/80">
                    {ago(h.since)}
                  </span>
                </span>
                <span className="block truncate text-[12.5px] text-white/85">
                  {h.line}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {list.length > 3 && (
        <div className="mt-1 px-1 text-[11px] text-white/45">
          외 {list.length - 3}통 · 대기실에서 기다려요
        </div>
      )}
    </div>
  );
}

function RouteBox({ cleared, onNav }: { cleared: number; onNav: () => void }) {
  const step = Math.min(cleared, ROUTE.length);
  const next = step < ROUTE.length ? stopName(ROUTE[step] ?? START) : null;
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-white/50">오늘 치운 일</span>
        <span className="text-[26px] leading-none font-black text-emerald-300 tabular-nums">
          {cleared}
        </span>
        <span className="ml-auto text-[11px] text-white/55">
          항로 {step}/{ROUTE.length}칸 · {stopName(stopAt(cleared))}
        </span>
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {ROUTE.map((id, i) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-emerald-300" : "bg-white/12"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-white/50">
          {next ? `하나 치우면 → ${next}` : "오늘 항로 끝 · 자유 비행"}
        </span>
        <button
          type="button"
          onClick={onNav}
          className="shrink-0 rounded-lg border border-sky-300/40 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-400/20"
        >
          항법 · 목적지
        </button>
      </div>
    </div>
  );
}

export function Cockpit({
  model,
  now,
  next,
  tasks,
  hails,
  gauges,
  cleared,
  onRoom,
  onCrew,
  onTask,
  onNav,
}: {
  model: RoomsModel;
  now?: Task;
  next: Task[];
  tasks: Task[];
  hails: Hail[];
  gauges: Gauge[];
  cleared: number;
  onRoom: () => void;
  onCrew: (c: Crew) => void;
  onTask: (t: Task) => void;
  onNav: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col bg-[linear-gradient(180deg,#1a2236_0%,#0f1526_40%,#0b0f1c_100%)] px-3 pt-1.5 pb-3">
      {/* 계기판 윗가장자리 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="mb-1.5 flex items-center gap-3">
        <Gauges gauges={gauges} />
        <span className="ml-auto shrink-0 text-[11px] text-white/35">
          ↓ 아래로 밀면 세 방
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_310px] gap-3">
        <section className="min-h-0 rounded-2xl border border-white/10 bg-hull-800/60 p-2.5 shadow-inner">
          <RoomBoard model={model} onRoom={onRoom} onCrew={onCrew} />
        </section>
        <section className="min-h-0 rounded-2xl border border-amber-300/25 bg-[#0a0f1d] p-3.5 shadow-[inset_0_0_30px_rgba(255,207,92,.05)]">
          <NowDisplay model={model} now={now} next={next} cleared={cleared} />
        </section>
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-hull-800/60 p-2.5">
          <Receiver hails={hails} tasks={tasks} onOpen={onTask} />
          <RouteBox cleared={cleared} onNav={onNav} />
        </section>
      </div>
    </div>
  );
}
