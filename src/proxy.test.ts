import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const req = (host: string) =>
  new NextRequest("http://127.0.0.1:7790/", { headers: { host } });

describe("proxy: 앱 전체 Host 검사", () => {
  it("이 컴퓨터 자신을 가리키는 Host는 통과한다", () => {
    for (const host of ["127.0.0.1:7790", "localhost:7790", "[::1]:7790"]) {
      expect(proxy(req(host)).status, host).toBe(200);
    }
  });

  it("다른 이름(DNS 재바인딩·같은 망의 다른 기기)은 421로 거절한다", () => {
    for (const host of [
      "evil.example:7790",
      "192.168.0.10:7790",
      "100.64.1.2",
    ]) {
      expect(proxy(req(host)).status, host).toBe(421);
    }
  });
});
