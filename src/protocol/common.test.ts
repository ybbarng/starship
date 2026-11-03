import { describe, expect, it } from "vitest";
import { lenientArray, parseWhen, WebUrl, When } from "./common";
import { Hail, Task } from "./v1";

describe("WebUrl: http(s)만", () => {
  it("http·https는 받는다", () => {
    expect(WebUrl.safeParse("https://example.com/a").success).toBe(true);
    expect(WebUrl.safeParse("http://127.0.0.1:7790/").success).toBe(true);
  });

  it("javascript:·data:·file:은 막는다", () => {
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ])
      expect(WebUrl.safeParse(u).success).toBe(false);
  });

  it("Task·Hail의 url도 같은 규칙이다", () => {
    const task = {
      id: "t1",
      kind: "review",
      source: { kind: "review", service: "GitHub" },
      context: "work",
      title: "PR 봐 주세요",
      from: "동료",
      since: 1,
      actions: ["focus"],
    };
    expect(
      Task.safeParse({ ...task, url: "https://example.com/pr/1" }).success,
    ).toBe(true);
    expect(
      Task.safeParse({ ...task, url: "javascript:alert(1)" }).success,
    ).toBe(false);
    const hail = {
      id: "h1",
      from: { name: "동료" },
      source: { kind: "chat" },
      context: "work",
      line: "잠깐 볼 수 있어요?",
      since: 1,
    };
    expect(Hail.safeParse({ ...hail, url: "file:///etc/hosts" }).success).toBe(
      false,
    );
  });
});

describe("parseWhen: 날짜만 적은 값은 이 컴퓨터의 자정", () => {
  it("날짜만 있으면 로컬 자정", () => {
    expect(parseWhen("2026-10-31")).toBe(new Date(2026, 9, 31).getTime());
  });

  it("시각이 있으면 적힌 시간대 그대로", () => {
    expect(parseWhen("2026-10-31T10:12:00+09:00")).toBe(
      Date.UTC(2026, 9, 31, 1, 12),
    );
    expect(parseWhen("2026-10-31T01:12:00Z")).toBe(
      Date.UTC(2026, 9, 31, 1, 12),
    );
  });

  it("읽을 수 없거나 없는 날이면 NaN", () => {
    expect(parseWhen("어제쯤")).toBeNaN();
    expect(parseWhen("2026-02-31")).toBeNaN();
  });

  it("When 스키마는 parseWhen으로 읽히는 글만 받는다", () => {
    expect(When.safeParse("2026-10-31").success).toBe(true);
    expect(When.safeParse("2026-02-31").success).toBe(false);
  });
});

describe("lenientArray", () => {
  it("틀린 항목만 빼고 이유를 적는다", () => {
    const r = lenientArray(Hail, "hails").parse([
      {
        id: "h1",
        from: { name: "동료" },
        source: { kind: "chat" },
        context: "work",
        line: "안녕하세요",
        since: 1,
      },
      { id: "h2", from: { name: "동료" } },
    ]);
    expect(r.items.map((h) => h.id)).toEqual(["h1"]);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/^hails\[1\] \(id h2\): /);
  });
});
