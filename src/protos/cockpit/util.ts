"use client";

// 이 시안이 함께 쓰는 작은 도우미: 화면 크기, 모드 사이를 부드럽게 옮기는 값, 교신 화상 창 상태, 일 신호 계산.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Gauge, Hail, Task } from "@/protocol/v1";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 안에서 [a, b] 구간만 0..1로 늘인다(단계별 연출) */
export const span = (t: number, a: number, b: number) =>
  clamp01((t - a) / (b - a));
export const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;

export function useViewport() {
  const [size, setSize] = useState({ w: 1372, h: 872 });
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return size;
}

/**
 * target(0 또는 1) 쪽으로 duration 동안 옮겨 가는 값. 중간에 방향이 바뀌면 그 자리에서 되돌아간다.
 * jump()는 연출 없이 바로 옮긴다(주소로 감상 모드에서 시작할 때).
 */
export function useTween(target: number, duration: number) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;
    // 남은 거리에 맞춰 시간을 줄인다(되돌아갈 때 느려지지 않게)
    const time = duration * Math.max(0.35, Math.abs(target - from));
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / time);
      const v = from + (target - from) * easeInOut(k);
      valueRef.current = v;
      setValue(v);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  const jump = (v: number) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    valueRef.current = v;
    setValue(v);
  };
  return { value, jump };
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

/** 글을 드래그해 고르는 중이면 true. 그때 누른 것으로 치지 않는다. */
export function selecting(): boolean {
  const s = typeof window === "undefined" ? null : window.getSelection();
  return Boolean(s && !s.isCollapsed && s.toString().trim());
}

/** 교신 화상 창: 무엇을 열었나, 무엇을 이미 봤나. 보던 교신이 치워지면 다음 것으로, 없으면 닫는다. */
export function useHailScreen(hails: Hail[]) {
  const ids = hails.map((h) => h.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    setOpenId((id) => (!id || list.includes(id) ? id : (list[0] ?? null)));
  }, [key]);

  useEffect(() => {
    if (openId && !seen.has(openId)) setSeen((s) => new Set(s).add(openId));
  }, [openId, seen]);

  return useMemo(
    () => ({
      openId,
      seen,
      open: (id: string) => setOpenId(id),
      close: () => setOpenId(null),
      step: (d: number) =>
        setOpenId((id) => {
          const list = idsRef.current;
          if (!list.length) return null;
          const i = Math.max(0, list.indexOf(id ?? ""));
          return list[(i + d + list.length) % list.length] ?? null;
        }),
    }),
    [openId, seen],
  );
}

export type Lamp = "off" | "warn" | "alert";

export const HOUR = 3_600_000;
/** 내 차례가 이만큼 쌓이면 노란 등 */
export const PILE_WARN = 5;
export const PILE_ALERT = 10;

/** 경고등 줄이 쓰는 값: 일이 쌓였나, 오래 기다린 일, 정기 작업 */
export function useWarnings(
  tasks: Task[],
  gauges: Gauge[],
  hails: Hail[],
  now: number,
) {
  return useMemo(() => {
    const old = tasks.filter((t) => now - t.since > HOUR);
    const oldest = old.reduce((m, t) => Math.max(m, now - t.since), 0);
    const failed = gauges.filter((g) => g.status === "error");
    const warned = gauges.filter((g) => g.status === "warn");
    const pile: Lamp =
      tasks.length >= PILE_ALERT
        ? "alert"
        : tasks.length >= PILE_WARN
          ? "warn"
          : "off";
    const late: Lamp =
      oldest > 4 * HOUR ? "alert" : old.length > 0 ? "warn" : "off";
    const jobs: Lamp = failed.length ? "alert" : warned.length ? "warn" : "off";
    const hail: Lamp = hails.length ? "warn" : "off";
    return { old, failed, warned, pile, late, jobs, hail };
  }, [tasks, gauges, hails, now]);
}
