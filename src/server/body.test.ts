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
