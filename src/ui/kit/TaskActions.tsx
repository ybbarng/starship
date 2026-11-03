"use client";

// 할 일 하나에 붙는 버튼들. 프로토콜의 actions에 있는 것만 보인다.
// 모양은 시안마다 다르게: renderButton으로 직접 그리거나 className으로 꾸민다.
// 보내는 동안에는 그 할 일의 단추를 모두 막는다(두 번 눌러 같은 동작이 두 번 가지 않게).
import { type ReactNode, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useAct } from "@/data/hooks";
import { deskSentKey, useSent } from "@/data/sent";
import type { ActionResult, Task, TaskAction } from "@/protocol/v1";
import { ACTION_LABEL } from "./labels";

export type TaskButton = {
  key: string;
  label: string;
  action: TaskAction;
  /** answer일 때 고른 선택지 */
  choice?: string;
  primary?: boolean;
  /** 이 할 일의 동작을 본부에 보내는 중. 단추에 disabled·aria-busy로 건다 */
  busy: boolean;
  onClick: () => void;
};

/** 버튼 목록만 만들어 준다. 선택지가 있으면 "답하기" 대신 선택지 버튼이 나온다. */
export function useTaskButtons(task: Task | undefined): {
  buttons: TaskButton[];
  answering: boolean;
  setAnswering: (v: boolean) => void;
  /** 보내는 중인지(이 할 일 하나 기준) */
  busy: boolean;
  /** 글로 쓴 답을 보낸다. 보내는 중이면 다시 보내지 않고 ok:false를 돌려준다 */
  sendAnswer: (text: string) => Promise<ActionResult>;
} {
  const act = useAct();
  const [answering, setAnswering] = useState(false);
  const [busy, setBusy] = useState(false);
  // 상태는 다음 그림에서야 바뀌어서, 빠르게 두 번 누르면 둘 다 지나간다. 그래서 ref로도 막는다.
  const sending = useRef(false);
  const run = async (
    fn: () => Promise<ActionResult>,
  ): Promise<ActionResult> => {
    if (sending.current) return { ok: false };
    sending.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const mark = useSent((s) => s.mark);
  // 책상 기다림에 답했으면 보낸 답을 남긴다: 세션이 책상을 고치기 전까지 선실 책상 카드가 "보냈어요"로 보이게
  const answer = async (t: Task, text: string): Promise<ActionResult> => {
    const result = await act.task(t, "answer", text);
    if (result.ok && t.id.startsWith("desk:")) mark(deskSentKey(t.id), text);
    return result;
  };
  const sendAnswer = (text: string) =>
    task ? run(() => answer(task, text)) : Promise.resolve({ ok: false });
  if (!task) return { buttons: [], answering, setAnswering, busy, sendAnswer };
  const out: TaskButton[] = [];
  for (const action of task.actions) {
    if (action === "answer") {
      if (task.choices?.length) {
        for (const [i, c] of task.choices.entries()) {
          out.push({
            // 같은 글의 선택지가 둘 와도 key가 겹치지 않게 순번을 붙인다
            key: `answer-${i}-${c}`,
            label: c,
            action,
            choice: c,
            primary: i === 0,
            busy,
            onClick: () => void run(() => answer(task, c)),
          });
        }
      } else {
        out.push({
          key: "answer",
          label: ACTION_LABEL.answer,
          action,
          busy,
          onClick: () => setAnswering(true),
        });
      }
      continue;
    }
    out.push({
      key: action,
      label: ACTION_LABEL[action],
      action,
      primary: action === "focus" && !task.choices?.length,
      busy,
      onClick: () => void run(() => act.task(task, action)),
    });
  }
  return { buttons: out, answering, setAnswering, busy, sendAnswer };
}

/** 기본 모양의 버튼 줄. 직접 답하기 입력칸도 함께 다룬다. */
export function TaskActions({
  task,
  className,
  buttonClassName,
  primaryClassName,
  renderButton,
}: {
  task: Task | undefined;
  className?: string;
  buttonClassName?: string;
  primaryClassName?: string;
  renderButton?: (b: TaskButton) => ReactNode;
}) {
  const { buttons, answering, setAnswering, busy, sendAnswer } =
    useTaskButtons(task);
  const [text, setText] = useState("");
  if (!task) return null;
  if (answering) {
    return (
      <form
        className={className}
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          const result = await sendAnswer(text.trim());
          // 본부가 받았을 때만 비우고 닫는다. 못 받았으면 쓴 글을 그대로 두어 다시 보낼 수 있게.
          if (!result.ok) return;
          setText("");
          setAnswering(false);
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: 답하기를 누른 직후 바로 쓰게
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="답을 적고 Enter"
          className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/50"
        />
        <button
          type="submit"
          className={buttonClassName}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "보내는 중…" : "보내기"}
        </button>
        <button
          type="button"
          className={buttonClassName}
          onClick={() => setAnswering(false)}
        >
          취소
        </button>
      </form>
    );
  }
  // renderButton으로 직접 그린 단추도 막히게, 보내는 동안은 fieldset disabled로 감싼다.
  return (
    <fieldset
      disabled={busy}
      aria-busy={busy}
      className={twMerge("min-w-0", className)}
    >
      {buttons.map((b) =>
        renderButton ? (
          renderButton(b)
        ) : (
          <button
            key={b.key}
            type="button"
            data-action={b.action}
            onClick={b.onClick}
            disabled={b.busy}
            aria-busy={b.busy}
            className={
              b.primary
                ? (primaryClassName ?? buttonClassName)
                : buttonClassName
            }
          >
            {b.label}
          </button>
        ),
      )}
    </fieldset>
  );
}
