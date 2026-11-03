import { describe, expect, it } from "vitest";
import { agoShort, HQ_GRACE_MS, hqConnected, inboxEmpty } from "./hqLink";

const t0 = Date.parse("2026-11-03T12:00:00+09:00");

describe("hqConnected", () => {
  it("오류가 없으면 연결된 것으로 본다", () => {
    expect(hqConnected(false, 0, t0)).toBe(true);
  });

  it("오류가 났어도 마지막으로 받은 지 15초가 안 됐으면 깜빡이지 않는다", () => {
    expect(hqConnected(true, t0, t0 + HQ_GRACE_MS - 1)).toBe(true);
  });

  it("15초 넘게 못 받으면 끊김", () => {
    expect(hqConnected(true, t0, t0 + HQ_GRACE_MS)).toBe(false);
  });

  it("한 번도 받지 못하고 오류면 끊김", () => {
    expect(hqConnected(true, 0, t0)).toBe(false);
  });
});

describe("agoShort", () => {
  it("초와 분으로 적는다", () => {
    expect(agoShort(t0, t0 + 3_000)).toBe("3초 전");
    expect(agoShort(t0, t0 + 120_000)).toBe("2분 전");
  });

  it("시계가 받은 때보다 늦게 돌아도 음수로 적지 않는다", () => {
    expect(agoShort(t0, t0 - 1_500)).toBe("0초 전");
  });
});

describe("inboxEmpty: 빈 결재함 글", () => {
  it("아직 받지 못했고 오류도 없으면 받아 오는 중", () => {
    expect(inboxEmpty(false, false)).toBe("loading");
  });

  it("한 번도 받지 못하고 오류면 본부에 닿지 않음(순항 중이라 하지 않는다)", () => {
    expect(inboxEmpty(false, true)).toBe("unreachable");
  });

  it("한 번이라도 받았으면 그 자료로 순항 중", () => {
    expect(inboxEmpty(true, false)).toBe("calm");
    expect(inboxEmpty(true, true)).toBe("calm");
  });
});
