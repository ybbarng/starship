"use client";

// 지금 어디로 가고 있나. 여러 화면 부품(창밖, 목적지 고르기, 계기판)이 함께 본다.
import { create } from "zustand";
import { DESTINATION_BY_ID, type Destination } from "./bodies";

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

export function useDestination(): Destination {
  const id = useVoyage((s) => s.destinationId);
  return (
    DESTINATION_BY_ID.get(id) ?? (DESTINATION_BY_ID.get("earth") as Destination)
  );
}
