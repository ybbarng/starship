"use client";

// 조종석 결재함(2026-11-02, '지금 할 일' 한 장을 대신함). 묶는 규칙은 inboxGroups.ts, 설계는 docs/cockpit-inbox.md.
//   왼쪽 = 승무원 목차: 기다리는 일이 있는 승무원(건수·가장 오래 기다린 시간·지금 하는 일), 그 아래 나머지 승무원
//   가운데 = 고른 승무원의 결재 서류: 제목 전체·세부·선택지를 모두 펼치고 그 자리에서 처리
import Link from "next/link";
import { useState } from "react";
import type { Context, Crew, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  elapsed,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import { FileButtons } from "@/ui/kit/FileButtons";
import { findPaths } from "@/ui/kit/filePaths";
import styles from "./cockpit.module.css";
import { type InboxGroup, LOOSE_KEY, STALE_MS } from "./inboxGroups";
import { CrewLamp, MapBadge, sortCrew } from "./Panel";
import { ContextTag, KEY_SMALL } from "./parts";

const LATE_MS = 3600_000;

function groupName(g: InboxGroup): string {
  return g.key === LOOSE_KEY ? "새 일" : (g.crew?.name ?? g.key);
}

function groupContext(g: InboxGroup): Context {
  return g.crew?.context ?? g.tasks[0]?.context ?? "work";
}

function ageTone(since: number, now: number): string {
  const d = now - since;
  return d > STALE_MS
    ? "text-[#ff8a7a]"
    : d > LATE_MS
      ? "text-[#ffd84a]"
      : "text-white/45";
}

/* ───────────── 왼쪽: 승무원 목차 ───────────── */

export function InboxIndex({
  groups,
  selected,
  crew,
  now,
  onSelect,
  onCrew,
}: {
  groups: InboxGroup[];
  selected: string | undefined;
  crew: Crew[];
  now: number;
  onSelect: (key: string) => void;
  onCrew: (id: string) => void;
}) {
  const busy = new Set(groups.map((g) => g.key));
  const others = sortCrew(crew.filter((c) => !busy.has(c.id)));
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  return (
    <section
      aria-label="승무원 결재 목차"
      data-inbox-index
      className={`${styles.bay} flex h-full min-h-0 flex-col gap-1.5 overflow-hidden rounded-lg px-2 pt-2 pb-2`}
    >
      <div className="flex items-center gap-2 px-0.5 text-[9.5px] font-semibold tracking-[0.22em] text-white/35">
        <span>승무원</span>
        <span className="h-px flex-1 bg-white/[0.07]" />
        <span className="tracking-normal text-white/45">
          결재 {total} · {groups.length}곳
        </span>
      </div>
      <div
        data-scroll-inside
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin]"
      >
        <ul className="space-y-[3px]">
          {groups.map((g) => {
            const on = g.key === selected;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  data-inbox-group={g.key}
                  aria-pressed={on}
                  onClick={() => onSelect(g.key)}
                  className={`relative block w-full rounded-md px-2 py-1.5 text-left transition ${
                    on
                      ? "bg-[#7fb8ff]/[0.13] shadow-[inset_2px_0_0_#7fb8ff]"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
                    {g.crew ? (
                      <CrewLamp status={g.crew.status} />
                    ) : (
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full border border-dashed border-white/40" />
                    )}
                    <span
                      className="h-2.5 w-[3px] shrink-0 rounded-sm"
                      style={{ background: CONTEXT_COLOR[groupContext(g)] }}
                    />
                    <span
                      className={`truncate font-semibold ${on ? "text-white" : "text-white/85"}`}
                    >
                      {groupName(g)}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-[#ffd84a] px-1.5 text-[10.5px] leading-[15px] font-bold text-hull-950 tabular-nums">
                      {g.tasks.length}
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[19px] text-[10.5px]">
                    <span className="min-w-0 flex-1 truncate text-white/40">
                      {g.key === LOOSE_KEY
                        ? "감시·알림·리뷰 등 승무원 없이 온 일"
                        : (g.crew?.activity ?? "")}
                    </span>
                    {g.stale > 0 && (
                      <span className="shrink-0 text-[#ff8a7a]">
                        묵음 {g.stale}
                      </span>
                    )}
                    <span
                      className={`shrink-0 font-mono tabular-nums ${ageTone(g.oldest, now)}`}
                    >
                      {ago(g.oldest, now)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {groups.length === 0 && (
            <li className="px-2 py-3 text-[12px] text-white/40">
              결재할 것이 없어요. 순항 중.
            </li>
          )}
        </ul>
        {others.length > 0 && (
          <>
            <div className="mt-2 mb-1 px-1 text-[10px] text-white/30">
              나머지 승무원 {others.length}
            </div>
            <div className="grid grid-cols-2 gap-x-1 gap-y-[2px]">
              {others.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-crew-lamp={c.id}
                  data-status={c.status}
                  title={`${c.name} · ${c.activity ?? ""}`}
                  onClick={() => onCrew(c.id)}
                  className={`relative flex min-w-0 items-center gap-1.5 rounded px-1.5 py-[3px] text-left text-[11px] transition hover:bg-white/[0.07] ${
                    c.status === "off" ? "text-white/35" : "text-white/65"
                  }`}
                >
                  <CrewLamp status={c.status} />
                  <span className="truncate">{c.name}</span>
                  <MapBadge crew={c} compact />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ───────────── 가운데: 결재 서류 ───────────── */

export function InboxSheet({
  group,
  reply,
  now,
  onCrew,
}: {
  group: InboxGroup | undefined;
  /** 이 승무원의 마지막 답변(소식). 결재가 아니라 맨 아래에 접어 둔다. */
  reply?: Task;
  now: number;
  onCrew: (id: string) => void;
}) {
  return (
    <div className="relative flex h-full min-w-0 flex-col rounded-xl bg-[#07090d] p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_8px_22px_rgba(0,0,0,0.55)]">
      <div
        className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[9px] ${styles.screen}`}
        data-inbox-sheet={group?.key ?? "none"}
      >
        {group ? (
          <>
            <SheetHeader group={group} now={now} onCrew={onCrew} />
            <ul
              key={group.key}
              data-scroll-inside
              className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pt-2 pb-3 [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin] ${styles.swap}`}
            >
              {group.tasks.map((t) => (
                <Paper
                  key={t.id}
                  task={t}
                  now={now}
                  showFrom={t.from !== groupName(group)}
                  showContext={group.key === LOOSE_KEY}
                />
              ))}
              {reply && <ReplyNote key={reply.id} task={reply} now={now} />}
            </ul>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="h-3.5 w-3.5 rounded-full bg-[#5ee08a] shadow-[0_0_16px_#5ee08a]" />
            <div className="text-[24px] font-semibold text-white">순항 중</div>
            <div className="text-[13px] text-white/45">
              결재할 것이 없어요. 승무원이 부르면 여기 쌓여요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SheetHeader({
  group,
  now,
  onCrew,
}: {
  group: InboxGroup;
  now: number;
  onCrew: (id: string) => void;
}) {
  const c = group.crew;
  const m = c?.map;
  const about = c
    ? [
        c.activity && `지금: ${c.activity}`,
        m &&
          `지도 ${Math.round(m.progress * 100)}%${m.forksForMe ? ` · 내가 정할 갈림길 ${m.forksForMe}` : ""}`,
        c.desk?.doing && `하는 일 ${c.desk.doing}`,
      ]
        .filter(Boolean)
        .join(" · ") || CONTEXT_LABEL[c.context]
    : "승무원 없이 온 일이에요(감시·알림·리뷰). 하나씩 보고 치우거나 원래 자리로 가요.";
  return (
    <header className="shrink-0 border-b border-white/[0.07] px-4 pt-2.5 pb-2">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-[0.24em] text-[#7fb8ff]/70">
        <span>결재함</span>
        <span className="h-px flex-1 bg-[#7fb8ff]/15" />
        <span className="font-mono tracking-normal text-white/45 tabular-nums">
          {group.tasks.length}건 · 가장 오래 {elapsed(group.oldest, now)}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {c && <ContextTag context={c.context} />}
        <h2 className="truncate text-[19px] font-semibold text-white">
          {groupName(group)}
        </h2>
        {c && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[11.5px]">
            <button
              type="button"
              onClick={() => onCrew(c.id)}
              className="rounded px-1.5 py-0.5 text-white/55 hover:bg-white/10 hover:text-white"
            >
              승무원 정보
            </button>
            <Link
              href={`/crew/${encodeURIComponent(c.id)}`}
              data-cabin-link={c.id}
              className="rounded px-1.5 py-0.5 text-white/55 hover:bg-white/10 hover:text-white"
            >
              선실로 →
            </Link>
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[12px] text-white/45" title={about}>
        {about}
      </p>
    </header>
  );
}

/** 마지막 답변: 터미널에서 이미 읽었을 수 있어 한 줄로 접어 두고, 펼치면 서류처럼 답할 수 있다. */
function ReplyNote({ task, now }: { task: Task; now: number }) {
  const [open, setOpen] = useState(false);
  if (open)
    return <Paper task={task} now={now} showFrom={false} showContext={false} />;
  return (
    <li data-inbox-reply={task.id}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11.5px] text-white/40 hover:bg-white/[0.05] hover:text-white/65"
      >
        <span className="shrink-0">마지막 답변 · {ago(task.since, now)}</span>
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
        <span className="shrink-0 text-[#7fb8ff]/70">펼치기</span>
      </button>
    </li>
  );
}

/** 결재 서류 한 장: 무엇을·언제부터·전문·단추. 세부가 길면 접어 두고 펼친다. */
function Paper({
  task,
  now,
  showFrom,
  showContext,
}: {
  task: Task;
  now: number;
  showFrom: boolean;
  /** 승무원 없이 온 묶음은 업무·개인이 섞여서 서류마다 꼬리표를 단다 */
  showContext: boolean;
}) {
  const [open, setOpen] = useState(false);
  const long =
    (task.detail?.length ?? 0) > 220 ||
    (task.detail?.split("\n").length ?? 0) > 4;
  const stale = now - task.since > STALE_MS;
  // 제목·세부에 적힌 이 맥의 파일 경로는 그 자리에서 보기·열기(2026-11-02 사용자 요청)
  const files = findPaths(`${task.title}\n${task.detail ?? ""}`);
  return (
    <li
      data-inbox-item={task.id}
      className={`rounded-lg border px-3 pt-2 pb-2.5 ${
        stale
          ? "border-[#ff8a7a]/25 bg-[#ff8a7a]/[0.035]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/50">
        {showContext && <ContextTag context={task.context} />}
        <span className="font-semibold text-white/75">
          {KIND_LABEL[task.kind]}
        </span>
        {showFrom && <span className="truncate">· {task.from}</span>}
        <span className="truncate text-white/35">
          · {sourceLabel(task.source)}
        </span>
        <span
          className={`ml-auto shrink-0 font-mono tabular-nums ${ageTone(task.since, now)}`}
        >
          {stale && "묵음 · "}
          {elapsed(task.since, now)} 기다림
        </span>
      </div>
      <h3 className="mt-1 text-[15px] leading-snug font-semibold whitespace-pre-line text-white">
        {task.title}
      </h3>
      {task.detail && (
        <>
          <p
            className={`mt-1 text-[12.5px] leading-relaxed whitespace-pre-line text-white/55 ${long && !open ? "line-clamp-4" : ""}`}
          >
            {task.detail}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-0.5 text-[11px] text-[#7fb8ff]/80 hover:text-[#7fb8ff]"
            >
              {open ? "접기" : "전부 보기"}
            </button>
          )}
        </>
      )}
      {files.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" data-paper-files>
          {files.map((p) => (
            <FileButtons key={p} path={p} />
          ))}
        </div>
      )}
      <TaskActions
        task={task}
        className="mt-2 flex flex-wrap items-center gap-1.5"
        buttonClassName={KEY_SMALL}
        renderButton={(b) => (
          <button
            key={b.key}
            type="button"
            data-action={b.action}
            onClick={b.onClick}
            className={`${KEY_SMALL} ${
              b.action === "answer" && b.choice
                ? styles.keyChoice
                : b.primary
                  ? styles.keyPrimary
                  : ""
            }`}
          >
            {b.label}
          </button>
        )}
      />
    </li>
  );
}
