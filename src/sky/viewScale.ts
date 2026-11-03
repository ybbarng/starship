// 목적지에 도착했을 때 카메라가 멈추는 거리. 예전에는 반지름에 비례해 떨어져서 어느 천체나 화면에서
// 같은 크기였다(목성 = 지구, 베텔게우스 < 태양). 이제 화면 크기를 기준 천체(행성은 지구, 별은 태양)에
// 견준 실제 반지름의 제곱근만큼 키우고, 원 전체가 화면 안에 들어오도록 상한을 둔다(2026-11-03 사용자 결정).
// 상한 가까이에서는 부드럽게 눌러, 상한을 넘는 큰 별끼리도 크기 순서가 남게 한다.

/** 기준보다 작은 천체를 줄이는 하한(달·명왕성이 점처럼 작아지지 않게) */
export const MIN_SCALE = 0.6;
/** 원의 반지름이 화면 짧은 쪽 반(시야 반각)의 이만큼까지(가장자리 계기·빛무리 몫을 남긴다) */
export const FIT_FILL = 0.8;
/** 상한의 이 비율까지는 제곱근 그대로, 그 위는 부드럽게 눌러 상한에 다가간다 */
const KNEE = 0.6;

export type ViewFrame = {
  /** 세로 시야각(도) */
  fov: number;
  /** 가로 ÷ 세로 */
  aspect: number;
};

/** 화면 짧은 쪽의 시야 반각(라디안) */
export function halfFovMin({ fov, aspect }: ViewFrame): number {
  const halfV = (fov * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 1e-6));
  return Math.min(halfV, halfH);
}

/** 크기 배율 s를 상한 max 아래로 부드럽게 누른다. 무릎 아래는 그대로, 위는 지수로 다가간다. */
export function softCap(s: number, max: number): number {
  if (max <= 0) return 0;
  const knee = max * KNEE;
  if (s <= knee) return s;
  const room = max - knee;
  return knee + room * (1 - Math.exp(-(s - knee) / room));
}

/**
 * 보는 거리.
 * - reach: 화면에 담을 반지름(고리가 있으면 고리 바깥 반지름)
 * - baseDist: 예전 규칙의 거리(반지름 × 배수). 기준 천체와 크기가 같으면 이 거리
 * - ratio: 기준 천체에 견준 실제 반지름(지구 = 1 또는 태양 = 1)
 */
export function viewDistance(
  reach: number,
  baseDist: number,
  ratio: number,
  frame: ViewFrame,
): number {
  const base = reach / baseDist;
  const want = Math.max(MIN_SCALE, Math.sqrt(Math.max(ratio, 0)));
  const max = Math.sin(FIT_FILL * halfFovMin(frame)) / base;
  // 상한은 화면 모양에서 나온다. 화면이 아주 좁아 예전 크기부터 넘치면 원이 들어올 만큼 물러난다.
  return baseDist / softCap(want, max);
}
