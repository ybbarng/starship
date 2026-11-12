// 본부 승무원: 비서 세션. 이 승무원의 선실만 본부 방(할 일 · 나르기 · 시설 · 지도)으로 넓힌다. 설계: docs/hq.md.

/** 본부 승무원 id 기본값 */
export const HQ_CREW_DEFAULT = "secretary";

/**
 * 본부 승무원 id. 서버 환경 변수 STARSHIP_HQ_CREW로 바꿀 수 있고, 비었으면 기본값을 쓴다.
 * 선실 페이지(서버 컴포넌트)가 읽어 화면에 넘긴다.
 */
export function hqCrewId(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.STARSHIP_HQ_CREW?.trim() || HQ_CREW_DEFAULT;
}
