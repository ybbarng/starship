import { describe, expect, it } from "vitest";
import { SecureLog } from "@/protocol/secure";
import {
  ALERT_DENIED,
  ALERT_NO_REQUEST,
  activeRequests,
  groupCalls,
} from "@/secure/rows";
import { DEMO_FAKE_SECRET, demoSecureLog } from "./secure";

const NOW = Date.UTC(2026, 10, 10, 6, 0);
const log = SecureLog.parse(demoSecureLog(NOW));
const rows = groupCalls(log.calls);

describe("보안 구역 데모: 화면이 보여야 할 경우를 다 담는다", () => {
  it("형식 검사에 걸리는 항목이 없다", () => {
    expect(log.problems).toBeUndefined();
  });

  it("유효한 신청서 둘과 만료된 것 여럿, 카드 있는 것과 없는 것", () => {
    expect(activeRequests(log.requests, NOW)).toHaveLength(2);
    expect(
      log.requests.filter((r) => r.expiresAt <= NOW).length,
    ).toBeGreaterThanOrEqual(2);
    expect(log.requests.some((r) => r.card)).toBe(true);
    expect(log.requests.some((r) => !r.card)).toBe(true);
  });

  it("AI 호출의 hook·wrapper 짝이 한 줄로 묶이고 신청서에 이어진다", () => {
    const pairs = rows.filter((r) => r.vias.length === 2);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    expect(pairs.every((r) => r.requestId)).toBe(true);
  });

  it("막힌 호출과 신청서 없는 wrapper 호출이 빨갛다", () => {
    expect(rows.some((r) => r.alerts.includes(ALERT_DENIED))).toBe(true);
    expect(rows.some((r) => r.alerts.includes(ALERT_NO_REQUEST))).toBe(true);
  });

  it("사람의 직접 실행은 맥락(tty·터미널·폴더·부모 명령)을 갖는다", () => {
    const human = log.calls.filter((c) => c.actor === "human");
    expect(human.length).toBeGreaterThanOrEqual(2);
    expect(human.some((c) => c.context?.gitRoot && c.context.parentCmd)).toBe(
      true,
    );
  });

  it("비서가 가린 인자와 값처럼 보이는 인자가 하나씩 있다", () => {
    const args = log.calls.flatMap((c) => c.command.args);
    expect(args).toContain("<가림>");
    expect(args.some((a) => a.includes(DEMO_FAKE_SECRET))).toBe(true);
  });
});
