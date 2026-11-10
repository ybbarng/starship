import { describe, expect, it } from "vitest";
import type { SecureCall, SecureRequest } from "@/protocol/secure";
import {
  ALERT_DENIED,
  ALERT_NO_REQUEST,
  activeRequests,
  callAlerts,
  filterRequests,
  filterRows,
  groupCalls,
  isHarmlessCall,
  latestRequest,
  periodStart,
  remainingLabel,
  rowAck,
  sessionsOf,
  unackedAlertCount,
} from "./rows";

const NOW = new Date(2026, 10, 10, 15, 0).getTime();
const MIN = 60_000;
const shop = {
  key: "s-shop",
  name: "web-shop",
  cwd: "/work/web-shop",
  tmuxPane: "%3",
};
const blog = {
  key: "s-blog",
  name: "lunar-blog",
  cwd: "/home/me/lunar-blog",
  tmuxPane: "%7",
};
const REF = "op://Personal/blog.deploy.prod/DEPLOY_TOKEN";

const call = (id: string, over: Partial<SecureCall> = {}): SecureCall => ({
  id,
  at: NOW - 10 * MIN,
  actor: "ai",
  via: "wrapper",
  session: shop,
  command: { sub: "read", args: [REF] },
  requestId: "r1",
  ...over,
});

const request = (
  id: string,
  over: Partial<SecureRequest> = {},
): SecureRequest => ({
  id,
  at: NOW - 20 * MIN,
  expiresAt: NOW + 10 * MIN,
  actor: "ai",
  session: shop,
  purpose: "배포 토큰 갱신",
  plan: ["토큰을 읽는다"],
  items: [{ ref: REF, action: "read" }],
  ...over,
});

describe("callAlerts: 빨간 까닭", () => {
  it("denied면 막힌 호출", () => {
    expect(callAlerts(call("c", { via: "hook", decision: "denied" }))).toEqual([
      ALERT_DENIED,
    ]);
  });

  it("AI의 wrapper 기록에 신청서가 없으면 신청서 없는 호출", () => {
    expect(callAlerts(call("c", { requestId: null }))).toEqual([
      ALERT_NO_REQUEST,
    ]);
  });

  it("hook 기록이나 사람의 직접 실행은 신청서가 없어도 빨갛지 않다", () => {
    expect(callAlerts(call("c", { via: "hook", requestId: null }))).toEqual([]);
    expect(
      callAlerts(
        call("c", { actor: "human", session: undefined, requestId: null }),
      ),
    ).toEqual([]);
  });

  it("값을 건드리지 않는 호출(op --version 등)은 신청서가 없어도 빨갛지 않다", () => {
    for (const args of [["--version"], ["-v"], ["--help"], ["-h"], ["help"]])
      expect(
        callAlerts(call("c", { requestId: null, command: { sub: "", args } })),
      ).toEqual([]);
  });

  it("값을 건드리지 않는 호출이어도 denied면 빨갛다", () => {
    expect(
      callAlerts(
        call("c", {
          via: "hook",
          requestId: null,
          decision: "denied",
          command: { sub: "", args: ["--version"] },
        }),
      ),
    ).toEqual([ALERT_DENIED]);
  });
});

describe("isHarmlessCall: 보수적으로 판정", () => {
  it("하위 명령이 있거나 다른 인자가 섞이면 아니다", () => {
    expect(isHarmlessCall({ sub: "read", args: ["--help"] })).toBe(false);
    expect(isHarmlessCall({ sub: "", args: ["--version", REF] })).toBe(false);
    expect(isHarmlessCall({ sub: "", args: ["--help=1"] })).toBe(false);
    expect(isHarmlessCall({ sub: " ", args: ["-v"] })).toBe(false);
  });

  it("인자가 하나도 없으면 아니다", () => {
    expect(isHarmlessCall({ sub: "", args: [] })).toBe(false);
  });

  it("판본·도움말 인자만 있으면 맞다", () => {
    expect(isHarmlessCall({ sub: "", args: ["--version"] })).toBe(true);
    expect(isHarmlessCall({ sub: "", args: ["help", "-h"] })).toBe(true);
  });
});

