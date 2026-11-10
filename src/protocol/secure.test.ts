import { describe, expect, it } from "vitest";
import {
  SecureAckBody,
  SecureAckResult,
  SecureLog,
  SecureResponse,
} from "./secure";

const session = {
  key: "s1",
  name: "web-shop",
  cwd: "/w/web-shop",
  tmuxPane: "%3",
};

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  at: "2026-11-10T10:00:00+09:00",
  expiresAt: "2026-11-10T10:30:00+09:00",
  actor: "ai",
  session,
  purpose: "배포 토큰 갱신",
  plan: ["토큰을 읽는다", "배포 설정에 넣는다"],
  items: [
    { ref: "op://Personal/blog.deploy.prod/DEPLOY_TOKEN", action: "read" },
  ],
  ...over,
});

const call = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  at: "2026-11-10T10:01:00+09:00",
  actor: "ai",
  via: "wrapper",
  session,
  command: {
    sub: "read",
    args: ["op://Personal/blog.deploy.prod/DEPLOY_TOKEN"],
  },
  requestId: "r1",
  ...over,
});

describe("SecureLog: 틀린 항목만 빼기", () => {
  it("모두 맞으면 problems가 없고 시각은 밀리초로 바뀐다", () => {
    const log = SecureLog.parse({
      requests: [request("r1")],
      calls: [call("c1")],
    });
    expect(log.problems).toBeUndefined();
    expect(log.requests[0]?.at).toBe(Date.parse("2026-11-10T10:00:00+09:00"));
    expect(log.calls[0]?.requestId).toBe("r1");
  });

  it("시각을 숫자(ms)로 보내도 받는다", () => {
    const log = SecureLog.parse({
      requests: [request("r1", { at: 1_000.4, expiresAt: 2_000 })],
      calls: [],
    });
    expect(log.requests[0]?.at).toBe(1_000);
    expect(log.requests[0]?.expiresAt).toBe(2_000);
  });

  it("틀린 신청서·호출은 그것만 빠지고 problems에 적힌다", () => {
    const log = SecureLog.parse({
      requests: [request("r1"), request("r2", { at: "어제쯤" })],
      calls: [call("c1", { via: "telepathy" }), call("c2")],
    });
    expect(log.requests.map((r) => r.id)).toEqual(["r1"]);
    expect(log.calls.map((c) => c.id)).toEqual(["c2"]);
    expect(log.problems).toHaveLength(2);
    expect(log.problems?.[0]).toMatch(/^requests\[1\] \(id r2\): at/);
    expect(log.problems?.[1]).toMatch(/^calls\[0\] \(id c1\): via/);
  });

  it("requestId가 없거나 null이면 null, 빠져도 되는 칸은 없어도 된다", () => {
    const { requestId: _drop, ...noReq } = call("c1");
    const log = SecureLog.parse({
      requests: [],
      calls: [
        noReq,
        call("c2", {
          actor: "human",
          session: null,
          requestId: null,
          context: {
            tty: "/dev/ttys004",
            termProgram: "iTerm.app",
            gitRoot: null,
          },
        }),
      ],
    });
    expect(log.calls.map((c) => c.requestId)).toEqual([null, null]);
    expect(log.calls[1]?.session).toBeUndefined();
    expect(log.calls[1]?.context?.gitRoot).toBeUndefined();
  });

  it("requests나 calls가 배열이 아니면 전체가 실패한다", () => {
    expect(SecureLog.safeParse({ requests: {}, calls: [] }).success).toBe(
      false,
    );
    expect(SecureLog.safeParse({ requests: [] }).success).toBe(false);
  });
});

describe("SecureResponse", () => {
  it("이미 읽은 기록(밀리초)을 다시 읽어도 같다", () => {
    const log = SecureLog.parse({
      requests: [request("r1")],
      calls: [call("c1")],
    });
    const res = SecureResponse.parse(
      JSON.parse(
        JSON.stringify({ source: "demo", status: "ok", hidden: 0, log }),
      ),
    );
    expect(res.log).toEqual(log);
  });
});

describe("SecureCall.ack: 확인함 표시", () => {
  it("없거나 null이면 확인 안 함, 있으면 시각을 밀리초로", () => {
    const log = SecureLog.parse({
      requests: [],
      calls: [
        call("c1"),
        call("c2", { ack: null }),
        call("c3", {
          ack: { at: "2026-11-10T11:00:00+09:00", by: "starship" },
        }),
        call("c4", { ack: { at: 5_000 } }),
      ],
    });
    expect(log.calls.map((c) => c.ack)).toEqual([
      undefined,
      undefined,
      { at: Date.parse("2026-11-10T11:00:00+09:00"), by: "starship" },
      { at: 5_000 },
    ]);
  });

  it("ack 시각이 틀리면 그 호출만 빠진다", () => {
    const log = SecureLog.parse({
      requests: [],
      calls: [call("c1", { ack: { at: "언젠가" } }), call("c2")],
    });
    expect(log.calls.map((c) => c.id)).toEqual(["c2"]);
    expect(log.problems?.[0]).toMatch(/^calls\[0\] \(id c1\): ack/);
  });
});

describe("SecureAckBody: Starship이 받는 확인함 요청", () => {
  it("id 1~50개, undo는 선택", () => {
    expect(SecureAckBody.parse({ ids: ["a"] })).toEqual({ ids: ["a"] });
    expect(SecureAckBody.parse({ ids: ["a", "b"], undo: true }).undo).toBe(
      true,
    );
  });

  it("빈 목록·빈 id·51개·글이 아닌 id는 거절", () => {
    expect(SecureAckBody.safeParse({ ids: [] }).success).toBe(false);
    expect(SecureAckBody.safeParse({ ids: [""] }).success).toBe(false);
    const many = Array.from({ length: 51 }, (_, i) => `c${i}`);
    expect(SecureAckBody.safeParse({ ids: many }).success).toBe(false);
    expect(SecureAckBody.safeParse({ ids: [1] }).success).toBe(false);
    expect(SecureAckBody.safeParse({ ids: ["a"], undo: "yes" }).success).toBe(
      false,
    );
  });
});

describe("SecureAckResult: 비서 응답은 느슨하게", () => {
  it("모르는 칸이 있거나 목록이 빠져도 받는다", () => {
    expect(SecureAckResult.parse({}).acked).toBeUndefined();
    const r = SecureAckResult.parse({ acked: ["a"], unknown: ["z"], extra: 1 });
    expect(r.acked).toEqual(["a"]);
    expect(r.unknown).toEqual(["z"]);
  });
});
