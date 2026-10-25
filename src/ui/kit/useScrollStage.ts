"use client";

// "약간의 저항을 넘겨 스크롤하면" 다음 장면으로. 휠·키보드·터치를 모아 문턱을 넘으면 장면을 바꾸고,
// 0..1 사이 progress를 부드럽게 옮겨 준다(조종석이 작아지는 연출에 쓴다).
import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollStage({
  stages = 2,
  threshold = 160,
  duration = 900,
  enabled = true,
}: {
  stages?: number;
  threshold?: number;
  duration?: number;
  /** false면 휠·키보드·터치로 장면을 바꾸지 않는다(예: 전체 화면 감상 중) */
  enabled?: boolean;
} = {}) {
  const stageRef = useRef(0);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0); // 0 = 첫 장면, stages-1 = 마지막
  /** 문턱까지 얼마나 밀었나(0..1). 버티는 느낌을 보여 줄 때 쓴다. */
  const [push, setPush] = useState(0);
  const acc = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef<number | null>(null);
  const progressRef = useRef(0);

  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(stages - 1, next));
      stageRef.current = target;
      setStage(target);
      acc.current = 0;
      setPush(0);
      const from = progressRef.current;
      const start = performance.now();
      if (anim.current) cancelAnimationFrame(anim.current);
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / duration);
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        const v = from + (target - from) * e;
        progressRef.current = v;
        setProgress(v);
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [stages, duration],
  );

  useEffect(() => {
    if (!enabled) return;
    const feed = (dy: number) => {
      // 같은 방향으로 계속 밀어야 쌓인다.
      if (Math.sign(dy) !== Math.sign(acc.current)) acc.current = 0;
      acc.current += dy;
      setPush(Math.min(1, Math.abs(acc.current) / threshold));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        acc.current = 0;
        setPush(0);
      }, 260);
      const now = stageRef.current;
      if (acc.current > threshold && now < stages - 1) go(now + 1);
      else if (acc.current < -threshold && now > 0) go(now - 1);
    };
    const onWheel = (e: WheelEvent) => {
      // 안쪽에 스스로 스크롤하는 목록이 있으면 그쪽을 먼저.
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-scroll-inside]")) return;
      if (el?.closest("[role=dialog]")) return;
      e.preventDefault();
      feed(e.deltaY);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea")) return;
      if (e.key === "PageDown" || e.key === "ArrowDown") feed(threshold + 1);
      if (e.key === "PageUp" || e.key === "ArrowUp") feed(-threshold - 1);
    };
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      feed((touchY - y) * 2);
      touchY = y;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [threshold, stages, go, enabled]);

  /** 버튼으로 장면을 바꿀 때 */
  const goTo = go;

  return { stage, progress, push, goTo };
}
