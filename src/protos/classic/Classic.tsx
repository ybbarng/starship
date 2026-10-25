"use client";

// 시안 1. 정석 조종석: 앞 유리 다섯 장 너머 우주(위 58%) + 금속 계기판(아래 42%).
// 스크롤 문턱을 넘기면 조종석이 앞코로 줄어들며 옆에서 자른 우주선 단면(개미농장)이 나온다.
import { useEffect, useMemo, useRef, useState } from "react";
import { useBridge } from "@/data/hooks";
import type { Context, Hail } from "@/protocol/v1";
import { SpaceView } from "@/sky/SpaceView";
import { useDestination, useVoyage } from "@/sky/voyage";
import { EventLayer } from "@/ui/events";
import {
  CONTEXT_LABEL,
  DestinationPicker,
  Modal,
  ProtoBadge,
  Toasts,
  useScrollStage,
} from "@/ui/kit";
import { CrewDetail, CrewHeader } from "./CrewDetail";
import { Dashboard } from "./Dashboard";
import { HailScreen } from "./HailScreen";
import { Interior, SHIP } from "./Interior";
import { AllTasksList, BriefsList, HailsList } from "./Lists";
import { ToggleSwitch } from "./ToggleSwitch";
import { sortCrew, useNow } from "./util";
import { WindowFrame } from "./WindowFrame";

const WINDOW_SHARE = 0.58;

type ModalState =
  | { type: "nav" }
  | { type: "brief" }
  | { type: "tasks" }
  | { type: "hails" }
  | { type: "crew"; id: string }
  | { type: "bank"; context: Context }
  | null;

function useViewport() {
  const [size, setSize] = useState({ w: 1372, h: 872 });
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return size;
}

