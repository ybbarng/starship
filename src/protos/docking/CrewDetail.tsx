"use client";

// 승무원 한 명: 브리핑과 할 일 체크(체크 = 치우기), 창으로 가기·브리핑 다시.
import { useAct } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  KIND_LABEL,
} from "@/ui/kit";

export function CrewDetail({
  crew,
  tasks,
  clock,
}: {
  crew: Crew;
  tasks: Task[];
  clock: number;
}) {
  const act = useAct();
  const b = crew.brief;
  return (
    <div>
      <div className="flex items-center gap-3">
        <Animal
          kind={animalFor(crew.id)}
          pose={poseFor(crew.status)}
          context={crew.context}
          size={64}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 text-[11px] font-bold text-hull-950"
              style={{ background: CONTEXT_COLOR[crew.context] }}
            >
              {CONTEXT_LABEL[crew.context]}
            </span>
            <span
              className={`text-sm ${crew.status === "needs-you" ? "font-semibold text-signal-warn" : "text-white/70"}`}
            >
              {CREW_STATUS_LABEL[crew.status]}
            </span>
          </div>
          <div className="mt-0.5 text-lg font-semibold">{crew.name}</div>
          {crew.activity && (
            <div className="text-sm text-white/60">{crew.activity}</div>
          )}
        </div>
      </div>

      <h4 className="mt-4 mb-1.5 text-xs font-semibold tracking-widest text-white/45">
        할 일 {tasks.length}
      </h4>
      {tasks.length === 0 ? (
        <p className="text-sm text-white/45">나를 기다리는 일이 없어요.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2.5 hover:bg-white/10">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#5ee08a]"
                  onChange={(e) => e.target.checked && act.task(t, "dismiss")}
                  disabled={!t.actions.includes("dismiss")}
                />
                <span className="min-w-0">
                  <span className="block text-[15px] leading-snug text-white">
                    {t.title}
                  </span>
                  <span className="block text-xs text-white/50">
                    {KIND_LABEL[t.kind]} · {t.from} · {ago(t.since, clock)}{" "}
                    기다림
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {b ? (
        <div className="mt-4 space-y-2.5 text-sm">
          <h4 className="text-xs font-semibold tracking-widest text-white/45">
            브리핑 · {ago(b.at, clock)} 전
          </h4>
          <p className="text-white/85">{b.summary}</p>
          <BriefList title="오늘" items={b.today} />
          <BriefList title="다음" items={b.next} />
          <BriefList title="위험" items={b.risks} tone="warn" />
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/40">아직 브리핑이 없어요.</p>
      )}

      <div className="mt-5 flex gap-2">
        {crew.actions.includes("focus") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "focus")}
            className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-hull-950 hover:bg-white/90"
          >
            창으로 가기
          </button>
        )}
        {crew.actions.includes("brief") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "brief")}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
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
  tone?: "warn";
}) {
  if (!items.length) return null;
  return (
    <div>
      <div
        className={`text-xs ${tone === "warn" ? "text-signal-warn/80" : "text-white/45"}`}
      >
        {title}
      </div>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-white/75">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
