"use client";

// 조종석 "승무원 정보": 잠깐 엿보기. 처리는 결재함, 한 승무원의 전부는 선실에서 한다(역할: docs/crew-views.md).
// 여기서는 상태·지금 일·하는 일·브리핑 요약 한 줄과 가는 길(결재함·창·선실)만 보인다.
import { useAct } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { ago } from "@/ui/kit";
import styles from "./cockpit.module.css";
import { isNews } from "./inboxGroups";

export function CrewPeek({
  crew,
  tasks,
  now,
  onInbox,
}: {
  crew: Crew;
  tasks: Task[];
  now: number;
  /** 결재함에서 이 승무원 묶음을 연다 */
  onInbox: () => void;
}) {
  const act = useAct();
  const waiting = tasks.filter((t) => !isNews(t)).length;
  const answers = crew.desk?.answers ?? 0;
  const doing = crew.desk?.doing;
  const brief = crew.brief;
  return (
    <div className="space-y-3 text-[13px]" data-crew-peek>
      {(doing || brief) && (
        <dl className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          {doing && (
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-white/40">하는 일</dt>
              <dd className="min-w-0 text-white/85">{doing}</dd>
            </div>
          )}
          {brief && (
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-white/40">브리핑</dt>
              <dd className="min-w-0 text-white/85">
                <span className="line-clamp-2">{brief.summary}</span>
                <span className="text-[11px] text-white/35">
                  {ago(brief.at, now)} 전 · 전체는 선실에서
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-peek-inbox
          disabled={waiting === 0 && answers === 0}
          onClick={onInbox}
          className={`${styles.key} ${waiting || answers ? styles.keyPrimary : ""} rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40`}
        >
          {waiting || answers
            ? `결재함에서 보기${waiting ? ` ${waiting}건` : ""}${answers ? ` · 답 ${answers}` : ""}`
            : "기다리는 결재 없음"}
        </button>
        {crew.actions.includes("focus") && (
          <button
            type="button"
            onClick={() => act.crew(crew, "focus")}
            className={`${styles.key} rounded-md px-3 py-1.5 text-[13px] font-semibold text-white/85`}
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
