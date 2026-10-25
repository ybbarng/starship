"use client";

// 승무원·계기 등: 오른쪽 위 작은 단추로 여는 접히는 패널. 평소엔 보이지 않는다.
import { useState } from "react";
import { useAct } from "@/data/hooks";
import type { Crew, CrewStatus, Gauge, GaugeStatus, Task } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, CONTEXT_LABEL, CREW_STATUS_LABEL } from "@/ui/kit";
import styles from "./cockpit.module.css";
import { BTN } from "./Tasks";
import { GLASS, LABEL, selecting } from "./ui";

const STATUS_ORDER: Record<CrewStatus, number> = {
  "needs-you": 0,
  working: 1,
  idle: 2,
  off: 3,
};

const STATUS_COLOR: Record<CrewStatus, string> = {
  "needs-you": "#ffcf5c",
  working: "#5ee08a",
  idle: "rgba(255,255,255,.35)",
  off: "rgba(255,255,255,.12)",
};

const GAUGE_COLOR: Record<GaugeStatus, string> = {
  ok: "#5ee08a",
  warn: "#ffcf5c",
  error: "#ff6b6b",
  off: "rgba(255,255,255,.18)",
};

export type CrewTab = "crew" | "gauges";

/** 오른쪽 위 단추 둘: 승무원 n · 계기 등 줄 */
export function CrewButtons({
  crew,
  gauges,
  open,
  onOpen,
}: {
  crew: Crew[];
  gauges: Gauge[];
  open: CrewTab | null;
  onOpen: (tab: CrewTab | null) => void;
}) {
  const waiting = crew.filter((c) => c.status === "needs-you").length;
  const bad = gauges.filter((g) => g.status === "error" || g.status === "warn");
  const tab = (t: CrewTab) =>
    `pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] backdrop-blur-md transition ${
      open === t
        ? "border-white/25 bg-white/[0.12] text-white"
        : "border-white/[0.09] bg-[#060a14]/55 text-white/60 hover:text-white"
    }`;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        data-open="crew"
        onClick={() => onOpen(open === "crew" ? null : "crew")}
        className={tab("crew")}
      >
        승무원
        <span className="font-mono tabular-nums text-white/45">
          {crew.length}
        </span>
        {waiting > 0 && (
          <span className="flex items-center gap-1 font-mono tabular-nums text-[#ffcf5c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffcf5c]" />
            {waiting}
          </span>
        )}
      </button>
      <button
        type="button"
        data-open="gauges"
        onClick={() => onOpen(open === "gauges" ? null : "gauges")}
        className={tab("gauges")}
      >
        계기
        <span className="flex items-center gap-[3px]" aria-hidden>
          {gauges.slice(0, 6).map((g) => (
            <span
              key={g.id}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: GAUGE_COLOR[g.status] }}
            />
          ))}
        </span>
        {bad.length > 0 && <span className="sr-only">주의 {bad.length}</span>}
      </button>
    </div>
  );
}

