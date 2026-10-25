"use client";

import { create } from "zustand";

export type ToastTone = "ok" | "error" | "info";
export type Toast = { id: number; text: string; tone: ToastTone };

type ToastStore = {
  items: Toast[];
  show: (text: string, tone?: ToastTone) => void;
};

let seq = 0;

export const useToast = create<ToastStore>((set) => ({
  items: [],
  show: (text, tone = "info") => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
    setTimeout(
      () => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
      3_200,
    );
  },
}));
