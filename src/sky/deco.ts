// 장식용 움직임의 시계: 저절로 도는 하늘(drift), 행성 자전, 구름 흐름, 별 반짝임, 태양 표면.
// 앱 창에 초점이 없으면 1초쯤에 걸쳐 멈추고, 돌아오면 그 자리에서 다시 움직인다.
// 멈춘 하늘은 끊겨 보일 일이 없어서 아주 드물게(1초에 1번) 그려도 된다(src/ui/kit/pace.ts, 설계: docs/pace.md).
// 진짜 시간을 따르는 것(행성 궤도 위치, 지구 자전 각도)은 이 시계를 쓰지 않는다.

/** 멈추고 다시 움직이는 빠르기(1초에 남은 몫의 이만큼) */
const EASE_PER_S = 3;

export const deco = {
  /** 장식 시계(초). 멈춘 동안은 흐르지 않는다 */
  time: 0,
  /** 이번 프레임 장식 시계가 흐른 만큼(초) */
  dt: 0,
  /** 지금 빠르기 0..1 */
  k: 1,
};

/**
 * 장식 시계를 한 프레임 진행한다. moving이면 빠르기를 1로, 아니면 0으로 부드럽게 옮긴다.
 * 돌려주는 값: 빠르기가 아직 바뀌는 중인가(그동안은 매 프레임 그려야 매끄럽다).
 */
export function stepDeco(
  state: typeof deco,
  dt: number,
  moving: boolean,
): boolean {
  const target = moving ? 1 : 0;
  // 오래 쉬었다 그린 첫 프레임(dt가 큼)에 한 번에 건너뛰지 않게 dt를 묶는다
  const step = Math.min(dt, 0.1);
  state.k += (target - state.k) * Math.min(1, step * EASE_PER_S);
  const settling = Math.abs(target - state.k) > 0.01;
  if (!settling) state.k = target;
  state.dt = dt * state.k;
  state.time += state.dt;
  return settling;
}
