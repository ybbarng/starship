import { afterEach, describe, expect, it, vi } from "vitest";
import { createShared, fetchUpstream } from "./upstream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUpstream: 시간 제한", () => {
  it("본부가 답하지 않으면 정한 시간에 TimeoutError로 끊는다", async () => {
    // 신호가 끊기기 전에는 답하지 않는 본부
    vi.stubGlobal(
      "fetch",
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    await expect(
      fetchUpstream("http://127.0.0.1:7787/v1/snapshot", {}, 20),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("init을 그대로 넘기되 캐시는 끈다", async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      seen.push(init);
      return new Response("{}");
    });
    await fetchUpstream("http://127.0.0.1:7787/v1/actions", { method: "POST" });
    expect(seen[0]).toMatchObject({ method: "POST", cache: "no-store" });
  });
});

describe("createShared: 함께 쓰기와 짧은 캐시", () => {
  const clockAt = (t: { now: number }) => () => t.now;

  it("진행 중인 요청은 함께 쓴다", async () => {
    const shared = createShared(1_500, clockAt({ now: 0 }));
    let calls = 0;
    const load = async () => ++calls;
    const [a, b] = await Promise.all([
      shared.get("k", load),
      shared.get("k", load),
    ]);
    expect([a, b, calls]).toEqual([1, 1, 1]);
  });

  it("끝난 뒤 ttl 안이면 다시 쓰고, 지나면 새로 묻는다", async () => {
    const t = { now: 0 };
    const shared = createShared(1_500, clockAt(t));
    let calls = 0;
    const load = async () => ++calls;
    await shared.get("k", load);
    t.now = 1_499;
    expect(await shared.get("k", load)).toBe(1);
    t.now = 1_500;
    expect(await shared.get("k", load)).toBe(2);
  });

  it("오래 걸리는 요청도 끝날 때까지는 함께 쓴다", async () => {
    const t = { now: 0 };
    const shared = createShared(1_500, clockAt(t));
    let release: (v: string) => void = () => {};
    let calls = 0;
    const slow = () => {
      calls++;
      return new Promise<string>((r) => {
        release = r;
      });
    };
    const a = shared.get("k", slow);
    t.now = 3_000;
    const b = shared.get("k", slow);
    release("답");
    expect([await a, await b, calls]).toEqual(["답", "답", 1]);
  });

  it("열쇠가 다르면 따로, 실패는 남기지 않고, clear하면 비운다", async () => {
    const shared = createShared(1_500, clockAt({ now: 0 }));
    let calls = 0;
    await shared.get("a", async () => ++calls);
    await shared.get("b", async () => ++calls);
    expect(calls).toBe(2);
    await expect(
      shared.get("c", async () => {
        throw new Error("본부 꺼짐");
      }),
    ).rejects.toThrow();
    expect(await shared.get("c", async () => "다시")).toBe("다시");
    shared.clear();
    expect(await shared.get("a", async () => "새로")).toBe("새로");
  });
});
