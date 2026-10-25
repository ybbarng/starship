"use client";

// 할 일 하나에 붙는 버튼들. 프로토콜의 actions에 있는 것만 보인다.
// 모양은 시안마다 다르게: renderButton으로 직접 그리거나 className으로 꾸민다.
import { type ReactNode, useState } from "react";
import { useAct } from "@/data/hooks";
import type { Task, TaskAction } from "@/protocol/v1";
import { ACTION_LABEL } from "./labels";

export type TaskButton = {
  key: string;
  label: string;
  action: TaskAction;
  /** answer일 때 고른 선택지 */
  choice?: string;
  primary?: boolean;
  onClick: () => void;
};

/** 버튼 목록만 만들어 준다. 선택지가 있으면 "답하기" 대신 선택지 버튼이 나온다. */
export function useTaskButtons(task: Task | undefined): {
  buttons: TaskButton[];
  answering: boolean;
  setAnswering: (v: boolean) => void;
} {
  const act = useAct();
  const [answering, setAnswering] = useState(false);
  if (!task) return { buttons: [], answering, setAnswering };
  const out: TaskButton[] = [];
  for (const action of task.actions) {
    if (action === "answer") {
      if (task.choices?.length) {
        for (const [i, c] of task.choices.entries()) {
          out.push({
            key: `answer-${c}`,
            label: c,
            action,
            choice: c,
            primary: i === 0,
            onClick: () => act.task(task, "answer", c),
          });
        }
      } else {
        out.push({
          key: "answer",
          label: ACTION_LABEL.answer,
          action,
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
      onClick: () => act.task(task, action),
    });
  }
  return { buttons: out, answering, setAnswering };
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
  const act = useAct();
  const { buttons, answering, setAnswering } = useTaskButtons(task);
  const [text, setText] = useState("");
  if (!task) return null;
  if (answering) {
    return (
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          act.task(task, "answer", text.trim());
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
        <button type="submit" className={buttonClassName}>
          보내기
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
  return (
    <div className={className}>
      {buttons.map((b) =>
        renderButton ? (
          renderButton(b)
        ) : (
          <button
            key={b.key}
            type="button"
            data-action={b.action}
            onClick={b.onClick}
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
    </div>
  );
}
