"use client";

import {
  type ComponentType,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  EVENT_DURATION_MS,
  EVENT_LABELS,
  type EventInfo,
  type EventKind,
  isAlienKind,
  seededRandom,
  triggerFromUrl,
  useEventBus,
} from "./model";
import { DorScene, KkungScene, MoaScene, PopoScene } from "./scenes/aliens";
import type { SceneProps } from "./scenes/common";
import {
  CometScene,
  MeteorsScene,
  OumuamuaScene,
  StationScene,
} from "./scenes/sky";
import { EVENT_CSS } from "./styles";

const SCENES: Record<EventKind, ComponentType<SceneProps>> = {
  moa: MoaScene,
  popo: PopoScene,
  dor: DorScene,
  kkung: KkungScene,
  comet: CometScene,
  meteors: MeteorsScene,
  station: StationScene,
  oumuamua: OumuamuaScene,
};

export interface EventLayerProps {
  /** 자동 이벤트 사이 간격(초). 기본 90초 */
  every?: number;
  /** 첫 자동 이벤트까지 기다리는 시간(초). 기본 20초 */
  firstDelay?: number;
  /** false면 층 전체를 끈다(자동 이벤트도, trigger로 일으킨 것도 보이지 않는다) */
  enabled?: boolean;
  /** 이벤트가 시작될 때 `clicked: false`, 손님을 누를 때 `clicked: true`로 부른다 */
  onEvent?: (info: EventInfo) => void;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * 창밖 영역(position: relative인 부모)을 꽉 채우는 투명한 층.
 * 가끔 손님이나 우주 현상이 창 위쪽 75% 안에서 지나가고, 아래 25%는 계기판을 위해 비워 둔다.
 */
export function EventLayer({
  every = 90,
  firstDelay = 20,
  enabled = true,
  onEvent,
}: EventLayerProps) {
  const current = useEventBus((s) => s.current);
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // 주소의 ?event= 값은 열리자마자 한 번
  useEffect(() => {
    if (enabled) triggerFromUrl();
  }, [enabled]);

  // 정해진 간격마다 하나씩. 무언가 지나가는 중이면 이번 차례는 건너뛴다.
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const tick = () => {
      const bus = useEventBus.getState();
      if (!bus.current) bus.trigger();
      timer = window.setTimeout(tick, every * 1000);
    };
    timer = window.setTimeout(tick, firstDelay * 1000);
    return () => window.clearTimeout(timer);
  }, [enabled, every, firstDelay]);

  // 시작을 알리고, 정해진 시간이 지나면 끝낸다
  useEffect(() => {
    if (!current) return;
    onEventRef.current?.({ kind: current.kind, clicked: false });
    const timer = window.setTimeout(
      () => useEventBus.getState().clear(current.id),
      Math.max(1500, EVENT_DURATION_MS[current.kind] - current.offsetMs),
    );
    return () => window.clearTimeout(timer);
  }, [current]);

  // 중간부터 보여 줄 때는 모든 애니메이션 시계를 그만큼 앞으로 돌린다. 이름표는 처음처럼 보인다.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!current?.offsetMs || !root) return;
    for (const anim of root.getAnimations({ subtree: true })) {
      const effect = anim.effect as KeyframeEffect | null;
      const target = effect?.target;
      const isLabel =
        target instanceof Element && target.classList.contains("ev-label");
      const at = isLabel ? 600 : current.offsetMs;
      // 지연이 걸린 애니메이션은 지연을 없애고 그만큼 시각을 당긴다(지연을 둔 채 돌리면 그려지지 않는 브라우저가 있다)
      const delay = Number(effect?.getTiming().delay ?? 0);
      if (delay && effect) {
        effect.updateTiming({ delay: 0 });
        anim.currentTime = at - delay;
      } else {
        anim.currentTime = at;
      }
    }
  }, [current]);

  const rand = useMemo(
    () => (current ? seededRandom(current.seed) : Math.random),
    [current],
  );

  if (!enabled || !current) return null;

  const Scene = SCENES[current.kind];
  const kind = current.kind;
  const onPoke = isAlienKind(kind)
    ? () => onEventRef.current?.({ kind, clicked: true })
    : () => {};

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-event={kind}
    >
      <style>{EVENT_CSS}</style>
      <div className="ev-band">
        <Scene
          key={current.id}
          durationMs={EVENT_DURATION_MS[kind]}
          rand={rand}
          reduced={reduced}
          onPoke={onPoke}
        />
      </div>
      <div key={`label-${current.id}`} className="ev-label" role="status">
        {EVENT_LABELS[kind]}
      </div>
    </div>
  );
}