export function CrewPanel({
  tab,
  crew,
  gauges,
  tasksByCrew,
  now,
  onTab,
  onClose,
}: {
  tab: CrewTab;
  crew: Crew[];
  gauges: Gauge[];
  tasksByCrew: Map<string, Task[]>;
  now: number;
  onTab: (t: CrewTab) => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label={tab === "crew" ? "승무원" : "계기 등"}
      data-crew-panel
      className={`${GLASS} ${styles.rise} flex max-h-[min(560px,calc(100vh-140px))] w-[340px] flex-col overflow-hidden`}
    >
      <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 pt-3 pb-2 text-[12.5px]">
        {(["crew", "gauges"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={
              tab === t
                ? "font-semibold text-white"
                : "text-white/40 hover:text-white/80"
            }
          >
            {t === "crew"
              ? `승무원 ${crew.length}`
              : `계기 등 ${gauges.length}`}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto rounded px-1.5 text-white/45 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </header>
      <div
        data-scroll-inside
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin]"
      >
        {tab === "crew" ? (
          <CrewList crew={crew} tasksByCrew={tasksByCrew} now={now} />
        ) : (
          <GaugeList gauges={gauges} now={now} />
        )}
      </div>
    </section>
  );
}

function CrewList({
  crew,
  tasksByCrew,
  now,
}: {
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  now: number;
}) {
  const act = useAct();
  const [open, setOpen] = useState<string | null>(null);
  if (!crew.length)
    return (
      <p className="py-6 text-center text-[12px] text-white/40">
        아직 승무원이 없어요.
      </p>
    );
  const sorted = [...crew].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.name.localeCompare(b.name),
  );
  return (
    <ul>
      {sorted.map((c) => {
        const isOpen = open === c.id;
        const waiting = tasksByCrew.get(c.id)?.length ?? 0;
        return (
          <li
            key={c.id}
            className={`rounded-md ${isOpen ? "bg-white/[0.04]" : ""}`}
          >
            {/* biome-ignore lint/a11y/useSemanticElements: 글을 드래그해 고를 수 있게 div */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => !selecting() && setOpen(isOpen ? null : c.id)}
              onKeyDown={(e) =>
                e.key === "Enter" && setOpen(isOpen ? null : c.id)
              }
              className={`flex cursor-pointer items-center gap-2 px-1.5 py-1 ${c.status === "off" ? "opacity-55" : ""}`}
            >
              <Animal
                kind={animalFor(c.id)}
                pose={poseFor(c.status)}
                context={c.context}
                size={30}
                furniture={false}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="font-medium text-white/90">{c.name}</span>
                  <span
                    className="text-[10px]"
                    style={{ color: CONTEXT_COLOR[c.context] }}
                  >
                    {CONTEXT_LABEL[c.context]}
                  </span>
                </span>
                <span className="block truncate text-[11px] text-white/45">
                  {c.activity ?? CREW_STATUS_LABEL[c.status]}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-white/50">
                {waiting > 0 && (
                  <span className="font-mono tabular-nums text-[#ffcf5c]">
                    {waiting}
                  </span>
                )}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATUS_COLOR[c.status] }}
                  title={CREW_STATUS_LABEL[c.status]}
                />
              </span>
            </div>
            {isOpen && (
              <div className="px-2 pb-2.5 pl-11 text-[11.5px] text-white/60">
                <div className="text-white/45">
                  {CREW_STATUS_LABEL[c.status]}
                  {c.since ? ` · ${ago(c.since, now)} 전부터` : ""}
                </div>
                {c.brief && (
                  <>
                    <p className="mt-1 leading-relaxed text-white/75">
                      {c.brief.summary}
                    </p>
                    {c.brief.risks.length > 0 && (
                      <p className="mt-1 text-[#ffcf5c]/80">
                        위험: {c.brief.risks.join(" · ")}
                      </p>
                    )}
                  </>
                )}
                {c.actions.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {c.actions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => act.crew(c, a)}
                        className={BTN}
                      >
                        {a === "focus" ? "창으로 가기" : "브리핑 다시"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GaugeList({ gauges, now }: { gauges: Gauge[]; now: number }) {
  if (!gauges.length)
    return (
      <p className="py-6 text-center text-[12px] text-white/40">
        계기 등이 없어요.
      </p>
    );
  return (
    <ul className="space-y-0.5">
      {gauges.map((g) => (
        <li key={g.id} className="flex items-start gap-2.5 px-1.5 py-1.5">
          <span
            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
            style={{
              background: GAUGE_COLOR[g.status],
              boxShadow:
                g.status === "off"
                  ? "none"
                  : `0 0 6px ${GAUGE_COLOR[g.status]}`,
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2 text-[12.5px]">
              <span className="text-white/85">{g.label}</span>
              {g.value && (
                <span className="font-mono text-[11px] tabular-nums text-white/55">
                  {g.value}
                </span>
              )}
              {g.at && (
                <span className={`${LABEL} ml-auto`}>{ago(g.at, now)} 전</span>
              )}
            </span>
            {g.detail && (
              <span className="block text-[11px] leading-snug text-white/40">
                {g.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
