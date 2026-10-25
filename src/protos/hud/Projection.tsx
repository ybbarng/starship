"use client";

// 앞 유리 아래쪽 1/3에 떠 있는 투영 글: 지금 할 일 세 줄 + 유리 위 버튼, 왼쪽 가장자리에 다음 차례.
import type { CSSProperties } from "react";
import type { Crew, Task } from "@/protocol/v1";
import {
  ago,
  CONTEXT_COLOR,
  CONTEXT_LABEL,
  isHail,
  KIND_LABEL,
  sourceLabel,
  TaskActions,
} from "@/ui/kit";
import s from "./hud.module.css";

export type Brightness = { label: string; glow: number; plate: number };

export const BRIGHTNESS: Brightness[] = [
  { label: "낮게", glow: 0.35, plate: 0.42 },
  { label: "보통", glow: 0.7, plate: 0.58 },
  { label: "밝게", glow: 1, plate: 0.72 },
];

export function hudVars(b: Brightness): CSSProperties {
  return {
    "--hud": "#a6fbff",
    "--glow": b.glow,
    "--plate": b.plate,
  } as CSSProperties;
}

/** 투영판 모서리 꺾쇠 */
function Brackets({ color = "rgb(166 251 255 / 0.9)" }: { color?: string }) {
  const L = 18;
  const common = {
    stroke: color,
    strokeWidth: 2,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <svg x="0" y="0" overflow="visible" aria-hidden>
        <path d={`M0 ${L} V0 H${L}`} {...common} />
      </svg>
      <svg x="100%" y="0" overflow="visible" aria-hidden>
        <path d={`M${-L} 0 H0 V${L}`} {...common} />
      </svg>
      <svg x="0" y="100%" overflow="visible" aria-hidden>
        <path d={`M0 ${-L} V0 H${L}`} {...common} />
      </svg>
      <svg x="100%" y="100%" overflow="visible" aria-hidden>
        <path d={`M${-L} 0 H0 V${-L}`} {...common} />
      </svg>
    </svg>
  );
}

function whoOf(task: Task, crewById: Map<string, Crew>): string {
  if (task.crewId) return crewById.get(task.crewId)?.name ?? task.crewId;
  return "새 일";
}

export function Projection({
  now,
  next,
  crewById,
  brightness,
  clock,
}: {
  now: Task | undefined;
  next: Task[];
  crewById: Map<string, Crew>;
  brightness: Brightness;
  clock: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[3.5%] flex items-end justify-center gap-6 px-8"
      style={{
        ...hudVars(brightness),
        height: "34%",
        perspective: "1100px",
      }}
    >
      {/* 왼쪽 가장자리: 다음 차례 */}
      <div
        className={`${s.plate} pointer-events-auto relative flex h-full w-[290px] shrink-0 flex-col rounded-md px-4 py-3`}
        style={{ transform: "rotateY(9deg)", transformOrigin: "left center" }}
      >
        <Brackets color="rgb(166 251 255 / 0.55)" />
        <div
          className={`${s.hudText} mb-2 font-mono text-[11px] tracking-wide opacity-80`}
        >
          다음 차례 ▾
        </div>
        {next.length === 0 ? (
          <div className={`${s.hudText} text-sm opacity-70`}>
            다음 차례가 없어요
          </div>
        ) : (
          <ol className="flex min-h-0 flex-1 flex-col justify-start gap-2.5">
            {next.map((t, i) => (
              <li key={t.id} className="flex gap-2">
                <span
                  className={`${s.hudText} mt-px font-mono text-xs opacity-70`}
                >
                  {i + 2}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`${s.hudText} truncate text-[11.5px] opacity-75`}
                  >
                    <span style={{ color: CONTEXT_COLOR[t.context] }}>
                      {CONTEXT_LABEL[t.context]}
                    </span>
                    {" · "}
                    {whoOf(t, crewById)} · {ago(t.since, clock)}
                  </div>
                  <div
                    className={`${s.hudText} truncate text-[14px] font-medium`}
                  >
                    {t.title}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 가운데: 지금 할 일 */}
      <section
        aria-label="지금 할 일"
        data-now-task={now?.id ?? ""}
        className={`${s.plate} pointer-events-auto relative flex h-full max-w-[800px] min-w-0 flex-1 flex-col justify-between rounded-md px-6 py-4`}
        style={{ transform: "rotateX(5deg)", transformOrigin: "bottom center" }}
      >
        <Brackets />
        {now ? (
          <>
            <div
              className={`${s.hudText} flex items-center gap-2 text-[13.5px] font-medium tracking-wide`}
            >
              <span className="font-mono text-[11px] tracking-wide opacity-70">
                지금 ▸
              </span>
              <span
                className="rounded-sm px-1.5 py-px text-[12px] font-bold"
                style={{
                  color: "#04121a",
                  background: CONTEXT_COLOR[now.context],
                  textShadow: "none",
                }}
              >
                {CONTEXT_LABEL[now.context]}
              </span>
              <span className="truncate">
                {whoOf(now, crewById)} · {KIND_LABEL[now.kind]}
                {isHail(now) && ` · ${sourceLabel(now.source)} ${now.from}`}
              </span>
              <span className="ml-auto shrink-0 font-mono">
                ⏱ {ago(now.since, clock)} 기다림
              </span>
            </div>
            <h1
              className={`${s.hudText} line-clamp-2 text-[27px] leading-[1.28] font-semibold`}
            >
              {now.title}
            </h1>
            <TaskActions
              task={now}
              className="flex flex-wrap items-center gap-2"
              buttonClassName={s.hudButton}
              primaryClassName={s.hudPrimary}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className={`${s.hudText} text-[26px] font-semibold`}>
              기다리는 일이 없어요
            </div>
            <div className={`${s.hudText} text-sm opacity-75`}>
              창밖을 끌어서 둘러보거나, 항법에서 목적지를 골라 보세요
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** 갑판을 내려다볼 때 창 띠 아래에 남는 한 줄 투영 */
export function CompactProjection({
  now,
  crewById,
  brightness,
  clock,
}: {
  now: Task | undefined;
  crewById: Map<string, Crew>;
  brightness: Brightness;
  clock: number;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-3 flex justify-center px-6"
      style={hudVars(brightness)}
    >
      <div
        className={`${s.plate} relative flex max-w-[1100px] min-w-0 items-center gap-3 rounded-md px-4 py-2`}
      >
        <Brackets />
        <span
          className={`${s.hudText} shrink-0 font-mono text-[11px] tracking-wide opacity-70`}
        >
          지금 ▸
        </span>
        {now ? (
          <>
            <span className={`${s.hudText} shrink-0 text-[12.5px] opacity-80`}>
              <span style={{ color: CONTEXT_COLOR[now.context] }}>
                {CONTEXT_LABEL[now.context]}
              </span>{" "}
              · {whoOf(now, crewById)} · {ago(now.since, clock)}
            </span>
            <span
              className={`${s.hudText} min-w-0 truncate text-[16px] font-semibold`}
            >
              {now.title}
            </span>
            <TaskActions
              task={now}
              className="flex shrink-0 items-center gap-1.5"
              buttonClassName={`${s.hudButton} px-2.5! py-1! text-[12.5px]!`}
              primaryClassName={`${s.hudPrimary} px-2.5! py-1! text-[12.5px]!`}
            />
          </>
        ) : (
          <span className={`${s.hudText} text-sm`}>기다리는 일이 없어요</span>
        )}
      </div>
    </div>
  );
}
