"use client";

// 보냈지만 아직 세션이 반영하지 않은 답(2026-11-03). 본부는 답을 받으면 할 일을 지우지만,
// 지도 깃발·책상 기다림은 세션이 파일을 고쳐야 사라진다. 그 사이 "보냈어요"를 창을 닫았다 열어도,
// 깃발 창과 구역 판·조종석과 선실 어디서 보든 같게 보이도록 화면 하나의 상태가 아니라 여기 둔다.
// 브라우저 localStorage(열쇠 SENT_STORAGE_KEY)에 남아 새로 고쳐도 유지되고, 다른 탭에서 바꾼 것도
// storage 이벤트로 다시 읽어 따라온다(2026-11-24, useSentStorageSync). 서버 렌더 때는 비어 있다가
// 마운트 뒤 채워진다. localStorage를 못 쓰면(사파리 개인 창 등) 예전처럼 탭 안에서만 산다.
// 세션이 반영하면(깃발 decided, 책상에서 기다림이 빠짐) 지운다. 그래도 남은 것은 읽을 때 정리한다:
// 끝난 미룸은 버리고, 보낸 답은 7일이 지나면 버리며, 보낸 답·읽음은 각각 최근 300개까지만 둔다.
// 책상 기다림을 1시간 미룬 것도 여기 둔다: 미루면 할 일은 빠지지만 책상 카드는 남기 때문이다.
import { useEffect } from "react";
import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";
import type { ActionRequest, ActionResult } from "@/protocol/v1";

/** localStorage 열쇠. 저장 형식을 바꾸면 뒤 숫자를 올린다 */
export const SENT_STORAGE_KEY = "starship-sent/1";
/** 보낸 답·읽음을 남기는 최대 개수(오래된 것부터 버린다) */
export const SENT_MAX = 300;
export const READ_MAX = 300;
/** 보낸 답을 남기는 기간. 세션이 이만큼 반영하지 않았으면 버린다 */
export const SENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

/** localStorage에 남기는 부분 */
export type SavedSent = {
  /** 열쇠 → 보낸 답 */
  sent: Record<string, string>;
  /** 열쇠 → 보낸 시각(Unix 밀리초). 만료를 따지려고 sent와 함께 둔다 */
  sentAt: Record<string, number>;
  /** 읽음을 눌러 숨긴 답해 둔 것(readKey). 본부가 못 받으면 되돌린다 */
  read: Record<string, true>;
  /** 열쇠 → 미뤄 둔 끝(Unix 밀리초). 본부가 미룸을 받았을 때만 남긴다(2026-11-03) */
  snoozed: Record<string, number>;
};

type SentStore = SavedSent & {
  mark: (key: string, answer: string) => void;
  clear: (key: string) => void;
  /** 앞머리가 prefix인 열쇠 가운데 keep에 없는 것을 지운다(세션이 반영해 사라진 것) */
  prune: (prefix: string, keep: ReadonlySet<string>) => void;
  setRead: (key: string, on: boolean) => void;
  snooze: (key: string, until: number) => void;
};

/** 넣은 순서로 뒤에서 max개만 남긴다(앞의 오래된 것부터 버린다) */
export function keepLast<T>(
  rec: Record<string, T>,
  max: number,
): Record<string, T> {
  const entries = Object.entries(rec);
  if (entries.length <= max) return rec;
  return Object.fromEntries(entries.slice(entries.length - max));
}

function pickRecord<T>(
  v: unknown,
  ok: (x: unknown) => x is T,
): Record<string, T> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) if (ok(x)) out[k] = x;
  return out;
}
const isString = (x: unknown): x is string => typeof x === "string";
const isNumber = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const isTrue = (x: unknown): x is true => x === true;

/**
 * 저장해 둔 것을 읽을 때 정리한다. 모양이 틀린 값은 버리고, 끝난 미룸, 보낸 지 SENT_TTL_MS가
 * 지났거나 시각이 없는 답을 버린 뒤, 보낸 답·읽음은 최근 것만 남긴다.
 */
