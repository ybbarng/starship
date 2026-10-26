"use client";

// 3차 시안 "조종석과 감상창". 방향: docs/prototypes/direction-round3.md, 지시서: brief-round3.md
// 평소 = 일하는 조종석: 위쪽 넓게 트인 곡면 유리 너머로 우주가 천천히 흐르고, 아래 계기판 한가운데 지금 할 일 하나.
// "우주 감상하기"를 누르면 창으로 몸을 기울이듯 계기판이 먼저 내려가고, 유리 테두리가 화면 바깥으로 밀려나며
// 2차의 트인 함교(끌어서 둘러보기·속도계·행성 단추)가 된다. Esc나 "조종석으로"로 반대 순서로 돌아온다.
// 아래로 밀면 창밖이 위쪽 띠로 줄고 2차의 네 갑판 단면이 나온다.
//
// 창밖(SpaceView)은 하나만 두고 크기를 바꾸지 않는다. 화면 크기 캔버스를 위아래로 옮기고 그 위에 유리 모양만
// 바꿔 그려서, 전환 중에도 매 프레임 다시 그리는 일이 없게 했다.
import { useEffect, useMemo, useState } from "react";
import { useBridge } from "@/data/hooks";
import type { Context, Task } from "@/protocol/v1";
import { CrewDetail, CrewHeader } from "@/protos/classic/CrewDetail";
import { HailScreen } from "@/protos/open-bridge/cockpit/Hails";
import { lightTime } from "@/protos/open-bridge/cockpit/ui";
import { Interior } from "@/protos/open-bridge/interior/Interior";
import { ScaleNote } from "@/sky/ScaleNote";
import { SpaceView } from "@/sky/SpaceView";
import { formatDistance } from "@/sky/telemetry";
import { useKoreaTime, useTelemetry } from "@/sky/useTelemetry";
import { useDestination } from "@/sky/voyage";
import { EventLayer } from "@/ui/events";
import {
  CONTEXT_LABEL,
  DestinationPicker,
  Modal,
  ProtoBadge,
  Toasts,
  useScrollStage,
} from "@/ui/kit";
import styles from "./cockpit.module.css";
import { GazeLayer } from "./Gaze";
import { GlassFrame, type GlassShape } from "./Glass";
import { GaugeList, TaskList } from "./Lists";
import { TaskDetail } from "./MainDisplay";
import { CrewLamp, Dashboard, type ListKind, sortCrew } from "./Panel";
import {
  clamp01,
  lerp,
  span,
  useHailScreen,
  useNow,
  useTween,
  useViewport,
  useWarnings,
} from "./util";

/** 조종석에서 유리창 아랫변(화면 비율) */
const WINDOW_SHARE = 0.58;
/** 내부 장면에서 창밖 띠 높이(2차와 같게) */
const BAND_SHARE = 0.3;
/** 감상 모드로 들어가고 나오는 시간 */
const GAZE_MS = 1500;

type ModalState =
  | { type: "more"; id: string }
  | { type: "list"; kind: ListKind }
  | { type: "crew"; id: string }
  | { type: "bank"; context: Context }
  | { type: "nav" }
  | null;

function mixShape(a: GlassShape, b: GlassShape, t: number): GlassShape {
  return {
    x0: lerp(a.x0, b.x0, t),
    x1: lerp(a.x1, b.x1, t),
    topMid: lerp(a.topMid, b.topMid, t),
    topCorner: lerp(a.topCorner, b.topCorner, t),
    bottom: lerp(a.bottom, b.bottom, t),
    r: lerp(a.r, b.r, t),
  };
}