describe("확인함 표시: rowAck, unackedAlertCount", () => {
  const T1 = NOW - 5 * MIN;
  const T2 = NOW - 2 * MIN;

  it("빨간 기록이 모두 확인됐으면 가장 늦은 ack", () => {
    const calls = [
      call("h", {
        via: "hook",
        requestId: null,
        decision: "denied",
        ack: { at: T1 },
      }),
      call("w", { requestId: null, ack: { at: T2, by: "starship" } }),
    ];
    expect(rowAck(calls)).toEqual({ at: T2, by: "starship" });
  });

  it("빨간 기록 중 하나라도 확인 안 했으면 undefined", () => {
    const calls = [
      call("h", {
        via: "hook",
        requestId: null,
        decision: "denied",
        ack: { at: T1 },
      }),
      call("w", { requestId: null }),
    ];
    expect(rowAck(calls)).toBeUndefined();
  });

  it("빨갛지 않은 기록의 ack는 보지 않는다", () => {
    expect(rowAck([call("w", { ack: { at: T1 } })])).toBeUndefined();
    const calls = [
      call("h", { via: "hook", decision: "allowed" }),
      call("w", { requestId: null, ack: { at: T1 } }),
    ];
    expect(rowAck(calls)).toEqual({ at: T1 });
  });

  it("groupCalls가 줄에 ack를 붙이고, 확인 안 한 빨간 줄만 센다", () => {
    const rows = groupCalls([
      call("a", { at: NOW - 30 * MIN, requestId: null, ack: { at: T1 } }),
      call("b", { at: NOW - 20 * MIN, requestId: null }),
      call("c", { at: NOW - 10 * MIN }),
      call("d", {
        at: NOW - 40 * MIN,
        session: blog,
        via: "hook",
        decision: "denied",
      }),
    ]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    expect(byKey.get("a")?.ack).toEqual({ at: T1 });
    expect(byKey.get("b")?.ack).toBeUndefined();
    expect(byKey.get("c")).not.toHaveProperty("ack");
    expect(unackedAlertCount(rows)).toBe(2);
  });
});

describe("groupCalls: hook과 wrapper 짝을 한 줄로", () => {
  it("같은 세션·같은 하위 명령·5초 안의 hook과 wrapper는 한 줄", () => {
    const rows = groupCalls([
      call("w", { at: NOW - 10 * MIN + 1_200, exit: 0, ms: 340 }),
      call("h", {
        via: "hook",
        decision: "allowed",
        command: { sub: "read", args: [] },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "h+w",
      at: NOW - 10 * MIN,
      vias: ["hook", "wrapper"],
      decision: "allowed",
      exit: 0,
      ms: 340,
      command: { sub: "read", args: [REF] },
      alerts: [],
    });
  });

  it("시각 차이가 5초를 넘거나 세션·하위 명령이 다르면 따로", () => {
    const rows = groupCalls([
      call("a", { via: "hook" }),
      call("b", { at: NOW - 10 * MIN + 6_000 }),
      call("c", { via: "hook", at: NOW - 5 * MIN, session: blog }),
      call("d", { at: NOW - 5 * MIN }),
      call("e", {
        via: "hook",
        at: NOW - 2 * MIN,
        command: { sub: "item", args: [] },
      }),
      call("f", { at: NOW - 2 * MIN }),
    ]);
    expect(rows).toHaveLength(6);
  });

  it("같은 명령을 잇달아 두 번 부르면 짝마다 한 줄씩(한 줄에 같은 출처는 하나)", () => {
    const rows = groupCalls([
      call("h1", { via: "hook", at: NOW - 10_000 }),
      call("w1", { at: NOW - 9_000 }),
      call("h2", { via: "hook", at: NOW - 8_000 }),
      call("w2", { at: NOW - 7_000 }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["h2+w2", "h1+w1"]);
  });

  it("사람의 직접 실행은 묶지 않는다", () => {
    const human = {
      actor: "human" as const,
      session: undefined,
      requestId: null,
    };
    const rows = groupCalls([
      call("a", { ...human, via: "hook" }),
      call("b", { ...human }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("묶은 기록 중 하나라도 빨가면 줄이 빨갛고, 까닭은 겹치지 않게 모은다", () => {
    const rows = groupCalls([
      call("h", { via: "hook", decision: "denied", requestId: null }),
      call("w", { at: NOW - 10 * MIN + 500, requestId: null }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.decision).toBe("denied");
    expect(rows[0]?.alerts).toEqual([ALERT_DENIED, ALERT_NO_REQUEST]);
  });

  it("결과는 최근순", () => {
    const rows = groupCalls([
      call("old", { at: NOW - 60 * MIN }),
      call("new", { at: NOW - MIN }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["new", "old"]);
  });
});

describe("거르기", () => {
  const rows = groupCalls([
    call("recent", { at: NOW - 30 * MIN }),
    call("morning", {
      at: new Date(2026, 10, 10, 9, 0).getTime(),
      session: blog,
    }),
    call("yesterday", { at: NOW - 26 * 60 * MIN }),
    call("old", { at: NOW - 10 * 24 * 60 * MIN }),
    call("me", {
      at: NOW - 5 * MIN,
      actor: "human",
      session: undefined,
      requestId: null,
    }),
  ]);
  const keys = (f: Parameters<typeof filterRows>[1]) =>
    filterRows(rows, f, NOW).map((r) => r.key);

  it("기간: 1시간·오늘(자정부터)·7일·전체", () => {
    expect(keys({ actor: "all", period: "1h" })).toEqual(["me", "recent"]);
    expect(keys({ actor: "all", period: "today" })).toEqual([
      "me",
      "recent",
      "morning",
    ]);
    expect(keys({ actor: "all", period: "7d" })).toHaveLength(4);
    expect(keys({ actor: "all", period: "all" })).toHaveLength(5);
    expect(periodStart("today", NOW)).toBe(new Date(2026, 10, 10).getTime());
  });

  it("사람/AI와 세션", () => {
    expect(keys({ actor: "human", period: "all" })).toEqual(["me"]);
    expect(keys({ actor: "ai", period: "all", session: "s-blog" })).toEqual([
      "morning",
    ]);
  });

  it("신청서는 AI만 쓰니 사람으로 거르면 비고, 세션으로 거를 수 있다", () => {
    const reqs = [request("r1"), request("r2", { session: blog })];
    expect(
      filterRequests(reqs, { actor: "human", period: "all" }, NOW),
    ).toEqual([]);
    expect(
      filterRequests(
        reqs,
        { actor: "all", period: "all", session: "s-blog" },
        NOW,
      ).map((r) => r.id),
    ).toEqual(["r2"]);
  });

  it("세션 목록은 신청서와 호출에서 모으고 최근에 나온 순", () => {
    const list = sessionsOf(
      [request("r1", { at: NOW - 3 * MIN })],
      [
        call("c", { at: NOW - 60 * MIN, session: blog }),
        call("d", { at: NOW - 90 * MIN }),
      ],
    );
    expect(list).toEqual([
      { key: "s-shop", name: "web-shop" },
      { key: "s-blog", name: "lunar-blog" },
    ]);
  });
});

describe("유효한 신청서와 남은 시간", () => {
  it("expiresAt이 지금보다 뒤인 것만, 최근에 쓴 순", () => {
    const reqs = [
      request("old-valid", { at: NOW - 50 * MIN }),
      request("expired", { at: NOW - 40 * MIN, expiresAt: NOW - MIN }),
      request("new-valid", { at: NOW - 5 * MIN }),
      request("edge", { expiresAt: NOW }),
    ];
    expect(activeRequests(reqs, NOW).map((r) => r.id)).toEqual([
      "new-valid",
      "old-valid",
    ]);
    expect(latestRequest(reqs)?.id).toBe("new-valid");
    expect(latestRequest([])).toBeUndefined();
  });

  it("남은 시간 글", () => {
    expect(remainingLabel(NOW + 40_000, NOW)).toBe("40초 남음");
    expect(remainingLabel(NOW + 12 * MIN, NOW)).toBe("12분 남음");
    expect(remainingLabel(NOW + 65 * MIN, NOW)).toBe("1시간 5분 남음");
    expect(remainingLabel(NOW + 120 * MIN, NOW)).toBe("2시간 남음");
    expect(remainingLabel(NOW, NOW)).toBe("만료됨");
  });
});
