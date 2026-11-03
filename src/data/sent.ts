"use client";

// 보냈지만 아직 세션이 반영하지 않은 답(2026-11-03). 본부는 답을 받으면 할 일을 지우지만,
// 지도 깃발·책상 기다림은 세션이 파일을 고쳐야 사라진다. 그 사이 "보냈어요"를 창을 닫았다 열어도,
// 깃발 창과 구역 판·조종석과 선실 어디서 보든 같게 보이도록 화면 하나의 상태가 아니라 여기 둔다.
// 탭 안에서만 산다(새로 고치면 사라진다). 세션이 반영하면(깃발 decided, 책상에서 기다림이 빠짐) 지운다.
import { create } from "zustand";

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
  mark: (key: string, answer: string) => void;
  clear: (key: string) => void;
  /** 앞머리가 prefix인 열쇠 가운데 keep에 없는 것을 지운다(세션이 반영해 사라진 것) */
  prune: (prefix: string, keep: ReadonlySet<string>) => void;
  setRead: (key: string, on: boolean) => void;
};

export const useSent = create<SentStore>((set) => ({
  sent: {},
  read: {},
  mark: (key, answer) => set((s) => ({ sent: { ...s.sent, [key]: answer } })),
  clear: (key) =>
    set((s) => {
      if (!(key in s.sent)) return s;
      const { [key]: _, ...rest } = s.sent;
      return { sent: rest };
    }),
  prune: (prefix, keep) =>
    set((s) => {
      const gone = Object.keys(s.sent).filter(
        (k) => k.startsWith(prefix) && !keep.has(k),
      );
      if (!gone.length) return s;
      const next = { ...s.sent };
      for (const k of gone) delete next[k];
      return { sent: next };
    }),
  setRead: (key, on) =>
    set((s) => {
      if (on === !!s.read[key]) return s;
      const next = { ...s.read };
      if (on) next[key] = true;
      else delete next[key];
      return { read: next };
    }),
}));

/**
 * 읽음으로 숨긴 답인지. crewId를 모르면 id만으로 본다(답 id는 책상 안에서만 겹치지 않는다).
 * 화면 밖 계산(crewTaskCount)에서도 쓰려고 훅이 아니라 지금 값을 읽는다.
 */
export function isReadHidden(answerId: string, crewId?: string): boolean {
  const read = useSent.getState().read;
  if (crewId) return !!read[readKey(crewId, answerId)];
  return Object.keys(read).some((k) => k.endsWith(`/${answerId}`));
}
