import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsageLimitsResponse } from "@/protocol/limits";
import { GET } from "./route";

const BASE = "http://127.0.0.1:7787/hq-limits";
const AT = Date.UTC(2026, 10, 3, 10, 0);
/** 본부의 GET /v1/usage/limits 응답 모양 */
const HQ_BODY = {
  protocol: "starship/1",
  at: AT,
  limits: [{ id: "week", label: "주간", usedPct: 42, resetsAt: AT + 6e6 }],
};

const g = globalThis as Record<string, unknown>;

/** 본부 흉내: 다음 응답을 바꿀 수 있다 */
let hq: () => Response;
const read = async () => UsageLimitsResponse.parse(await (await GET()).json());

beforeEach(() => {
  delete g.__starshipLimits;
  delete g.__starshipLimitsGood;
  vi.useFakeTimers({ now: AT + 60_000, toFake: ["Date"] });
  vi.stubEnv("STARSHIP_SERVER_URL", BASE);
  vi.stubGlobal("fetch", async () => hq());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** 기억 시간(성공 1분·실패 15초)을 넘긴다 */
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe("GET /api/v1/usage/limits — 본부가 잠깐 실패할 때", () => {
  it("한 번 받은 뒤 본부가 502면 마지막 값을 stale로 준다(at은 그대로)", async () => {
    hq = () => Response.json(HQ_BODY);
    expect(await read()).toMatchObject({ ok: true, at: AT });
    later(61_000);
    hq = () => new Response("bad gateway", { status: 502 });
    const held = await read();
    expect(held).toMatchObject({
      ok: true,
      stale: true,
      at: AT,
      note: "본부 502",
    });
    expect(held.limits[0]?.usedPct).toBe(42);
  });

  it("다시 받으면 stale이 빠진다", async () => {
    hq = () => Response.json(HQ_BODY);
    await read();
    later(61_000);
    hq = () => {
      throw new DOMException("시간 초과", "TimeoutError");
    };
    expect((await read()).stale).toBe(true);
    later(16_000);
    hq = () => Response.json({ ...HQ_BODY, at: AT + 120_000 });
    const back = await read();
    expect(back.stale).toBeUndefined();
    expect(back.at).toBe(AT + 120_000);
  });

  it("받은 적이 없으면 ok:false", async () => {
    hq = () => new Response("bad gateway", { status: 502 });
    expect(await read()).toMatchObject({ ok: false, limits: [] });
  });

  it("본부가 끝점을 모르면(404) 기억한 값 없이 ok:false", async () => {
    hq = () => Response.json(HQ_BODY);
    await read();
    later(61_000);
    hq = () => new Response("not found", { status: 404 });
    expect(await read()).toMatchObject({ ok: false, limits: [] });
  });
});
