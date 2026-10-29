"use client";

// 교신 화상 창: 사람이 부르면 앞 유리 오른쪽 위에 열린다.
// 출처마다 다른 함교 그림 + 보낸 사람 · 한 줄 · 기다린 시간 + 응답(창으로 가기) · 1시간 뒤 · 치우기.
import type { Hail, Task } from "@/protocol/v1";
import {
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  elapsed,
  sourceLabel,
  useTaskButtons,
} from "@/ui/kit";
import { BridgeScene } from "./Bridges";
import styles from "./classic.module.css";
import { BRIDGE_NAME, bridgeOf, initialOf } from "./util";

const HAIL_KEYS = ["focus", "snooze", "dismiss"] as const;

export function HailScreen({
  hail,
  task,
  index,
  count,
  now,
  onPrev,
  onNext,
  onClose,
}: {
  hail: Hail;
  task: Task | undefined;
  index: number;
  count: number;
  now: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const bridge = bridgeOf(hail.source);
  const service = sourceLabel(hail.source);
  return (
    <section
      key={hail.id}
      aria-label={`교신: ${hail.from.name}`}
      data-hail={hail.id}
      className={`${styles.hailIn} pointer-events-auto w-[340px] overflow-hidden rounded-xl border border-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)_inset] ${styles.metal}`}
    >
      {/* 머리띠 */}
      <header className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
        <span
          className={`h-2 w-2 rounded-full bg-[#ff5d5d] shadow-[0_0_8px_#ff5d5d] ${styles.blink}`}
        />
        <span className="font-semibold tracking-wide text-white/85">
          교신 수신 중
        </span>
        <span className="text-white/45">· {BRIDGE_NAME[bridge]}</span>
        <span className="ml-auto flex items-center gap-1 text-white/50">
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                aria-label="이전 교신"
                className="rounded px-1 hover:bg-white/10"
              >
                ◂
              </button>
              <span className="tabular-nums">
                {index + 1}/{count}
              </span>
              <button
                type="button"
                onClick={onNext}
                aria-label="다음 교신"
                className="rounded px-1 hover:bg-white/10"
              >
                ▸
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="화상 창 닫기"
            className="ml-1 rounded px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </span>
      </header>
      {/* 화면 */}
      <div className="relative mx-2 h-[136px] overflow-hidden rounded-md border border-black bg-black">
        <BridgeScene bridge={bridge} initial={initialOf(hail.from.name)} />
        <div
          className={`pointer-events-none absolute inset-0 ${styles.scan}`}
        />
        <div className="absolute top-1.5 left-2 rounded bg-black/55 px-1.5 py-px text-[10px] text-white/80">
          {service}
          {hail.from.where && hail.from.where !== service
            ? ` · ${hail.from.where}`
            : ""}
        </div>
        <div
          className="absolute right-2 bottom-1.5 flex items-end gap-[2px]"
          aria-hidden
        >
          {[4, 7, 10, 13].map((h) => (
            <span
              key={h}
              className="w-[3px] rounded-sm bg-[#7dffb0]"
              style={{ height: h }}
            />
          ))}
        </div>
      </div>
      {/* 자막 */}
      <div className="px-3 pt-2 pb-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
          <span
            className="rounded px-1 py-px text-[10px] font-semibold text-black"
            style={{ background: CONTEXT_COLOR[hail.context] }}
          >
            {CONTEXT_LABEL[hail.context]}
          </span>
          <span className="font-semibold text-white/90">{hail.from.name}</span>
          <span>· {service}</span>
          <span className="ml-auto tabular-nums text-[#ffd84a]">
            {elapsed(hail.since, now)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium text-white">
          “{hail.line}”
        </p>
        <HailButtons hail={hail} task={task} />
      </div>
    </section>
  );
}

function HailButtons({ hail, task }: { hail: Hail; task: Task | undefined }) {
  const { buttons } = useTaskButtons(task);
  const shown = buttons.filter((b) =>
    (HAIL_KEYS as readonly string[]).includes(b.action),
  );
  if (!task) {
    return hail.url ? (
      <div className="mt-2 flex gap-1.5">
        <a
          href={hail.url}
          target="_blank"
          rel="noopener"
          className={`${styles.key} ${styles.keyPrimary} rounded-md px-3 py-1 text-[13px] font-semibold`}
        >
          응답
        </a>
      </div>
    ) : null;
  }
  return (
    <div className="mt-2 flex gap-1.5">
      {shown.map((b) => (
        <button
          key={b.key}
          type="button"
          data-action={b.action}
          data-hail-action
          onClick={b.onClick}
          className={`${styles.key} ${b.action === "focus" ? styles.keyPrimary : "text-white/85"} rounded-md px-3 py-1 text-[13px] font-semibold`}
        >
          {b.action === "focus" ? "응답" : b.label}
        </button>
      ))}
    </div>
  );
}
