"use client";

// 선실 옆판 "할 일": 이 승무원을 기다리는 것 전부. 결재함(조종석)에서 이 승무원 묶음을 연 것과 같은 내용이다.
//   답해 둔 것(물어본 것에 세션이 남긴 답) → 책상(기다림 + 하는 일) → 책상 밖에서 온 일 → 마지막 답변(접힘)
// 세 화면의 역할: docs/crew-views.md
import type { Desk } from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { Paper, ReplyNote } from "@/protos/cockpit/Inbox";
import { isNews, lastReplies } from "@/protos/cockpit/inboxGroups";
import { AnswerList } from "./Answers";
import { DeskPanel } from "./DeskPanel";

/** 책상 기다림에서 온 Task인지(id desk:<crewId>:<waitId>) */
function fromDesk(t: Task): boolean {
  return t.id.startsWith("desk:");
}

/** 할 일 판 배지: 책상 기다림 + 책상 밖 일 + 답해 둔 것 */
export function crewTaskCount(desk: Desk | null, tasks: Task[]): number {
  return (
    (desk?.waiting.length ?? 0) +
    tasks.filter((t) => !isNews(t) && !fromDesk(t)).length +
    (desk?.answers?.length ?? 0)
  );
}

export function CrewTasks({
  crewId,
  desk,
  tasks,
  now,
}: {
  crewId: string;
  desk: Desk | null;
  tasks: Task[];
  now: number;
}) {
  const others = tasks.filter((t) => !isNews(t) && !fromDesk(t));
  const reply = lastReplies(tasks).get(crewId);
  return (
    <div className="flex flex-col gap-5" data-crew-tasks>
      {desk?.answers?.length ? (
        <AnswerList crewId={crewId} answers={desk.answers} now={now} />
      ) : null}
      {desk ? (
        <DeskPanel crewId={crewId} desk={desk} tasks={tasks} now={now} />
      ) : (
        <p className="text-[12.5px] text-white/40">
          이 세션은 책상을 쓰지 않아요.
        </p>
      )}
      {others.length > 0 && (
        <section data-crew-other-tasks>
          <h3 className="mb-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
            책상 밖에서 온 일 {others.length}
          </h3>
          <ul className="space-y-2">
            {others.map((t) => (
              <Paper
                key={t.id}
                task={t}
                now={now}
                showFrom
                showContext={false}
              />
            ))}
          </ul>
        </section>
      )}
      {reply && (
        <ul>
          <ReplyNote key={reply.id} task={reply} now={now} />
        </ul>
      )}
    </div>
  );
}
