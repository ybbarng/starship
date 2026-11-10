import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecureAckResponse, SecureResponse } from "@/protocol/secure";
import { resetDemoAcks } from "@/server/secure";
import { GET } from "../route";
import { POST } from "./route";

const HOST = "127.0.0.1:7790";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://${HOST}/api/v1/secure/ack`, {
    method: "POST",
    headers: {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** 데모 기록의 빨간 호출(hook이 막은 것) */
const DENIED = "call-forge-h1";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/v1/secure/ack — 요청 검사", () => {
  beforeEach(() => vi.stubEnv("STARSHIP_SERVER_URL", ""));

  it("다른 출처는 403", async () => {
    const res = await POST(
      post({ ids: [DENIED] }, { origin: "https://example.com" }),
    );
    expect(res.status).toBe(403);
  });

  it("본문이 64KB를 넘으면 413", async () => {
    const res = await POST(post("{}", { "content-length": "70000" }));
    expect(res.status).toBe(413);
  });

  it("본문 형식이 틀리면 400", async () => {
    for (const body of ["이건 JSON 아님", { ids: [] }, { ids: [""] }, {}]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
    }
  });
});

describe("POST /api/v1/secure/ack — 데모 모드", () => {
  beforeEach(() => {
    vi.stubEnv("STARSHIP_SERVER_URL", "");
    resetDemoAcks();
    vi.stubGlobal("fetch", async () => {
      throw new Error("데모 모드에서 비서에 묻지 않아야 해요");
    });
  });

  it("표시하면 다음 GET에 ack가 보이고, 되돌리면 사라진다", async () => {
    const res = await POST(post({ ids: [DENIED] }));
    expect(res.status).toBe(200);
    expect(SecureAckResponse.parse(await res.json())).toMatchObject({
      source: "demo",
      acked: [DENIED],
    });
    const ackOf = async () =>
      SecureResponse.parse(await (await GET()).json()).log.calls.find(
        (c) => c.id === DENIED,
      )?.ack;
    expect((await ackOf())?.by).toBe("starship");

    const undo = await POST(post({ ids: [DENIED], undo: true }));
    expect(SecureAckResponse.parse(await undo.json()).undone).toEqual([DENIED]);
    expect(await ackOf()).toBeUndefined();
  });
});

describe("POST /api/v1/secure/ack — 서버 연결 모드", () => {
  type Seen = { url: string; init?: RequestInit };
  let seen: Seen[];
  let hq: (s: Seen) => Response;
  let n = 0;
  let base: string;

  beforeEach(() => {
    seen = [];
    resetDemoAcks();
    // 1.5초 함께 쓰기(createShared)가 앞 시험 결과를 돌려주지 않게 주소를 바꾼다
    n += 1;
    base = `http://127.0.1.${n}:7787`;
    vi.stubEnv("STARSHIP_SERVER_URL", `${base}/starship`);
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const s = { url, init };
      seen.push(s);
      return hq(s);
    });
  });

  it("비서 /api/secure/ack에 Origin·content-type 헤더와 함께 보낸다", async () => {
    hq = () => Response.json({ acked: ["c1", "c2"], unknown: [] });
    const res = await POST(post({ ids: ["c1", "c2"] }));
    expect(res.status).toBe(200);
    expect(SecureAckResponse.parse(await res.json())).toEqual({
      source: "remote",
      acked: ["c1", "c2"],
      undone: [],
      unknown: [],
    });
    expect(seen).toHaveLength(1);
    const [s] = seen;
    expect(s?.url).toBe(`${base}/api/secure/ack`);
    expect(s?.init?.method).toBe("POST");
    const headers = new Headers(s?.init?.headers);
    expect(headers.get("origin")).toBe(base);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(s?.init?.body))).toEqual({
      ids: ["c1", "c2"],
      by: "starship",
    });
  });

  it("undo는 본문에 undo: true를 싣는다", async () => {
    hq = () => Response.json({ undone: ["c1"], unknown: [] });
    const res = await POST(post({ ids: ["c1"], undo: true }));
    expect(SecureAckResponse.parse(await res.json()).undone).toEqual(["c1"]);
    expect(JSON.parse(String(seen[0]?.init?.body))).toEqual({
      ids: ["c1"],
      undo: true,
      by: "starship",
    });
  });

  it("데모 기록 id를 보내도 데모 상태를 건드리지 않고 비서에 보낸다", async () => {
    hq = () => Response.json({ acked: [], unknown: [DENIED] });
    const res = await POST(post({ ids: [DENIED] }));
    expect(SecureAckResponse.parse(await res.json())).toMatchObject({
      source: "remote",
      unknown: [DENIED],
    });
    vi.stubEnv("STARSHIP_SERVER_URL", "");
    const demo = SecureResponse.parse(await (await GET()).json());
    expect(demo.log.calls.find((c) => c.id === DENIED)?.ack).toBeUndefined();
  });

  it("비서가 끝점을 모르면(404) 502와 이유", async () => {
    hq = () => new Response("not found", { status: 404 });
    const res = await POST(post({ ids: ["c1"] }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(
      "비서가 아직 확인 표시를 받지 못해요",
    );
  });

  it("비서가 실패하거나 시간을 넘기면 502와 이유", async () => {
    hq = () => new Response("forbidden", { status: 403 });
    let res = await POST(post({ ids: ["c1"] }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("비서 서버가 403로 답했어요");

    hq = () => {
      throw new DOMException("시간 초과", "TimeoutError");
    };
    res = await POST(post({ ids: ["c1"] }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/10초 안에 답하지 않았어요/);
  });

  it("표시한 뒤 GET은 함께 쓰던 결과를 버리고 비서에 다시 묻는다", async () => {
    hq = (s) =>
      s.url.endsWith("/ack")
        ? Response.json({ acked: ["c1"] })
        : Response.json({ requests: [], calls: [] });
    await GET();
    await GET();
    expect(seen.filter((s) => s.url.includes("/api/secure?"))).toHaveLength(1);
    await POST(post({ ids: ["c1"] }));
    await GET();
    expect(seen.filter((s) => s.url.includes("/api/secure?"))).toHaveLength(2);
  });
});
