"use client";

// 선실 현황판 "할 일": 이 승무원을 기다리는 것 전부. 결재함(조종석)에서 이 승무원 묶음을 연 것과 같은 내용이다.
//   답해 둔 것(물어본 것에 세션이 남긴 답) → 책상(기다림 + 하는 일) → 책상 밖에서 온 일 → 마지막 답변(접힘)
// 세 화면의 역할: docs/crew-views.md
import { readKey } from "@/data/sent";
import type { Desk } from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { Paper, ReplyNote } from "@/protos/cockpit/Inbox";
import {
  decisionsByCrew,
  isNews,
  lastReplies,
} from "@/protos/cockpit/inboxGroups";
import { AnswerList } from "./Answers";
import { DeskPanel } from "./DeskPanel";

/** 책상 기다림에서 온 Task인지(id desk:<crewId>:<waitId>) */
function fromDesk(t: Task): boolean {
  return t.id.startsWith("desk:");
}

/**
 * 할 일 판 배지: 이 승무원의 결재(decisionsByCrew, 조종석 결재함 "결재 n"과 같은 수) + 읽지 않은 답해 둔 것.
 * 책상 기다림은 `desk:` Task로 결재에 들어 있으니 desk.waiting을 따로 세지 않는다. 그래서 미룬 기다림·
 * 아직 Task가 오지 않은 기다림은 결재가 아니라 세지 않는다(2026-11-03, 전에는 desk.waiting.length를 세어
 * 조종석보다 많았다). 답해 둔 것은 읽음을 눌러 숨긴 것(read, src/data/sent.ts)은 빼고 센다.
 * read는 부르는 쪽이 useSent((s) => s.read)로 구독해 넘긴다. 그래야 읽음을 누르면 배지도 바로 다시 그려진다.
 * 정의: docs/crew-views.md "건수".
 */
export function crewTaskCount(
  crewId: string,
  desk: Desk | null,
  tasks: readonly Task[],
  read: Readonly<Record<string, true>>,
): number {
  const answers = (desk?.answers ?? []).filter(
    (a) => !read[readKey(crewId, a.id)],
  );
  const decisions = decisionsByCrew(tasks).get(crewId) ?? [];
  return decisions.length + answers.length;
}

export function CrewTasks({
  crewId,
  desk,
  tasks,
  now,
  off = false,
}: {
  crewId: string;
  desk: Desk | null;
  tasks: Task[];
  now: number;
  /** 세션이 꺼졌나. 닫을 때도 사용자가 정할 기다림은 책상에 남고(2026-11-09), 선실에서 단 답은 다시 열 때 들어간다. */
  off?: boolean;
}) {
  const others = tasks.filter((t) => !isNews(t) && !fromDesk(t));
  const reply = lastReplies(tasks).get(crewId);
  return (
    <div className="flex min-w-0 flex-col gap-5" data-crew-tasks>
      {off && desk?.waiting.length ? (
        <p className="text-[12.5px] text-white/50" data-crew-off-note>
          세션이 꺼져 있어요. 답은 다음에 세션을 열 때 전해져요.
        </p>
      ) : null}
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
