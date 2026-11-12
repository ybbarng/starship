import { describe, expect, it } from "vitest";
import { RelayLine, RelayLog, RelayResponse } from "./relay";

const line = (over: Record<string, unknown> = {}) => ({
  relay: "starship-relay/1",
  id: "R-1",
  at: "2026-11-12T09:30:00+09:00",
  kind: "open",
  from: "web-shop",
  title: "결제 문서 검토",
  ...over,
});

describe("RelayLine", () => {
  it("ISO 시각을 밀리초로 읽는다", () => {
    const l = RelayLine.parse(line());
    expect(l.at).toBe(Date.parse("2026-11-12T09:30:00+09:00"));
    expect(l).toMatchObject({ id: "R-1", kind: "open", from: "web-shop" });
  });

  it("밀리초 시각도 받는다", () => {
    expect(RelayLine.parse(line({ at: 1_700_000_000_000 })).at).toBe(
      1_700_000_000_000,
    );
  });

  it("null 칸은 없는 것으로 본다", () => {
    const l = RelayLine.parse(line({ card: null, note: null }));
    expect("card" in l && l.card !== undefined).toBe(false);
  });

  it("id 없는 forward는 받는다(어느 일인지 모르는 넘김)", () => {
    const r = RelayLine.safeParse(
      line({ id: undefined, kind: "forward", to: "doc-review" }),
    );
    expect(r.success).toBe(true);
  });

  it("forward가 아닌 줄에 id가 없으면 받지 않는다", () => {
    expect(RelayLine.safeParse(line({ id: undefined })).success).toBe(false);
  });

  it("모르는 판·종류는 받지 않는다", () => {
    expect(
      RelayLine.safeParse(line({ relay: "starship-relay/2" })).success,
    ).toBe(false);
    expect(RelayLine.safeParse(line({ kind: "pause" })).success).toBe(false);
  });
});

describe("RelayLog: 줄마다 따로 검사", () => {
  it("틀린 줄만 빼고 problems에 적는다", () => {
    const log = RelayLog.parse({
      relays: [
        line(),
        line({ id: "R-2", at: "어제쯤" }),
        line({ id: "R-3", kind: "close" }),
      ],
    });
    expect(log.relays.map((l) => l.id)).toEqual(["R-1", "R-3"]);
    expect(log.problems).toHaveLength(1);
    expect(log.problems?.[0]).toMatch(/^relays\[1\] \(id R-2\): at:/);
  });

  it("문제가 없으면 problems를 두지 않는다", () => {
    expect(RelayLog.parse({ relays: [line()] })).not.toHaveProperty("problems");
  });

  it("relays가 배열이 아니면 실패한다", () => {
    expect(RelayLog.safeParse({ relays: "없음" }).success).toBe(false);
  });

  it("비서가 보낸 problems를 앞에 둔다", () => {
    const log = RelayLog.parse({
      relays: [line({ kind: "nope" })],
      problems: ["비서: 3줄을 읽지 못했어요"],
    });
    expect(log.problems?.[0]).toBe("비서: 3줄을 읽지 못했어요");
    expect(log.problems).toHaveLength(2);
  });
});

describe("RelayResponse", () => {
  it("읽은 기록을 다시 읽어도 같다(화면이 받는 모양)", () => {
    const body = {
      source: "remote",
      status: "ok",
      log: RelayLog.parse({ relays: [line()] }),
    };
    const again = RelayResponse.parse(JSON.parse(JSON.stringify(body)));
    expect(again.log.relays[0]?.at).toBe(body.log.relays[0]?.at);
  });
});
