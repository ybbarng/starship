"use client";

// 선원·방문객 카드: 브리핑, 할 일 체크(체크 = 치우기), 창으로 가기.
import { useAct, useBridge } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  KIND_LABEL,
  sourceLabel,
} from "@/ui/kit";
import { ActionRow } from "./Actions";
import { Robot, SUIT, Visitor } from "./Figures";
import type { QueueEntry } from "./model";
import { useRoute } from "./route";

export function ContextChip({ context }: { context: Crew["context"] }) {
  return (
    <span
      className="rounded px-1.5 py-px text-[11px] font-semibold"
      style={{
        color: CONTEXT_COLOR[context],
        background: `${CONTEXT_COLOR[context]}22`,
        border: `1px solid ${CONTEXT_COLOR[context]}55`,
      }}
    >
      {CONTEXT_LABEL[context]}
    </span>
  );
}

function TaskCheck({ task }: { task: Task }) {
  const act = useAct();
  const expect = useRoute((s) => s.expect);
  const canDismiss = task.actions.includes("dismiss");
  return (
    <li className="flex items-start gap-2 rounded-lg bg-white/5 px-2.5 py-2">
      <button
        type="button"
        disabled={!canDismiss}
        aria-label={`치우기: ${task.title}`}
        data-action="dismiss"
        onClick={() => {
          expect(task.id);
          act.task(task, "dismiss");
        }}
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-emerald-300/60 text-xs text-emerald-200 hover:bg-emerald-400/25 disabled:opacity-30"
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug text-white">{task.title}</div>
        <div className="mt-0.5 text-[11px] text-white/50">
          {KIND_LABEL[task.kind]} · {sourceLabel(task.source)} ·{" "}
          {ago(task.since)} 기다림
        </div>
      </div>
    </li>
  );
}

export function CrewCard({ crew }: { crew: Crew }) {
  const { tasksByCrew } = useBridge();
  const act = useAct();
  const tasks = tasksByCrew.get(crew.id) ?? [];
  const first = tasks[0];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Animal
          kind={animalFor(crew.id)}
          pose={poseFor(crew.status)}
          context={crew.context}
          size={56}
          furniture={false}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-base font-semibold">
              {crew.name}
            </span>
            <ContextChip context={crew.context} />
          </div>
          <div className="text-xs text-white/60">
            {CREW_STATUS_LABEL[crew.status]}
            {crew.activity ? ` · ${crew.activity}` : ""}
          </div>
        </div>
      </div>
      {first && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-3">
          <div className="text-[11px] text-amber-200/80">
            {KIND_LABEL[first.kind]} · {ago(first.since)} 기다림
          </div>
          <div className="mt-1 text-[15px] leading-snug font-semibold">
            {first.title}
          </div>
          {first.detail && (
            <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-white/60">
              {first.detail}
            </p>
          )}
          <ActionRow task={first} size="sm" className="mt-2" />
        </div>
      )}
      {crew.brief ? (
        <div className="space-y-1.5 text-sm">
          <div className="text-xs font-semibold tracking-wider text-white/45">
            브리핑 · {ago(crew.brief.at)} 전
          </div>
          <p className="leading-snug text-white/85">{crew.brief.summary}</p>
          {crew.brief.today.length > 0 && (
            <p className="text-xs text-white/65">
              <b className="text-white/80">오늘</b>{" "}
              {crew.brief.today.join(" · ")}
            </p>
          )}
          {crew.brief.risks.length > 0 && (
            <p className="text-xs text-rose-200/80">
              <b>위험</b> {crew.brief.risks.join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/45">아직 브리핑이 없어요.</p>
      )}
      {!first && <p className="text-xs text-white/45">남은 할 일이 없어요.</p>}
      {tasks.length > 1 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wider text-white/45">
            다른 할 일 체크 · {tasks.length - 1}
          </div>
          <ul className="space-y-1.5">
            {tasks.slice(1).map((t) => (
              <TaskCheck key={t.id} task={t} />
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-1.5">
        {crew.actions.includes("focus") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "focus")}
            className="rounded-lg bg-amber-300 px-3 py-1.5 text-sm font-medium text-hull-950 hover:bg-amber-200"
          >
            창으로 가기
          </button>
        )}
        {crew.actions.includes("brief") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "brief")}
            className="rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-sm hover:bg-white/15"
          >
            브리핑 다시
          </button>
        )}
      </div>
    </div>
  );
}

export function TaskCard({ task }: { task: Task }) {
  const hailish =
    task.source.kind !== "reminder" && task.source.kind !== "monitor";
  const suit = SUIT[task.source.kind];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {hailish ? (
          <Visitor
            source={task.source.kind}
            service={task.source.service}
            size={52}
            pose="wave"
          />
        ) : (
          <Robot source={task.source.kind} size={52} />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold">{task.from}</span>
            <ContextChip context={task.context} />
          </div>
          <div className="text-xs text-white/60">
            <span style={{ color: suit.suit }}>●</span>{" "}
            {sourceLabel(task.source)} · {KIND_LABEL[task.kind]} ·{" "}
            {ago(task.since)} 기다림
            {task.crewId ? ` · ${task.crewId}` : ""}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[15px] leading-snug font-semibold">
          {task.title}
        </div>
        {task.detail && (
          <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-white/60">
            {task.detail}
          </p>
        )}
      </div>
      <ActionRow task={task} size="sm" />
    </div>
  );
}

export function EntryCard({ entry }: { entry: QueueEntry }) {
  if (entry.who === "crew") return <CrewCard crew={entry.crew} />;
  return <TaskCard task={entry.task} />;
}
