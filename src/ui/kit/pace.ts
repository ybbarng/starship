// 앱 전체의 그리는 박자. 선실을 하루 종일 켜 둬도 가볍게(2026-11-02 사용자 요청).
// 3D 하늘과 CSS 애니메이션(승무원 캐릭터·실내 깜빡이·연료실 불꽃)이 같은 박자에 맞춰 바뀐다.
// - 움직이는 동안(비행·끌기·미끄러짐, 누르기·휠·키 입력 직후): 화면 새로 고침마다(보통 1초에 60번)
// - 가만히 있을 때: 1초에 IDLE_FPS번
// - 창은 보이지만 다른 앱에서 일할 때(창에 초점이 없음): 1초에 BLUR_FPS번. 하루 종일 켜 둘 때 대부분 이 상태다
// - 창이 안 보일 때(document.hidden: 가려짐·최소화·다른 데스크톱): 멈춘다
// 움직임은 모두 시간으로 정해지므로, 덜 자주 바꿔도 자리·속도는 맞고 부드러움만 준다.
// 3D 하늘만은 따로: 보이는 동안 늘 1초에 SKY_FPS번(움직이는 중엔 매 프레임). 창밖이 움직일 거면 매끄럽게(2026-11-02 사용자).
// 박자를 돌리는 곳은 PaceRoot.tsx(앱 전체에 하나). 설계: docs/pace.md.

/** 가만히 있을 때 1초에 바꾸는 횟수 */
export const IDLE_FPS = 15;

/** 창에 초점이 없을 때 1초에 바꾸는 횟수 */
export const BLUR_FPS = 6;

/** 3D 하늘을 1초에 그리는 횟수(가만히 있을 때, 초점과 상관없이). 하늘은 1초에 화면 12px쯤 흘러 30번이면 한 번에 0.4px */
export const SKY_FPS = 30;

/** 입력(누르기·휠·키) 뒤 이만큼은 매 프레임 바꾼다(ms) */
export const INPUT_BUSY_MS = 1500;

export const pace = {
  /** 이 시각(performance.now 기준)까지는 매 프레임 바꾼다 */
  busyUntil: 0,
  /** 쉬는 중인 박자기를 바로 깨운다(PaceRoot가 채운다) */
  wake: null as (() => void) | null,
};

const listeners = new Set<() => void>();

/** 박자마다 부를 함수를 건다. 돌려준 함수로 뗀다. */
export function onPaceTick(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 건 함수들을 모두 부른다(PaceRoot가 박자마다 부른다). */
export function runPaceListeners(): void {
  for (const fn of listeners) fn();
}

/** 앞으로 ms 동안은 매 프레임 바꾸게 한다. 쉬는 중이었으면 바로 깨운다. */
export function markBusy(ms: number, now = performance.now()): void {
  const until = now + ms;
  if (until <= pace.busyUntil) return;
  const wasIdle = now >= pace.busyUntil;
  pace.busyUntil = until;
  if (wasIdle) pace.wake?.();
}

/** 다음 박자까지 어떻게 기다릴지: 멈춤 / 다음 화면 새로 고침 / ms 뒤. */
export function nextWait(s: {
  hidden: boolean;
  focused: boolean;
  now: number;
  busyUntil: number;
}): "stop" | "frame" | number {
  if (s.hidden) return "stop";
  if (s.now < s.busyUntil) return "frame";
  return 1000 / (s.focused ? IDLE_FPS : BLUR_FPS);
}

/** 3D 하늘을 이번 화면 새로 고침에 그릴까. 안 보이면 안 그리고, 바쁘면 늘, 아니면 SKY_FPS에 맞춰. 2ms는 화면 새로 고침 간격의 흔들림 몫 */
export function skyShouldDraw(s: {
  hidden: boolean;
  now: number;
  last: number;
  busyUntil: number;
}): boolean {
  if (s.hidden) return false;
  if (s.now < s.busyUntil) return true;
  return s.now - s.last >= 1000 / SKY_FPS - 2;
}

/** stepAnimations가 다루는 애니메이션 모양(브라우저의 CSSAnimation이 이 모양이다). */
export type SteppedAnimation = {
  readonly playState: string;
  // 브라우저 타입은 CSSNumberish(숫자 또는 CSS 수치)다. 문서 타임라인에서는 늘 ms 숫자다.
  currentTime: number | null | object;
  pause(): void;
  finish(): void;
  readonly effect: {
    getComputedTiming(): { endTime?: number | unknown };
  } | null;
};

/** 박자에 맞춰 옮기는 애니메이션마다: 타임라인 시각 − 애니메이션 시각(처음 본 순간 기준), 끝 시각. */
const tracked = new WeakMap<object, { origin: number; end: number }>();
/** 건드리지 않기로 한 것(앱이 멈춰 둔 것·끝난 것·박자에서 뺀 것). 다시 읽지 않는다. */
const skipped = new WeakSet<object>();

/**
 * CSS 애니메이션을 박자에 맞춰 바꾼다. 처음 본 돌던 애니메이션은 멈추고, 박자마다 시각만 옮긴다.
 * 그래서 Chrome이 매 프레임 스타일·그리기를 다시 하지 않고, 박자에만 한다.
 * 앱이 스스로 멈춰 둔 것·끝난 것, isFree가 참인 것(가끔 잠깐 도는 창밖 이벤트 등)은 건드리지 않는다.
 * 끝이 있는 것은 끝에 닿으면 끝낸다.
 * 읽기(상태·시각·끝 시각)는 처음 볼 때 한 번만, 쓰기보다 먼저 한다. 쓰고 나서 읽으면 그때마다 스타일 계산이 강제된다.
 * now는 document.timeline.currentTime(ms).
 */
export function stepAnimations(
  anims: Iterable<SteppedAnimation>,
  now: number,
  isFree: (a: SteppedAnimation) => boolean = () => false,
): void {
  const list = [...anims];
  const fresh: SteppedAnimation[] = [];
  for (const a of list) {
    if (tracked.has(a) || skipped.has(a)) continue;
    if (a.playState !== "running" || isFree(a)) {
      skipped.add(a);
      continue;
    }
    tracked.set(a, {
      origin: now - Number(a.currentTime ?? 0),
      end: Number(a.effect?.getComputedTiming().endTime),
    });
    fresh.push(a);
  }
  for (const a of fresh) a.pause();
  for (const a of list) {
    const tr = tracked.get(a);
    if (!tr) continue;
    const t = now - tr.origin;
    if (Number.isFinite(tr.end) && t >= tr.end) {
      tracked.delete(a);
      skipped.add(a);
      a.finish();
      continue;
    }
    a.currentTime = t;
  }
}
