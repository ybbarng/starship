"use client";

// 선실 오른쪽 판의 책상: 세션이 나를 기다리는 것(카드)과 지금 하는 일. 설계: docs/desk.md.
// 답은 책상이 아니라 같은 기다림의 Task(id desk:<crewId>:<waitId>)에 answer로 보낸다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
import {
  type Desk,
  deskAnswer,
  deskTaskId,
  type Waiting,
  type WaitType,
} from "@/protocol/desk";
import type { Task } from "@/protocol/v1";
import { FileButtons } from "@/ui/kit/FileButtons";
import { agoLabel } from "@/ui/map/labels";
import { waitFiles } from "./waitFiles";

export const WAIT_LABEL: Record<WaitType, string> = {
  decide: "고르기",
  check: "확인",
  approve: "승인",
  answer: "답하기",
};

const WAIT_COLOR: Record<WaitType, string> = {
  decide: "#ffd84a",
  check: "#7ce0ff",
  approve: "#ff9f5c",
  answer: "#c8a8ff",
};

export function DeskPanel({
  crewId,
  desk,
  tasks,
  now,
}: {
  crewId: string;
  desk: Desk;
  /** 이 승무원의 할 일. 기다림마다 같은 id의 Task를 찾아 답한다. */
  tasks: Task[];
  now: number;
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const updated = Date.parse(desk.updatedAt);
  return (
    <div data-desk className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
          나를 기다리는 것 {desk.waiting.length}
        </h3>
        <span className="text-[11px] text-white/35">
          책상 갱신 {agoLabel(updated, now)}
        </span>
      </div>
      {desk.waiting.length ? (
        desk.waiting.map((w) => (
          <WaitCard
            key={w.id}
            wait={w}
            task={byId.get(deskTaskId(crewId, w.id))}
            now={now}
          />
        ))
      ) : (
        <p className="text-white/40">없어요. 세션이 혼자 일하는 중이에요.</p>
      )}

      <h3 className="mt-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/35">
        지금 하는 일 {desk.doing.length}
      </h3>
      {desk.doing.length ? (
        <ul data-desk-doing className="flex flex-col gap-1">
          {desk.doing.map((d, i) => (
            <li
              key={d.id ?? i}
              className="flex items-baseline gap-2 text-white/75"
            >
              <span className="inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] animate-pulse rounded-full bg-[#5ee08a]" />
              <span className="min-w-0 flex-1">
                {d.title}
                {d.approved && (
                  <span
                    data-desk-approved
                    className="mt-0.5 block text-[11.5px] whitespace-pre-line text-white/45"
                  >
                    승인받은 것 · {d.approved}
                  </span>
                )}
              </span>
              {d.since && (
                <span className="shrink-0 text-[11px] text-white/35">
                  {agoLabel(Date.parse(d.since), now)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/40">적힌 일이 없어요</p>
      )}
    </div>
  );
}

function WaitCard({
  wait,
  task,
  now,
}: {
  wait: Waiting;
  task?: Task;
  now: number;
}) {
  const act = useAct();
  const [text, setText] = useState("");
  const color = WAIT_COLOR[wait.type];
  // path가 없으면 글 속 경로에도 보기·열기를 붙인다(2026-11-03). 고르는 규칙: waitFiles.ts
  const files = waitFiles(wait);
  const canAnswer = task?.actions.includes("answer") ?? false;
  const send = (choice?: string) => {
    const answer = deskAnswer(choice, text);
    if (!task || !answer) return;
    act.task(task, "answer", answer);
    setText("");
  };
  const choiceButton = (label: string, primary = false) => (
    <button
      key={label}
      type="button"
      disabled={!canAnswer || act.pending}
      onClick={() => send(label)}
      className={`rounded px-2.5 py-1 text-[12px] font-semibold disabled:opacity-40 ${
        primary
          ? "bg-white/90 text-hull-950 hover:bg-white"
          : "bg-white/[0.08] text-white/85 hover:bg-white/[0.14]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <article
      data-wait={wait.type}
      className="rounded-md border border-white/[0.08] bg-white/[0.03]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold" style={{ color }}>
            {WAIT_LABEL[wait.type]}
          </span>
          {wait.blocks && (
            <span
              data-wait-blocks
              className="rounded bg-[#ff6b6b]/15 px-1.5 py-px font-semibold text-[#ff9f9f]"
              title="세션이 이 답을 기다리며 멈춰 있어요"
            >
              세션 멈춤
            </span>
          )}
          {wait.since && (
            <span className="ml-auto text-white/35">
              {agoLabel(Date.parse(wait.since), now)}부터
            </span>
          )}
        </div>
        <div className="leading-snug font-semibold text-white/90">
          {wait.title}
        </div>
        {wait.detail && (
          <p className="text-[12px] leading-relaxed text-white/55">
            {wait.detail}
          </p>
        )}
        {files.detail.length > 0 && <FileList paths={files.detail} />}

        {wait.type === "decide" && (
          <ul className="flex flex-col gap-1.5">
            {(wait.options ?? []).map((o, i) => (
              <li
                key={o.id}
                data-option={o.id}
                className={`rounded border px-2.5 py-2 ${
                  o.recommended
                    ? "border-[#ffd84a]/40 bg-[#ffd84a]/[0.06]"
                    : "border-white/[0.08]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-white/85">
                    {o.label}
                  </span>
                  {o.recommended && (
                    <span className="shrink-0 text-[11px] font-semibold text-[#ffd84a]">
                      ★ 추천
                    </span>
                  )}
                </div>
                {o.note && (
                  <div className="mt-0.5 text-[11.5px] text-white/50">
                    {o.note}
                  </div>
                )}
                {(files.options[i] ?? []).length > 0 && (
                  <FileList paths={files.options[i] ?? []} className="mt-1.5" />
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  {o.url && <OpenLink href={o.url}>데모 열기</OpenLink>}
                  <span className="ml-auto">
                    {choiceButton(o.label, o.recommended)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {wait.type === "check" && (
          <ol className="flex list-inside list-decimal flex-col gap-1.5 text-white/80">
            {(wait.items ?? []).map((it, i) => (
              <li key={`${it.label}|${it.url ?? ""}`} data-check-item>
                {it.url ? (
                  <OpenLink href={it.url}>{it.label}</OpenLink>
                ) : (
                  it.label
                )}
                {(files.items[i] ?? []).map((p) => (
                  <span key={p} className="ml-2 inline-flex align-baseline">
                    <FileButtons path={p} />
                  </span>
                ))}
                {it.look && (
                  <div className="pl-4 text-[11.5px] text-white/50">
                    보실 점 · {it.look}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {canAnswer ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={wait.type === "answer" ? 2 : 1}
              placeholder={
                wait.type === "answer" ? "답을 적어 주세요" : "덧붙일 말(선택)"
              }
              className="resize-none rounded border border-white/[0.1] bg-black/30 px-2 py-1 text-[12.5px] text-white/90 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {wait.type === "check" && [
                choiceButton("확인함", true),
                choiceButton("고칠 것 있음"),
              ]}
              {wait.type === "approve" && [
                choiceButton("승인", true),
                choiceButton("보류"),
              ]}
              {wait.type === "answer" && (
                <button
                  type="button"
                  disabled={!text.trim() || act.pending}
                  onClick={() => send()}
                  className="rounded bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-hull-950 hover:bg-white disabled:opacity-40"
                >
                  보내기
                </button>
              )}
              {task?.actions.includes("snooze") && (
                <button
                  type="button"
                  disabled={act.pending}
                  onClick={() => task && act.task(task, "snooze")}
                  className="ml-auto rounded px-2 py-1 text-[11.5px] text-white/45 hover:bg-white/[0.06] hover:text-white/75"
                >
                  1시간 미루기
                </button>
              )}
            </div>
          </div>
        ) : (
          <p data-wait-noanswer className="text-[11.5px] text-white/40">
            아직 답할 수 없어요(할 일이 아직 안 왔어요)
          </p>
        )}

        {wait.after && (
          <p className="border-t border-white/[0.06] pt-1.5 text-[11.5px] text-white/50">
            <span className="text-white/35">답하면 · </span>
            {wait.after}
          </p>
        )}
      </div>
    </article>
  );
}

/** 경로 여러 개의 보기·열기 단추를 줄 바꿈하며 늘어놓는다 */
function FileList({
  paths,
  className = "",
}: {
  paths: string[];
  className?: string;
}) {
  return (
    <div
      data-wait-files
      className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}
    >
      {paths.map((p) => (
        <FileButtons key={p} path={p} />
      ))}
    </div>
  );
}

function OpenLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[12px] text-[#7ce0ff] underline-offset-2 hover:underline"
    >
      {children} ↗
    </a>
  );
}
