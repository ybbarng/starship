"use client";

// 답해 둔 것: 물어본 것에 세션이 답했는데 이어서 다른 일을 해 대화에서 지나간 답(2026-11-02 사용자 요청).
// 결재함(그 승무원 묶음 맨 위)과 선실 "할 일"이 같이 쓴다. "읽음"을 누르면 서버가 책상에서 뺀다.
// 형식: src/protocol/desk.ts Answered, 뜻: docs/desk.md "답해 둔 것".
import { useState } from "react";
import { useAct } from "@/data/hooks";
import type { Answered } from "@/protocol/desk";
import { FileButtons } from "@/ui/kit/FileButtons";
import { findPaths } from "@/ui/kit/filePaths";
import { agoLabel } from "@/ui/map/labels";

export function AnswerList({
  crewId,
  answers,
  now,
}: {
  crewId: string;
  answers: Answered[];
  now: number;
}) {
  // 읽음을 누르면 서버 답을 기다리지 않고 바로 접는다
  const [read, setRead] = useState<Set<string>>(new Set());
  const shown = answers
    .filter((a) => !read.has(a.id))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!shown.length) return null;
  return (
    <section data-answers className="flex flex-col gap-2">
      <h3 className="text-[10.5px] font-semibold tracking-[0.18em] text-[#7ce0ff]/70">
        답해 둔 것 {shown.length}
      </h3>
      <ul className="flex flex-col gap-2">
        {shown.map((a) => (
          <AnswerCard
            key={a.id}
            crewId={crewId}
            answer={a}
            now={now}
            onRead={() => setRead((s) => new Set(s).add(a.id))}
          />
        ))}
      </ul>
    </section>
  );
}

function AnswerCard({
  crewId,
  answer,
  now,
  onRead,
}: {
  crewId: string;
  answer: Answered;
  now: number;
  onRead: () => void;
}) {
  const act = useAct();
  const [open, setOpen] = useState(false);
  const long = answer.a.length > 240 || answer.a.split("\n").length > 5;
  const files = findPaths(answer.a);
  return (
    <li
      data-answer={answer.id}
      className="rounded-lg border border-[#7ce0ff]/20 bg-[#7ce0ff]/[0.04] px-3 py-2"
    >
      <div className="flex items-baseline gap-2 text-[11px] text-white/45">
        <span className="font-semibold text-[#7ce0ff]/80">물어본 것</span>
        <span className="ml-auto shrink-0">
          {agoLabel(Date.parse(answer.at), now)}
        </span>
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-white/90">
        {answer.q}
      </div>
      <p
        className={`mt-1 text-[12.5px] leading-relaxed whitespace-pre-line text-white/75 ${long && !open ? "line-clamp-5" : ""}`}
      >
        {answer.a}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] text-[#7ce0ff]/80 hover:text-[#7ce0ff]"
        >
          {open ? "접기" : "전부 보기"}
        </button>
      )}
      {files.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {files.map((p) => (
            <FileButtons key={p} path={p} />
          ))}
        </div>
      )}
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          data-answer-read
          onClick={() => {
            onRead();
            act.answerRead(crewId, answer.id);
          }}
          className="rounded border border-white/15 px-2 py-0.5 text-[11.5px] text-white/70 hover:bg-white/10 hover:text-white"
        >
          읽음
        </button>
      </div>
    </li>
  );
}
