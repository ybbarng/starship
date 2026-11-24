import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// localStorage 경계만 가짜로 둔다. 저장소 모듈은 시험마다 새로 불러와 "아직 읽지 않음"에서 시작한다
function fakeLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const now = Date.parse("2026-11-24T12:00:00+09:00");
const key = "desk:web-shop:coupon-ui";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ now, toFake: ["Date"] });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSent를 localStorage에 남기기", () => {
  it("처음 읽기 전에 다른 화면이 상태를 바꿔도 저장해 둔 보낸 답을 덮어쓰지 않는다", async () => {
    const saved = JSON.stringify({
      state: { sent: { [key]: "승인" }, sentAt: { [key]: now - 1000 } },
      version: 1,
    });
    const ls = fakeLocalStorage({ "starship-sent/1": saved });
    vi.stubGlobal("window", { localStorage: ls });
    const { useSent } = await import("./sent");
    // 자식 화면의 prune 같은 쓰기가 Providers의 읽기보다 먼저 돈다
    useSent.getState().prune("desk:blog:", new Set());
    useSent.getState().setRead("blog/a1", true);
    await useSent.persist.rehydrate();
    expect(useSent.getState().sent).toEqual({ [key]: "승인" });
  });

  it("읽은 뒤에 보낸 답은 localStorage에 보낸 시각과 함께 남는다", async () => {
    const ls = fakeLocalStorage();
    vi.stubGlobal("window", { localStorage: ls });
    const { useSent } = await import("./sent");
    await useSent.persist.rehydrate();
    useSent.getState().mark(key, "승인");
    const stored = JSON.parse(ls.data.get("starship-sent/1") ?? "null");
    expect(stored.state.sent).toEqual({ [key]: "승인" });
    expect(stored.state.sentAt).toEqual({ [key]: now });
  });

  it("localStorage가 막혀 있어도 답을 남기고 읽는 데 실패하지 않는다", async () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });
    const { useSent } = await import("./sent");
    await useSent.persist.rehydrate();
    useSent.getState().mark(key, "승인");
    expect(useSent.getState().sent).toEqual({ [key]: "승인" });
  });
});
