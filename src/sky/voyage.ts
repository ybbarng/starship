"use client";

// 지금 어디로 가고 있나. 여러 화면 부품(창밖, 목적지 고르기, 계기판)이 함께 본다.
import { useMemo, useSyncExternalStore } from "react";
import { create } from "zustand";
import {
  DESTINATION_BY_ID,
  DESTINATIONS,
  type Destination,
  getDestinationsVersion,
  subscribeDestinations,
} from "./bodies";

export type VoyagePhase = "cruise" | "travel";

type VoyageStore = {
  destinationId: string;
  previousId: string | null;
  phase: VoyagePhase;
  /** 0..1 이동 진행도 */
  progress: number;
  travelTo: (id: string) => void;
  /** SpaceView가 이동 상태를 알려 줄 때 쓴다. */
  _setPhase: (phase: VoyagePhase, progress?: number) => void;
};

export const useVoyage = create<VoyageStore>((set, get) => ({
  destinationId: "earth",
  previousId: null,
  phase: "cruise",
  progress: 1,
  travelTo: (id) => {
    if (!DESTINATION_BY_ID.has(id) || id === get().destinationId) return;
    set({
      previousId: get().destinationId,
      destinationId: id,
      phase: "travel",
      progress: 0,
    });
  },
  _setPhase: (phase, progress = phase === "cruise" ? 1 : 0) =>
    set({ phase, progress }),
}));

/** 목적지 전체. 하늘 자료가 와서 이름 있는 별이 더해지면 다시 그린다. */
export function useDestinations(): readonly Destination[] {
  const version = useSyncExternalStore(
    subscribeDestinations,
    getDestinationsVersion,
    getDestinationsVersion,
  );
  // version이 바뀔 때마다 새 배열을 돌려 React가 바뀐 것을 알게 한다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: DESTINATIONS는 제자리에서 늘어나는 배열이라 version으로 바뀐 것을 안다
  return useMemo(() => [...DESTINATIONS], [version]);
}

export function useDestination(): Destination {
  const id = useVoyage((s) => s.destinationId);
  return (
    DESTINATION_BY_ID.get(id) ?? (DESTINATION_BY_ID.get("earth") as Destination)
  );
}
