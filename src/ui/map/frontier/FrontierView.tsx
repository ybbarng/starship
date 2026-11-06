"use client";

// 개척지 선실: 프로젝트 하나를 우리 우주선이 내려앉은 행성의 개척지로 그린다(설계: docs/frontier.md).
// 가운데 착륙선(목표) 둘레로 구역마다 육각 칸 size개가 붙고, 맨 위 구역(지역)은 굵은 색 경계로 묶인다.
// 상태는 땅 모습으로: 안개는 모래 폭풍, 공사중은 갈아엎은 흙과 장비, 완공은 초록 돔, 막힘은 붉은 울타리.
// 배치는 hex.ts, 카메라(끌기·확대)는 camera.ts가 순수 함수로 정한다. 여기서는 그 둘을 화면에 곱한다.
// 처음에는 전체가 들어오게 맞추고, 끌고 확대해 다닐 수 있다. 이름표 글자는 크기가 그대로라
// 확대할수록 더 많은 이름표가 자리를 얻는다.
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCrewMapHistory } from "@/data/hooks";
import {
  droppedIds,
  isForkForMe,
  isNewFound,
  type Region,
  type RegionStatus,
  type Sign,
} from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { REGION_STATUS_LABEL } from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import { ForkAnswer } from "../ForkAnswer";
import {
  PARTY_MS,
  Party,
  partyTextY,
  WALK_MS,
  WaitBubble,
  Walker,
} from "./alive";
import {
  type Box,
  boxOf,
  type Camera,
  CLIP_BY_STAGE,
  centerOn,
  clampCamera,
  DRAG_THRESHOLD,
  type EdgeAsk,
  type EdgeTag,
  ease,
  FLY_MS,
  fitCamera,
  fitScale,
  isOnScreen,
  lerpCamera,
  panBy,
  parseCamera,
  placeEdgeTags,
  revealCamera,
  type Stage,
  stageFor,
  type Viewport,
  viewCenter,
  zoomAt,
  zoomRange,
} from "./camera";
import { CRANE_CELLS, cellSeed, dugOf, rigCount, spread } from "./decor";
import styles from "./frontier.module.css";
import { FrontierLegend } from "./Legend";
import { planetFor } from "./planet";
import { ReplayBar, stepMs, useReplay } from "./replay";
import {
  diffSeen,
  loadSeen,
  type Seen,
  type SeenDiff,
  saveSeen,
  seenOf,
} from "./seen";
import { placeTeams, type TeamOnMap } from "./teams";
import { type Weather, weatherOf } from "./weather";

const LEGEND_SEEN = "starship.frontier.legend-seen";

import {
  add,
  clip,
  corners,
  dodgeY,
  EDGE_DIRS,
  type Hex,
  hexKey,
  type LabelAsk,
  layoutFrontier,
  overlaps,
  type PlacedLabel,
  placeLabels,
  type Rect,
  ringOf,
  textWidth,
  toPixel,
} from "./hex";

/** 지역 색. 지도에 적힌 차례대로 고른다. 상태 색(초록·빨강·노랑)과 겹치지 않게 골랐다 */
export const TERRITORY_COLORS = [
  "#e9b872",
  "#9db4ff",
  "#cf9ef5",
  "#6fd6cb",
  "#f4a0bf",
  "#c6d27a",
];

/** 상태별 땅 바탕 */
export const GROUND: Record<RegionStatus, string> = {
  fog: "#454c5e",
  // 밝은 파헤친 흙: 막힘(어두운 붉은 갈색)·완공(초록)·안개(회색)와 밝기부터 다르다
  building: "#9a7444",
  done: "#2e7350",
  blocked: "#5e2329",
  dropped: "#262a33",
};

type P = { x: number; y: number };

const CAPTION_H = 26;
/** 단추 한 번에 확대하는 배율 */
const ZOOM_STEP = 1.5;
/** 화살표 한 번에 옮기는 거리(px) */
const PAN_STEP = 80;
/** "지금 여기"·"다음 갈림길"로 갈 때 적어도 이만큼 가까이(칸 반지름 px, 가운데 단계) */
const VISIT_S = 24;

const storeKeyOf = (id: string) => `starship.frontier.camera.${id}`;
function loadCamera(key: string): Camera | undefined {
  try {
    return parseCamera(window.sessionStorage.getItem(key));
  } catch {
    return undefined;
  }
}
function saveCamera(key: string, cam: Camera) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(cam));
  } catch {
    // 저장이 막힌 브라우저면 기억하지 않는다
  }
}
function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 땅 좌표로 구역(자손 포함) 무게중심 */
function worldCenterOf(
  layout: ReturnType<typeof layoutFrontier>,
  id: string,
): P | undefined {
  const cells = layout.cellsOf.get(id) ?? [];
  if (cells.length === 0) return undefined;
  const ps = cells.map((c) => toPixel(c));
  return {
    x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
    y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
  };
}

/**
 * 키를 친 곳이 지도 단축키를 받지 않는 곳인가. 깃발 답 창·되감기 막대 안이면 그 이름,
 * 그 밖의 글 칸(input·textarea·select·contenteditable)이면 "field", 아니면 null.
 */
function keyOwnerOf(
  t: EventTarget | null,
): "fork-pop" | "replay-bar" | "field" | null {
  if (!(t instanceof Element)) return null;
  if (t.closest("[data-fork-pop]")) return "fork-pop";
  if (t.closest("[data-replay-bar]")) return "replay-bar";
  if (t.closest("input,textarea,select,[contenteditable]")) return "field";
  return null;
}

/** 누른 곳이 땅·이름표·단추가 아닌 빈 곳인가 */
const isEmptySpot = (t: EventTarget | null) =>
  !(t instanceof Element) ||
  !t.closest("[data-region],[data-region-label],[data-camera],[data-edge-tag]");