export function Classic() {
  const bridge = useBridge();
  const now = useNow();
  const { w, h } = useViewport();
  const { progress, push, stage, goTo } = useScrollStage();
  const dest = useDestination();
  const phase = useVoyage((s) => s.phase);
  const [modal, setModal] = useState<ModalState>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const taskById = useMemo(
    () => new Map(bridge.tasks.map((t) => [t.id, t])),
    [bridge.tasks],
  );
  const hails = useMemo(
    () => [...bridge.hails].sort((a, b) => b.since - a.since),
    [bridge.hails],
  );
  const hail = useHailWindow(hails);

  const p = progress;
  // 창밖: 조종석 앞 유리(위 58%) → 선내 전경 위 띠(30%)
  const skyH = h * (WINDOW_SHARE + (SHIP.bandBottom - WINDOW_SHARE) * p);
  // 조종석 전체를 앞코 자리로 줄인다
  const s = SHIP.cockpitScale;
  const sc = 1 + (s - 1) * p;
  const tx = p * (SHIP.noseX * w - (w * s) / 2);
  const ty = p * (SHIP.noseY * h - (h * s) / 2);

  const currentHail = hails.find((x) => x.id === hail.shownId);
  const close = () => setModal(null);
  const modalCrew =
    modal?.type === "crew" ? bridge.crewById.get(modal.id) : undefined;

  return (
    <main className="fixed inset-0 overflow-hidden bg-hull-950 break-keep text-white select-none">
      {/* 창밖: 하나만 두고 크기만 바꾼다 */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: skyH }}
        data-sky
      >
        <div className="absolute inset-0">
          <SpaceView
            className="h-full w-full"
            labels="few"
            lookAround
            drift
            starScale={1 - 0.3 * p}
          />
        </div>
        <EventLayer />
      </div>

      {/* 선내 전경(스크롤 뒤) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: Math.min(1, p * 1.6),
          pointerEvents: stage === 1 && p > 0.9 ? "auto" : "none",
          visibility: p < 0.01 ? "hidden" : "visible",
        }}
      >
        <Interior
          crew={bridge.crew}
          tasksByCrew={bridge.tasksByCrew}
          now={now}
          selectedId={selected}
          onSelect={setSelected}
          onCockpit={() => goTo(0)}
          destination={dest}
        />
      </div>

      {/* 조종석: 앞 유리 틀 + 계기판 + 화상 창 */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: w,
          height: h,
          transform: `translate(${tx}px, ${ty}px) scale(${sc})`,
          pointerEvents: stage === 0 && p < 0.1 ? undefined : "none",
          borderRadius: p > 0.02 ? 40 : 0,
          overflow: p > 0.02 ? "hidden" : undefined,
          boxShadow: p > 0.02 ? `0 0 0 ${8 / sc}px #0c1018` : undefined,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: `${WINDOW_SHARE * 100}%` }}
        >
          <WindowFrame
            className="absolute inset-0 h-full w-full"
            backdrop={Math.min(1, p * 5)}
          />
          {/* 목적지 판 */}
          <div className="absolute top-[30px] left-1/2 flex max-w-[640px] -translate-x-1/2 items-center gap-2 rounded-md border border-black/60 bg-[#0d1016]/90 px-3 py-[3px] text-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="shrink-0 text-[10px] font-semibold tracking-[0.2em] text-white/40">
              목적지
            </span>
            <span className="shrink-0 font-semibold text-white">{dest.ko}</span>
            <span className="truncate text-white/55">
              {phase === "travel" ? "이동 중…" : dest.fact}
            </span>
          </div>
          {/* 문턱의 스크롤 안내 */}
          <div className="absolute bottom-[14px] left-1/2 flex -translate-x-1/2 items-center gap-2 text-[11px] text-white/45">
            <span>▼ 휠을 내려 선내 전경</span>
            <span className="h-1 w-16 overflow-hidden rounded-full bg-black/50">
              <span
                className="block h-full bg-[#7fb8ff]"
                style={{ width: `${push * 100}%` }}
              />
            </span>
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${(1 - WINDOW_SHARE) * 100}%` }}
        >
          <Dashboard
            now={now}
            task={bridge.now}
            next={bridge.next}
            crew={bridge.crew}
            crewById={bridge.crewById}
            gauges={bridge.gauges}
            hailCount={hails.length}
            hailFresh={!currentHail && hails.length > 0}
            destination={dest.ko}
            onCrew={(id) => setModal({ type: "crew", id })}
            onBank={(context) => setModal({ type: "bank", context })}
            onNav={() => setModal({ type: "nav" })}
            onBrief={() => setModal({ type: "brief" })}
            onTasks={() => setModal({ type: "tasks" })}
            onHails={() => setModal({ type: "hails" })}
          />
        </div>

        {/* 화상 창: 앞 유리 오른쪽 위. DOM에서는 주 표시창 뒤에 둔다 */}
        {currentHail && (
          <div className="absolute top-[70px] right-[44px]">
            <HailScreen
              hail={currentHail}
              task={
                currentHail.taskId
                  ? taskById.get(currentHail.taskId)
                  : undefined
              }
              index={hails.indexOf(currentHail)}
              count={hails.length}
              now={now}
              onPrev={() => hail.step(-1)}
              onNext={() => hail.step(1)}
              onClose={hail.close}
            />
          </div>
        )}
      </div>

      <ProtoBadge name="1. 정석 조종석" />
      <Toasts className={stage === 0 ? "bottom-[calc(42%+18px)]!" : ""} />

      <Modal
        open={modal?.type === "nav"}
        onClose={close}
        title="항법 · 목적지 고르기"
        width={760}
      >
        <DestinationPicker onPick={close} />
      </Modal>
      <Modal
        open={modal?.type === "brief"}
        onClose={close}
        title="승무원 브리핑"
        width={820}
      >
        <BriefsList
          crew={bridge.crew}
          now={now}
          onOpen={(id) => setModal({ type: "crew", id })}
        />
      </Modal>
      <Modal
        open={modal?.type === "tasks"}
        onClose={close}
        title={`전체 할 일 ${bridge.tasks.length}`}
        width={760}
      >
        <AllTasksList
          tasks={bridge.tasks}
          crewById={bridge.crewById}
          now={now}
        />
      </Modal>
      <Modal
        open={modal?.type === "hails"}
        onClose={close}
        title={`교신 목록 ${hails.length}`}
        width={680}
      >
        <HailsList
          hails={hails}
          taskById={taskById}
          now={now}
          onShow={(id) => {
            hail.show(id);
            close();
          }}
        />
      </Modal>
      <Modal
        open={modal?.type === "crew" && !!modalCrew}
        onClose={close}
        title={modalCrew ? <CrewHeader crew={modalCrew} now={now} /> : null}
        width={560}
      >
        {modalCrew && (
          <CrewDetail
            crew={modalCrew}
            tasks={bridge.tasksByCrew.get(modalCrew.id) ?? []}
            now={now}
          />
        )}
      </Modal>
      <Modal
        open={modal?.type === "bank"}
        onClose={close}
        title={
          modal?.type === "bank"
            ? `${CONTEXT_LABEL[modal.context]} 승무원 모두`
            : ""
        }
        width={720}
      >
        {modal?.type === "bank" && (
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {sortCrew(
              bridge.crew.filter((c) => c.context === modal.context),
            ).map((c) => (
              <ToggleSwitch
                key={c.id}
                crew={c}
                now={now}
                onOpen={() => setModal({ type: "crew", id: c.id })}
              />
            ))}
          </div>
        )}
      </Modal>
    </main>
  );
}

/** 새 교신이 오면 화상 창을 연다. 닫으면 램프에 숫자로만 남는다. */
function useHailWindow(hails: Hail[]) {
  const seen = useRef<Set<string>>(new Set());
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    const fresh = hails.filter((x) => !seen.current.has(x.id));
    for (const x of fresh) seen.current.add(x.id);
    if (fresh[0]) {
      setShownId(fresh[0].id);
      return;
    }
    // 보던 교신을 치웠으면 다음 교신으로, 없으면 닫는다
    setShownId((id) =>
      id && !hails.some((x) => x.id === id) ? (hails[0]?.id ?? null) : id,
    );
  }, [hails]);

  return {
    shownId,
    show: (id: string) => setShownId(id),
    close: () => setShownId(null),
    step: (d: number) =>
      setShownId((id) => {
        if (!hails.length) return null;
        const i = Math.max(
          0,
          hails.findIndex((x) => x.id === id),
        );
        return hails[(i + d + hails.length) % hails.length]?.id ?? null;
      }),
  };
}
