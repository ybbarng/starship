"use client";

// 도킹 포트를 누르면: 잠금 바퀴가 돌고, 해치 두 문이 위아래로 갈라지며 김이 빠지고, 붙어 있던 배와 보낸 사람이 보인다.
// 그 아래 메시지 전문과 할 일 버튼(원본으로·비서에게·1시간 뒤·풀어주기). 1차 도킹 시안의 해치를 다듬어 옮김.
// 큰 연출은 이 안쪽 도킹 베이에서만 쓴다(조종석에서는 신호만).
import type { Crew, TaskAction } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  elapsed,
  KIND_LABEL,
  Modal,
  TaskActions,
} from "@/ui/kit";
import type { Berth } from "./berths";
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
              {port > 0 ? `포트 ${port}` : "베이 밖"}
            </span>
            해치 열림 · {SHIP[b.kind].name}
          </span>
        )
      }
    >
      {b && (
        <div key={b.id}>
          <div
            className="relative h-[156px] overflow-hidden rounded-xl border border-black/60"
            style={{
              background: `radial-gradient(80% 120% at 50% 100%, ${c}33 0%, #070b16 70%)`,
            }}
          >
            {/* 해치 안: 도킹 통로 끝에 붙은 배와 보낸 사람 */}
            <div className="absolute inset-0 flex items-center gap-5 px-6">
              <div className="ib-bob shrink-0">
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
                  {elapsed(b.since, clock)} 포트에 붙어 있음
                </div>
              </div>
            </div>
            {/* 통로 둘레 고리 */}
            <div
              className="pointer-events-none absolute inset-2 rounded-[18px] border-[3px]"
              style={{ borderColor: `${c}55` }}
            />
            {/* 김 */}
            <div
              className="ib-hiss pointer-events-none absolute top-1/2 left-0 h-10 w-full -translate-y-1/2"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,.55), transparent 70%)",
              }}
            />
            {/* 위·아래 문 */}
            {(["t", "b"] as const).map((side) => (
              <div
                key={side}
                className={`pointer-events-none absolute inset-x-0 h-1/2 overflow-hidden ${side === "t" ? "ib-door-t top-0" : "ib-door-b bottom-0"}`}
                style={{
                  background:
                    "repeating-linear-gradient(135deg,#3b4562 0 14px,#2b3349 14px 28px)",
                  borderBottom: side === "t" ? "2px solid #0b0f1a" : undefined,
                  borderTop: side === "b" ? "2px solid #0b0f1a" : undefined,
                  boxShadow: "inset 0 0 30px rgba(0,0,0,.5)",
                }}
              >
                <div
                  className="absolute left-1/2 h-[10px] w-[60%] -translate-x-1/2 bg-[#e8b93a]/70"
                  style={side === "t" ? { bottom: 8 } : { top: 8 }}
                />
              </div>
            ))}
            {/* 잠금 바퀴: 먼저 돌고 문과 함께 사라진다 */}
            <svg
              viewBox="-30 -30 60 60"
              width={64}
              height={64}
              className="ib-wheel-out pointer-events-none absolute top-1/2 left-1/2 -mt-8 -ml-8"
              aria-hidden
            >
              <g className="ib-wheel">
                <circle r={22} fill="none" stroke="#9aa6c4" strokeWidth={4} />
                <circle r={6} fill="#5b6889" />
                {[0, 60, 120].map((a) => (
                  <line
                    key={a}
                    x1={-22}
                    y1={0}
                    x2={22}
                    y2={0}
                    stroke="#9aa6c4"
                    strokeWidth={3.5}
                    transform={`rotate(${a})`}
                  />
                ))}
              </g>
            </svg>
          </div>
          <div className="ib-hatch-body">
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
              <div
                className="text-[19px] leading-snug font-semibold text-white"
                data-hail-line
              >
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
                buttonClassName="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
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
              풀어주면 이 배는 떠나고 포트가 비어요.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
