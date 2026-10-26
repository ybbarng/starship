import { create } from "zustand";
import { useVoyage } from "@/sky/voyage";

/** 창밖에서 일어날 수 있는 일. 앞의 넷은 이 저장소에서 지어낸 손님, 뒤의 넷은 실제 우주 현상이다. */
export const EVENT_KINDS = [
  "moa",
  "popo",
  "dor",
  "kkung",
  "comet",
  "meteors",
  "station",
  "oumuamua",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

/** 클릭해서 반응을 볼 수 있는 손님들 */
export const ALIEN_KINDS = ["moa", "popo", "dor", "kkung"] as const;

export type AlienKind = (typeof ALIEN_KINDS)[number];

export interface EventInfo {
  kind: EventKind;
  /** 손님을 눌렀으면 true, 이벤트가 막 시작됐으면 false */
  clicked: boolean;
}

/** 창 구석에 잠깐 띄우는 이름표 */
export const EVENT_LABELS: Record<EventKind, string> = {
  moa: "모아가 지나가요",
  popo: "포포 떼가 지나가요",
  dor: "청소 로봇 도르가 지나가요",
  kkung: "정비 로봇 끙이 지나가요",
  comet: "혜성 통과",
  meteors: "유성우",
  station: "우주정거장이 지나가요",
  oumuamua: "길쭉한 성간 천체가 굴러가요",
};

/** 이벤트마다 보여 주는 시간(밀리초) */
export const EVENT_DURATION_MS: Record<EventKind, number> = {
  moa: 16_000,
  popo: 12_000,
  dor: 10_000,
  kkung: 20_000,
  comet: 16_000,
  meteors: 9_000,
  station: 10_000,
  oumuamua: 20_000,
};

/** 주소로 일으킬 때 `at`이 없으면 이만큼 지난 장면부터 보여 준다. 주인공이 창 안쪽에 잘 보이는 지점이다. */
export const EVENT_SHOWCASE_MS: Record<EventKind, number> = {
  moa: 7_000,
  popo: 5_500,
  dor: 4_500,
  kkung: 9_000,
  comet: 7_000,
  meteors: 3_200,
  station: 4_000,
  oumuamua: 9_000,
};

export function isEventKind(value: unknown): value is EventKind {
  return (
    typeof value === "string" &&
    (EVENT_KINDS as readonly string[]).includes(value)
  );
}

export function isAlienKind(kind: EventKind): kind is AlienKind {
  return (ALIEN_KINDS as readonly string[]).includes(kind);
}

export interface ActiveEvent {
  kind: EventKind;
  /** 같은 종류를 연달아 일으켜도 새로 그리도록 매번 바뀌는 번호 */
  id: number;
  /** 방향·높이 같은 무작위 값을 정하는 씨앗 */
  seed: number;
  /** 이 시간(밀리초)만큼 이미 지난 장면부터 보여 준다(시연·스크린숏용) */
  offsetMs: number;
}

interface EventBusState {
  current: ActiveEvent | null;
  last: EventKind | null;
  /** 이벤트를 바로 일으킨다. 종류를 빼면 바로 앞과 다른 것을 무작위로 고른다. */
  trigger: (kind?: EventKind, options?: { offsetMs?: number }) => void;
  /** 지금 이벤트를 끝낸다. id를 주면 그 이벤트일 때만 끝낸다. */
  clear: (id?: number) => void;
}

let nextId = 1;

/** 우주정거장은 지구 둘레를 돌므로 지구나 달에 있을 때만 지나간다. */
const NEAR_EARTH = new Set(["earth", "moon"]);

function pickRandom(except: EventKind | null): EventKind {
  const here = useVoyage.getState().destinationId;
  const pool = EVENT_KINDS.filter(
    (k) => k !== except && (k !== "station" || NEAR_EARTH.has(here)),
  );
  return pool[Math.floor(Math.random() * pool.length)] ?? "comet";
}

export const useEventBus = create<EventBusState>((set, get) => ({
  current: null,
  last: null,
  trigger: (kind, options) => {
    const chosen = kind ?? pickRandom(get().last);
    set({
      current: {
        kind: chosen,
        id: nextId++,
        seed: Math.floor(Math.random() * 2 ** 31),
        offsetMs: Math.max(0, options?.offsetMs ?? 0),
      },
      last: chosen,
    });
  },
  clear: (id) => {
    const { current } = get();
    if (!current) return;
    if (id !== undefined && current.id !== id) return;
    set({ current: null });
  },
}));

let urlHandled = false;

/**
 * 주소에 `?event=moa` 같은 값이 있으면 한 번만 그 이벤트를 일으킨다(시연·스크린숏용).
 * 주인공이 바로 보이도록 장면 중간부터 보여 준다. `&at=0`이면 처음부터, `&at=3`이면 3초 지점부터.
 */
export function triggerFromUrl(): void {
  if (urlHandled || typeof window === "undefined") return;
  urlHandled = true;
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("event");
  if (!isEventKind(kind)) return;
  const at = params.has("at") ? Number(params.get("at")) : Number.NaN;
  const offsetMs = Number.isFinite(at) ? at * 1000 : EVENT_SHOWCASE_MS[kind];
  useEventBus.getState().trigger(kind, { offsetMs });
}

/** 씨앗 하나로 같은 무작위 값 줄을 만든다 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
