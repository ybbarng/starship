"use client";

// 보냈지만 아직 세션이 반영하지 않은 답(2026-11-03). 본부는 답을 받으면 할 일을 지우지만,
// 지도 깃발·책상 기다림은 세션이 파일을 고쳐야 사라진다. 그 사이 "보냈어요"를 창을 닫았다 열어도,
// 깃발 창과 구역 판·조종석과 선실 어디서 보든 같게 보이도록 화면 하나의 상태가 아니라 여기 둔다.
// 탭 안에서만 산다(새로 고치면 사라진다). 세션이 반영하면(깃발 decided, 책상에서 기다림이 빠짐) 지운다.
// 책상 기다림을 1시간 미룬 것도 여기 둔다: 미루면 할 일은 빠지지만 책상 카드는 남기 때문이다.
import { create } from "zustand";
import type { ActionRequest, ActionResult } from "@/protocol/v1";

/** 지도 갈림길 답의 열쇠 */
export function forkKey(crewId: string, region: string, signId: string) {
  return `fork:${crewId}/${region}/${signId}`;
}

/** 책상 기다림 답의 열쇠: 그 기다림의 Task id(desk:<crewId>:<waitId>) 그대로 */
export function deskSentKey(taskId: string) {
  return taskId;
}

/** 답해 둔 것 읽음의 열쇠 */
export function readKey(crewId: string, answerId: string) {
  return `${crewId}/${answerId}`;
}

type SentStore = {
  /** 열쇠 → 보낸 답 */
  sent: Record<string, string>;
  /** 읽음을 눌러 숨긴 답해 둔 것(readKey). 본부가 못 받으면 되돌린다 */
  read: Record<string, true>;
  /** 열쇠 → 미뤄 둔 끝(Unix 밀리초). 본부가 미룸을 받았을 때만 남긴다(2026-11-03) */
  snoozed: Record<string, number>;
  mark: (key: string, answer: string) => void;
  clear: (key: string) => void;
  /** 앞머리가 prefix인 열쇠 가운데 keep에 없는 것을 지운다(세션이 반영해 사라진 것) */
  prune: (prefix: string, keep: ReadonlySet<string>) => void;
  setRead: (key: string, on: boolean) => void;
  snooze: (key: string, until: number) => void;
};

export const useSent = create<SentStore>((set) => ({
  sent: {},
  read: {},
  snoozed: {},
  mark: (key, answer) => set((s) => ({ sent: { ...s.sent, [key]: answer } })),
  clear: (key) =>
    set((s) => {
      if (!(key in s.sent)) return s;
      const { [key]: _, ...rest } = s.sent;
      return { sent: rest };
    }),
  prune: (prefix, keep) =>
    set((s) => {
      const goneOf = (rec: Record<string, unknown>) =>
        Object.keys(rec).filter((k) => k.startsWith(prefix) && !keep.has(k));
      const gone = goneOf(s.sent);
      const goneSnoozed = goneOf(s.snoozed);
      if (!gone.length && !goneSnoozed.length) return s;
      const sent = { ...s.sent };
      for (const k of gone) delete sent[k];
      const snoozed = { ...s.snoozed };
      for (const k of goneSnoozed) delete snoozed[k];
      return { sent, snoozed };
    }),
  setRead: (key, on) =>
    set((s) => {
      if (on === !!s.read[key]) return s;
      const next = { ...s.read };
      if (on) next[key] = true;
      else delete next[key];
      return { read: next };
    }),
  snooze: (key, until) =>
    set((s) => ({ snoozed: { ...s.snoozed, [key]: until } })),
}));

/**
 * 할 일 동작의 결과를 이 저장소에 남긴다. 지금은 책상 기다림(id desk:…) 미룸만:
 * 본부가 받았을 때 미룬 끝을 남겨, 조종석 결재함에서 미뤘든 선실 카드에서 미뤘든
 * 선실 카드가 "n분 뒤 다시 와요"로 보이게 한다(전에는 선실 카드에서 미룰 때만 남겨
 * 결재함에서 미루면 "아직 답할 수 없어요"가 잘못 떴다, 2026-11-03). useAct().task가 부른다.
 */
export function noteTaskResult(
  req: Extract<ActionRequest, { target: "task" }>,
  result: ActionResult,
): void {
  if (!result.ok || !req.id.startsWith("desk:")) return;
  if (req.action === "snooze" && req.until !== undefined)
    useSent.getState().snooze(deskSentKey(req.id), req.until);
}
