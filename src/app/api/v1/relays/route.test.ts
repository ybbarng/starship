import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelayResponse } from "@/protocol/relay";
import { GET } from "./route";

/** 비서 서버가 보내는 모양 그대로(시각은 ISO 글, 순서는 보장하지 않음) */
const HQ_BODY = {
  relays: [
    {
      relay: "starship-relay/1",
      id: "R-20261112-0930-a1",
      at: "2026-11-12T09:40:00+09:00",
      kind: "forward",
      to: "doc-review",
    },
    {
      relay: "starship-relay/1",
      id: "R-20261112-0930-a1",
      at: "2026-11-12T09:30:00+09:00",
      kind: "open",
      from: "web-shop",
      title: "결제 문서 검토",
    },
    {
      relay: "starship-relay/1",
      at: "2026-11-12T10:00:00+09:00",
      kind: "forward",
      to: "garden-bot",
    },
    { relay: "starship-relay/1", at: "어제", kind: "open", id: "R-bad" },
  ],
};

let hq: (url: string) => Response;
const seen: string[] = [];
let n = 0;

async function read() {
  const res = await GET();
  return { status: res.status, text: await res.text() };
}

beforeEach(() => {
  seen.length = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    seen.push(url);
    return hq(url);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/v1/relays — 데모 모드", () => {
  beforeEach(() => vi.stubEnv("STARSHIP_SERVER_URL", ""));

  it("지어낸 기록을 주고 비서에 묻지 않는다", async () => {
    const { status, text } = await read();
    expect(status).toBe(200);
    const body = RelayResponse.parse(JSON.parse(text));
    expect(body).toMatchObject({ source: "demo", status: "ok" });
    expect(body.log.relays.length).toBeGreaterThan(5);
    expect(seen).toEqual([]);
  });
});

describe("GET /api/v1/relays — 서버 연결 모드", () => {
  // 모드마다 1.5초 함께 쓰기(createShared)가 앞 시험 결과를 돌려주지 않게 주소를 바꾼다
  beforeEach(() => {
    n += 1;
    vi.stubEnv("STARSHIP_SERVER_URL", `http://127.0.1.${n}:7787/starship`);
  });

  it("비서의 기록만 주고 데모 기록을 섞지 않는다. 틀린 줄은 problems로", async () => {
    hq = () => Response.json(HQ_BODY);
    const { status, text } = await read();
    expect(status).toBe(200);
    const body = RelayResponse.parse(JSON.parse(text));
    expect(body).toMatchObject({ source: "remote", status: "ok" });
    expect(body.log.relays).toHaveLength(3);
    expect(body.log.relays.some((l) => l.id?.startsWith("R-demo"))).toBe(false);
    expect(body.log.problems).toHaveLength(1);
    expect(body.log.problems?.[0]).toMatch(/^relays\[3\] \(id R-bad\)/);
    expect(seen).toEqual([`http://127.0.1.${n}:7787/api/relays?limit=200`]);
  });

  it("비서가 끝점을 모르면(404) 빈 기록과 status none", async () => {
    hq = () => new Response("not found", { status: 404 });
    const body = RelayResponse.parse(JSON.parse((await read()).text));
    expect(body).toMatchObject({ source: "remote", status: "none" });
    expect(body.log).toEqual({ relays: [] });
  });

  it("비서가 실패하면 502와 이유", async () => {
    hq = () => new Response("boom", { status: 500 });
    const { status, text } = await read();
    expect(status).toBe(502);
    expect(JSON.parse(text).error).toBe("비서 서버가 500로 답했어요");
  });

  it("시간을 넘기면 502와 시간 초과 이유", async () => {
    hq = () => {
      throw new DOMException("시간 초과", "TimeoutError");
    };
    const { status, text } = await read();
    expect(status).toBe(502);
    expect(JSON.parse(text).error).toMatch(/4초 안에 답하지 않았어요/);
  });

  it("겉 모양이 틀리면 502", async () => {
    hq = () => Response.json({ relays: "없음" });
    expect((await read()).status).toBe(502);
  });
});
