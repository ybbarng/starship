"use client";

// 모달로 띄우는 기능들: 승무원 상세(브리핑·할 일 체크), 브리핑 모음, 전체 할 일, 항법.
import { useAct } from "@/data/hooks";
import type { Context, Crew, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  CREW_STATUS_LABEL,
  DestinationPicker,
  KIND_LABEL,
  Modal,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import s from "./hud.module.css";

const PANEL = `${s.rise} border-[#a6fbff]/35! bg-[#06121c]/95! shadow-[0_0_40px_rgb(80_230_255/0.15)]`;

const smallBtn =
  "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[12.5px] text-white/85 hover:border-[#a6fbff]/60 hover:bg-[#a6fbff]/10";
const smallPrimary =
  "rounded-md border border-[#a6fbff] bg-[#a6fbff]/85 px-2.5 py-1 text-[12.5px] font-semibold text-[#02161d] hover:bg-[#a6fbff]";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1 text-[11px] tracking-wide text-[#a6fbff]/70">
        {title}
      </h4>
      <ul className="space-y-0.5 text-[13.5px] text-white/85">
        {items.map((it) => (
          <li key={it} className="flex gap-1.5">
            <span className="text-white/35">·</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CrewPanel({
  crew,
  tasks,
  onClose,
  clock,
}: {
  crew: Crew | undefined;
  tasks: Task[];
  onClose: () => void;
  clock: number;
}) {
  const act = useAct();
  return (
    <Modal
      open={!!crew}
      onClose={onClose}
      width={680}
      className={PANEL}
      title={
        crew && (
          <div className="flex items-center gap-3">
            <Animal
              kind={animalFor(crew.id)}
              pose={poseFor(crew.status)}
              context={crew.context}
              size={44}
              furniture={false}
            />
            <div>
              <div className="flex items-center gap-2">
                {crew.name}
                <span
                  className="rounded-sm px-1.5 text-[11.5px] font-bold text-black"
                  style={{ background: CONTEXT_COLOR[crew.context] }}
                >
                  {CONTEXT_LABEL[crew.context]}
                </span>
              </div>
              <div className="text-[12.5px] font-normal text-white/60">
                {CREW_STATUS_LABEL[crew.status]}
                {crew.activity && ` · ${crew.activity}`}
                {crew.since && ` · ${ago(crew.since, clock)} 전부터`}
              </div>
            </div>
          </div>
        )
      }
    >
      {crew && (
        <div className="space-y-4">
          <div>
            <h4 className="mb-1.5 text-[11px] tracking-wide text-[#a6fbff]/70">
              할 일 체크 · 체크하면 치워요
            </h4>
            {tasks.length === 0 ? (
              <p className="text-sm text-white/55">
                이 선원이 기다리는 일은 없어요.
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t, i) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        data-check={t.id}
                        aria-label={`${t.title} 치우기`}
                        onClick={() => act.task(t, "dismiss")}
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-[#a6fbff]/70 text-[13px] text-[#a6fbff] hover:bg-[#a6fbff]/20"
                      >
                        <span className="opacity-0 hover:opacity-100">✓</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] text-white/50">
                          {KIND_LABEL[t.kind]} · {sourceLabel(t.source)} ·{" "}
                          {t.from} · {ago(t.since, clock)}
                        </div>
                        <div className="text-[14.5px] font-medium">
                          {t.title}
                        </div>
                        {i === 0 && t.detail && (
                          <p className="mt-1 text-[12.5px] whitespace-pre-line text-white/60">
                            {t.detail}
                          </p>
                        )}
                        {i === 0 && (
                          <TaskActions
                            task={t}
                            className="mt-2 flex flex-wrap gap-1.5"
                            buttonClassName={smallBtn}
                            primaryClassName={smallPrimary}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {crew.brief ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="flex items-baseline">
                <h4 className="text-[11px] tracking-wide text-[#a6fbff]/70">
                  브리핑
                </h4>
                <span className="ml-auto text-[11px] text-white/40">
                  {ago(crew.brief.at, clock)} 전
                </span>
              </div>
              <p className="text-[14px] text-white/90">{crew.brief.summary}</p>
              <div className="grid grid-cols-2 gap-3">
                <Section title="오늘" items={crew.brief.today} />
                <Section title="다음" items={crew.brief.next} />
              </div>
              <Section title="위험" items={crew.brief.risks} />
            </div>
          ) : (
            <p className="text-sm text-white/50">아직 브리핑이 없어요.</p>
          )}

          <div className="flex gap-2">
            {crew.actions.includes("focus") && (
              <button
                type="button"
                className={smallPrimary}
                onClick={() => act.crew(crew, "focus")}
              >
                창으로 가기
              </button>
            )}
            {crew.actions.includes("brief") && (
              <button
                type="button"
                className={smallBtn}
                onClick={() => act.crew(crew, "brief")}
              >
                브리핑 다시
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function RosterPanel({
  open,
  onClose,
  crew,
  only,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  crew: Crew[];
  only: Context | null;
  onPick: (c: Crew) => void;
}) {
  const groups: Context[] = only ? [only] : ["work", "personal"];
  const order = { "needs-you": 0, working: 1, idle: 2, off: 3 } as const;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={760}
      className={PANEL}
      title={only ? `${CONTEXT_LABEL[only]} 승무원` : "브리핑 · 승무원 요약"}
    >
      <div className="space-y-4">
        {groups.map((g) => {
          const list = crew
            .filter((c) => c.context === g)
            .sort((a, b) => order[a.status] - order[b.status]);
          return (
            <section key={g}>
              <h3
                className="mb-1.5 text-[12px] font-semibold tracking-wide"
                style={{ color: CONTEXT_COLOR[g] }}
              >
                {CONTEXT_LABEL[g]} · {list.length}명
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPick(c)}
                    className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left hover:border-[#a6fbff]/50"
                  >
                    <Animal
                      kind={animalFor(c.id)}
                      pose={poseFor(c.status)}
                      context={c.context}
                      size={34}
                      furniture={false}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                        {c.name}
                        <span
                          className="text-[11px]"
                          style={{
                            color:
                              c.status === "needs-you"
                                ? "#ffcf5c"
                                : "#ffffff70",
                          }}
                        >
                          {CREW_STATUS_LABEL[c.status]}
                        </span>
                      </div>
                      <div className="line-clamp-2 text-[12px] text-white/55">
                        {c.brief?.summary ?? c.activity ?? "브리핑 없음"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

export function AllTasksPanel({
  open,
  onClose,
  tasks,
  crewById,
  clock,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  crewById: Map<string, Crew>;
  clock: number;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={820}
      className={PANEL}
      title={`전체 할 일 · ${tasks.length}개`}
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-white/55">기다리는 일이 없어요.</p>
      ) : (
        <ol className="space-y-2">
          {tasks.map((t, i) => (
            <li
              key={t.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
            >
              <div className="flex items-baseline gap-2 text-[11.5px] text-white/50">
                <span className="font-mono text-white/40">{i + 1}</span>
                <span style={{ color: CONTEXT_COLOR[t.context] }}>
                  {CONTEXT_LABEL[t.context]}
                </span>
                <span>
                  {t.crewId
                    ? (crewById.get(t.crewId)?.name ?? t.crewId)
                    : "새 일"}{" "}
                  · {KIND_LABEL[t.kind]} · {sourceLabel(t.source)} · {t.from}
                </span>
                <span className="ml-auto font-mono">{ago(t.since, clock)}</span>
              </div>
              <div className="mt-0.5 text-[14.5px] font-medium">{t.title}</div>
              <TaskActions
                task={t}
                className="mt-1.5 flex flex-wrap gap-1.5"
                buttonClassName={smallBtn}
                primaryClassName={smallPrimary}
              />
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export function NavPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={760}
      className={PANEL}
      title="항법 · 목적지 고르기"
    >
      <DestinationPicker onPick={onClose} />
    </Modal>
  );
}
