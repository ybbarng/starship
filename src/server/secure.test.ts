import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACK_NOT_READY, ackSecure, getSecure, resetDemoAcks } from "./secure";

const MIN = 60_000;
const NOW = Date.parse("2026-11-10T15:00:00+09:00");
// 데모 기록의 빨간 호출: hook이 막은 것, 신청서 없이 나간 wrapper
const DENIED = "call-forge-h1";
const NO_REQUEST = "call-garden-w1";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ackSecure — 데모 모드(서버 메모리)", () => {
  beforeEach(() => {
    vi.stubEnv("STARSHIP_SERVER_URL", "");
    resetDemoAcks();
  });

  it("표시하면 데모 기록의 그 호출에 ack가 붙고 나머지는 그대로", async () => {
    const res = await ackSecure([DENIED], false, NOW);
    expect(res).toEqual({
      source: "demo",
      acked: [DENIED],
      undone: [],
      unknown: [],
    });
    const { log } = await getSecure(NOW + MIN);
    const byId = new Map(log.calls.map((c) => [c.id, c]));
    expect(byId.get(DENIED)?.ack).toEqual({ at: NOW, by: "starship" });
    expect(byId.get(NO_REQUEST)?.ack).toBeUndefined();
  });

  it("같은 id를 다시 표시하면 처음 시각이 남는다", async () => {
    await ackSecure([DENIED], false, NOW);
    await ackSecure([DENIED], false, NOW + 5 * MIN);
    const { log } = await getSecure(NOW + 6 * MIN);
    expect(log.calls.find((c) => c.id === DENIED)?.ack?.at).toBe(NOW);
  });

  it("undo면 거두고, 모르는 id는 unknown으로 돌려준다", async () => {
    await ackSecure([DENIED, NO_REQUEST], false, NOW);
    const res = await ackSecure([DENIED, "call-nowhere"], true, NOW);
    expect(res).toMatchObject({
      acked: [],
      undone: [DENIED],
      unknown: ["call-nowhere"],
    });
    const { log } = await getSecure(NOW);
    const byId = new Map(log.calls.map((c) => [c.id, c]));
    expect(byId.get(DENIED)?.ack).toBeUndefined();
    expect(byId.get(NO_REQUEST)?.ack).toBeDefined();
  });
});

describe("ackSecure — 서버 연결 모드", () => {
  it("404면 비서가 아직 확인 표시를 받지 못한다는 오류", async () => {
    vi.stubEnv("STARSHIP_SERVER_URL", "http://127.0.0.9:7787/starship");
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    await expect(ackSecure(["c1"])).rejects.toThrow(ACK_NOT_READY);
  });

  it("답 형식이 다르면 오류", async () => {
    vi.stubEnv("STARSHIP_SERVER_URL", "http://127.0.0.9:7787/starship");
    vi.stubGlobal("fetch", async () => Response.json({ acked: "c1" }));
    await expect(ackSecure(["c1"])).rejects.toThrow(/형식이 달라요/);
  });
});
