"use client";

// 승무원 상세: 브리핑·할 일 체크(체크 = 치우기)·창으로 가기. 모달과 고리 옆 패널이 같이 쓴다.
import { useAct, useBridge } from "@/data/hooks";
import type { Crew, Hail } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  elapsed,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import { ContextChip } from "./common";

const BTN =
  "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/85 hover:border-white/40 hover:bg-white/10";
const PRIMARY =
  "rounded-md border border-[#6cb6ff]/60 bg-[#6cb6ff]/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#6cb6ff]/35";

export function CrewDetail({ crew }: { crew: Crew }) {
  const { tasksByCrew } = useBridge();
  const act = useAct();
  const tasks = tasksByCrew.get(crew.id) ?? [];
  const b = crew.brief;
  const accent = crew.context === "work" ? "#6cb6ff" : "#ffb86c";

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 rounded-xl border-2 p-1"
          style={{ borderColor: accent, background: "#0a1020" }}
        >
          <Animal
            kind={animalFor(crew.id)}
            pose={poseFor(crew.status)}
            context={crew.context}
            size={56}
            furniture={false}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ContextChip context={crew.context} />
            <span className="truncate text-base font-semibold">
              {crew.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/60">
            {CREW_STATUS_LABEL[crew.status]}
            {crew.since ? ` · ${elapsed(crew.since)}` : ""}
            {crew.activity ? ` · ${crew.activity}` : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {crew.actions.includes("focus") && (
              <button
                type="button"
                className={PRIMARY}
                onClick={() => act.crew(crew, "focus")}
              >
                창으로 가기
              </button>
            )}
            {crew.actions.includes("brief") && (
              <button
                type="button"
                className={BTN}
                onClick={() => act.crew(crew, "brief")}
              >
                브리핑 다시
              </button>
            )}
          </div>
        </div>
      </div>

      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-widest text-white/45">
          할 일 {tasks.length ? `${tasks.length}` : ""}
        </h4>
        {tasks.length === 0 ? (
          <p className="text-xs text-white/45">
            {CONTEXT_LABEL[crew.context]} 선원 {crew.name}에게 남은 할 일이
            없어요.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t, i) => (
              <li
                key={t.id}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2"
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    data-check={t.id}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#5ee08a]"
                    onChange={() => act.task(t, "dismiss")}
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] text-white/50">
                      {KIND_LABEL[t.kind]} · {sourceLabel(t.source)} ·{" "}
                      {elapsed(t.since)}
                    </span>
                    <span className="block leading-snug">{t.title}</span>
                  </span>
                </label>
                {i === 0 && (
                  <TaskActions
                    task={t}
                    className="mt-2 flex flex-wrap gap-1.5 pl-6"
                    buttonClassName={BTN}
                    primaryClassName={PRIMARY}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {b && (
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-semibold tracking-widest text-white/45">
            브리핑 · {ago(b.at)} 전
          </h4>
          <p className="leading-snug text-white/85">{b.summary}</p>
          {b.today.length > 0 && (
            <div>
              <div className="text-[11px] text-white/45">오늘</div>
              <ul className="list-disc pl-4 text-xs text-white/75">
                {b.today.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {b.next.length > 0 && (
            <div>
              <div className="text-[11px] text-white/45">다음</div>
              <ul className="list-disc pl-4 text-xs text-white/75">
                {b.next.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {b.risks.length > 0 && (
            <div>
              <div className="text-[11px] text-[#ff6b6b]/80">위험</div>
              <ul className="list-disc pl-4 text-xs text-[#ffb3b3]">
                {b.risks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** 교신 목록: 누가·어디서·한 줄·몇 분, 할 일 버튼 */
export function HailList({ focusId }: { focusId?: string }) {
  const { hails, tasks } = useBridge();
  if (!hails.length)
    return <p className="text-sm text-white/55">들어온 교신이 없어요.</p>;
  const sorted: Hail[] = focusId
    ? [...hails].sort((a, b) =>
        a.id === focusId ? -1 : b.id === focusId ? 1 : 0,
      )
    : hails;
  return (
    <ul className="space-y-2.5">
      {sorted.map((h) => {
        const task = tasks.find((t) => t.id === h.taskId);
        return (
          <li
            key={h.id}
            className={`rounded-xl border p-3 ${
              h.id === focusId
                ? "border-[#ffcf5c]/50 bg-[#ffcf5c]/[0.06]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-white/60">
              <ContextChip context={h.context} />
              <span className="font-semibold text-white/90">{h.from.name}</span>
              {h.from.where && h.from.where !== sourceLabel(h.source) && (
                <span>· {h.from.where}</span>
              )}
              <span>· {sourceLabel(h.source)}</span>
              <span className="ml-auto">{elapsed(h.since)}</span>
            </div>
            <div className="mt-1.5 text-[15px] leading-snug">{h.line}</div>
            {task ? (
              <TaskActions
                task={task}
                className="mt-2.5 flex flex-wrap gap-1.5"
                buttonClassName={BTN}
                primaryClassName={PRIMARY}
              />
            ) : (
              h.url && (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener"
                  className={`mt-2.5 inline-block ${PRIMARY}`}
                >
                  답하러 가기
                </a>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