export function CockpitGaze() {
  const bridge = useBridge();
  const now = useNow();
  const { w, h } = useViewport();

  // 감상 모드
  const [gaze, setGaze] = useState(false);
  const tween = useTween(gaze ? 1 : 0, GAZE_MS);
  const g = tween.value;
  const gDash = span(g, 0, 0.62); // 계기판이 먼저 내려가며 유리 아랫변을 끌고 가고
  const gGlass = span(g, 0.12, 1); // 테두리가 바깥으로 밀려나고 반사광이 사라지고
  const gOver = span(g, 0.78, 1); // 마지막에 감상 계기가 떠오른다
  const settledCockpit = !gaze && g < 0.001;

  // 내부 장면(감상 중에는 스크롤로 가지 않는다)
  const {
    stage,
    progress: p,
    push,
    goTo,
  } = useScrollStage({
    enabled: settledCockpit,
  });

  const [grid, setGrid] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const hails = useMemo(
    () => [...bridge.hails].sort((a, b) => b.since - a.since),
    [bridge.hails],
  );
  const taskById = useMemo(
    () => new Map<string, Task>(bridge.tasks.map((t) => [t.id, t])),
    [bridge.tasks],
  );
  const hail = useHailScreen(hails);
  const currentHail = hails.find((x) => x.id === hail.openId);
  const warnings = useWarnings(bridge.tasks, bridge.gauges, hails, now);

  // ?view=gaze 로 열면 감상 모드에서 시작
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "gaze") {
      setGaze(true);
      tween.jump(1);
    }
  }, []);

  const enterGaze = () => {
    setDrawer(false);
    setGaze(true);
  };
  const exitGaze = () => {
    setGaze(false);
    setGrid(false);
  };

  const openHail = (id?: string) => {
    const target = id ?? hails[0]?.id;
    if (!target) return;
    setDrawer(false);
    hail.open(target);
  };

  // 단축키: G = 감상하기, Esc = 열린 것부터 닫고 마지막엔 조종석으로
  useEffect(() => {
    if (stage !== 0) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "Escape") {
        if (hail.openId) hail.close();
        else if (drawer) setDrawer(false);
        else if (gaze) exitGaze();
      } else if ((e.key === "g" || e.key === "G" || e.key === "ㅎ") && !gaze) {
        e.preventDefault();
        enterGaze();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 선내로 가면 서랍·화상 창을 닫는다
  useEffect(() => {
    if (stage === 1) {
      setDrawer(false);
      hail.close();
    }
  }, [stage, hail.close]);

  // 할 일이 없어지면(치웠으면) "더 보기" 창을 닫는다
  const moreTask = modal?.type === "more" ? taskById.get(modal.id) : undefined;
  useEffect(() => {
    if (modal?.type === "more" && !moreTask) setModal(null);
  }, [modal, moreTask]);

  // ── 유리 모양: 조종석 → (감상) 화면 바깥 / (선내) 위쪽 띠
  const cockpitShape: GlassShape = {
    x0: 14,
    x1: w - 14,
    topMid: 10,
    topCorner: 34,
    bottom: WINDOW_SHARE * h,
    r: 22,
  };
  const gazeShape: GlassShape = {
    x0: -70,
    x1: w + 70,
    topMid: -90,
    topCorner: -90,
    bottom: h + 90,
    r: 0,
  };
  const bandShape: GlassShape = {
    x0: -4,
    x1: w + 4,
    topMid: -4,
    topCorner: -4,
    bottom: BAND_SHARE * h,
    r: 0,
  };
  // 유리 아랫변은 내려가는 계기판에 붙어 함께 내려간다(사이가 비지 않게)
  const leaning = {
    ...mixShape(cockpitShape, gazeShape, gGlass),
    bottom: lerp(cockpitShape.bottom, gazeShape.bottom, gDash),
  };
  const shape = mixShape(leaning, bandShape, p);
  // 캔버스는 화면 크기 그대로 두고, 보이는 유리 한가운데에 화면 가운데가 오도록 옮긴다
  const visTop = Math.max(0, shape.topMid);
  const visBottom = Math.min(h, shape.bottom);
  const canvasTop = Math.max(
    visBottom - h,
    Math.min(0, (visTop + visBottom) / 2 - h / 2),
  );

  const dashTop = WINDOW_SHARE * h - 4;
  const dashShift = gDash * (h - dashTop + 40) + p * (h - dashTop);
  const cockpitAlpha = (1 - span(gDash, 0.55, 1)) * (1 - clamp01(p * 1.6));
  const glassUi = clamp01(1 - gGlass * 3) * clamp01(1 - p * 3);

  const close = () => setModal(null);
  const modalCrew =
    modal?.type === "crew" ? bridge.crewById.get(modal.id) : undefined;
  const listTasks =
    modal?.type === "list" && modal.kind === "late"
      ? warnings.old
      : bridge.tasks;

  const inCockpit = stage === 0 && !gaze;

  return (
    <main className="fixed inset-0 overflow-hidden bg-hull-950 break-keep text-white">
      {/* 창밖: 하나만 두고 위아래로만 옮긴다 */}
      <div
        className={`absolute inset-x-0 top-0 ${gaze ? "" : "[&_canvas]:cursor-default!"}`}
        style={{ height: h, transform: `translateY(${canvasTop}px)` }}
        data-sky
      >
        <SpaceView
          className="absolute inset-0"
          labels="few"
          lookAround={gaze}
          clickToFly
          drift
          grid={gaze && grid}
        />
      </div>

      {/* 창밖 이벤트: 유리 안에서만 */}
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{
          left: Math.max(0, shape.x0),
          top: visTop,
          width: Math.min(w, shape.x1) - Math.max(0, shape.x0),
          height: Math.max(0, visBottom - visTop),
          borderRadius: shape.r,
        }}
      >
        <EventLayer every={150} enabled={stage === 0} />
      </div>

      {/* 유리 테두리·선실·반사광 */}
      <GlassFrame
        w={w}
        h={h}
        shape={shape}
        frame={1 - clamp01(p * 1.4)}
        reflect={(1 - gGlass) * (1 - p)}
        blocking={!gaze && stage === 0}
      />
      {p > 0.02 && (
        <div
          className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.12]"
          style={{ top: shape.bottom }}
        />
      )}

      {/* 유리 위 글: 감상하기 단추와 아래 가장자리 계측 */}
      {glassUi > 0.01 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ opacity: glassUi }}
        >
          <button
            type="button"
            data-enter-gaze
            onClick={enterGaze}
            title="창밖을 크게 둘러봐요 (G)"
            className="pointer-events-auto absolute flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#08101e]/45 px-3 py-1 text-[12px] text-white/80 shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:border-white/35 hover:bg-[#0e1a30]/70 hover:text-white"
            style={{ top: shape.topCorner + 10, right: w - shape.x1 + 16 }}
          >
            <span aria-hidden className="text-[13px]">
              ⤢
            </span>
            우주 감상하기
          </button>
          <GlassReadout bottom={h - shape.bottom + 30} />
        </div>
      )}

      {/* 계기판: 감상하기에선 아래로 내려가고, 선내로 가면 아래로 비켜난다 */}
      <div
        className="absolute inset-x-0"
        style={{
          top: dashTop,
          height: h - dashTop,
          transform: `translateY(${dashShift}px)`,
          opacity: cockpitAlpha,
          visibility: cockpitAlpha < 0.01 ? "hidden" : "visible",
          pointerEvents: inCockpit ? "auto" : "none",
        }}
      >
        <Dashboard
          tasks={bridge.tasks}
          hails={hails}
          seen={hail.seen}
          crew={bridge.crew}
          crewById={bridge.crewById}
          warnings={warnings}
          connected={!bridge.error}
          now={now}
          drawerOpen={drawer}
          push={push}
          onDrawer={() => {
            if (!drawer) hail.close();
            setDrawer((d) => !d);
          }}
          onMore={(t) => setModal({ type: "more", id: t.id })}
          onList={(kind) => setModal({ type: "list", kind })}
          onHail={openHail}
          onCrew={(id) => setModal({ type: "crew", id })}
          onCrewMore={(context) => setModal({ type: "bank", context })}
          onPicker={() => setModal({ type: "nav" })}
          onInterior={() => goTo(1)}
        />
      </div>

      {/* 감상 모드 계기(2차 조종석 층) */}
      {gOver > 0.01 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: gOver,
            transform: `translateY(${(1 - gOver) * 8}px)`,
          }}
        >
          <GazeLayer
            tasks={bridge.tasks}
            hails={hails}
            seen={hail.seen}
            now={now}
            hailOpen={!!currentHail}
            grid={grid}
            onGrid={() => setGrid((v) => !v)}
            onHail={openHail}
            onExit={exitGaze}
          />
        </div>
      )}

      {/* 교신 화상 창: 조종석에선 유리 오른쪽 위, 감상 중엔 화면 오른쪽 위 */}
      {currentHail && stage === 0 && (g < 0.05 || g > 0.95) && (
        <div
          className={`absolute ${styles.hailIn}`}
          style={
            gaze
              ? { top: 52, right: 16 }
              : { top: shape.topCorner + 46, right: w - shape.x1 + 16 }
          }
        >
          <HailScreen
            hail={currentHail}
            task={
              currentHail.taskId ? taskById.get(currentHail.taskId) : undefined
            }
            index={hails.indexOf(currentHail)}
            count={hails.length}
            now={now}
            onStep={(d) => hail.step(d)}
            onClose={hail.close}
          />
        </div>
      )}

      {/* 내부 장면(창밖 띠 아래): 2차 그대로 */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: `${100 * BAND_SHARE}%`,
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px)`,
          pointerEvents: stage === 1 ? "auto" : "none",
          visibility: p < 0.02 ? "hidden" : "visible",
        }}
      >
        <Interior active={stage === 1} onCockpit={() => goTo(0)} />
      </div>

      <Toasts
        className={stage === 1 ? "" : gaze ? "bottom-24" : "top-14 bottom-auto"}
      />
      <ProtoBadge name="조종석과 감상창 (3차)" />

      {/* 모달 */}
      <Modal open={!!moreTask} onClose={close} title="지금 할 일" width={620}>
        {moreTask && (
          <TaskDetail task={moreTask} crewById={bridge.crewById} now={now} />
        )}
      </Modal>
      <Modal
        open={modal?.type === "list" && modal.kind !== "jobs"}
        onClose={close}
        title={
          modal?.type === "list" && modal.kind === "late"
            ? `1시간 넘게 기다린 일 ${warnings.old.length}`
            : `내 차례 전체 ${bridge.tasks.length}`
        }
        width={760}
      >
        <TaskList
          tasks={listTasks}
          crewById={bridge.crewById}
          now={now}
          empty="기다리는 일이 없어요. 순항 중."
        />
      </Modal>
      <Modal
        open={modal?.type === "list" && modal.kind === "jobs"}
        onClose={close}
        title="정기 작업 · 계기"
        width={560}
      >
        <GaugeList gauges={bridge.gauges} now={now} />
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
          <ul className="grid grid-cols-3 gap-1">
            {sortCrew(
              bridge.crew.filter((c) => c.context === modal.context),
            ).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setModal({ type: "crew", id: c.id })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-white/[0.06]"
                >
                  <CrewLamp status={c.status} />
                  <span className="truncate text-white/85">{c.name}</span>
                  <span className="ml-auto truncate text-[11px] text-white/40">
                    {c.activity}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal
        open={modal?.type === "nav"}
        onClose={close}
        title="항법 · 어디로 갈까요"
        width={720}
      >
        <div data-scroll-inside>
          <DestinationPicker onPick={close} />
        </div>
      </Modal>
    </main>
  );
}

/** 한국 시각 "16:19:02" */
const SEOUL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** 유리 아래 가장자리의 작은 글: 목적지 · 지구까지 거리 · 교신 지연 · 한국 시각(진짜 값) */
function GlassReadout({ bottom }: { bottom: number }) {
  const t = useTelemetry(2);
  // 1초마다 다시 그려 준다. 화면이 뜨기 전(서버 그림)에는 "--:--:--"
  const korea = useKoreaTime();
  const time = korea.date ? SEOUL.format(new Date()) : korea.time;
  const dest = useDestination();
  const atEarth = dest.id === "earth" && !t.traveling;
  const km =
    t.earthKm < 14_959_787
      ? `${Math.round(t.earthKm).toLocaleString("ko-KR")} km`
      : formatDistance(t.earthKm);
  return (
    <div
      data-glass-readout
      className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/25 px-3 py-[3px] font-mono text-[11px] whitespace-nowrap text-white/55 tabular-nums backdrop-blur-[2px]"
      style={{ bottom }}
    >
      <span>
        <span className="font-sans text-white/35">
          {t.traveling ? "이동 중 → " : "목적지 "}
        </span>
        <span className="font-sans text-white/85">{dest.ko}</span>
      </span>
      <span className="text-white/20">·</span>
      <span>
        <span className="font-sans text-white/35">
          {atEarth ? "지구 고도 " : "지구까지 "}
        </span>
        {km}
      </span>
      <span className="text-white/20">·</span>
      <span>
        <span className="font-sans text-white/35">교신 지연 </span>
        {lightTime(t.earthKm)}
      </span>
      <span className="text-white/20">·</span>
      <span>
        <span className="font-sans text-white/35">한국 </span>
        {time}
      </span>
      <span className="text-white/20">·</span>
      <ScaleNote />
    </div>
  );
}
