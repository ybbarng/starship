// 책상 기다림 카드 아래쪽에 무엇을 보일지(2026-11-03). 화면 없이 시험하려고 DeskPanel에서 뺐다.
//   sent    : 답을 보냈다 → "“답” 보냈어요"
//   snoozed : 1시간 미뤘다 → "1시간 뒤로 미뤘어요 · n분 뒤 다시 와요", 답 단추는 막는다
//   open    : 할 일(Task)이 있어 답할 수 있다
//   none    : 할 일이 아직 안 왔다 → "아직 답할 수 없어요"
// 미루면 본부가 할 일을 잠시 빼지만 책상 기다림은 남는다. 그 사이 "아직 답할 수 없어요"가 뜨지 않게
// 미룬 때를 src/data/sent.ts에 남겨 두고 이것으로 고른다.

export type WaitAnswerState = "sent" | "snoozed" | "open" | "none";

export function waitAnswerState({
  sent,
  canAnswer,
  snoozedUntil,
  now,
}: {
  /** 보낸 답(없으면 undefined) */
  sent: string | undefined;
  /** 할 일(Task)에 answer 동작이 있는지 */
  canAnswer: boolean;
  /** 미뤄 둔 끝(Unix 밀리초, 미루지 않았으면 undefined) */
  snoozedUntil: number | undefined;
  now: number;
}): WaitAnswerState {
  if (sent !== undefined) return "sent";
  if (snoozedUntil !== undefined) {
    // 미룬 시간이 아직 남았으면 할 일이 화면에 남아 있어도(다시 읽기 전) 미룬 것으로 본다.
    // 시간이 지났는데 할 일이 아직 안 돌아왔으면 "곧 다시 와요"로 둔다
    if (snoozedUntil > now || !canAnswer) return "snoozed";
  }
  return canAnswer ? "open" : "none";
}

/** "1시간 뒤로 미뤘어요 · 42분 뒤 다시 와요". 남은 시간이 1분 안쪽이거나 지났으면 "곧 다시 와요" */
export function snoozeNote(until: number, now: number): string {
  const mins = Math.ceil((until - now) / 60_000);
  const left =
    mins <= 1
      ? "곧 다시 와요"
      : mins < 60
        ? `${mins}분 뒤 다시 와요`
        : `${Math.floor(mins / 60)}시간 ${mins % 60 ? `${mins % 60}분 ` : ""}뒤 다시 와요`;
  return `1시간 뒤로 미뤘어요 · ${left}`;
}
