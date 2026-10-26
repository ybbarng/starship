"use client";

// 창밖 축척 모드(줄인 축척 / 실제 축척). 창밖, 축척 안내, 항법 계기가 함께 본다.
import { create } from "zustand";
import { type ScaleMode, setScaleMode } from "./astro";

type ScaleStore = {
  mode: ScaleMode;
  setMode: (mode: ScaleMode) => void;
};

export const useScale = create<ScaleStore>((set) => ({
  mode: "compressed",
  setMode: (mode) => {
    // 계산 함수가 읽는 모듈 상태를 먼저 바꾸고 나서 다시 그리게 한다.
    setScaleMode(mode);
    set({ mode });
  },
}));