export function FrontierView({
  map,
  crew,
  selected,
  onSelect,
  showDropped,
  now,
  teams,
}: MapViewProps) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e)
        setSize({
          w: Math.floor(e.contentRect.width),
          h: Math.floor(e.contentRect.height),
        });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // 도움말: 처음 한 번은 저절로 연다(이 브라우저에서 본 적이 없으면)
  const [legend, setLegend] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(LEGEND_SEEN)) {
        setLegend(true);
        localStorage.setItem(LEGEND_SEEN, "1");
      }
    } catch {
      // 저장소를 못 쓰면 저절로 열지 않는다
    }
  }, []);

  const layout = useMemo(() => layoutFrontier(map), [map]);
  const dropped = useMemo(() => droppedIds(map), [map]);
  /* ── 되감기: 지나온 지도를 한 장씩(replay.tsx). 카메라 맞춤은 지금 지도 기준 그대로 ── */
  const [replayOpen, setReplayOpen] = useState(false);
  const history = useCrewMapHistory(crew?.id, replayOpen);
  const frames = history.data?.frames ?? [];
  const replay = useReplay(frames, replayOpen);
  const replaying = replayOpen && frames.length >= 2;
  const shownMap = replaying ? (frames[replay.k]?.map ?? map) : map;
  const shownLayout = useMemo(() => layoutFrontier(shownMap), [shownMap]);
  const shownDropped = useMemo(() => droppedIds(shownMap), [shownMap]);
  /* ── 깃발을 눌러 바로 정하기: 깃발 옆에 선택지 창. 지도를 움직이면 닫는다 ── */
  const [forkPop, setForkPop] = useState<{
    region: string;
    id: string;
    x: number;
    y: number;
  } | null>(null);
  // 숨긴 칸까지 넣어 맞춘다. "버린 구역 보기"를 껐다 켜도 크기가 그대로다
  const box = useMemo<Box>(
    () => boxOf(layout.leaves.flatMap((l) => l.cells.map((c) => toPixel(c)))),
    [layout],
  );
  const vp: Viewport = {
    w: size.w,
    h: size.h,
    top: 6,
    bottom: CAPTION_H + 4,
    side: 20,
  };
  const s0 = size.w > 0 ? fitScale(box, vp) : 1;

  /* ── 카메라: 승무원마다 브라우저에 기억한다. 5초마다 지도가 다시 와도 이 상태는 그대로다 ── */
  const storeKey = storeKeyOf(crew?.id ?? map.title);
  const [rawCam, setRawCam] = useState<Camera | undefined>(() =>
    typeof window === "undefined" ? undefined : loadCamera(storeKey),
  );
  const loadedKey = useRef(storeKey);
  useEffect(() => {
    // 승무원 정보가 늦게 와서 열쇠가 바뀌면, 그 열쇠로 기억한 자리가 있을 때만 옮긴다
    if (loadedKey.current === storeKey) return;
    loadedKey.current = storeKey;
    const c = loadCamera(storeKey);
    if (c) setRawCam(c);
  }, [storeKey]);
  const cam = clampCamera(rawCam ?? fitCamera(box), box, vp, s0);
  const camRef = useRef(cam);
  camRef.current = cam;
  const geo = useRef({ box, vp, s0 });
  geo.current = { box, vp, s0 };

  const flight = useRef<number | null>(null);
  const stopFlight = useCallback(() => {
    if (flight.current !== null) cancelAnimationFrame(flight.current);
    flight.current = null;
  }, []);
  // 브라우저 기억은 움직임이 멈춘 뒤 한 번만(끌기·비행·휠 동안 프레임마다 sessionStorage에 쓰지 않는다).
  // 사람이 움직인 카메라만 그 열쇠로 적고, 선실을 떠나면 남은 것을 바로 적는다
  const pendingSave = useRef<{ key: string; cam: Camera } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const p = pendingSave.current;
    pendingSave.current = null;
    if (p) saveCamera(p.key, p.cam);
  }, []);
  useEffect(() => flushSave, [flushSave]);
  const setCam = useCallback(
    (c: Camera) => {
      setRawCam(c);
      setForkPop(null);
      pendingSave.current = { key: storeKey, cam: c };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, 250);
    },
    [storeKey, flushSave],
  );
  /** 부드럽게 날아간다(0.35초). 움직임을 줄이는 설정이면 바로 옮긴다 */
  const flyTo = useCallback(
    (target: Camera) => {
      stopFlight();
      const from = camRef.current;
      if (reducedMotion()) {
        setCam(target);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / FLY_MS);
        setCam(lerpCamera(from, target, ease(k)));
        flight.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      flight.current = requestAnimationFrame(step);
    },
    [setCam, stopFlight],
  );
  useEffect(() => stopFlight, [stopFlight]);

  // 고른 구역이 바뀌었는데(오른쪽 판 목록에서 고를 때 등) 화면 밖이면 그리로 날아간다.
  // 이미 보이면 움직이지 않는다. 처음 열 때 고른 구역(지금 여기)은 건드리지 않는다.
  const prevSelected = useRef(selected);
  const skipReveal = useRef(false);
  const measured = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (prevSelected.current === selected) return;
    prevSelected.current = selected;
    const skip = skipReveal.current;
    skipReveal.current = false;
    if (!selected || skip || !measured) return;
    const c = worldCenterOf(layout, selected);
    if (!c) return;
    const { box: b, vp: v, s0: s } = geo.current;
    const target = revealCamera(camRef.current, c, b, v, s);
    if (target !== camRef.current) flyTo(target);
  }, [selected, layout, measured, flyTo]);

  const local = (e: { clientX: number; clientY: number }): P => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  /* ── 휠·트랙패드 핀치: 마우스 위치를 중심으로. 페이지가 스크롤되지 않게 직접 붙인다 ── */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 도움말·깃발 답 창 위에서는 그 창을 스크롤한다(지도 확대로 쓰지 않는다)
      if (
        e.target instanceof Element &&
        e.target.closest("[data-map-legend],[data-fork-pop]")
      )
        return;
      e.preventDefault();
      stopFlight();
      const { box: b, vp: v, s0: s } = geo.current;
      // 핀치(ctrlKey)는 한 번에 작게 오니 더 세게 곱한다
      const k = e.ctrlKey ? 0.012 : 0.0018;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const r = el.getBoundingClientRect();
      setCam(
        zoomAt(
          camRef.current,
          Math.exp(-dy * k),
          { x: e.clientX - r.left, y: e.clientY - r.top },
          b,
          v,
          s,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setCam, stopFlight]);

  /* ── 끌기(4px 넘게 움직이면)와 두 손가락 핀치 ── */
  const pointers = useRef(new Map<number, P>());
  const drag = useRef<{
    start: P;
    cam: Camera;
    moved: boolean;
    pinch?: { dist: number; mid: P };
  } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !isEmptyOrLand(e.target)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    stopFlight();
    if (pointers.current.size === 1)
      drag.current = { start: p, cam: camRef.current, moved: false };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b)
        drag.current = {
          start: p,
          cam: camRef.current,
          moved: true,
          pinch: {
            dist: Math.hypot(a.x - b.x, a.y - b.y),
            mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          },
        };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const { box: b, vp: v, s0: s } = geo.current;
    if (d.pinch && pointers.current.size >= 2) {
      const [a, c] = [...pointers.current.values()];
      if (!a || !c) return;
      const dist = Math.hypot(a.x - c.x, a.y - c.y);
      const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
      const zoomed = zoomAt(
        camRef.current,
        dist / Math.max(1, d.pinch.dist),
        mid,
        b,
        v,
        s,
      );
      setCam(
        panBy(zoomed, mid.x - d.pinch.mid.x, mid.y - d.pinch.mid.y, b, v, s),
      );
      d.pinch = { dist, mid };
      return;
    }
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      ref.current?.setPointerCapture(e.pointerId);
    }
    setCam(panBy(d.cam, dx, dy, b, v, s));
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.moved) suppressClick.current = true;
    if (pointers.current.size === 0) drag.current = null;
    else if (d?.pinch) {
      // 한 손가락이 남으면 거기서 다시 끌기
      const [rest] = [...pointers.current.values()];
      if (rest)
        drag.current = { start: rest, cam: camRef.current, moved: true };
    }
  };

  /* ── 카메라 일 ── */
  const zoomBy = (factor: number, at?: P) => {
    const { box: b, vp: v, s0: s } = geo.current;
    flyTo(zoomAt(camRef.current, factor, at ?? viewCenter(v), b, v, s));
  };
  const showAll = () => flyTo(fitCamera(box));
  /** 구역으로 날아가 고른다. close면 적어도 가운데 단계까지 다가간다 */
  const visit = (id: string, close: boolean) => {
    const c = worldCenterOf(layout, id);
    if (!c) return;
    const zoom = close
      ? Math.max(cam.zoom, Math.min(zoomRange(s0).max, VISIT_S / s0))
      : cam.zoom;
    flyTo(centerOn(cam, c, box, vp, s0, zoom));
    if (selected !== id) {
      // 여기서 이미 날아가니, 고르기가 바뀌어 다시 날지 않게
      skipReveal.current = true;
      onSelect(id);
    }
  };
  const visible = (id: string) => showDropped || !dropped.has(id);
  const myForks = layout.leaves
    .map((l) => l.region)
    .filter(
      (r) =>
        visible(r.id) &&
        !dropped.has(r.id) &&
        (r.signs ?? []).some(
          (x) =>
            isForkForMe(x) && !(x.type === "fork" && x.status === "decided"),
        ),
    )
    .map((r) => r.id);
  const [forkAt, setForkAt] = useState(-1);
  const nextFork = () => {
    if (myForks.length === 0) return;
    const k = (forkAt + 1) % myForks.length;
    setForkAt(k);
    const id = myForks[k];
    if (id) visit(id, true);
  };
  const goHere = () => {
    if (map.here && visible(map.here)) visit(map.here, true);
  };
  // 도움말(왼쪽 위)과 되감기 막대(위 가운데)는 넓은 도움말이 막대를 가리니 하나만 연다
  const toggleLegend = () => {
    if (!legend) setReplayOpen(false);
    setLegend(!legend);
  };
  const toggleReplay = () => {
    if (!replayOpen) setLegend(false);
    setReplayOpen(!replayOpen);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    // 깃발 답 창·되감기 막대·글 칸에서 친 키는 지도 단축키가 아니다(답 글의 "f"가 다음 갈림길로 새지 않게).
    // Esc만 받아 그 창을 닫는다
    const owner = keyOwnerOf(e.target);
    if (owner) {
      if (k !== "Escape") return;
      if (owner === "fork-pop") setForkPop(null);
      else if (owner === "replay-bar") setReplayOpen(false);
      else return;
      e.preventDefault();
      return;
    }
    let done = true;
    if (k === "+" || k === "=") zoomBy(ZOOM_STEP);
    else if (k === "-" || k === "_") zoomBy(1 / ZOOM_STEP);
    else if (k === "0") showAll();
    else if (k === "h" || k === "H") goHere();
    else if (k === "f" || k === "F") nextFork();
    else if (k === "?") toggleLegend();
    else if (k === "Escape") {
      if (forkPop) setForkPop(null);
      else if (legend) setLegend(false);
      else if (replayOpen) setReplayOpen(false);
      else if (selected) onSelect(selected);
    } else if (k.startsWith("Arrow")) {
      const dx =
        k === "ArrowLeft" ? PAN_STEP : k === "ArrowRight" ? -PAN_STEP : 0;
      const dy = k === "ArrowUp" ? PAN_STEP : k === "ArrowDown" ? -PAN_STEP : 0;
      flyTo(panBy(cam, dx, dy, box, vp, s0));
    } else done = false;
    if (done) e.preventDefault();
  };

  const s = s0 * cam.zoom;
  const vc = viewCenter(vp);
  const ox = vc.x - cam.x * s;
  const oy = vc.y - cam.y * s;
  // 맞춤에서 화면 위쪽(높이 7%)에 있던 지평선을 땅 좌표로 적어 두고 카메라를 따라 옮긴다
  const fit = fitCamera(box);
  const fitLimb = Math.max(14, size.h * 0.07);
  const limb = {
    x: vc.x + (fit.x - cam.x) * s,
    y: vc.y + (fit.y + (fitLimb - vc.y) / s0 - cam.y) * s,
    r: Math.max(size.w, size.h) * 2.2 * cam.zoom,
  };
  const { min: zMin, max: zMax } = zoomRange(s0);
  const forkLabel =
    myForks.length > 0
      ? forkAt >= 0
        ? `다음 ${(forkAt % myForks.length) + 1}/${myForks.length}`
        : `다음 · ${myForks.length}개`
      : "";

  return (
    <section
      ref={ref}
      data-map
      data-zoom={cam.zoom.toFixed(2)}
      data-stage={stageFor(s, cam.zoom)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: 지도에 초점을 두고 키보드로 움직인다
      tabIndex={0}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-white/30 active:cursor-grabbing"
      aria-label={`${map.title} 개척지 지도. 끌어서 옮기고 휠로 확대해요. 키보드: + - 0 화살표 h f Esc`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => {
        // 빈 곳 누르기: 고르기 풀기
        if (isEmptySpot(e.target) && selected) onSelect(selected);
      }}
      onDoubleClick={(e) => {
        if (isEmptySpot(e.target)) zoomBy(ZOOM_STEP, local(e));
      }}
      onKeyDown={onKeyDown}
    >
      {size.w > 0 && size.h > 0 && (
        <Scene
          w={size.w}
          h={size.h}
          s={s}
          ox={ox}
          oy={oy}
          stage={stageFor(s, cam.zoom)}
          limb={limb}
          uid={uid}
          map={shownMap}
          crew={crew}
          layout={shownLayout}
          dropped={shownDropped}
          replay={replaying}
          walkMs={
            replaying ? Math.min(WALK_MS, stepMs(frames.length) * 0.9) : WALK_MS
          }
          onFork={
            crew && !replaying
              ? (region, id, at) => setForkPop({ region, id, ...at })
              : undefined
          }
          selected={selected}
          hover={hover}
          setHover={setHover}
          onSelect={onSelect}
          onVisit={(id) => visit(id, false)}
          showDropped={showDropped}
          now={now}
          teams={replaying ? undefined : teams}
        />
      )}
      <div
        role="toolbar"
        aria-label="지도 카메라"
        className="absolute top-2 right-2 flex flex-col items-end gap-1 text-[12px]"
      >
        <div className="flex overflow-hidden rounded-md border border-white/15 bg-[#0a0a10]/85">
          <CamButton
            name="zoom-in"
            title="확대 (+)"
            disabled={cam.zoom >= zMax - 1e-3}
            onClick={() => zoomBy(ZOOM_STEP)}
          >
            +
          </CamButton>
          <CamButton
            name="zoom-out"
            title="축소 (-)"
            disabled={cam.zoom <= zMin + 1e-3}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
          >
            −
          </CamButton>
          <CamButton name="fit" title="전체 보기 (0)" onClick={showAll}>
            ⤢ 전체
          </CamButton>
          <CamButton
            name="help"
            title="이 지도 읽는 법 (?)"
            onClick={toggleLegend}
          >
            ? 도움말
          </CamButton>
        </div>
        {crew && (
          <CamButton
            name="replay"
            title="개척 되감기: 지도가 지나온 모습"
            boxed
            onClick={toggleReplay}
          >
            ⏪ 되감기
          </CamButton>
        )}
        {map.here && visible(map.here) && (
          <CamButton name="here" title="지금 여기로 (h)" boxed onClick={goHere}>
            🐾 지금 여기
          </CamButton>
        )}
        {myForks.length > 0 && (
          <CamButton
            name="next-fork"
            title="내가 정할 갈림길 차례로 (f)"
            boxed
            tone="fork"
            onClick={nextFork}
          >
            ⑂ {forkLabel}
          </CamButton>
        )}
      </div>
      {legend && (
        <FrontierLegend crew={crew} onClose={() => setLegend(false)} />
      )}
      <WeatherTag weather={weatherOf(crew)} />
      {forkPop && crew && (
        <ForkPop
          map={map}
          crewId={crew.id}
          pop={forkPop}
          w={size.w}
          onClose={() => setForkPop(null)}
        />
      )}
      {replayOpen && (
        <ReplayBar
          frames={frames}
          replay={replay}
          loading={history.isLoading}
          onClose={() => setReplayOpen(false)}
        />
      )}

      {map.goal && (
        <div
          className="pointer-events-none absolute bottom-2 left-3 max-w-[46%] rounded bg-black/60 px-2 py-0.5 text-[11.5px] leading-snug backdrop-blur-[2px]"
          title={map.goal}
        >
          <span className="text-white/45">
            {planetFor(crew?.id ?? map.title).name} · 착륙선 목표 ·{" "}
          </span>
          <span className="text-white/75">{clip(map.goal, 40)}</span>
        </div>
      )}
    </section>
  );
}

