import { describe, expect, it } from "vitest";
import { ActionRequest } from "@/protocol/v1";
import { MAX_BODY_BYTES, readJsonBody } from "./body";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://127.0.0.1:7790/api/v1/actions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

describe("readJsonBody: 본문 크기 상한", () => {
  it("보통 동작 요청은 읽는다", async () => {
    const r = await readJsonBody(
      post(JSON.stringify({ target: "task", id: "t1", action: "dismiss" })),
    );
    expect(r).toEqual({
      ok: true,
      value: { target: "task", id: "t1", action: "dismiss" },
    });
  });

  it("Content-Length가 64KB를 넘으면 읽지 않고 413", async () => {
    const r = await readJsonBody(
      post("{}", { "content-length": String(MAX_BODY_BYTES + 1) }),
    );
    expect(r).toEqual({ ok: false, status: 413 });
  });

  it("길이를 적지 않았어도 읽은 뒤 64KB를 넘으면 413", async () => {
    const big = JSON.stringify({ answer: "가".repeat(MAX_BODY_BYTES) });
    const req = post(big);
    req.headers.delete("content-length");
    expect(await readJsonBody(req)).toEqual({ ok: false, status: 413 });
  });

  it("길이를 적지 않은 긴 본문은 64KB를 넘는 순간 그만 읽는다(끝까지 메모리에 올리지 않는다)", async () => {
    const CHUNK = 16 * 1024;
    const TOTAL = 64; // 1MB
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (pulled >= TOTAL) return c.close();
        pulled++;
        c.enqueue(new Uint8Array(CHUNK).fill(0x61));
      },
    });
    const req = new Request("http://127.0.0.1:7790/api/v1/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readJsonBody(req)).toEqual({ ok: false, status: 413 });
    // 64KB + 한 조각을 넘게 당기지 않는다(스트림이 미리 한두 조각 더 당길 수는 있다)
    expect(pulled).toBeLessThan(TOTAL / 4);
  });

  it("여러 조각으로 온 한글 본문도 그대로 읽는다", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ answer: "결제 칸 안에 바로 입력" }),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        // 한글 글자 한가운데서 자른다
        c.enqueue(bytes.slice(0, 13));
        c.enqueue(bytes.slice(13));
        c.close();
      },
    });
    const req = new Request("http://127.0.0.1:7790/api/v1/actions", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readJsonBody(req)).toEqual({
      ok: true,
      value: { answer: "결제 칸 안에 바로 입력" },
    });
  });

  it("JSON이 아니면 value가 null", async () => {
    expect(await readJsonBody(post("not json"))).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("ActionRequest: 글 길이 상한", () => {
  it("answer는 4000자까지", () => {
    const req = (answer: string) => ({
      target: "task",
      id: "desk:web-shop:coupon-entry",
      action: "answer",
      answer,
    });
    expect(ActionRequest.safeParse(req("가".repeat(4000))).success).toBe(true);
    expect(ActionRequest.safeParse(req("가".repeat(4001))).success).toBe(false);
  });

  it("id·crewId·region은 200자까지", () => {
    const sign = (region: string) => ({
      target: "sign",
      crewId: "web-shop",
      region,
      id: "receipt",
      action: "answer",
      answer: "직접 발급",
    });
    expect(ActionRequest.safeParse(sign("a".repeat(200))).success).toBe(true);
    expect(ActionRequest.safeParse(sign("a".repeat(201))).success).toBe(false);
    expect(
      ActionRequest.safeParse({
        target: "crew",
        id: "w".repeat(201),
        action: "focus",
      }).success,
    ).toBe(false);
  });
});
