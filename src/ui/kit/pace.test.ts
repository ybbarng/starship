import { beforeEach, describe, expect, it } from "vitest";
import {
  BLUR_FPS,
  IDLE_FPS,
  markBusy,
  nextWait,
  onPaceTick,
  pace,
  runPaceListeners,
  type SteppedAnimation,
  stepAnimations,
} from "./pace";

describe("nextWait: 다음 박자까지 기다리는 법", () => {
  const base = { hidden: false, focused: true, now: 1000, busyUntil: 1000 };
  it("창이 안 보이면 멈춘다(바쁜 중이어도)", () => {
    expect(nextWait({ ...base, hidden: true, busyUntil: 5000 })).toBe("stop");
  });
  it("움직이는 동안은 화면 새로 고침마다(초점이 없어도)", () => {
    expect(nextWait({ ...base, busyUntil: 1001 })).toBe("frame");
    expect(nextWait({ ...base, focused: false, busyUntil: 1001 })).toBe(
      "frame",
    );
  });
  it("가만히 있으면 초점이 있을 때 IDLE_FPS, 없을 때 BLUR_FPS에 맞춰 기다린다", () => {
    expect(nextWait(base)).toBe(1000 / IDLE_FPS);
    expect(nextWait({ ...base, focused: false })).toBe(1000 / BLUR_FPS);
  });
});

describe("markBusy: 매 프레임 바꾸는 구간 늘리기", () => {
  beforeEach(() => {
    pace.busyUntil = 0;
    pace.wake = null;
  });

  it("쉬는 중이었으면 박자기를 깨운다", () => {
    let woke = 0;
    pace.wake = () => woke++;
    markBusy(300, 1000);
    expect(pace.busyUntil).toBe(1300);
    expect(woke).toBe(1);
  });

  it("이미 바쁜 중이면 끝만 늘리고 다시 깨우지 않는다", () => {
    let woke = 0;
    pace.wake = () => woke++;
    markBusy(300, 1000);
    markBusy(300, 1100);
    expect(pace.busyUntil).toBe(1400);
    expect(woke).toBe(1);
  });

  it("더 짧은 구간은 끝을 앞당기지 않는다", () => {
    markBusy(1500, 1000);
    markBusy(100, 1100);
    expect(pace.busyUntil).toBe(2500);
  });
});

describe("onPaceTick: 박자마다 부를 함수", () => {
  it("건 함수는 박자마다 불리고, 떼면 더 불리지 않는다", () => {
    let n = 0;
    const off = onPaceTick(() => n++);
    runPaceListeners();
    off();
    runPaceListeners();
    expect(n).toBe(1);
  });
});

/** 브라우저 CSSAnimation처럼 움직이는 가짜. endTime이 Infinity면 끝없이 도는 것. */
function fakeAnim(
  playState: string,
  currentTime: number,
  endTime = Number.POSITIVE_INFINITY,
) {
  const a = {
    playState,
    currentTime: currentTime as number | null,
    paused: 0,
    finished: 0,
    pause() {
      a.paused++;
      a.playState = "paused";
    },
    finish() {
      a.finished++;
      a.playState = "finished";
      a.currentTime = endTime;
    },
    effect: { getComputedTiming: () => ({ endTime }) },
  };
  return a satisfies SteppedAnimation;
}

describe("stepAnimations: CSS 애니메이션을 박자에 맞추기", () => {
  it("처음 본 돌던 애니메이션은 멈추고, 박자마다 흐른 시간만큼 시각을 옮긴다", () => {
    const a = fakeAnim("running", 200);
    stepAnimations([a], 10_000);
    expect(a.paused).toBe(1);
    expect(a.currentTime).toBe(200);
    stepAnimations([a], 10_066);
    expect(a.currentTime).toBe(266);
    expect(a.paused).toBe(1);
  });

  it("앱이 멈춰 둔 것·끝난 것은 건드리지 않는다", () => {
    const paused = fakeAnim("paused", 50);
    const done = fakeAnim("finished", 300, 300);
    stepAnimations([paused, done], 10_000);
    stepAnimations([paused, done], 10_500);
    expect(paused.currentTime).toBe(50);
    expect(paused.paused).toBe(0);
    expect(done.currentTime).toBe(300);
  });

  it("박자에서 뺀 것(창밖 이벤트 등)은 멈추지도 옮기지도 않는다", () => {
    const squid = fakeAnim("running", 120);
    const lamp = fakeAnim("running", 120);
    const isFree = (a: SteppedAnimation) => a === squid;
    stepAnimations([squid, lamp], 5000, isFree);
    stepAnimations([squid, lamp], 5100, isFree);
    expect(squid.paused).toBe(0);
    expect(squid.playState).toBe("running");
    expect(squid.currentTime).toBe(120);
    expect(lamp.paused).toBe(1);
    expect(lamp.currentTime).toBe(220);
  });

  it("끝이 있는 애니메이션은 끝에 닿으면 끝내고 그 뒤로는 건드리지 않는다", () => {
    const enter = fakeAnim("running", 0, 400);
    stepAnimations([enter], 1000);
    stepAnimations([enter], 1300);
    expect(enter.currentTime).toBe(300);
    stepAnimations([enter], 1400);
    expect(enter.finished).toBe(1);
    stepAnimations([enter], 2000);
    expect(enter.finished).toBe(1);
    expect(enter.currentTime).toBe(400);
  });
});
