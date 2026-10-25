"use client";

// 포트를 누르면 해치가 열리며 교신 전문이 보인다. 풀어주기 = 치우기(배가 떠난다).
import type { Crew, TaskAction } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  KIND_LABEL,
  Modal,
  TaskActions,
} from "@/ui/kit";
import type { Berth } from "./model";
import { SHIP, Ship } from "./ships";

const HATCH_LABEL: Partial<Record<TaskAction, string>> = {
  focus: "원본으로",
  handoff: "비서에게",
  snooze: "1시간 뒤",
  dismiss: "풀어주기",
};

const ORDER: TaskAction[] = ["focus", "answer", "handoff", "snooze", "dismiss"];

export function HatchModal({
  berth,
  port,
  crewById,
  onClose,
  clock,
}: {
  berth: Berth | null;
  port: number;
  crewById: Map<string, Crew>;
  onClose: () => void;
  clock: number;
}) {
  const b = berth;
  const c = b ? SHIP[b.kind].color : "#fff";
  const task = b?.task
    ? {
        ...b.task,
        actions: [...b.task.actions].sort(
          (x, y) => ORDER.indexOf(x) - ORDER.indexOf(y),
        ),
      }
    : undefined;
  return (
    <Modal
      open={!!b}
      onClose={onClose}
      width={620}
      title={
        b && (
          <span className="flex items-center gap-2">
            <span
              className="rounded px-1.5 text-xs font-bold text-hull-950"
              style={{ background: c }}
            >
              포트 {port}
            </span>
            해치 열림 · {SHIP[b.kind].name}
          </span>
        )
      }
    >
      {b && (
        <div>
          {/* 해치: 두 문이 양옆으로 열리고 안에 배와 보낸 사람 */}
          <div
            className="relative h-[150px] overflow-hidden rounded-xl border border-black/60"
            style={{
              background: `radial-gradient(80% 120% at 50% 100%, ${c}33 0%, #070b16 70%)`,
            }}
          >
            <div className="absolute inset-0 flex items-center gap-5 px-6">
              <div className="dk-bob shrink-0">
                <Ship kind={b.kind} width={190} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold text-white">{b.from}</div>
                <div className="text-sm text-white/65">
                  {[b.where && b.where !== b.source ? b.where : null, b.source]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="mt-1 text-xs" style={{ color: c }}>
                  {SHIP[b.kind].star} 항구에서 · {ago(b.since, clock)} 붙어 있음
                </div>
              </div>
            </div>
            {[0, 1].map((side) => (
              <div
                key={side}
                className={`absolute top-0 bottom-0 w-1/2 overflow-hidden ${side ? "dk-hatch-r right-0" : "dk-hatch-l left-0"}`}
                style={{
                  background:
                    "repeating-linear-gradient(135deg,#3b4562 0 14px,#2b3349 14px 28px)",
                  borderLeft: side ? "2px solid #0b0f1a" : undefined,
                  borderRight: side ? undefined : "2px solid #0b0f1a",
                  boxShadow: "inset 0 0 30px rgba(0,0,0,.5)",
                }}
              >
                <div
                  className="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-4 border-[#5b6889] bg-[#1a2135]"
                  style={side ? { left: -20 } : { right: -20 }}
                />
              </div>
            ))}
          </div>
          <div className="dk-hatch-body">
            <div className="mt-4 flex flex-wrap items-center gap-x-2 text-[13px] text-white/60">
              <span
                className="rounded px-1.5 text-[12px] font-bold text-hull-950"
                style={{ background: CONTEXT_COLOR[b.context] }}
              >
                {CONTEXT_LABEL[b.context]}
              </span>
              {b.task && <span>{KIND_LABEL[b.task.kind]}</span>}
              {b.crewId && (
                <span>
                  · 승무원{" "}
                  <b className="text-white/85">
                    {crewById.get(b.crewId)?.name ?? b.crewId}
                  </b>
                </span>
              )}
              <span className="ml-auto font-semibold text-white/85">
                {ago(b.since, clock)} 기다림
              </span>
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[19px] leading-snug font-semibold text-white">
                {b.line}
              </div>
              {b.task?.detail && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-white/70">
                  {b.task.detail}
                </p>
              )}
            </div>
            {task ? (
              <TaskActions
                task={task}
                className="mt-4 flex flex-wrap gap-2"
                renderButton={(btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    data-action={btn.action}
                    onClick={() => {
                      btn.onClick();
                      if (btn.action !== "answer" || btn.choice) onClose();
                    }}
                    className={
                      btn.action === "dismiss"
                        ? "ml-auto rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-hull-950"
                        : btn.primary
                          ? "rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-hull-950 hover:bg-white/90"
                          : "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                    }
                    style={
                      btn.action === "dismiss"
                        ? { background: c, borderColor: c }
                        : undefined
                    }
                  >
                    {btn.choice
                      ? btn.label
                      : (HATCH_LABEL[btn.action] ?? btn.label)}
                  </button>
                )}
              />
            ) : (
              b.url && (
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener"
                  className="mt-4 inline-block rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-hull-950"
                >
                  원본으로
                </a>
              )
            )}
            <p className="mt-3 text-xs text-white/40">
              풀어주면 이 배는 {SHIP[b.kind].star} 항구로 돌아가고 포트가
              비어요.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
