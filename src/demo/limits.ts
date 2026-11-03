// 데모 모드의 계정 사용 한도. 지어낸 값이다: 주간 50%(다음 날 02:00 리셋), 5시간 30%.
import type { UsageLimits } from "@/protocol/limits";

/** now 다음에 오는 02:00(이 서버 시간대). 이미 지났으면 다음 날 */
export function nextTwoAm(now: number): number {
  const d = new Date(now);
  d.setHours(2, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function demoLimits(now: number): UsageLimits {
  // 5시간 한도는 지금부터 2시간 10분 뒤 정각 10분 단위로 리셋
  const fiveHour = Math.ceil((now + 130 * 60_000) / 600_000) * 600_000;
  return {
    protocol: "starship/1",
    at: now - 2 * 60_000,
    limits: [
      { id: "week", label: "주간", usedPct: 50, resetsAt: nextTwoAm(now) },
      { id: "five-hour", label: "5시간", usedPct: 30, resetsAt: fiveHour },
    ],
  };
}