/** 깃발 옆 선택지 창(ForkAnswer). 세션이 지도를 고치기 전까지는 깃발이 그대로다 */
function ForkPop({
  map,
  crewId,
  pop,
  w,
  onClose,
}: {
  map: MapViewProps["map"];
  crewId: string;
  pop: { region: string; id: string; x: number; y: number };
  w: number;
  onClose: () => void;
}) {
  const sign = map.regions
    .find((r) => r.id === pop.region)
    ?.signs?.find((x) => x.id === pop.id);
  if (sign?.type !== "fork") return null;
  const W = 280;
  const left = Math.max(8, Math.min(w - W - 8, pop.x - W / 2));
  return (
    <div
      data-fork-pop
      data-camera="fork-pop"
      role="dialog"
      aria-label="갈림길 정하기"
      className="absolute z-20 rounded-lg border border-[#ffd84a]/40 bg-[#0a0a10]/95 px-3 py-2.5 text-[12.5px] shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
      style={{ left, top: Math.max(8, pop.y + 14), width: W }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <span className="text-[#ffd84a]">⑂</span>
        <div className="min-w-0 flex-1 font-semibold text-white">
          {sign.title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded px-1 text-white/50 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <ForkAnswer crewId={crewId} region={pop.region} sign={sign} />
    </div>
  );
}

/** 아래 오른쪽: 지금 날씨가 무슨 뜻인지 한 줄로(맑은 낮이면 없음) */
function WeatherTag({ weather }: { weather: Weather }) {
  const lines = [
    weather.night && "🌙 밤 · 세션이 꺼져 있어요",
    weather.storm && "🌪 모래 폭풍 · 지도가 일보다 뒤처졌어요",
  ].filter(Boolean);
  if (!lines.length) return null;
  return (
    <div
      data-weather-tag
      className="pointer-events-none absolute right-3 bottom-2 flex flex-col items-end gap-1 text-[11.5px]"
    >
      {lines.map((l) => (
        <span
          key={String(l)}
          className="rounded bg-black/60 px-2 py-0.5 text-white/75 backdrop-blur-[2px]"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** 땅이나 빈 곳(단추·화면 밖 표가 아닌 곳)인가: 여기서만 끌기를 시작한다 */
const isEmptyOrLand = (t: EventTarget | null) =>
  !(t instanceof Element) || !t.closest("[data-camera],[data-edge-tag]");

function CamButton({
  name,
  title,
  disabled,
  boxed,
  tone,
  onClick,
  children,
}: {
  name: string;
  title: string;
  disabled?: boolean;
  boxed?: boolean;
  tone?: "fork";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-camera={name}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`cursor-pointer px-2.5 py-1 leading-tight whitespace-nowrap tabular-nums hover:bg-white/10 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent ${
        boxed
          ? `rounded-md border bg-[#0a0a10]/85 ${tone === "fork" ? "border-[#ffd84a]/40 text-[#ffd84a]" : "border-white/15 text-white/80"}`
          : "border-white/10 text-white/80 not-first:border-l"
      }`}
    >
      {children}
    </button>
  );
}

function Scene({
  w,
  h,
  s,
  ox,
  oy,
  stage,
  limb,
  uid,
  map,
  crew,
  layout,
  dropped,
  selected,
  hover,
  setHover,
  onSelect,
  onVisit,
  showDropped,
  now,
  replay = false,
  walkMs = WALK_MS,
  onFork,
  teams,
}: {
  w: number;
  h: number;
  /** 칸 반지름(px). 맞춤 배율 × 카메라 배율 */
  s: number;
  /** 착륙선(땅 좌표 0,0)의 화면 자리 */
  ox: number;
  oy: number;
  stage: Stage;
  /** 지평선: 행성 원의 가운데 x, 맨 위 y, 반지름(화면 px) */
  limb: { x: number; y: number; r: number };
  uid: string;
  map: MapViewProps["map"];
  crew?: Crew;
  layout: ReturnType<typeof layoutFrontier>;
  dropped: Set<string>;
  selected: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  /** 화면 밖 표를 눌렀다: 그리로 날아가 고른다 */
  onVisit: (id: string) => void;
  showDropped: boolean;
  now: number;
  /** 되감기 중: 바뀐 것은 보여 주되 브라우저에 기억하지 않는다 */
  replay?: boolean;
  /** 승무원이 걷는 시간(되감기 중에는 장 사이보다 짧게) */
  walkMs?: number;
  /** 내 갈림길 깃발을 눌렀다(없으면 깃발을 누를 수 없다) */
  onFork?: (region: string, signId: string, at: P) => void;
  /** 이 지도를 같이 쓰는 작업팀(teams.ts). 되감기 중에는 세우지 않는다 */
  teams?: TeamOnMap[];
}) {
  const visible = (id: string) => showDropped || !dropped.has(id);
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const leafById = new Map(layout.leaves.map((l) => [l.region.id, l]));
  const terrIndex = new Map(
    layout.territories.map((t) => [t.region.id, t.index]),
  );
  const colorOf = (territory: string) =>
    TERRITORY_COLORS[(terrIndex.get(territory) ?? 0) % 6] ?? "#fff";
  /** 땅 장식(돔·장비·표지)은 칸 크기를 따르되 너무 커지지 않게 */
  const ds = Math.min(s, 30);
  /** 늘 보여야 할 표(내 깃발·금지 표지)는 작아져도 이만큼은 지킨다 */
  const ks = Math.max(14, Math.min(s, 30));

  const px = (hx: Hex): P => {
    const p = toPixel(hx, s);
    return { x: ox + p.x, y: oy + p.y };
  };
  const poly = (c: P, k = 1) =>
    corners(c.x, c.y, s * k)
      .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
      .join(" ");

  /* ── 칸 주인(보이는 잎만) ── */
  const owner = new Map<string, string>();
  for (const l of layout.leaves)
    if (visible(l.region.id))
      for (const c of l.cells) owner.set(hexKey(c), l.region.id);

  /* ── 경계선: 지역(굵게, 지역 색) · 구역(중간) · 3단(얇게) · 같은 구역 칸 사이(흐리게) ── */
  const terrEdges = new Map<string, string[]>();
  const regionEdges: string[] = [];
  const subEdges: string[] = [];
  const cellEdges: string[] = [];
  const seg = (a?: P, b?: P) =>
    a && b
      ? `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
      : "";
  for (const l of layout.leaves) {
    if (!visible(l.region.id)) continue;
    for (const c of l.cells) {
      const p = px(c);
      const cs = corners(p.x, p.y, s);
      const inset = corners(p.x, p.y, s * 0.9);
      EDGE_DIRS.forEach((d, i) => {
        const nid = owner.get(hexKey(add(c, d)));
        const other = nid ? leafById.get(nid) : undefined;
        if (!other || other.territory !== l.territory) {
          const list = terrEdges.get(l.territory) ?? [];
          list.push(seg(inset[i], inset[(i + 1) % 6]));
          terrEdges.set(l.territory, list);
        } else if (other.group !== l.group)
          regionEdges.push(seg(cs[i], cs[(i + 1) % 6]));
        else if (other.region.id !== l.region.id)
          subEdges.push(seg(cs[i], cs[(i + 1) % 6]));
        else if (i < 3) cellEdges.push(seg(cs[i], cs[(i + 1) % 6]));
      });
    }
  }
  /** 구역(자손 포함) 둘레 선 */
  const outline = (id: string, k = 1) => {
    const cells = layout.cellsOf.get(id) ?? [];
    const keys = new Set(
      cells.filter((c) => owner.has(hexKey(c))).map((c) => hexKey(c)),
    );
    const out: string[] = [];
    for (const c of cells) {
      if (!keys.has(hexKey(c))) continue;
      const p = px(c);
      const cs = corners(p.x, p.y, s * k);
      EDGE_DIRS.forEach((d, i) => {
        if (!keys.has(hexKey(add(c, d)))) out.push(seg(cs[i], cs[(i + 1) % 6]));
      });
    }
    return out.join("");
  };

  /* ── 구역마다 가운데 칸과 표지 자리 ── */
  type Spot = { leaf: (typeof layout.leaves)[number]; center: P; slots: P[] };
  const spots = new Map<string, Spot>();
  for (const l of layout.leaves) {
    const ps = l.cells.map(px);
    const c = {
      x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
      y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
    };
    // 가운데 가까운 칸부터. 칸보다 표지가 많으면 칸 안 좌우로 나눈다
    const sorted = [...ps].sort(
      (a, b) =>
        Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
    );
    const slots = [
      ...sorted,
      ...sorted.map((p) => ({ x: p.x + s * 0.42, y: p.y + s * 0.1 })),
      ...sorted.map((p) => ({ x: p.x - s * 0.42, y: p.y + s * 0.1 })),
    ];
    spots.set(l.region.id, { leaf: l, center: c, slots });
  }
  /** 구역(자손 포함) 무게중심 */
  const centerOf = (id: string): P | undefined => {
    const cells = (layout.cellsOf.get(id) ?? []).filter((c) =>
      owner.has(hexKey(c)),
    );
    if (cells.length === 0) return undefined;
    const ps = cells.map(px);
    return {
      x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
      y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
    };
  };

  const statusOf = (r: Region): RegionStatus =>
    dropped.has(r.id) ? "dropped" : r.status;
  const activeSigns = (r: Region) =>
    (r.signs ?? [])
      .filter((x) => !(x.type === "fork" && x.status === "decided"))
      .filter((x) => !(x.type === "talk" && x.status === "done"))
      .sort((a, b) => Number(isForkForMe(b)) - Number(isForkForMe(a)));

  /* ── 동물 선원 ── */
  const hereLeaf = map.here ? spots.get(map.here) : undefined;
  const hereCenter = map.here
    ? hereLeaf && visible(map.here)
      ? hereLeaf.slots[0]
      : visible(map.here)
        ? centerOf(map.here)
        : undefined
    : undefined;
  const animalSize = Math.max(26, Math.min(58, s * 1.55));
  /** 날씨와 낮밤(weather.ts) */
  const weather = weatherOf(crew);
  /** 프로젝트마다 다른 행성(planet.ts) */
  const planet = planetFor(crew?.id ?? map.title);

  /* ── 작업팀: 책상 일터(doing[].region) 칸에, 없으면 착륙선 옆에(teams.ts) ── */
  const teamSize = animalSize * 0.72;
  const teamLift = ds * 0.45;
  // 잎 구역은 가운데 칸, 묶음 구역(자식이 있는 구역)은 무게중심. 소장 그림(지금 여기)과 같은 규칙
  const spotOf = (id: string): P | undefined =>
    visible(id) ? (spots.get(id)?.slots[0] ?? centerOf(id)) : undefined;
  const teamSpots = placeTeams(
    teams ?? [],
    (id) => spotOf(id) !== undefined,
    hereCenter ? map.here : null,
  ).map((t) => {
    const base = (t.region ? spotOf(t.region) : undefined) ?? {
      // 착륙장 오른쪽 아래 가장자리
      x: ox + s * 1.75,
      y: oy + s * 1.1,
    };
    const at = { x: base.x + t.dx * teamSize, y: base.y };
    return { ...t, at, world: { x: (at.x - ox) / s, y: (at.y - oy) / s } };
  });

  /* ── 살아 있는 지도: 지난번 본 것과 달라졌으면 걷고, 완공을 축하한다(seen.ts, alive.tsx) ── */
  const who = crew?.id ?? map.title;
  const toWorld = (p: P): P => ({ x: (p.x - ox) / s, y: (p.y - oy) / s });
  const [walk, setWalk] = useState<{ from: P; to: P; t0: number } | null>(null);
  const [parties, setParties] = useState<{ id: string; t0: number }[]>([]);
  const seenRef = useRef<Seen | undefined>(undefined);
  const seenLoaded = useRef<string | null>(null);
  const replayPrev = useRef<Seen | undefined>(undefined);
  // 지도가 새로 올 때만 비교한다(카메라가 움직일 때는 아니다). 화면 자리는 이번 그림의 값을 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 지도·승무원이 바뀔 때만
  useEffect(() => {
    let diff: SeenDiff;
    if (replay) {
      // 되감기: 앞 장과 비교만 한다(기억은 지금 지도 기준 그대로 둔다)
      diff = diffSeen(replayPrev.current, map);
      replayPrev.current = seenOf(map);
    } else {
      replayPrev.current = undefined;
      if (seenLoaded.current !== who) {
        seenRef.current = loadSeen(who);
        seenLoaded.current = who;
      }
      diff = diffSeen(seenRef.current, map);
      seenRef.current = seenOf(map);
      saveSeen(who, seenRef.current);
    }
    if (reducedMotion()) return;
    const t0 = performance.now();
    const fromP = diff.walkFrom
      ? (spots.get(diff.walkFrom)?.slots[0] ?? centerOf(diff.walkFrom))
      : undefined;
    if (fromP && hereCenter)
      setWalk({ from: toWorld(fromP), to: toWorld(hereCenter), t0 });
    const shown = diff.newlyDone.filter((id) => visible(id) && centerOf(id));
    if (shown.length)
      setParties((cur) => [...cur, ...shown.map((id) => ({ id, t0 }))]);
  }, [map, who]);
  useEffect(() => {
    if (!walk) return;
    const t = setTimeout(() => setWalk(null), walkMs + 100);
    return () => clearTimeout(t);
  }, [walk, walkMs]);
  useEffect(() => {
    if (!parties.length) return;
    const t = setTimeout(() => setParties([]), PARTY_MS + 100);
    return () => clearTimeout(t);
  }, [parties]);

  // 작업팀 일터가 바뀌면 승무원처럼 걸어간다. 처음 보는 작업팀은 제자리에 바로 선다.
  // 땅 좌표로 비교해서 지도를 끌거나 확대해도 걷지 않는다.
  const teamWhere = useRef(new Map<string, P>());
  const [teamWalks, setTeamWalks] = useState<
    Map<string, { from: P; to: P; t0: number }>
  >(() => new Map());
  const teamKey = teamSpots
    .map((t) => `${t.crew.id}@${t.world.x.toFixed(3)},${t.world.y.toFixed(3)}`)
    .join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: 작업팀 자리(teamKey)가 바뀔 때만
  useEffect(() => {
    const prev = teamWhere.current;
    const next = new Map(teamSpots.map((t) => [t.crew.id, t.world]));
    teamWhere.current = next;
    if (reducedMotion()) return;
    const t0 = performance.now();
    const moved = teamSpots.flatMap((t) => {
      const from = prev.get(t.crew.id);
      if (!from) return [];
      if (Math.hypot(from.x - t.world.x, from.y - t.world.y) < 1e-3) return [];
      return [[t.crew.id, { from, to: t.world, t0 }] as const];
    });
    if (moved.length) setTeamWalks((cur) => new Map([...cur, ...moved]));
  }, [teamKey]);
  useEffect(() => {
    if (!teamWalks.size) return;
    const t = setTimeout(() => setTeamWalks(new Map()), walkMs + 100);
    return () => clearTimeout(t);
  }, [teamWalks, walkMs]);

  /* ── 장애물: 착륙선, 동물, 내 깃발 ── */
  const center = { x: ox, y: oy };
  const obstacles: Rect[] = [
    { x: center.x - s * 1.3, y: center.y - s * 1.4, w: s * 2.6, h: s * 2.6 },
    { x: 0, y: h - CAPTION_H, w: w * 0.5, h: CAPTION_H },
  ];
  if (hereCenter)
    obstacles.push({
      x: hereCenter.x - animalSize / 2,
      y: hereCenter.y - animalSize * 1.2,
      w: animalSize,
      h: animalSize * 1.2,
    });
  for (const t of teamSpots)
    obstacles.push({
      x: t.at.x - teamSize / 2,
      y: t.at.y + teamLift - teamSize * 1.25,
      w: teamSize,
      h: teamSize * 1.25 + 14,
    });
  const flagSpots: { id: string; p: P }[] = [];
  for (const sp of spots.values()) {
    const r = sp.leaf.region;
    if (!visible(r.id) || dropped.has(r.id)) continue;
    if (!activeSigns(r).some(isForkForMe)) continue;
    // 깃발은 동물이 없는 칸, 착륙장에서 먼 칸에 꽂는다
    const free = sp.slots
      .slice(0, sp.leaf.cells.length)
      .filter((p) => p !== hereCenter);
    const p =
      [...free].sort(
        (a, b) =>
          Math.hypot(b.x - center.x, b.y - center.y) -
          Math.hypot(a.x - center.x, a.y - center.y),
      )[0] ?? sp.slots[0];
    if (!p) continue;
    flagSpots.push({ id: r.id, p });
    obstacles.push({
      x: p.x - 3,
      y: p.y - ks * 1.6,
      w: ks * 1.05,
      h: ks * 1.7,
    });
  }

  /* ── 나머지 표지 자리: 동물·내 깃발이 없는 칸에 차례로 ── */
  const signSpots: { region: Region; sign: Sign; p: P }[] = [];
  {
    const taken = new Set<P>([
      ...(hereCenter ? [hereCenter] : []),
      ...flagSpots.map((f) => f.p),
    ]);
    for (const sp of spots.values()) {
      const r = sp.leaf.region;
      if (!visible(r.id)) continue;
      const free = sp.slots.filter((x) => !taken.has(x));
      let k = 0;
      for (const sign of activeSigns(r)) {
        if (isForkForMe(sign)) continue;
        const p = free[k++ % Math.max(1, free.length)] ?? sp.slots[0];
        if (p) signSpots.push({ region: r, sign, p });
      }
    }
  }
  /** 완공 땅의 위험(알고 두기로 한 문제)은 집 밑에 깔린 금으로: 땅 층에서 돔보다 먼저 그린다(2026-11-02 사용자) */
  const isUnderCrack = (x: { region: Region; sign: Sign }) =>
    x.sign.type === "risk" && statusOf(x.region) === "done";
  const underCracks =
    stage === "far" ? [] : signSpots.filter((x) => isUnderCrack(x));

  /* ── 이름표: 지역 이름은 늘, 구역 이름은 확대 단계와 자리에 따라 ── */
  const near = stage === "near";
  const bounds = { x: 4, y: 4, w: w - 8, h: h - CAPTION_H - 4 };
  /** 화면(pad만큼 넉넉히) 안인가 */
  const inView = (p: P, pad = 0) =>
    p.x >= -pad && p.x <= w + pad && p.y >= -pad && p.y <= h + pad;
  // 오른쪽 위 카메라 단추 자리
  const toolbar: Rect = { x: w - 180, y: 0, w: 180, h: 96 };
  obstacles.push(toolbar);

  /* ── 화면 밖 표: 확대해서 지금 여기·내 갈림길·막힌 땅·지역이 화면 밖이면 가장자리에 ── */
  type EdgeItem = EdgeAsk & {
    regionId: string;
    kind: "here" | "fork" | "blocked" | "terr";
    text: string;
    sub?: string;
    color: string;
  };
  const edgeAsks: EdgeItem[] = [];
  const screenRect: Rect = { x: 0, y: 0, w, h: h - CAPTION_H };
  const offScreen = (p: P) => !isOnScreen(p, screenRect, 6);
  const edgeItem = (
    kind: EdgeItem["kind"],
    regionId: string,
    target: P,
    text: string,
    color: string,
  ): EdgeItem => ({
    id: `${kind}:${regionId}`,
    regionId,
    kind,
    target,
    text,
    color,
    w: textWidth(text, 11) + 30,
    h: 20,
  });
  if (map.here && hereCenter && offScreen(hereCenter))
    edgeAsks.push(
      edgeItem("here", map.here, hereCenter, "🐾 지금 여기", "#7ce0ff"),
    );
  for (const f of flagSpots) {
    if (!offScreen(f.p)) continue;
    const r = byId.get(f.id);
    const sign = r ? activeSigns(r).find(isForkForMe) : undefined;
    edgeAsks.push(
      edgeItem(
        "fork",
        f.id,
        f.p,
        `⑂ ${clip(sign?.title ?? r?.title ?? f.id, 12)}`,
        "#ffd84a",
      ),
    );
  }
  for (const l of layout.leaves) {
    if (!visible(l.region.id) || statusOf(l.region) !== "blocked") continue;
    const c = spots.get(l.region.id)?.center;
    if (!c || !offScreen(c)) continue;
    edgeAsks.push(
      edgeItem(
        "blocked",
        l.region.id,
        c,
        `⛔ ${clip(l.region.title, 10)}`,
        "#ff6b6b",
      ),
    );
  }

  const terrAsks: (LabelAsk & { text: string; color: string; sub: string })[] =
    [];
  for (const t of layout.territories) {
    const cells = (layout.cellsOf.get(t.region.id) ?? []).filter((c) =>
      owner.has(hexKey(c)),
    );
    if (cells.length === 0) continue;
    const a = (t.angle * Math.PI) / 180;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const doneCells = layout.leaves
      .filter((l) => l.territory === t.region.id && visible(l.region.id))
      .filter((l) => statusOf(l.region) === "done")
      .reduce((n, l) => n + l.cells.length, 0);
    const sub = `완공 ${doneCells}/${cells.length}`;
    // 지역이 통째로 화면 밖이면 가장자리 표로 방향을 알린다
    const shown = cells.map(px).filter((p) => inView(p));
    if (shown.length === 0) {
      const ps = cells.map(px);
      const text = clip(t.region.title, 8);
      edgeAsks.push({
        id: `terr:${t.region.id}`,
        regionId: t.region.id,
        kind: "terr",
        target: {
          x: ps.reduce((n, p) => n + p.x, 0) / ps.length,
          y: ps.reduce((n, p) => n + p.y, 0) / ps.length,
        },
        text,
        sub,
        color: colorOf(t.region.id),
        w: textWidth(text, 12) + textWidth(sub, 10) + 36,
        h: 20,
      });
      continue;
    }
    // 이름표는 지역 끝 너머에. 확대해서 끝이 화면 밖이면 보이는 칸 가운데 가장 먼 칸 너머에
    let far = 0;
    let farShown = Number.NEGATIVE_INFINITY;
    let farShownP: P | undefined;
    for (const c of cells) {
      const p = toPixel(c);
      const k = p.x * dir.x + p.y * dir.y;
      far = Math.max(far, k);
      const sp = px(c);
      if (inView(sp) && k > farShown) {
        farShown = k;
        farShownP = sp;
      }
    }
    const text = clip(t.region.title, 10);
    const fs = 13;
    const tw = textWidth(text, fs) + textWidth(sub, 10.5) + 22;
    const d = (far + 1.05) * s;
    let ax = center.x + dir.x * d;
    let ay = center.y + dir.y * d;
    if (!inView({ x: ax, y: ay }) && farShownP) {
      ax = farShownP.x + dir.x * s * 0.9;
      ay = farShownP.y + dir.y * s * 0.9;
    }
    ax = Math.min(
      bounds.x + bounds.w - tw / 2 - 2,
      Math.max(bounds.x + tw / 2 + 2, ax),
    );
    ay = Math.min(bounds.y + bounds.h - 12, Math.max(bounds.y + 12, ay));
    terrAsks.push({
      id: t.region.id,
      anchor: { x: ax, y: ay + 11 },
      w: tw,
      h: 22,
      text,
      sub,
      color: colorOf(t.region.id),
    });
  }
  const edgeTags = placeEdgeTags(
    edgeAsks,
    { x: 6, y: 6, w: w - 12, h: h - CAPTION_H - 10 },
    [toolbar, { x: 0, y: h - CAPTION_H - 6, w: w * 0.5, h: CAPTION_H + 6 }],
  ) as (EdgeTag & EdgeItem)[];
  obstacles.push(...edgeTags);
  // 아래 구석의 목표 글. 지역 이름표가 덮지 않게 한다
  const caption: Rect = {
    x: 0,
    y: h - CAPTION_H - 6,
    w: w * 0.5,
    h: CAPTION_H + 6,
  };
  const terrPlaced = placeLabels(
    terrAsks,
    bounds,
    [toolbar, caption, ...edgeTags],
    0,
  );
  // 자리가 없던 지역 이름표도 버리지 않고 제자리에 둔다(늘 보여야 한다)
  const terrLabels: (PlacedLabel & {
    text: string;
    color: string;
    sub: string;
  })[] = [];
  for (const a of terrAsks) {
    const p = terrPlaced.find((x) => x.id === a.id);
    if (p) {
      terrLabels.push({ ...a, ...p });
      continue;
    }
    const at = {
      side: "up" as const,
      x: a.anchor.x - a.w / 2,
      y: a.anchor.y - a.h,
      w: a.w,
      h: a.h,
    };
    // 카메라 단추 밑에 숨지 않게 왼쪽으로 비킨다
    if (overlaps(at, toolbar)) at.x = toolbar.x - a.w - 4;
    // 화면 밖 표·목표 글·앞서 놓인 지역 이름표와 겹치면 위아래로 조금씩 비킨다(못 찾으면 제자리)
    const hits = (y: number) =>
      edgeTags.some((t) => overlaps({ ...at, y }, t, 2)) ||
      terrLabels.some((t) => overlaps({ ...at, y }, t, 2)) ||
      overlaps({ ...at, y }, caption) ||
      overlaps({ ...at, y }, toolbar);
    for (let k = 1; k <= 8 && hits(at.y); k++) {
      const dy = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (a.h + 4);
      const y = at.y + dy;
      if (y < bounds.y || y + a.h > bounds.y + bounds.h || hits(y)) continue;
      at.y = y;
      break;
    }
    terrLabels.push({ ...a, ...at });
  }

  // 구역 이름표 후보: 보이는 잎과 2단 묶음 구역. 중요한 것부터
  type RegionAsk = LabelAsk & {
    /** region: 구역 이름표, fork: 내 깃발의 갈림길 제목, talk: 안테나의 교신 상대 */
    kind: "region" | "fork" | "talk";
    text: string;
    status?: string;
    tone: string;
    fresh: boolean;
  };
  const regionAsks: (RegionAsk & { rank: number })[] = [];
  const cellDots = [...owner.keys()].map((key) => {
    const [q = 0, r = 0] = key.split(",").map(Number);
    const p = px({ q, r });
    return { key, x: p.x - s * 0.6, y: p.y - s * 0.5, w: s * 1.2, h: s };
  });
  for (const r of map.regions) {
    const depth = layout.depthOf.get(r.id) ?? 1;
    if (depth === 1 && !leafById.has(r.id)) continue;
    if (!visible(r.id)) continue;
    const isLeaf = leafById.has(r.id);
    if (!isLeaf && depth !== 2) continue;
    const c = isLeaf ? spots.get(r.id)?.center : centerOf(r.id);
    if (!c) continue;
    const signs = activeSigns(r);
    const mine = signs.some(isForkForMe);
    const st = statusOf(r);
    const fresh = isNewFound(r, now);
    let rank = (layout.cellsOf.get(r.id)?.length ?? 1) + (isLeaf ? 0 : 6);
    if (r.id === map.here) rank += 100;
    if (mine) rank += 80;
    if (st === "blocked") rank += 60;
    if (r.id === selected) rank += 200;
    // 화면 밖 구역은 이름표를 찾지 않는다(가장자리 표가 대신 알린다)
    if (!inView(c, s)) continue;
    const important = rank >= 60;
    const text = clip(
      r.title,
      r.id === selected
        ? Math.max(22, CLIP_BY_STAGE[stage])
        : CLIP_BY_STAGE[stage],
    );
    // 가까이 단계에서만: 상태 글자와 "새"(멀리·가운데에서는 땅의 하늘색 점선으로만 보인다)
    const status = near ? REGION_STATUS_LABEL[st] : undefined;
    const showFresh = near && fresh;
    const own = new Set((layout.cellsOf.get(r.id) ?? []).map(hexKey));
    const fs = 11;
    const lw =
      textWidth(text, fs) +
      (status ? textWidth(` ${status}`, 10) + 4 : 0) +
      (showFresh ? 16 : 0) +
      12;
    // 멀리 단계: 꼭 보일 것이 아니면 땅이 이름표보다 넉넉히 넓을 때만
    const cells = layout.cellsOf.get(r.id)?.length ?? 1;
    if (stage === "far" && !important && cells * 2.6 * s * s < lw * 17 * 2)
      continue;
    regionAsks.push({
      kind: "region",
      id: r.id,
      anchor: { x: c.x, y: c.y - s * 0.15 },
      w: lw,
      // 꼭 보일 것(지금 여기·내 갈림길·막힘·고른 구역)이 아니면 다른 구역 칸을 덮지 않는다.
      // 가까이 단계는 칸이 넉넉해 덮어도 땅이 보인다
      avoid:
        important || near ? undefined : cellDots.filter((d) => !own.has(d.key)),
      h: 17,
      text,
      status,
      fresh: showFresh,
      tone: mine
        ? "#ffd84a"
        : st === "blocked"
          ? "#ff6b6b"
          : r.id === map.here
            ? "#7ce0ff"
            : "rgba(255,255,255,0.22)",
      rank,
    });
  }
  // 가까이 단계: 내 깃발에 갈림길 제목, 교신 안테나에 상대 이름
  if (near) {
    for (const f of flagSpots) {
      const r = byId.get(f.id);
      const sign = r ? activeSigns(r).find(isForkForMe) : undefined;
      if (!sign || !inView(f.p)) continue;
      const text = `⑂ ${clip(sign.title, 20)}`;
      regionAsks.push({
        kind: "fork",
        id: `fork:${f.id}`,
        anchor: { x: f.p.x + ks * 0.5, y: f.p.y - ks * 1.55 },
        w: textWidth(text, 10.5) + 12,
        h: 16,
        text,
        fresh: false,
        tone: "#ffd84a",
        rank: 90,
      });
    }
    for (const { sign, p } of signSpots) {
      if (sign.type !== "talk" || !inView(p)) continue;
      const text = `📡 ${clip(sign.with, 10)}`;
      regionAsks.push({
        kind: "talk",
        id: `talk:${sign.id}`,
        anchor: { x: p.x, y: p.y - ds * 0.8 },
        w: textWidth(text, 10.5) + 12,
        h: 16,
        text,
        fresh: false,
        tone: "rgba(214,236,255,0.45)",
        rank: 1,
      });
    }
  }
  regionAsks.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  const placedAll = placeLabels(
    regionAsks,
    bounds,
    [...obstacles, ...terrLabels],
    Math.min(12, s * 0.45),
  ).map((p) => ({
    ...p,
    ...(regionAsks.find((a) => a.id === p.id) as RegionAsk),
  }));
  const regionLabels = placedAll.filter((l) => l.kind === "region");
  const noteLabels = placedAll.filter((l) => l.kind !== "region");
  const shownIds = new Set(regionLabels.map((l) => l.id));

  // 마우스를 올린 구역: 숨은 이름표면 전체 이름을 맨 위에
  const hoverRegion = hover ? byId.get(hover) : undefined;
  const hoverC = hover
    ? (spots.get(hover)?.center ?? centerOf(hover))
    : undefined;

  /* ── 하늘·지평선·별 ── */
  const stars = useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: 70 }, () => ({
      x: rnd(),
      y: rnd(),
      r: rnd() * 0.9 + 0.3,
      o: rnd() * 0.5 + 0.2,
    }));
  }, []);
  // 별과 달은 화면에 고정, 지평선과 행성 표면은 땅과 함께 움직인다
  const skyY = Math.max(14, h * 0.07);
  const limbY = limb.y;
  const planetR = limb.r;

  const selectOf = (id: string) => () => onSelect(id);
  const keyOf = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  // 개척할 땅: 바깥 두 고리까지 옅은 칸 윤곽
  const ghostRing = layout.maxRing + 2;
  const ghosts: Hex[] = [];
  for (let q = -ghostRing; q <= ghostRing; q++)
    for (let r = -ghostRing; r <= ghostRing; r++) {
      const hx = { q, r };
      const n = ringOf(hx);
      if (n <= 1 || n > ghostRing || owner.has(hexKey(hx))) continue;
      ghosts.push(hx);
    }

  return (
    <svg
      width={w}
      height={h}
      className="absolute inset-0 select-none"
      role="img"
      aria-label={`${map.title} 개척지`}
    >
      <defs>
        <radialGradient id={`ground${uid}`} cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor={planet.ground[0]} />
          <stop offset="55%" stopColor={planet.ground[1]} />
          <stop offset="100%" stopColor={planet.ground[2]} />
        </radialGradient>
        <linearGradient id={`air${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={planet.air} stopOpacity="0.32" />
          <stop offset="100%" stopColor={planet.air} stopOpacity="0" />
        </linearGradient>
        {/* 먼지 무늬는 땅을 따라 움직인다(화면에 붙어 땅 위로 미끄러지지 않게) */}
        <pattern
          id={`dust${uid}`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${ox.toFixed(1)} ${oy.toFixed(1)})`}
        >
          <circle cx="1.5" cy="1.5" r="0.9" fill="#d8dce8" opacity="0.35" />
          <circle cx="5" cy="4.6" r="0.7" fill="#d8dce8" opacity="0.25" />
        </pattern>
        <clipPath id={`planet${uid}`}>
          <circle cx={limb.x} cy={limbY + planetR} r={planetR} />
        </clipPath>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* 하늘과 행성 표면 */}
      <rect width={w} height={h} fill="#05070d" />
      {stars.map((st, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 별 목록
          key={i}
          cx={st.x * w}
          cy={st.y * skyY * 1.6}
          r={st.r}
          fill="#fff"
          opacity={st.o}
          className={i % 9 === 0 ? styles.twinkle : undefined}
        />
      ))}
      <circle
        cx={w - 220}
        cy={skyY * 0.55}
        r={Math.max(5, skyY * 0.32)}
        fill={planet.moon}
        opacity="0.7"
      />
      <circle
        cx={w - 220 + 2.5}
        cy={skyY * 0.55 - 1}
        r={Math.max(5, skyY * 0.32)}
        fill="#05070d"
        opacity="0.75"
      />
      <circle
        cx={limb.x}
        cy={limbY + planetR}
        r={planetR}
        fill={`url(#ground${uid})`}
      />
      <rect
        x={0}
        y={limbY - 2}
        width={w}
        height={skyY * 1.4}
        fill={`url(#air${uid})`}
        opacity="0.5"
      />

      {/* 개척할 땅(옅은 칸) */}
      <g
        stroke={planet.grid}
        fill="none"
        strokeWidth="1"
        clipPath={`url(#planet${uid})`}
      >
        {ghosts.map((g) => (
          <polygon key={hexKey(g)} points={poly(px(g), 0.96)} />
        ))}
      </g>

      {/* 착륙장과 착륙선 */}
      <g>
        <title>{`착륙선 · 목표: ${map.goal ?? map.title}`}</title>
        <circle
          cx={center.x}
          cy={center.y}
          r={s * 2.35}
          fill="#2b2d35"
          stroke="#5c6070"
          strokeDasharray="4 3"
        />
        <circle
          cx={center.x}
          cy={center.y}
          r={s * 1.5}
          fill="none"
          stroke="#ffd84a"
          strokeOpacity="0.25"
          strokeWidth={s * 0.08}
        />
        <Lander
          x={center.x}
          y={center.y}
          s={Math.min(s, 40)}
          dark={weather.night}
        />
      </g>

      {/* 구역 땅 */}
      {layout.leaves.map((l) => {
        const r = l.region;
        if (!visible(r.id)) return null;
        const st = statusOf(r);
        const fresh = isNewFound(r, now);
        const tint = colorOf(l.territory);
        const label = `${r.title} · ${REGION_STATUS_LABEL[st]}${fresh ? " · 새 땅" : ""}`;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
          <g
            key={r.id}
            data-region={r.id}
            data-status={st}
            className={styles.leaf}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected === r.id}
            onClick={selectOf(r.id)}
            onKeyDown={keyOf(r.id)}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
            opacity={st === "dropped" ? 0.6 : 1}
          >
            <title>{label}</title>
            {l.cells.map((c) => {
              const p = px(c);
              return (
                <g key={hexKey(c)}>
                  <polygon
                    className={styles.ground}
                    points={poly(p)}
                    fill={GROUND[st]}
                  />
                  <polygon
                    points={poly(p)}
                    fill={tint}
                    opacity={st === "fog" ? 0.16 : 0.1}
                  />
                  {underCracks
                    .filter(
                      (u) =>
                        u.region.id === r.id &&
                        Math.abs(u.p.x - p.x) + Math.abs(u.p.y - p.y) < 1,
                    )
                    .map((u) => (
                      <Crack
                        key={u.sign.id}
                        x={p.x}
                        y={p.y + ds * 0.2}
                        s={ds}
                      />
                    ))}
                  <CellDecor
                    st={st}
                    p={p}
                    s={s}
                    ds={ds}
                    uid={uid}
                    seed={cellSeed(c.q, c.r)}
                  />
                  {fresh && (
                    <polygon
                      points={poly(p, 0.7)}
                      fill="none"
                      stroke="#7ce0ff"
                      strokeWidth="1.3"
                      strokeDasharray="3 2.5"
                      opacity="0.9"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 경계 */}
      <g fill="none" pointerEvents="none" strokeLinecap="round">
        <path
          d={cellEdges.join("")}
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="0.8"
        />
        <path
          d={subEdges.join("")}
          stroke="rgba(12,10,16,0.55)"
          strokeWidth="1.1"
          strokeDasharray="2.5 2"
        />
        <path
          d={regionEdges.join("")}
          stroke="#120d12"
          strokeWidth={Math.min(3, Math.max(1.6, s * 0.08))}
        />
        {[...terrEdges.entries()].map(([t, list]) => (
          <path
            key={t}
            d={list.join("")}
            stroke={colorOf(t)}
            strokeWidth={Math.min(4.5, Math.max(2.2, s * 0.12))}
            opacity="0.95"
          />
        ))}
      </g>

      {/* 밤: 세션이 꺼져 있으면 땅이 어두워진다(표지·이름표는 위에 그려 밝게 남는다) */}
      {weather.night && (
        <rect
          data-weather="night"
          width={w}
          height={h}
          fill="#030616"
          opacity="0.42"
          pointerEvents="none"
        />
      )}

      {/* 막힘: 붉은 울타리 */}
      <g pointerEvents="none">
        {layout.leaves
          .filter(
            (l) => visible(l.region.id) && statusOf(l.region) === "blocked",
          )
          .map((l) => {
            const sp = spots.get(l.region.id);
            const p = sp?.slots[0];
            return (
              <g key={l.region.id}>
                <path
                  d={outline(l.region.id, 0.8)}
                  fill="none"
                  stroke="#ff6b6b"
                  strokeWidth={Math.min(4, Math.max(2, s * 0.1))}
                  strokeDasharray={`${ds * 0.22} ${ds * 0.12}`}
                />
                {l.cells.flatMap((c) =>
                  corners(px(c).x, px(c).y, s * 0.8).map((v, i) => (
                    <circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: 칸 꼭짓점 차례
                      key={`${hexKey(c)}-${i}`}
                      cx={v.x}
                      cy={v.y}
                      r={Math.min(2.6, Math.max(1.4, s * 0.06))}
                      fill="#ffc2c2"
                    />
                  )),
                )}
                {p && <NoEntry x={p.x} y={p.y} s={ks} />}
              </g>
            );
          })}
      </g>

      {/* 공사 장비 */}
      <g pointerEvents="none">
        {layout.leaves
          .filter(
            (l) => visible(l.region.id) && statusOf(l.region) === "building",
          )
          .map((l) => {
            // 3칸마다 장비 하나를 승무원·내 깃발이 없는 칸에 고르게. 큰 땅은 첫 장비가 크레인
            const sp = spots.get(l.region.id);
            const free = (sp?.slots.slice(0, l.cells.length) ?? []).filter(
              (x) => x !== hereCenter && !flagSpots.some((f) => f.p === x),
            );
            const fallback = sp?.slots[l.cells.length];
            const at = spread(
              free.length ? free : fallback ? [fallback] : [],
              rigCount(l.cells.length),
            );
            const crane = l.cells.length >= CRANE_CELLS;
            return (
              <g key={l.region.id} data-rigs={at.length}>
                {at.map((p, i) =>
                  crane && i === 0 ? (
                    <Crane key="crane" x={p.x} y={p.y} s={ds} />
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: 고르게 고른 칸 차례
                    <Rig key={i} x={p.x} y={p.y} s={ds} />
                  ),
                )}
              </g>
            );
          })}
      </g>

      {/* 갈림길·교신·위험 표지 */}
      <g pointerEvents="none">
        {/* 멀리 단계에서는 남의 깃발·안테나·균열을 그리지 않는다(땅 모습과 늘 보이는 것만) */}
        {stage !== "far" &&
          signSpots.map(({ region: r, sign, p }) => {
            const key = `${r.id}/${sign.id}`;
            if (sign.type === "fork")
              return <OtherFlag key={key} x={p.x} y={p.y} s={ds} />;
            if (sign.type === "talk")
              return (
                <Antenna
                  key={key}
                  x={p.x}
                  y={p.y}
                  s={ds}
                  waiting={sign.status === "waiting" || sign.status === "sent"}
                />
              );
            if (isUnderCrack({ region: r, sign })) return null;
            return <Crack key={key} x={p.x} y={p.y} s={ds} />;
          })}
        {flagSpots.map((f) => {
          const r = byId.get(f.id);
          const sign = r ? activeSigns(r).find(isForkForMe) : undefined;
          const flag = (
            <MyFlag x={f.p.x} y={f.p.y} s={ks} title={sign?.title ?? ""} />
          );
          if (!onFork || !sign) return <g key={f.id}>{flag}</g>;
          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
            <g
              key={f.id}
              data-fork-flag={f.id}
              data-camera="fork"
              role="button"
              tabIndex={0}
              aria-label={`갈림길 정하기: ${sign.title}`}
              pointerEvents="visiblePainted"
              className="cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onFork(f.id, sign.id, f.p);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFork(f.id, sign.id, f.p);
                }
              }}
            >
              {flag}
            </g>
          );
        })}
      </g>

      {/* 내가 정할 갈림길 땅: 노랗게 숨쉬는 둘레 */}
      <g pointerEvents="none" fill="none">
        {flagSpots.map((f) => (
          <path
            key={f.id}
            className={styles.breathe}
            d={outline(f.id, 0.93)}
            stroke="#ffd84a"
            strokeWidth={Math.min(4, Math.max(2, s * 0.11))}
          />
        ))}
      </g>

      {/* 고른 구역 */}
      {selected && (
        <g pointerEvents="none" fill="none">
          <path
            d={outline(selected)}
            stroke="#fff"
            strokeWidth="7"
            opacity="0.25"
            filter={`url(#glow${uid})`}
          />
          <path d={outline(selected)} stroke="#fff" strokeWidth="2.6" />
        </g>
      )}

      {/* 모래 폭풍: 지도가 일보다 뒤처졌다 */}
      {weather.storm && (
        <g data-weather="storm" pointerEvents="none">
          <rect width={w} height={h} fill="#b8915c" opacity="0.14" />
          <rect width={w} height={h} fill={`url(#dust${uid})`} opacity="0.7" />
          <g className={styles.drift} fill="#e3c79a">
            <ellipse
              cx={w * 0.3}
              cy={h * 0.45}
              rx={w * 0.32}
              ry={h * 0.12}
              opacity="0.12"
            />
            <ellipse
              cx={w * 0.7}
              cy={h * 0.62}
              rx={w * 0.28}
              ry={h * 0.1}
              opacity="0.1"
            />
            <ellipse
              cx={w * 0.5}
              cy={h * 0.3}
              rx={w * 0.25}
              ry={h * 0.08}
              opacity="0.08"
            />
          </g>
        </g>
      )}

      {/* 완공 폭죽 */}
      {/* "완공!" 글은 지역·구역 이름표를 덮지 않게 위(없으면 아래)로 비킨다 */}
      {parties.map((pt) => {
        const c = centerOf(pt.id);
        if (!c) return null;
        const tw = textWidth("완공!", 13) + 8;
        // 글은 떠오르며 위아래로 10px쯤 움직인다. 그만큼 넉넉히 잡는다
        const box = {
          x: c.x - tw / 2,
          y: partyTextY(c.y, s) - 23,
          w: tw,
          h: 30,
        };
        const y = dodgeY(box, [...terrLabels, ...placedAll], bounds);
        return (
          <Party
            key={`${pt.id}-${pt.t0}`}
            x={c.x}
            y={c.y}
            s={s}
            textY={partyTextY(c.y, s) + (y - box.y)}
          />
        );
      })}

      {/* 걸어오는 승무원(걷는 동안은 제자리 동물 대신) */}
      {walk && (
        <Walker
          from={walk.from}
          to={walk.to}
          t0={walk.t0}
          ms={walkMs}
          ox={ox}
          oy={oy}
          s={s}
          size={animalSize}
          lift={ds * 0.45}
        >
          <HereAnimal crew={crew} size={animalSize} />
        </Walker>
      )}

      {/* 지금 여기: 동물 선원 */}
      {hereCenter && !walk && (
        <g pointerEvents="none">
          <ellipse
            cx={hereCenter.x}
            cy={hereCenter.y + ds * 0.38}
            rx={ds * 0.75}
            ry={ds * 0.28}
            fill="#7ce0ff"
            opacity="0.25"
          />
          <ellipse
            className={styles.ping}
            cx={hereCenter.x}
            cy={hereCenter.y + ds * 0.38}
            rx={ds * 0.75}
            ry={ds * 0.28}
            fill="none"
            stroke="#7ce0ff"
          />
          <g
            transform={`translate(${hereCenter.x - animalSize / 2} ${hereCenter.y + ds * 0.45 - animalSize * 1.25})`}
          >
            <HereAnimal crew={crew} size={animalSize} />
          </g>
          <WaitBubble
            x={hereCenter.x + animalSize * 0.45}
            y={hereCenter.y + ds * 0.45 - animalSize * 1.3}
            crew={crew}
          />
          {weather.night && (
            <text
              className={styles.zzz}
              x={hereCenter.x - animalSize * 0.85}
              y={hereCenter.y + ds * 0.45 - animalSize * 1.05}
              fontSize={Math.max(10, animalSize * 0.3)}
              fontWeight="700"
              fill="#c9d6ff"
            >
              z z
            </text>
          )}
        </g>
      )}

      {/* 작업팀: 소장 지도를 같이 쓰는 세션(teams.ts). 걷는 동안은 Walker가 대신 그린다 */}
      {teamSpots.map((t) => {
        const walking = teamWalks.get(t.crew.id);
        const name = `작업팀 ${t.crew.name}`;
        if (walking)
          return (
            <Walker
              key={t.crew.id}
              from={walking.from}
              to={walking.to}
              t0={walking.t0}
              ms={walkMs}
              ox={ox}
              oy={oy}
              s={s}
              size={teamSize}
              lift={teamLift}
            >
              <TeamAnimal crew={t.crew} size={teamSize} />
            </Walker>
          );
        const foot = t.at.y + teamLift;
        return (
          <g
            key={t.crew.id}
            pointerEvents="none"
            data-team={t.crew.id}
            data-team-region={t.region ?? "lander"}
          >
            <title>{`${name} · ${t.region ? (byId.get(t.region)?.title ?? t.region) : "착륙선 옆(일터를 적지 않음)"}`}</title>
            <ellipse
              cx={t.at.x}
              cy={foot - teamLift * 0.16}
              rx={teamSize * 0.3}
              ry={teamSize * 0.09}
              fill="#000"
              opacity="0.3"
            />
            <g
              transform={`translate(${t.at.x - teamSize / 2} ${foot - teamSize * 1.25})`}
            >
              <TeamAnimal crew={t.crew} size={teamSize} />
            </g>
            <text
              x={t.at.x}
              // 이웃 이름표와 겹치지 않게 한 줄씩 엇갈린다
              y={foot + 11 + (t.nth % 2) * 12}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="700"
              fill="#e8ecf6"
              stroke="#0a0a10"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {name}
            </text>
          </g>
        );
      })}

      {/* 지역 이름표 */}
      {terrLabels.map((l) => (
        // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
        <g
          key={l.id}
          data-region-label={l.id}
          role="button"
          tabIndex={0}
          onClick={selectOf(l.id)}
          onKeyDown={keyOf(l.id)}
          className="cursor-pointer"
        >
          <title>{byId.get(l.id)?.title ?? l.id}</title>
          <rect
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            rx={l.h / 2}
            fill="rgba(10,8,14,0.82)"
            stroke={l.color}
            strokeWidth={selected === l.id ? 2.4 : 1.4}
          />
          <text
            x={l.x + 11}
            y={l.y + 15.5}
            fontSize="13"
            fontWeight="700"
            fill={l.color}
          >
            {l.text}
            <tspan
              dx="6"
              fontSize="10.5"
              fontWeight="500"
              fill="rgba(255,255,255,0.55)"
            >
              {l.sub}
            </tspan>
          </text>
        </g>
      ))}

      {/* 구역 이름표(말풍선) */}
      {regionLabels.map((l) => (
        <Bubble
          key={l.id}
          l={l}
          s={s}
          selected={selected === l.id}
          onClick={selectOf(l.id)}
          onHover={setHover}
          title={byId.get(l.id)?.title ?? l.id}
        />
      ))}
      {/* 가까이 단계의 덧붙임: 갈림길 제목, 교신 상대 */}
      {noteLabels.map((l) => (
        <g key={l.id} pointerEvents="none" data-note-label={l.kind}>
          <rect
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            rx="3"
            fill={
              l.kind === "fork" ? "rgba(40,32,4,0.92)" : "rgba(10,12,20,0.85)"
            }
            stroke={l.tone}
            strokeWidth="1"
          />
          <text
            x={l.x + 6}
            y={l.y + 11.8}
            fontSize="10.5"
            fontWeight={l.kind === "fork" ? 600 : 400}
            fill={l.kind === "fork" ? "#ffe58a" : "rgba(214,236,255,0.85)"}
          >
            {l.text}
          </text>
        </g>
      ))}
      {/* 화면 밖 표: 누르면 그리로 날아가 고른다 */}
      {edgeTags.map((t) => (
        // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
        <g
          key={t.id}
          data-edge-tag={t.id}
          role="button"
          tabIndex={0}
          aria-label={`${t.text}${t.sub ? ` ${t.sub}` : ""}, 화면 밖. 누르면 그리로 가요`}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onVisit(t.regionId);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onVisit(t.regionId);
            }
          }}
        >
          <title>{byId.get(t.regionId)?.title ?? t.regionId}</title>
          <rect
            x={t.x}
            y={t.y}
            width={t.w}
            height={t.h}
            rx={t.h / 2}
            fill="rgba(8,8,14,0.9)"
            stroke={t.color}
            strokeWidth={t.kind === "terr" ? 1.4 : 1.2}
            strokeDasharray={t.kind === "terr" ? "4 2" : undefined}
          />
          <text
            x={t.x + 9}
            y={t.y + 14}
            fontSize={t.kind === "terr" ? 12 : 11}
            fontWeight={t.kind === "terr" ? 700 : 600}
            fill={t.color}
          >
            {t.text}
            {t.sub && (
              <tspan
                dx="5"
                fontSize="10"
                fontWeight="500"
                fill="rgba(255,255,255,0.55)"
              >
                {t.sub}
              </tspan>
            )}
            <tspan dx="5" fill="#fff">
              {t.arrow}
            </tspan>
          </text>
        </g>
      ))}
      {hoverRegion && hoverC && !shownIds.has(hoverRegion.id) && (
        <HoverTip
          region={hoverRegion}
          status={REGION_STATUS_LABEL[statusOf(hoverRegion)]}
          at={hoverC}
          s={s}
          w={w}
        />
      )}
    </svg>
  );
}

/* ───────────── 칸 무늬 ───────────── */

export function CellDecor({
  st,
  p,
  s,
  ds,
  uid,
  seed = 0,
}: {
  st: RegionStatus;
  p: P;
  s: number;
  /** 장식 크기(칸이 커져도 상한이 있다) */
  ds: number;
  uid: string;
  /** 칸 좌표로 정한 씨앗(decor.ts cellSeed). 공사 칸의 고랑·흙더미·말뚝이 칸마다 다르다 */
  seed?: number;
}) {
  const pts = corners(p.x, p.y, s)
    .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
    .join(" ");
  if (st === "fog")
    return (
      <g pointerEvents="none">
        <polygon points={pts} fill={`url(#dust${uid})`} />
        <g className={styles.drift} fill="#e2e6f0">
          <ellipse
            cx={p.x - s * 0.25}
            cy={p.y - s * 0.1}
            rx={s * 0.42}
            ry={s * 0.2}
            opacity="0.17"
          />
          <ellipse
            cx={p.x + s * 0.3}
            cy={p.y + s * 0.28}
            rx={s * 0.36}
            ry={s * 0.16}
            opacity="0.13"
          />
        </g>
      </g>
    );
  if (st === "building") return <Dug p={p} s={s} seed={seed} />;
  if (st === "done") return <Dome x={p.x} y={p.y} s={ds} />;
  if (st === "dropped")
    return (
      <polygon
        points={corners(p.x, p.y, s * 0.75)
          .map((v) => `${v.x},${v.y}`)
          .join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeDasharray="2 3"
        pointerEvents="none"
      />
    );
  return null;
}

function Dome({ x, y, s }: { x: number; y: number; s: number }) {
  const r = s * 0.46;
  const by = y + s * 0.28;
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={by} rx={r * 1.05} ry={r * 0.22} fill="#173b29" />
      <path
        d={`M${x - r} ${by}A${r} ${r * 0.95} 0 0 1 ${x + r} ${by}Z`}
        fill="#8fe8b4"
        fillOpacity="0.8"
        stroke="#d6ffe6"
        strokeWidth="0.8"
      />
      <path
        d={`M${x - r * 0.45} ${by - r * 0.5}A${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.05} ${by - r * 0.82}`}
        stroke="#fff"
        strokeOpacity="0.6"
        fill="none"
        strokeWidth="0.9"
      />
      <rect
        x={x + r * 0.15}
        y={by - r * 0.42}
        width={r * 0.26}
        height={r * 0.3}
        fill="#fff4b5"
      />
      <rect
        x={x - r * 0.42}
        y={by - r * 0.32}
        width={r * 0.22}
        height={r * 0.24}
        fill="#fff4b5"
        opacity="0.8"
      />
    </g>
  );
}

/**
 * 공사 칸: 파헤친 흙에 짧은 고랑 2~3개(수평에 가깝게, 칸 좌표로 그려 땅을 따라 움직인다),
 * 칸에 따라 흙더미와 주황 깃발 말뚝. 사선 줄무늬는 "주의·금지"로 읽혀 쓰지 않는다(2026-11-03 검토)
 */
function Dug({ p, s, seed }: { p: P; s: number; seed: number }) {
  const d = dugOf(seed);
  const rows = d.furrows === 3 ? [-0.38, 0, 0.38] : [-0.2, 0.22];
  const groove = Math.max(0.8, s * 0.075);
  const fine = s >= 10;
  return (
    <g pointerEvents="none" data-dug>
      <g
        transform={`rotate(${d.tilt} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
        fill="none"
        strokeLinecap="round"
      >
        {rows.map((ry, i) => {
          const x0 = p.x + s * (-0.42 + (i % 2) * 0.12);
          const x1 = x0 + s * 0.58;
          const y = p.y + s * ry;
          const mid = `${((x0 + x1) / 2).toFixed(1)} ${(y - s * 0.07).toFixed(1)}`;
          return (
            <g key={ry}>
              <path
                d={`M${x0.toFixed(1)} ${(y - groove * 0.9).toFixed(1)}Q${mid} ${x1.toFixed(1)} ${(y - groove * 0.9).toFixed(1)}`}
                stroke="#d2ad78"
                strokeWidth={groove * 0.6}
                opacity="0.7"
              />
              <path
                d={`M${x0.toFixed(1)} ${y.toFixed(1)}Q${mid} ${x1.toFixed(1)} ${y.toFixed(1)}`}
                stroke="#5b3e1f"
                strokeWidth={groove}
              />
            </g>
          );
        })}
      </g>
      {fine && d.mound && (
        <path
          d={`M${p.x + s * 0.18} ${p.y + s * 0.5}Q${p.x + s * 0.4} ${p.y + s * 0.18} ${p.x + s * 0.62} ${p.y + s * 0.5}Z`}
          fill="#7c5631"
          stroke="#c99d63"
          strokeWidth={Math.max(0.6, s * 0.03)}
        />
      )}
      {fine && d.stake && (
        <g>
          <line
            x1={p.x - s * 0.5}
            y1={p.y + s * 0.42}
            x2={p.x - s * 0.5}
            y2={p.y - s * 0.02}
            stroke="#f1e3c8"
            strokeWidth={Math.max(0.9, s * 0.04)}
          />
          <path
            d={`M${p.x - s * 0.5} ${p.y - s * 0.02}L${p.x - s * 0.28} ${p.y + s * 0.06}L${p.x - s * 0.5} ${p.y + s * 0.14}Z`}
            fill="#ff8a1f"
          />
        </g>
      )}
    </g>
  );
}

/** 큰 공사 땅의 크레인: 격자 기둥과 팔, 매달린 짐 */
export function Crane({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 20;
  const lattice = [-3, -9, -15, -21, -27]
    .map((t) => `M-1.6 ${t}L1.6 ${t - 3}L-1.6 ${t - 6}`)
    .join("");
  return (
    <g
      data-crane
      transform={`translate(${x} ${y + 6 * u}) scale(${u})`}
      fill="none"
      strokeLinecap="round"
    >
      <rect x="-5" y="-1" width="10" height="3" rx="1" fill="#1f1a14" />
      <path d="M-1.6 -1V-33M1.6 -1V-33" stroke="#f2b13a" strokeWidth="1.4" />
      <path d={lattice} stroke="#f2b13a" strokeWidth="0.7" />
      <path
        d="M-7 -33H17M0 -38L17 -33M0 -38L-7 -33"
        stroke="#f2b13a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="-8" y="-35" width="4" height="4" fill="#8a5a1c" />
      <g className={styles.sway}>
        <path d="M13 -33V-22" stroke="#e6e0d0" strokeWidth="0.6" />
        <rect x="10.5" y="-22" width="5" height="3.5" fill="#c9862c" />
      </g>
    </g>
  );
}

export function Rig({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 20;
  return (
    <g transform={`translate(${x - 9 * u} ${y - 2 * u}) scale(${u})`}>
      <rect x="0" y="9" width="13" height="4" rx="2" fill="#1f1a14" />
      <rect
        x="1"
        y="3"
        width="10"
        height="6.5"
        rx="1"
        fill="#f2a43a"
        stroke="#4a2f0d"
        strokeWidth="0.8"
      />
      <rect x="2.2" y="4.2" width="3.6" height="3" fill="#ffe6a8" />
      <g className={styles.dig}>
        <path
          d="M10 5 L17 -1 L20 4"
          fill="none"
          stroke="#f2a43a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M18.5 3.5 L21.5 3 L21 7 Z" fill="#c9862c" />
      </g>
    </g>
  );
}

export function NoEntry({ x, y, s }: { x: number; y: number; s: number }) {
  const r = Math.max(5, s * 0.3);
  return (
    <g>
      <circle
        cx={x}
        cy={y - s * 0.05}
        r={r}
        fill="#e04646"
        stroke="#ffd0d0"
        strokeWidth="1.2"
      />
      <rect
        x={x - r * 0.62}
        y={y - s * 0.05 - r * 0.2}
        width={r * 1.24}
        height={r * 0.4}
        fill="#fff"
      />
    </g>
  );
}

/** 내가 정할 갈림길: 땅에 꽂힌 큰 노란 깃발 */
export function MyFlag({
  x,
  y,
  s,
  title,
}: {
  x: number;
  y: number;
  s: number;
  title: string;
}) {
  const top = y - s * 1.5;
  const fw = s * 0.95;
  const fh = s * 0.55;
  return (
    <g>
      <title>{`내가 정할 갈림길: ${title}`}</title>
      <ellipse
        className={styles.ping}
        cx={x}
        cy={y + s * 0.15}
        rx={s * 0.5}
        ry={s * 0.2}
        fill="none"
        stroke="#ffd84a"
        strokeWidth="1.6"
      />
      <ellipse
        cx={x}
        cy={y + s * 0.15}
        rx={s * 0.22}
        ry={s * 0.08}
        fill="#000"
        opacity="0.4"
      />
      <path
        className={styles.flag}
        d={`M${x} ${top}C${x + fw * 0.35} ${top - fh * 0.18} ${x + fw * 0.65} ${top + fh * 0.18} ${x + fw} ${top + fh * 0.05}L${x + fw} ${top + fh}C${x + fw * 0.65} ${top + fh * 1.12} ${x + fw * 0.35} ${top + fh * 0.78} ${x} ${top + fh}Z`}
        fill="#ffd84a"
        stroke="#7a5a00"
        strokeWidth="0.9"
      />
      <line
        x1={x}
        y1={y + s * 0.15}
        x2={x}
        y2={top - 2}
        stroke="#f6efd8"
        strokeWidth={Math.max(1.6, s * 0.08)}
        strokeLinecap="round"
      />
      <circle cx={x} cy={top - 2} r={Math.max(1.5, s * 0.07)} fill="#fff" />
    </g>
  );
}

/** 남이 정할 갈림길: 낮은 회색 깃발 */
export function OtherFlag({ x, y, s }: { x: number; y: number; s: number }) {
  const top = y - s * 0.75;
  return (
    <g>
      <line
        x1={x}
        y1={y + s * 0.15}
        x2={x}
        y2={top}
        stroke="#cfd4de"
        strokeWidth="1.2"
      />
      <path
        d={`M${x} ${top}L${x + s * 0.45} ${top + s * 0.14}L${x} ${top + s * 0.3}Z`}
        fill="#9aa3b5"
      />
    </g>
  );
}

export function Antenna({
  x,
  y,
  s,
  waiting,
}: {
  x: number;
  y: number;
  s: number;
  waiting: boolean;
}) {
  const top = y - s * 0.7;
  const r1 = s * 0.25;
  const r2 = s * 0.45;
  return (
    <g stroke="#d6ecff" fill="none" strokeLinecap="round">
      <path
        d={`M${x - s * 0.18} ${y + s * 0.2}L${x} ${top}L${x + s * 0.18} ${y + s * 0.2}`}
        strokeWidth="1.3"
      />
      <circle cx={x} cy={top} r={Math.max(1.4, s * 0.06)} fill="#d6ecff" />
      <g className={waiting ? styles.signal : undefined} strokeWidth="1.2">
        <path
          d={`M${x - r1} ${top - r1 * 0.4}A${r1} ${r1} 0 0 1 ${x + r1} ${top - r1 * 0.4}`}
        />
        <path
          d={`M${x - r2} ${top - r2 * 0.4}A${r2} ${r2} 0 0 1 ${x + r2} ${top - r2 * 0.4}`}
          opacity="0.6"
        />
      </g>
    </g>
  );
}

export function Crack({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 10;
  const d = `M${x - 6 * u} ${y - 3 * u}L${x - 2 * u} ${y - 1 * u}L${x - 3 * u} ${y + 2 * u}L${x + 2 * u} ${y + 1 * u}L${x + 1 * u} ${y + 4 * u}L${x + 6 * u} ${y + 5 * u}`;
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke="#140b0b" strokeWidth={Math.max(2.4, s * 0.12)} />
      <path d={d} stroke="#ff9b5c" strokeWidth={Math.max(1, s * 0.045)} />
    </g>
  );
}

export function Lander({
  x,
  y,
  s,
  dark = false,
}: {
  x: number;
  y: number;
  s: number;
  /** 밤(세션이 꺼짐): 창과 불이 꺼진다 */
  dark?: boolean;
}) {
  const u = s / 14;
  return (
    <g transform={`translate(${x} ${y}) scale(${u})`}>
      <ellipse cx="0" cy="11" rx="13" ry="3.5" fill="#000" opacity="0.35" />
      <path
        d="M-9 4 L-13 11 M9 4 L13 11 M0 6 L0 11"
        stroke="#aab3c5"
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M-15 11 h4 M11 11 h4" stroke="#aab3c5" strokeWidth="1.6" />
      <path
        d="M-11 6 Q-11 -10 0 -16 Q11 -10 11 6 Z"
        fill="#dfe6f2"
        stroke="#7f8aa3"
        strokeWidth="1"
      />
      <circle
        cx="0"
        cy="-4"
        r="4"
        fill={dark ? "#24323d" : "#7ce0ff"}
        stroke="#2a5d73"
        strokeWidth="1"
      />
      <path d="M-11 3 h22" stroke="#7f8aa3" strokeWidth="1" />
      {!dark && (
        <>
          <circle
            cx="-6"
            cy="5"
            r="1.1"
            fill="#ffd84a"
            className={styles.twinkle}
          />
          <circle cx="6" cy="5" r="1.1" fill="#ffd84a" />
        </>
      )}
    </g>
  );
}

function HereAnimal({ crew, size }: { crew?: Crew; size: number }) {
  if (!crew)
    return (
      <text x={size / 2} y={size} fontSize={size * 0.6} textAnchor="middle">
        📍
      </text>
    );
  return (
    <Animal
      kind={animalFor(crew.id)}
      pose={crew.status === "off" ? "sleep" : poseFor(crew.status)}
      context={crew.context}
      size={size}
      furniture={false}
      label={`${crew.name} 선원, 지금 여기`}
    />
  );
}

/** 작업팀 그림: 그 작업팀의 동물(animalFor). 소장 그림보다 작게 */
function TeamAnimal({ crew, size }: { crew: Crew; size: number }) {
  return (
    <Animal
      kind={animalFor(crew.id)}
      pose={crew.status === "off" ? "sleep" : poseFor(crew.status)}
      context={crew.context}
      size={size}
      furniture={false}
      label={`작업팀 ${crew.name}`}
    />
  );
}

/* ───────────── 이름표 ───────────── */

function Bubble({
  l,
  s,
  selected,
  onClick,
  onHover,
  title,
}: {
  l: PlacedLabel & {
    text: string;
    status?: string;
    tone: string;
    fresh: boolean;
  };
  s: number;
  selected: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
  title: string;
}) {
  const { x, y } = l.anchor;
  // 말풍선 꼬리: 가리키는 점 쪽 변 가운데에서
  const tail =
    l.side === "up"
      ? `M${x - 4} ${l.y + l.h}L${x} ${l.y + l.h + Math.min(6, s * 0.4)}L${x + 4} ${l.y + l.h}Z`
      : l.side === "down"
        ? `M${x - 4} ${l.y}L${x} ${l.y - Math.min(6, s * 0.4)}L${x + 4} ${l.y}Z`
        : l.side === "right"
          ? `M${l.x} ${y - 4}L${l.x - Math.min(6, s * 0.4)} ${y}L${l.x} ${y + 4}Z`
          : `M${l.x + l.w} ${y - 4}L${l.x + l.w + Math.min(6, s * 0.4)} ${y}L${l.x + l.w} ${y + 4}Z`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
    <g
      data-region-label={l.id}
      role="button"
      tabIndex={-1}
      className="cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      onMouseEnter={() => onHover(l.id)}
      onMouseLeave={() => onHover(null)}
    >
      <title>{title}</title>
      <path d={tail} fill="rgba(10,10,16,0.88)" />
      <rect
        x={l.x}
        y={l.y}
        width={l.w}
        height={l.h}
        rx="4"
        fill="rgba(10,10,16,0.88)"
        stroke={selected ? "#fff" : l.tone}
        strokeWidth={selected ? 1.6 : 1}
      />
      <text
        x={l.x + 6}
        y={l.y + 12.5}
        fontSize="11"
        fill="rgba(255,255,255,0.9)"
      >
        {l.text}
        {l.status && (
          <tspan dx="5" fontSize="10" fill="rgba(255,255,255,0.5)">
            {l.status}
          </tspan>
        )}
      </text>
      {l.fresh && (
        <text
          x={l.x + l.w - 17}
          y={l.y + 12.5}
          fontSize="9.5"
          fontWeight="700"
          fill="#7ce0ff"
        >
          새
        </text>
      )}
    </g>
  );
}

function HoverTip({
  region,
  status,
  at,
  s,
  w,
}: {
  region: Region;
  status: string;
  at: P;
  s: number;
  w: number;
}) {
  const text = `${clip(region.title, 30)} · ${status}`;
  const tw = textWidth(text, 11.5) + 14;
  const x = Math.min(w - tw - 4, Math.max(4, at.x - tw / 2));
  const y = Math.max(4, at.y - s * 0.6 - 20);
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={tw}
        height={19}
        rx="4"
        fill="#0a0a10"
        stroke="rgba(255,255,255,0.5)"
      />
      <text x={x + 7} y={y + 13.5} fontSize="11.5" fill="#fff">
        {text}
      </text>
    </g>
  );
}
