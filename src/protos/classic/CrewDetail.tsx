"use client";

// 승무원 한 명의 자리: 브리핑(요약·오늘·다음·위험)과 할 일 체크(체크 = 치우기), 창으로 가기 · 브리핑 다시.
// 조종석에서는 모달 안에, 선내 전경에서는 오른쪽 패널 안에 같은 것을 넣는다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
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
import styles from "./classic.module.css";

export function CrewHeader({ crew, now }: { crew: Crew; now: number }) {
  return (
    <div className="flex items-center gap-3">
      <Animal
        kind={animalFor(crew.id)}
        pose={poseFor(crew.status)}
        context={crew.context}
        size={56}
        furniture={false}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-lg font-semibold">{crew.name}</span>
          <span
            className="rounded px-1.5 py-px text-[11px] font-semibold text-black"
            style={{ background: CONTEXT_COLOR[crew.context] }}
          >
            {CONTEXT_LABEL[crew.context]}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-white/65">
          <StatusDot status={crew.status} /> {CREW_STATUS_LABEL[crew.status]}
          {crew.since ? ` · ${ago(crew.since, now)}째` : ""}
          {crew.activity ? ` · ${crew.activity}` : ""}
        </div>
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: Crew["status"] }) {
  const c =
    status === "working"
      ? "bg-[#5ee08a] shadow-[0_0_6px_#5ee08a]"
      : status === "needs-you"
        ? `bg-[#ffd84a] shadow-[0_0_6px_#ffd84a] ${styles.blink}`
        : "bg-white/20";
  return (
    <span className={`inline-block h-2 w-2 rounded-full align-middle ${c}`} />
  );
}

export function CrewDetail({
  crew,
  tasks,
  now,
}: {
  crew: Crew;
  tasks: Task[];
  now: number;
}) {
  const act = useAct();
  const brief = crew.brief;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-white/45">
          할 일 체크 · 체크하면 치운다
        </h3>
        {tasks.length === 0 ? (
          <p className="text-white/50">이 선원이 기다리는 일은 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <CheckItem key={t.id} task={t} now={now} />
            ))}
          </ul>
        )}
      </section>

      {brief ? (
        <section className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold tracking-widest text-white/45">
              브리핑
            </h3>
            <span className="text-[11px] text-white/40">
              {ago(brief.at, now)} 전에 만듦
            </span>
          </div>
          <p className="leading-relaxed text-white/90">{brief.summary}</p>
          <BriefList title="오늘" items={brief.today} />
          <BriefList title="다음" items={brief.next} />
          <BriefList title="위험" items={brief.risks} tone="risk" />
        </section>
      ) : (
        <p className="text-white/50">아직 브리핑이 없어요.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {crew.actions.includes("focus") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "focus")}
            className={`${styles.key} ${styles.keyPrimary} rounded-md px-3 py-1.5 text-[13px] font-semibold`}
          >
            창으로 가기
          </button>
        )}
        {crew.actions.includes("brief") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "brief")}
            className={`${styles.key} rounded-md px-3 py-1.5 text-[13px] font-semibold text-white/85`}
          >
            브리핑 다시
          </button>
        )}
      </div>
    </div>
  );
}

function BriefList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "risk";
}) {
  if (!items.length) return null;
  return (
    <div className="flex gap-2">
      <span
        className={`w-8 shrink-0 text-xs font-semibold ${tone ? "text-[#ff8f8f]" : "text-white/45"}`}
      >
        {title}
      </span>
      <ul className="min-w-0 space-y-0.5 text-white/80">
        {items.map((s) => (
          <li key={s}>· {s}</li>
        ))}
      </ul>
    </div>
  );
}

function CheckItem({ task, now }: { task: Task; now: number }) {
  const act = useAct();
  const [done, setDone] = useState(false);
  const canDismiss = task.actions.includes("dismiss");
  return (
    <li className="flex items-start gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2">
      <input
        type="checkbox"
        aria-label={`치우기: ${task.title}`}
        data-check={task.id}
        disabled={!canDismiss || done}
        checked={done}
        onChange={() => {
          setDone(true);
          act.task(task, "dismiss");
        }}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#5ee08a]"
      />
      <div
        className={`min-w-0 flex-1 ${done ? "text-white/35 line-through" : ""}`}
      >
        <div className="text-[11px] text-white/50">
          {KIND_LABEL[task.kind]} · {sourceLabel(task.source)} ·{" "}
          {ago(task.since, now)}째
        </div>
        <div className="leading-snug">{task.title}</div>
      </div>
      {task.actions.includes("focus") && !done && (
        <button
          type="button"
          onClick={() => act.task(task, "focus")}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-[#9cc8ff] hover:bg-white/10"
        >
          창으로
        </button>
      )}
    </li>
  );
}
