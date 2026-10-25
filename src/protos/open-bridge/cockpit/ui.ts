"use client";

// 조종석 층이 함께 쓰는 작은 도우미: 유리판 모양, 기억되는 상태, 글 선택 중 클릭 막기.
import { useCallback, useEffect, useRef, useState } from "react";

/** 하늘 위에 얹는 얇은 유리판 */
export const GLASS =
  "pointer-events-auto rounded-xl border border-white/[0.09] bg-[#060a14]/60 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md";

/** 계기 글: 작은 이름표 */
export const LABEL = "text-[10px] tracking-[0.08em] text-white/40";

/** 계기 글: 고정폭 숫자 */
export const VALUE = "font-mono text-[11.5px] tabular-nums text-white/85";

/** 작은 단추 */
export const CHIP_BTN =
  "pointer-events-auto rounded-md px-2 py-0.5 text-[11px] text-white/55 transition hover:bg-white/10 hover:text-white";

/**
 * localStorage에 기억되는 상태. 첫 그림은 기본값으로 그리고(서버 그림과 어긋나지 않게)
 * 붙은 뒤에 읽어 온다. 사생활 창 등에서 막혀도 기본값으로 돈다.
 */
export function usePersisted<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  // 읽기 전에 기본값을 써 버리지 않게(개발 모드는 효과를 두 번 돌린다) 상태로 둔다
  const [ready, setReady] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial은 처음 한 번만 본다
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {
      // 기본값 그대로
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 못 해도 화면은 그대로
    }
  }, [key, value, ready]);
  return [value, setValue];
}

/** 빛이 그 거리를 가는 시간(교신 지연). 공용 formatLightTime의 "4분 60초" 반올림을 피해 초 단위로 먼저 자른다. */
export function lightTime(km: number): string {
  const s = km / 299_792.458;
  if (s < 1) return `${Math.round(s * 1000)}밀리초`;
  if (s < 60) return `${s.toFixed(1)}초`;
  const whole = Math.round(s);
  if (whole < 3600) return `${Math.floor(whole / 60)}분 ${whole % 60}초`;
  const min = Math.round(s / 60);
  if (min < 1440) return `${Math.floor(min / 60)}시간 ${min % 60}분`;
  const y = s / 31_557_600;
  if (y >= 1)
    return `${y.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}년`;
  return `${(s / 86_400).toFixed(1)}일`;
}

/** 글을 드래그해 고르는 중이면 true. 그때 누른 것으로 치지 않는다. */
export function selecting(): boolean {
  const s = typeof window === "undefined" ? null : window.getSelection();
  return Boolean(s && !s.isCollapsed && s.toString().trim());
}

/** 기다린 시간 글이 저절로 바뀌도록 */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(t);
  }, [every]);
  return now;
}

/**
 * 가장자리를 끌어 크기를 바꾼다. dir: 오른쪽(+x)·위(-y) 같은 방향 부호.
 * 끄는 동안 글 선택이 따라 생기지 않게 body의 선택을 잠깐 막는다.
 */
export function useEdgeDrag(
  onDelta: (dx: number, dy: number) => void,
): (e: React.PointerEvent) => void {
  const cb = useRef(onDelta);
  cb.current = onDelta;
  return useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      cb.current(ev.clientX - x, ev.clientY - y);
      x = ev.clientX;
      y = ev.clientY;
    };
    const up = () => {
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);
}
