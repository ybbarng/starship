// 데모 토큰 사용량: 데모 승무원들이 지난 31일 동안 쓴 것처럼 지어낸 요청들.
// 같은 날·같은 승무원이면 늘 같은 숫자가 나오게 시각에서 씨앗을 만든다.
import type { AreaRule, ProjectPaths, UsageRecord } from "@/usage/model";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** [승무원, 영역, 하루 요청 수 대략, 주력 모델] */
const CREWS: [string, "work" | "personal", number, string][] = [
  ["web-shop", "work", 60, "claude-opus-5-5"],
  ["pixel-forge", "work", 25, "claude-opus-5-5"],
  ["admin-console", "work", 18, "claude-sonnet-5-5"],
  ["billing-api", "work", 8, "claude-opus-5-5"],
  ["orbit-notes", "personal", 40, "claude-opus-5-5"],
  ["star-atlas", "personal", 30, "claude-opus-5-5"],
  ["garden-bot", "personal", 12, "claude-haiku-5-5"],
  ["lunar-blog", "personal", 6, "claude-opus-5-5"],
];

const project = (id: string) => `-demo-${id}`;

export const DEMO_USAGE_PATHS: ProjectPaths = Object.fromEntries(
  CREWS.map(([id, area]) => [project(id), `/demo/${area}/${id}`]),
);

export const DEMO_USAGE_RULES: AreaRule[] = [
  { prefix: "/demo/work", area: "work" },
  { prefix: "/demo/personal", area: "personal" },
];

/** 0..1 사이의 정해진 수 */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function buildDemoUsage(now = Date.now()): UsageRecord[] {
  const out: UsageRecord[] = [];
  const today = Math.floor(now / DAY);
  for (let d = 0; d <= 31; d++) {
    const dayIndex = today - d;
    CREWS.forEach(([id, , perDay, model], ci) => {
      const seed = dayIndex * 31 + ci;
      // 주말엔 업무가 거의 없고, 날마다 들쭉날쭉하다.
      const weekday = new Date(dayIndex * DAY).getUTCDay();
      const quiet = weekday === 0 || weekday === 6 ? 0.25 : 1;
      const n = Math.round(perDay * quiet * (0.3 + 1.4 * rand(seed)));
      const sessions = 1 + Math.floor(rand(seed + 7) * 3);
      for (let i = 0; i < n; i++) {
        const t = dayIndex * DAY + Math.floor(rand(seed * 97 + i) * DAY);
        if (t > now) continue;
        const r = rand(seed * 53 + i);
        const sub = r < 0.1;
        out.push({
          id: `demo-${id}-${dayIndex}-${i}`,
          t,
          project: project(id),
          session: `${id}-${dayIndex}-${Math.floor(r * sessions)}`,
          model: sub ? "claude-sonnet-5-5" : model,
          input: Math.round(5 + r * 40),
          cacheWrite5m: Math.round(2_000 + r * 30_000),
          cacheWrite1h: i % 9 === 0 ? 40_000 : 0,
          cacheRead: Math.round(60_000 + r * 240_000),
          output: Math.round(150 + r * r * 4_000),
        });
      }
    });
  }
  return out;
}
