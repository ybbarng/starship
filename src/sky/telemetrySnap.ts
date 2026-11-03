// 계기판 글이 telemetry를 옮겨 올 때의 규칙(순수 함수). 훅은 useTelemetry.ts, 박자는 src/ui/kit/pace.ts.
// 값이 그대로면 새 객체를 만들지 않아(다시 그리지 않아) 조종석이 1초에 수십 번 헛그리지 않게 한다.
import type { Telemetry } from "./telemetry";

/** 이번 박자에 옮겨 올 때인가: 시각을 periodMs 칸으로 나눠 칸이 바뀌었으면. 같은 주기의 계기는 같은 박자에 함께 바뀐다 */
export function periodDue(
  last: number,
  now: number,
  periodMs: number,
): boolean {
  return Math.floor(now / periodMs) !== Math.floor(last / periodMs);
}

/** 옮겨 오는 주기(ms). 이동 중이 아니면 idleHz(더 드물게) */
export function samplePeriod(
  traveling: boolean,
  hz: number,
  idleHz: number,
): number {
  return 1000 / (traveling ? hz : Math.min(hz, idleHz));
}

/** 얕은 비교: 같은 키에 같은 값(Object.is)이면 같다 */
export function shallowSame<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}

type Coords = Telemetry["view"];

function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.ra === b.ra && a.dec === b.dec && a.lon === b.lon && a.lat === b.lat;
}

/** telemetry 전체 비교(자리·보는 방향·마우스 하늘까지) */
export function sameTelemetry(a: Telemetry, b: Telemetry): boolean {
  return (
    a.earthKm === b.earthKm &&
    a.altitudeKm === b.altitudeKm &&
    a.targetKm === b.targetKm &&
    a.speedKmS === b.speedKmS &&
    a.remainingKm === b.remainingKm &&
    a.traveling === b.traveling &&
    a.progress === b.progress &&
    a.position.every((v, i) => v === b.position[i]) &&
    sameCoords(a.view, b.view) &&
    sameCoords(a.cursor, b.cursor)
  );
}

/** telemetry 복사(모듈 값은 매 프레임 고쳐지니 화면에는 사본을 준다) */
export function copyTelemetry(t: Telemetry): Telemetry {
  return {
    ...t,
    position: [...t.position] as Telemetry["position"],
    view: { ...t.view },
    cursor: t.cursor ? { ...t.cursor } : null,
  };
}
