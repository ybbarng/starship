import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const HOST = "127.0.0.1:7790";
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request(`http://${HOST}/api/v1/actions`, {
    method: "POST",
    headers: {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      ...headers,
    },
    body,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/v1/actions", () => {
  it("본부에 닿지 못하면(시간 초과) 한 줄로 알린다", async () => {
    vi.stubEnv("STARSHIP_SERVER_URL", "http://127.0.0.1:7787/hq-route");
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("시간 초과", "TimeoutError");
    });
    const res = await POST(
      post(JSON.stringify({ target: "task", id: "t1", action: "dismiss" })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: false,
      note: "본부에 닿지 못했어요",
    });
  });

  it("본문이 64KB를 넘으면 413", async () => {
    const res = await POST(post("{}", { "content-length": "70000" }));
    expect(res.status).toBe(413);
  });

  it("다른 출처는 403", async () => {
    const res = await POST(post("{}", { origin: "https://example.com" }));
    expect(res.status).toBe(403);
  });
});
