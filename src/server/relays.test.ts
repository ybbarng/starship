import { describe, expect, it } from "vitest";
import { demoRelayLog } from "@/demo/relays";
import { RelayLog } from "@/protocol/relay";
import { foldRelays } from "@/relay/fold";
import { relaysUrl } from "./relays";

const NOW = Date.parse("2026-11-12T12:00:00+09:00");

describe("relaysUrl: 비서 서버 뿌리의 /api/relays", () => {
  it("STARSHIP_SERVER_URL의 경로는 버리고 origin에 붙인다", () => {
    expect(relaysUrl("http://127.0.0.1:7787/starship")).toBe(
      "http://127.0.0.1:7787/api/relays?limit=200",
    );
  });
});

describe("데모 나르기 기록", () => {
  const log = RelayLog.parse(demoRelayLog(NOW));
  const board = foldRelays(log.relays, NOW);

  it("모든 줄이 형식 검사를 통과한다", () => {
    expect(log.problems).toBeUndefined();
  });

  it("나르기 판의 모습이 모두 보인다", () => {
    const states = new Set(board.active.map((r) => r.state));
    expect(states).toEqual(new Set(["open", "moving", "returned"]));
    expect(board.active.some((r) => r.stalled)).toBe(true);
    expect(board.done.map((r) => r.state).sort()).toEqual([
      "cancelled",
      "closed",
    ]);
    expect(board.unlinked.length).toBeGreaterThan(0);
  });

  it("7일 지난 끝은 판에 없다", () => {
    const ids = [...board.active, ...board.done].map((r) => r.id);
    expect(ids).not.toContain("R-demo-g7");
  });
});