export function tidySaved(saved: unknown, now: number): SavedSent {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<
    string,
    unknown
  >;
  const rawSent = pickRecord(s.sent, isString);
  const rawAt = pickRecord(s.sentAt, isNumber);
  const fresh: Record<string, [string, number]> = {};
  for (const [k, answer] of Object.entries(rawSent)) {
    const at = rawAt[k];
    if (at !== undefined && now - at <= SENT_TTL_MS) fresh[k] = [answer, at];
  }
  const sent: Record<string, string> = {};
  const sentAt: Record<string, number> = {};
  for (const [k, [answer, at]] of Object.entries(keepLast(fresh, SENT_MAX))) {
    sent[k] = answer;
    sentAt[k] = at;
  }
  const snoozed: Record<string, number> = {};
  for (const [k, until] of Object.entries(pickRecord(s.snoozed, isNumber)))
    if (until > now) snoozed[k] = until;
  return {
    sent,
    sentAt,
    read: keepLast(pickRecord(s.read, isTrue), READ_MAX),
    snoozed,
  };
}

/** localStorage가 없거나 막혀도(사파리 개인 창, 저장 공간 가득) 앱이 깨지지 않게 감싼다 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // 못 남기면 탭 안에서만 산다
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // 위와 같다
    }
  },
};

function without<T>(rec: Record<string, T>, key: string): Record<string, T> {
  if (!(key in rec)) return rec;
  const { [key]: _, ...rest } = rec;
  return rest;
}

export const useSent = create<SentStore>()(
  persist<SentStore, [], [], SavedSent>(
    (set) => ({
      sent: {},
      sentAt: {},
      read: {},
      snoozed: {},
      mark: (key, answer) =>
        set((s) => {
          // 다시 보낸 답은 맨 뒤로 옮겨, 상한에서 가장 늦게 버려지게 한다
          const sent = keepLast(
            { ...without(s.sent, key), [key]: answer },
            SENT_MAX,
          );
          const sentAt: Record<string, number> = {};
          for (const k of Object.keys(sent)) {
            const at = k === key ? Date.now() : s.sentAt[k];
            if (at !== undefined) sentAt[k] = at;
          }
          return { sent, sentAt };
        }),
      clear: (key) =>
        set((s) => {
          if (!(key in s.sent)) return s;
          return { sent: without(s.sent, key), sentAt: without(s.sentAt, key) };
        }),
      prune: (prefix, keep) =>
        set((s) => {
          const goneOf = (rec: Record<string, unknown>) =>
            Object.keys(rec).filter(
              (k) => k.startsWith(prefix) && !keep.has(k),
            );
          const gone = goneOf(s.sent);
          const goneSnoozed = goneOf(s.snoozed);
          if (!gone.length && !goneSnoozed.length) return s;
          const sent = { ...s.sent };
          const sentAt = { ...s.sentAt };
          for (const k of gone) {
            delete sent[k];
            delete sentAt[k];
          }
          const snoozed = { ...s.snoozed };
          for (const k of goneSnoozed) delete snoozed[k];
          return { sent, sentAt, snoozed };
        }),
      setRead: (key, on) =>
        set((s) => {
          if (on === !!s.read[key]) return s;
          if (!on) return { read: without(s.read, key) };
          return { read: keepLast({ ...s.read, [key]: true }, READ_MAX) };
        }),
      snooze: (key, until) =>
        set((s) => ({ snoozed: { ...s.snoozed, [key]: until } })),
    }),
    {
      name: SENT_STORAGE_KEY,
      version: 1,
      storage: {
        getItem: (name) => {
          const raw = safeLocalStorage.getItem(name);
          if (typeof raw !== "string") return null;
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        },
        setItem: (name, value) =>
          safeLocalStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => safeLocalStorage.removeItem(name),
      },
      partialize: ({ sent, sentAt, read, snoozed }): SavedSent => ({
        sent,
        sentAt,
        read,
        snoozed,
      }),
      // 저장된 것이 진짜다(쓸 때마다 남기므로). 읽을 때 정리해 현재 상태를 바꾼다
      merge: (saved, current) => ({
        ...current,
        ...tidySaved(saved, Date.now()),
      }),
      // 서버 렌더와 첫 그리기를 같게 두려고 마운트 뒤에 읽는다(useSentStorageSync)
      skipHydration: true,
    },
  ),
);

/**
 * 마운트 뒤 localStorage에서 읽고, 다른 탭이 바꾸면 다시 읽는다. 앱 맨 위(Providers)에서 한 번 부른다.
 */
export function useSentStorageSync(): void {
  useEffect(() => {
    void useSent.persist.rehydrate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SENT_STORAGE_KEY || e.key === null)
        void useSent.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

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
