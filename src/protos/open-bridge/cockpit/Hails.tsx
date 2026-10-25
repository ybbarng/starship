"use client";

import type { Hail, Task } from "@/protocol/v1";
// 교신: 사람이 부르면 오른쪽 가장자리에 작은 칩이 조용히 숨 쉰다(보낸 이 · 한 줄).
// 칩을 누르면 "교신 수신 중" 화상 창(1차 정석 조종석의 출처별 함교 그림)이 오른쪽에 열리고,
// 거기서 할 일 버튼으로 답한다. 여러 통이면 창 안에서 넘긴다.
import { BridgeScene } from "@/protos/classic/Bridges";
import { BRIDGE_NAME, bridgeOf, initialOf } from "@/protos/classic/util";
import { useTelemetry } from "@/sky/useTelemetry";
import {
  ACTION_LABEL,
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import styles from "./cockpit.module.css";
import { BTN, BTN_PRIMARY } from "./Tasks";
import { GLASS, lightTime, selecting } from "./ui";

const MAX_CHIPS = 4;

export function HailChips({
  hails,
  seen,
  now,
  onOpen,
}: {
  hails: Hail[];
  seen: Set<string>;
  now: number;
  onOpen: (id: string) => void;
}) {
  if (!hails.length) return null;
  const shown = hails.slice(0, MAX_CHIPS);
  const more = hails.length - shown.length;
  return (
    <div className="flex flex-col items-end gap-1.5">
      {shown.map((h) => {
        const fresh = !seen.has(h.id);
        return (
          // biome-ignore lint/a11y/useSemanticElements: 글을 드래그해 고를 수 있게 div
          <div
            key={h.id}
            role="button"
            tabIndex={0}
            data-hail-chip={h.id}
            onClick={() => !selecting() && onOpen(h.id)}
            onKeyDown={(e) => e.key === "Enter" && onOpen(h.id)}
            className={`${GLASS} ${styles.slideIn} group flex w-[232px] cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 transition hover:border-white/25`}
          >
            <span
              className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${fresh ? `bg-[#ffc478] ${styles.breathe}` : "bg-white/30"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1 text-[11px]">
                <span
                  className={
                    fresh ? "font-medium text-white/90" : "text-white/60"
                  }
                >
                  {h.from.name}
                </span>
                <span className="truncate text-white/35">
                  · {sourceLabel(h.source)}
                </span>
                <span className="ml-auto shrink-0 font-mono tabular-nums text-white/35">
                  {ago(h.since, now)}
                </span>
              </span>
              <span
                className={`block truncate text-[11.5px] ${fresh ? "text-white/80" : "text-white/50"}`}
              >
                {h.line}
              </span>
            </span>
          </div>
        );
      })}
      {more > 0 && (
        <button
          type="button"
          onClick={() => onOpen(hails[MAX_CHIPS]?.id ?? "")}
          className="pointer-events-auto rounded px-2 text-[11px] text-white/45 hover:text-white"
        >
          교신 {more}통 더
        </button>
      )}
    </div>
  );
}

export function HailScreen({
  hail,
  task,
  index,
  count,
  now,
  onStep,
  onClose,
}: {
  hail: Hail;
  task: Task | undefined;
  index: number;
  count: number;
  now: number;
  onStep: (d: number) => void;
  onClose: () => void;
}) {
  const bridge = bridgeOf(hail.source);
  const service = sourceLabel(hail.source);
  const { earthKm } = useTelemetry(2);
  return (
    <section
      key={hail.id}
      aria-label={`교신: ${hail.from.name}`}
      data-hail-screen={hail.id}
      className={`${GLASS} ${styles.tuneIn} w-[360px] overflow-hidden`}
    >
      <header className="flex items-center gap-2 px-3 py-2 text-[11px]">
        <span
          className={`h-1.5 w-1.5 rounded-full bg-[#ff6b6b] shadow-[0_0_6px_#ff6b6b] ${styles.blink}`}
        />
        <span className="font-semibold tracking-wide text-white/90">
          교신 수신 중
        </span>
        <span className="truncate text-white/40">· {BRIDGE_NAME[bridge]}</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-white/50">
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label="이전 교신"
                className="rounded px-1.5 hover:bg-white/10 hover:text-white"
              >
                ◂
              </button>
              <span className="font-mono tabular-nums">
                {index + 1}/{count}
              </span>
              <button
                type="button"
                onClick={() => onStep(1)}
                aria-label="다음 교신"
                className="rounded px-1.5 hover:bg-white/10 hover:text-white"
              >
                ▸
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="교신 창 닫기"
            className="ml-1 rounded px-1.5 text-white/55 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </span>
      </header>

      <div className="relative mx-2.5 h-[150px] overflow-hidden rounded-lg border border-white/[0.08] bg-black">
        <BridgeScene bridge={bridge} initial={initialOf(hail.from.name)} />
        <div
          className={`pointer-events-none absolute inset-0 ${styles.scan}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,.55))]" />
        <div className="absolute top-1.5 left-2 rounded bg-black/55 px-1.5 py-px text-[10px] text-white/80">
          {service}
          {hail.from.where && hail.from.where !== service
            ? ` · ${hail.from.where}`
            : ""}
        </div>
        <div
          className="absolute top-1.5 right-2 rounded bg-black/55 px-1.5 py-px font-mono text-[10px] tabular-nums text-white/65"
          title="지구까지 빛이 가는 시간"
        >
          지연 {lightTime(earthKm)}
        </div>
        <div
          className="absolute right-2 bottom-1.5 flex items-end gap-[2px]"
          aria-hidden
        >
          {[4, 7, 10, 13].map((h) => (
            <span
              key={h}
              className="w-[3px] rounded-sm bg-[#7dffb0]/80"
              style={{ height: h }}
            />
          ))}
        </div>
      </div>

      <div className="px-3.5 pt-2.5 pb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: CONTEXT_COLOR[hail.context] }}
          />
          <span style={{ color: CONTEXT_COLOR[hail.context] }}>
            {CONTEXT_LABEL[hail.context]}
          </span>
          <span className="font-semibold text-white/90">{hail.from.name}</span>
          <span className="truncate">· {hail.from.where ?? service}</span>
          <span className="ml-auto shrink-0 font-mono tabular-nums text-[#ffd98a]/80">
            {ago(hail.since, now)}째
          </span>
        </div>
        <p className="mt-1.5 text-[15px] leading-snug font-medium text-white">
          “{hail.line}”
        </p>
        {task?.detail && (
          <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-white/50">
            {task.detail}
          </p>
        )}
        {task ? (
          <TaskActions
            task={task}
            className="mt-3 flex flex-wrap gap-1.5"
            buttonClassName={BTN}
            primaryClassName={BTN_PRIMARY}
            renderButton={(b) => (
              <button
                key={b.key}
                type="button"
                data-action={b.action}
                data-hail-action
                onClick={b.onClick}
                className={b.primary ? BTN_PRIMARY : BTN}
              >
                {b.action === "focus" ? "응답하러 가기" : b.label}
              </button>
            )}
          />
        ) : hail.url ? (
          <a
            href={hail.url}
            target="_blank"
            rel="noopener"
            className={`${BTN_PRIMARY} mt-3 inline-block`}
          >
            {ACTION_LABEL.focus}
          </a>
        ) : null}
      </div>
    </section>
  );
}
