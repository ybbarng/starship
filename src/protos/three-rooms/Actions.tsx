"use client";

// 할 일 버튼 줄. 프로토콜 actions에 있는 것만(useTaskButtons). 치우는 동작이면 항로 칸을 걸어 둔다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
import type { Task } from "@/protocol/v1";
import { useTaskButtons } from "@/ui/kit";
import { clears, useRoute } from "./route";

const BTN =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition active:scale-95 whitespace-nowrap";
const PRIMARY = `${BTN} border-amber-300/70 bg-amber-300 text-hull-950 hover:bg-amber-200`;
const NORMAL = `${BTN} border-white/15 bg-white/8 text-white/90 hover:border-white/40 hover:bg-white/15`;
const CLEAR = `${BTN} border-emerald-300/50 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25`;

export function ActionRow({
  task,
  size = "md",
  className = "",
}: {
  task: Task | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const act = useAct();
  const expect = useRoute((s) => s.expect);
  const { buttons, answering, setAnswering } = useTaskButtons(task);
  const [text, setText] = useState("");
  if (!task) return null;
  const small = size === "sm" ? " !px-2.5 !py-1 !text-xs" : "";
  if (answering) {
    return (
      <form
        className={`flex items-center gap-1.5 ${className}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          expect(task.id);
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
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-300/70"
        />
        <button type="submit" className={PRIMARY + small}>
          보내기
        </button>
        <button
          type="button"
          className={NORMAL + small}
          onClick={() => setAnswering(false)}
        >
          취소
        </button>
      </form>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          data-action={b.action}
          onClick={() => {
            // 글로 답하기는 입력칸이 열릴 뿐이라 보낼 때 건다
            const opensForm = b.action === "answer" && b.choice === undefined;
            if (clears(b.action) && !opensForm) expect(task.id);
            b.onClick();
          }}
          className={
            (b.primary ? PRIMARY : b.action === "dismiss" ? CLEAR : NORMAL) +
            small
          }
        >
          {b.action === "dismiss" ? `✓ ${b.label}` : b.label}
        </button>
      ))}
    </div>
  );
}
