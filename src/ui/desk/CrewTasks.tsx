"use client";

// 선실 옆판 "할 일": 이 승무원을 기다리는 것 전부. 결재함(조종석)에서 이 승무원 묶음을 연 것과 같은 내용이다.
//   답해 둔 것(물어본 것에 세션이 남긴 답) → 책상(기다림 + 하는 일) → 책상 밖에서 온 일 → 마지막 답변(접힘)
// 세 화면의 역할: docs/crew-views.md
import { isReadHidden } from "@/data/sent";
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

/**
 * 할 일 판 배지: 책상 기다림 + 책상 밖 일 + 답해 둔 것. 답해 둔 것은 읽음을 눌러 숨긴 것은 빼고 센다
 * (본부가 책상에서 빼기 전까지 배지만 하나 많았다, 2026-11-03). crewId를 안 주면 할 일에서 찾는다.
 */
export function crewTaskCount(
  desk: Desk | null,
  tasks: Task[],
  crewId: string | undefined = tasks.find((t) => t.crewId)?.crewId,
): number {
  const answers = (desk?.answers ?? []).filter(
    (a) => !isReadHidden(a.id, crewId),
  );
  return (
    (desk?.waiting.length ?? 0) +
    tasks.filter((t) => !isNews(t) && !fromDesk(t)).length +
    answers.length
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
    <div className="flex min-w-0 flex-col gap-5" data-crew-tasks>
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
