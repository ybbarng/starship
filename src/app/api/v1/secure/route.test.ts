import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_FAKE_SECRET } from "@/demo/secure";
import { SecureResponse } from "@/protocol/secure";
import { HIDDEN_ARG } from "@/secure/secret";
import { secureUrl } from "@/server/secure";
import { GET } from "./route";

// 시험용 가짜 값. 비밀 검사(gitleaks)가 글자 그대로의 가짜 토큰도 잡아서 조각을 이어 만든다
const TOKEN = ["q7Rk2LmZ", "x9VbT4nW", "c8YpJ3sD"].join("");

/** 비서 서버가 보내는 모양 그대로(시각은 ISO 글, 최근순) */
const HQ_BODY = {
  requests: [
    {
      id: "req-1",
      at: "2026-11-10T10:00:00+09:00",
      expiresAt: "2026-11-10T10:30:00+09:00",
      actor: "ai",
      session: { key: "k1", name: "web-shop", cwd: "~/w", tmuxPane: "%1" },
      purpose: "결제 시험 서버에 쓸 API 키를 넣는다",
      plan: ["키를 읽는다"],
      items: [{ ref: "op://Shop/payment.api/API_SECRET", action: "read" }],
    },
  ],
  calls: [
    {
      id: "call-1",
      at: "2026-11-10T10:01:00+09:00",
      actor: "human",
      via: "wrapper",
      context: { tty: "/dev/ttys004", termProgram: "iTerm.app" },
      command: { sub: "item", args: ["edit", "x", `password=${TOKEN}`] },
      requestId: null,
    },
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

describe("secureUrl: 비서 서버 뿌리의 /api/secure", () => {
  it("STARSHIP_SERVER_URL의 경로는 버리고 origin에 붙인다", () => {
    expect(secureUrl("http://127.0.0.1:7787/starship")).toBe(
      "http://127.0.0.1:7787/api/secure?limit=200",
    );
  });
});

describe("GET /api/v1/secure — 데모 모드", () => {
  beforeEach(() => vi.stubEnv("STARSHIP_SERVER_URL", ""));

  it("지어낸 기록을 주고 비서에 묻지 않는다", async () => {
    const { status, text } = await read();
    expect(status).toBe(200);
    const body = SecureResponse.parse(JSON.parse(text));
    expect(body.source).toBe("demo");
    expect(body.log.requests.length).toBeGreaterThan(2);
    expect(seen).toEqual([]);
  });

  it("값처럼 보이는 글자는 응답에 남지 않는다", async () => {
    const { text } = await read();
    expect(text).not.toContain(DEMO_FAKE_SECRET);
    expect(text).toContain(HIDDEN_ARG);
    expect(SecureResponse.parse(JSON.parse(text)).hidden).toBe(1);
  });
});

describe("GET /api/v1/secure — 서버 연결 모드", () => {
  // 모드마다 1.5초 함께 쓰기(createShared)가 앞 시험 결과를 돌려주지 않게 주소를 바꾼다
  beforeEach(() => {
    n += 1;
    vi.stubEnv("STARSHIP_SERVER_URL", `http://127.0.0.${n}:7787/starship`);
  });

  it("비서의 기록만 주고 데모 기록을 섞지 않는다", async () => {
    hq = () => Response.json(HQ_BODY);
    const { status, text } = await read();
    expect(status).toBe(200);
    const body = SecureResponse.parse(JSON.parse(text));
    expect(body).toMatchObject({ source: "remote", status: "ok" });
    expect(body.log.requests.map((r) => r.id)).toEqual(["req-1"]);
    expect(body.log.calls.map((c) => c.id)).toEqual(["call-1"]);
    expect(seen).toEqual([`http://127.0.0.${n}:7787/api/secure?limit=200`]);
  });

  it("값처럼 보이는 인자는 지우고 보낸다", async () => {
    hq = () => Response.json(HQ_BODY);
    const { text } = await read();
    expect(text).not.toContain(TOKEN);
    const body = SecureResponse.parse(JSON.parse(text));
    expect(body.hidden).toBe(1);
    expect(body.log.calls[0]?.command.args[2]).toBe(`password=${HIDDEN_ARG}`);
  });

  it("비서가 끝점을 모르면(404) 빈 기록과 status none", async () => {
    hq = () => new Response("not found", { status: 404 });
    const body = SecureResponse.parse(JSON.parse((await read()).text));
    expect(body).toMatchObject({ source: "remote", status: "none" });
    expect(body.log).toEqual({ requests: [], calls: [] });
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
    hq = () => Response.json({ requests: "없음", calls: [] });
    expect((await read()).status).toBe(502);
  });
});
