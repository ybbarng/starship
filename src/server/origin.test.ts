import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

const req = (headers: Record<string, string>) =>
  new Request("http://127.0.0.1:7790/api/v1/actions", {
    method: "POST",
    headers,
  });

describe("isSameOrigin", () => {
  it("같은 호스트면 받는다", () => {
    expect(
      isSameOrigin(
        req({ origin: "http://127.0.0.1:7790", host: "127.0.0.1:7790" }),
      ),
    ).toBe(true);
  });

  it("다른 사이트나 Origin 없는 요청은 거절한다", () => {
    expect(
      isSameOrigin(
        req({ origin: "http://evil.example", host: "127.0.0.1:7790" }),
      ),
    ).toBe(false);
    expect(isSameOrigin(req({ host: "127.0.0.1:7790" }))).toBe(false);
  });
});
