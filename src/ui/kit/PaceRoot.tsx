"use client";

// 앱 전체의 박자기. providers.tsx에 하나만 둔다. 규칙은 pace.ts, 설계는 docs/pace.md.
import { useEffect } from "react";
import {
  INPUT_BUSY_MS,
  markBusy,
  nextWait,
  pace,
  runPaceListeners,
  type SteppedAnimation,
  stepAnimations,
} from "./pace";

/** 문서의 CSS 애니메이션만(CSS 전환·스크립트 애니메이션은 그대로 둔다). */
function cssAnimations(): SteppedAnimation[] {
  if (typeof CSSAnimation === "undefined") return [];
  return document
    .getAnimations()
    .filter((a): a is CSSAnimation => a instanceof CSSAnimation);
}

/** SVG 안 SMIL 애니메이션(<animate> 등)을 품은 바깥 svg마다: 타임라인 초 − svg 시각(처음 본 순간 기준). */
const smilOrigins = new WeakMap<SVGSVGElement, number>();

/**
 * SMIL 애니메이션도 CSS와 같이 박자에 맞춘다(연료실 불꽃의 일렁임 등).
 * 처음 본 svg는 멈추고(pauseAnimations), 박자마다 시각만 옮긴다(setCurrentTime). 시각은 그 svg 안의 모든 SMIL에 함께 적용된다.
 */
function stepSmil(nowMs: number) {
  const now = nowMs / 1000;
  const seen = new Set<SVGSVGElement>();
  for (const el of document.querySelectorAll(
    "animate, animateTransform, animateMotion",
  )) {
    let svg = (el as SVGElement).ownerSVGElement;
    while (svg?.ownerSVGElement) svg = svg.ownerSVGElement;
    if (!svg || seen.has(svg)) continue;
    seen.add(svg);
    let origin = smilOrigins.get(svg);
    if (origin === undefined) {
      origin = now - svg.getCurrentTime();
      smilOrigins.set(svg, origin);
      svg.pauseAnimations();
    }
    svg.setCurrentTime(now - origin);
  }
}

/** [data-pace-free] 안의 애니메이션은 박자에서 뺀다(창밖 이벤트처럼 가끔 잠깐 돌아 제 속도로 둬도 가벼운 것). */
function isPaceFree(a: SteppedAnimation): boolean {
  const t = (a as unknown as CSSAnimation).effect;
  const el = t instanceof KeyframeEffect ? t.target : null;
  return !!el?.closest("[data-pace-free]");
}

export function PaceRoot() {
  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    const tick = () => {
      clear();
      const wait = nextWait({
        hidden: document.hidden,
        focused: document.hasFocus(),
        now: performance.now(),
        busyUntil: pace.busyUntil,
      });
      if (wait === "stop") return;
      const now = Number(document.timeline.currentTime);
      stepAnimations(cssAnimations(), now, isPaceFree);
      stepSmil(now);
      runPaceListeners();
      if (wait === "frame") raf = requestAnimationFrame(tick);
      else timer = setTimeout(tick, wait);
    };
    const onInput = () => markBusy(INPUT_BUSY_MS);
    // 새로 시작한 CSS 애니메이션(캐릭터의 짧은 동작 등)은 다음 박자를 기다리지 않고 바로 멈춰 박자에 넣는다.
    // 기다리면 그사이(초점 없을 때 최대 0.17초) 매 프레임 돌고, 캐릭터가 여럿이라 거의 끊이지 않는다.
    // 문서 전체를 다시 훑지 않고 시작한 요소의 애니메이션만 본다. 한 번에 여러 개가 시작하면 묶어서 한 번에.
    const started = new Set<Element>();
    const onAnimStart = (e: Event) => {
      if (!(e.target instanceof Element)) return;
      if (started.size === 0)
        queueMicrotask(() => {
          const anims = [...started].flatMap((el) =>
            el
              .getAnimations()
              .filter((a): a is CSSAnimation => a instanceof CSSAnimation),
          );
          started.clear();
          stepAnimations(
            anims,
            Number(document.timeline.currentTime),
            isPaceFree,
          );
        });
      started.add(e.target);
    };
    document.addEventListener("animationstart", onAnimStart, true);
    pace.wake = tick;
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("blur", tick);
    window.addEventListener("pointerdown", onInput);
    window.addEventListener("wheel", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    window.addEventListener("resize", onInput);
    tick();
    return () => {
      clear();
      if (pace.wake === tick) pace.wake = null;
      document.removeEventListener("animationstart", onAnimStart, true);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("blur", tick);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("resize", onInput);
    };
  }, []);
  return null;
}
