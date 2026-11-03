// 본부(비서 서버) 연결 경고등의 계산. 화면 전체 시계(useNow)는 30초 주기라 이 등에 쓰면
// "마지막으로 받은 때"가 0초 전에 머물고 끊김도 30초 늦게 켜져서, 등만 따로 짧은 주기 시계를 쓴다.

/** 본부를 다시 띄우는 몇 초 동안 깜빡이지 않게, 이만큼 넘게 못 받았을 때만 끊김으로 본다 */
export const HQ_GRACE_MS = 15_000;

/** 연결 등이 쓰는 시계 주기 */
export const HQ_CLOCK_MS = 2_000;

/** 오류가 없거나, 오류가 났어도 마지막으로 받은 지 HQ_GRACE_MS가 안 됐으면 연결된 것으로 본다 */
export function hqConnected(error: boolean, lastAt: number, now: number) {
  return !error || (lastAt > 0 && now - lastAt < HQ_GRACE_MS);
}

/** 3초 전 · 2분 전. 시계가 받은 때보다 조금 늦게 돌아 음수가 나와도 0초로 */
export function agoShort(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 60 ? `${s}초 전` : `${Math.round(s / 60)}분 전`;
}

export type InboxEmpty = "loading" | "unreachable" | "calm";

/**
 * 결재함이 비었을 때 무엇이라 적을지. 아직 한 번도 받지 못했으면 "순항 중"이라 하지 않는다
 * (불러오는 중·본부가 꺼져 있을 때도 순항 중으로 보였다, 2026-11-03).
 * 한 번이라도 받았으면 그 자료로 판단한다(끊김은 연결 등이 알린다).
 */
export function inboxEmpty(ready: boolean, error: boolean): InboxEmpty {
  if (ready) return "calm";
  return error ? "unreachable" : "loading";
}
