"use client";

// 오늘의 항로: 할 일을 하나 치울 때마다 한 칸 워프한다. 벌은 없다(안 치워도 그 자리에서 돈다).
// 치움 = 치우기·답하기·비서에게. 버튼을 누른 할 일이 스냅샷에서 실제로 사라지면 한 칸 나아간다.
import { useEffect } from "react";
import { create } from "zustand";
import type { Task } from "@/protocol/v1";
import { DESTINATION_BY_ID } from "@/sky/bodies";
import { useVoyage } from "@/sky/voyage";
import { useEventBus } from "@/ui/events";

export const ROUTE = [
  "moon",
  "mars",
  "ceres",
  "jupiter",
  "io",
  "saturn",
  "titan",
  "uranus",
  "neptune",
  "pluto",
] as const;

export const START = "earth";

export function stopName(id: string): string {
  return DESTINATION_BY_ID.get(id)?.ko ?? id;
}

/** 지금 칸(0 = 출발 전 지구, 1..10 = ROUTE의 칸) */
export function stopAt(cleared: number): string {
  const step = Math.min(cleared, ROUTE.length);
  return step === 0 ? START : (ROUTE[step - 1] ?? START);
}

type Warp = { id: number; to: string; step: number };

type RouteStore = {
  cleared: number;
  /** 버튼을 눌러 사라지길 기다리는 할 일 */
  expecting: string[];
  lastWarp: Warp | null;
  expect: (taskId: string) => void;
  load: () => void;
  advance: (n: number, remaining: number) => void;
};

const KEY = () =>
  `three-rooms:route:${new Date().toISOString().slice(0, 10)}:${
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("demo") ?? "default")
  }`;

function save(n: number) {
  try {
    localStorage.setItem(KEY(), String(n));
  } catch {}
}

let warpSeq = 0;

export const useRoute = create<RouteStore>((set, get) => ({
  cleared: 0,
  expecting: [],
  lastWarp: null,
  expect: (taskId) =>
    set((s) =>
      s.expecting.includes(taskId)
        ? s
        : { expecting: [...s.expecting, taskId] },
    ),
  load: () => {
    let n = 0;
    try {
      const reset =
        new URLSearchParams(window.location.search).get("reset") === "1";
      if (reset) localStorage.removeItem(KEY());
      n = Number(localStorage.getItem(KEY()) ?? 0) || 0;
    } catch {}
    set({ cleared: n });
    // 창밖은 이동 없이 지금 칸에서 시작
    useVoyage.setState({ destinationId: stopAt(n), phase: "cruise" });
  },
  advance: (n, remaining) => {
    const before = get().cleared;
    const after = before + n;
    save(after);
    const to = stopAt(after);
    set({
      cleared: after,
      lastWarp: { id: ++warpSeq, to, step: Math.min(after, ROUTE.length) },
    });
    useVoyage.getState().travelTo(to);
    // 일이 끝나면 오는 손님: 하나마다 작은 손님, 셋마다 포포 떼, 다 치우면 모아
    const bus = useEventBus.getState();
    if (remaining === 0) bus.trigger("moa", { offsetMs: 2500 });
    else if (Math.floor(after / 3) > Math.floor(before / 3))
      bus.trigger("popo", { offsetMs: 2500 });
    else bus.trigger(after % 2 ? "meteors" : "comet", { offsetMs: 1500 });
  },
}));

/** 스냅샷을 보며, 눌러 둔 할 일이 사라졌으면 그만큼 나아간다. */
export function useRouteTracker(tasks: Task[], ready: boolean) {
  const expecting = useRoute((s) => s.expecting);
  useEffect(() => {
    useRoute.getState().load();
  }, []);
  useEffect(() => {
    if (!ready || expecting.length === 0) return;
    const ids = new Set(tasks.map((t) => t.id));
    const gone = expecting.filter((id) => !ids.has(id));
    if (gone.length === 0) return;
    useRoute.setState({
      expecting: expecting.filter((id) => ids.has(id)),
    });
    useRoute.getState().advance(gone.length, tasks.length);
  }, [tasks, expecting, ready]);
}

/** 이 동작이면 할 일이 목록에서 사라진다 */
export function clears(action: string): boolean {
  return action === "dismiss" || action === "answer" || action === "handoff";
}
