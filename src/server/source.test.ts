import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_MAP_CREW } from "@/demo/map";
import { PROTOCOL } from "@/protocol/v1";
import {
  demoSeatCount,
  getCrewDesk,
  getCrewMap,
  getCrewMapHistory,
  getSnapshot,
  MAX_DEMO_SEATS,
  runAction,
} from "./source";

/* ───────────── 본부 흉내 ───────────── */

const task = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "permission",
  source: { kind: "session", service: "Claude Code" },
  context: "work",
  title: "push해도 될까요?",
  from: "web-shop",
  crewId: "web-shop",
  since: 1_792_900_000_000,
  actions: ["answer", "focus"],
  choices: ["승인", "보류"],
  ...over,
});

const snapshot = (over: Record<string, unknown> = {}) => ({
  protocol: PROTOCOL,
  generatedAt: 1_792_900_100_000,
  tasks: [task("t1"), task("t2")],
  hails: [],
  crew: [
    {
      id: "web-shop",
      name: "web-shop",
      context: "work",
      status: "needs-you",
      onDeck: true,
      actions: ["focus"],
    },
  ],
  gauges: [{ id: "backup", label: "백업", status: "ok", value: "2시간 전" }],
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** 본부를 흉내 낸다. 받은 요청(주소·init)을 calls에 남긴다. 테스트마다 주소를 달리해 짧은 캐시가 섞이지 않게 한다. */
let n = 0;
function hq(route: Route) {
  const base = `http://127.0.0.1:7787/hq-${++n}`;
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubEnv("STARSHIP_SERVER_URL", base);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return route(url.slice(base.length), init);
    }),
  );
  return { base, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* ───────────── 원격 모드 ───────────── */

describe("원격 모드: 스냅숏", () => {
  it("정상이면 그대로 읽고, 시간 제한(signal)과 no-store를 건다", async () => {
    const { calls } = hq(() => json(snapshot()));
    const snap = await getSnapshot("default");
    expect(snap.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(snap.problems).toBeUndefined();
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("틀린 항목 하나는 빠지고 problems에 적힌다", async () => {
    hq(() =>
      json(snapshot({ tasks: [task("t1"), task("t2", { kind: "wish" })] })),
    );
    const snap = await getSnapshot("default");
    expect(snap.tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(snap.problems?.[0]).toContain("tasks[1] (id t2)");
  });

  it("javascript: 주소를 단 할 일만 빠진다", async () => {
    hq(() =>
      json(
        snapshot({
          tasks: [task("t1"), task("t2", { url: "javascript:alert(1)" })],
        }),
      ),
    );
    const snap = await getSnapshot("default");
    expect(snap.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("500이면 실패한다(경로가 502로 바꾼다)", async () => {
    hq(() => json({ error: "boom" }, 500));
    await expect(getSnapshot("default")).rejects.toThrow("snapshot 500");
  });

  it("시간을 넘기면 실패한다", async () => {
    hq(() => {
      throw new DOMException("시간 초과", "TimeoutError");
    });
    await expect(getSnapshot("default")).rejects.toThrow("시간 초과");
  });

  it("동시에 여러 번 물어도 본부에는 한 번, 1.5초 안이면 다시 쓴다", async () => {
    const { calls } = hq(() => json(snapshot()));
    const [a, b] = await Promise.all([
      getSnapshot("default", "/a"),
      getSnapshot("default", "/b"),
    ]);
    expect(a).toEqual(b);
    await getSnapshot("default");
    expect(calls).toHaveLength(1);
  });

  it("실패한 결과는 남기지 않는다", async () => {
    let fail = true;
    const { calls } = hq(() => (fail ? json({}, 500) : json(snapshot())));
    await expect(getSnapshot("default")).rejects.toThrow();
    fail = false;
    await expect(getSnapshot("default")).resolves.toMatchObject({
      protocol: PROTOCOL,
    });
    expect(calls).toHaveLength(2);
  });

  it("동작을 보낸 뒤에는 새로 묻는다(처리한 할 일이 다시 보이지 않게)", async () => {
    const { calls } = hq((path) =>
      path === "/v1/actions" ? json({ ok: true }) : json(snapshot()),
    );
    await getSnapshot("default");
    await runAction({ target: "task", id: "t1", action: "dismiss" });
    await getSnapshot("default");
    expect(calls.map((c) => c.url.split("/v1/")[1])).toEqual([
      "snapshot",
      "actions",
      "snapshot",
    ]);
  });
});

describe("원격 모드: 지도", () => {
  it("404면 지도가 없는 것", async () => {
    hq(() => json({}, 404));
    await expect(getCrewMap("web-shop")).resolves.toEqual({ map: null });
  });

  it("지도 형식이 틀리면 map: null과 problems", async () => {
    hq(() =>
      json({
        map: { map: "starship-map/1", title: "상점", regions: "없음" },
        problems: ["본부: 마지막으로 맞았던 지도 없음"],
      }),
    );
    const r = await getCrewMap("web-shop");
    expect(r.map).toBeNull();
    expect(r.problems?.[0]).toBe("본부: 마지막으로 맞았던 지도 없음");
    expect(r.problems?.length).toBeGreaterThan(1);
  });

  it("구역 하나가 틀리면 그 구역과 자손만 빠지고 지도는 보인다", async () => {
    hq(() =>
      json({
        map: {
          map: "starship-map/1",
          title: "상점",
          regions: [
            { id: "server", title: "서버", status: "building" },
            { id: "pay", title: "결제", parent: "server", status: "paused" },
            { id: "pay-card", title: "카드", parent: "pay", status: "fog" },
            {
              id: "web",
              title: "웹",
              status: "fog",
              links: [{ label: "x", url: "javascript:alert(1)" }],
            },
          ],
        },
      }),
    );
    const r = await getCrewMap("web-shop");
    expect(r.map?.regions.map((x) => x.id)).toEqual(["server", "web"]);
    expect(r.map?.regions[1]?.links).toEqual([]);
    expect(r.problems).toHaveLength(3);
  });

  it("맞는 지도면 problems를 두지 않는다", async () => {
    hq(() =>
      json({ map: { map: "starship-map/1", title: "상점", regions: [] } }),
    );
    expect(await getCrewMap("web-shop")).not.toHaveProperty("problems");
  });

  it("되감기는 404면 빈 기록, 틀린 장은 뺀다", async () => {
    hq(() => json({}, 404));
    await expect(getCrewMapHistory("web-shop")).resolves.toEqual({
      frames: [],
    });
    hq(() =>
      json({
        frames: [
          { at: 1, map: { map: "starship-map/1", title: "상점", regions: [] } },
          { at: 2, map: { map: "starship-map/9" } },
        ],
      }),
    );
    const r = await getCrewMapHistory("web-shop");
    expect(r.frames.map((f) => f.at)).toEqual([1]);
  });
});

describe("원격 모드: 책상", () => {
  const desk = {
    desk: "starship-desk/1",
    updatedAt: "2026-11-03",
    waiting: [
      {
        id: "shot",
        type: "check",
        title: "결제 화면 확인",
        items: [{ label: "스크린샷", path: "~/Desktop/pay.png" }],
      },
    ],
    doing: [],
  };

  it("~/ 경로가 든 책상도 받는다", async () => {
    hq(() => json({ desk }));
    const r = await getCrewDesk("web-shop");
    expect(r.desk?.waiting[0]?.items?.[0]?.path).toBe("~/Desktop/pay.png");
  });

  it("기다림 하나가 틀리면 그것만 빠지고, 본부 problems 뒤에 까닭이 붙는다", async () => {
    hq(() =>
      json({
        desk: {
          ...desk,
          waiting: [
            ...desk.waiting,
            { id: "pick", type: "decide", title: "선택지 없는 고르기" },
          ],
          doing: [{ title: "시험 돌리는 중" }],
        },
        problems: ["본부: 책상 파일을 늦게 읽었어요"],
      }),
    );
    const r = await getCrewDesk("web-shop");
    expect(r.desk?.waiting.map((w) => w.id)).toEqual(["shot"]);
    expect(r.desk?.doing).toHaveLength(1);
    expect(r.problems).toEqual([
      "본부: 책상 파일을 늦게 읽었어요",
      expect.stringMatching(/^waiting\[1\] \(id pick\): options/),
    ]);
  });

  it("맞는 책상이면 problems를 두지 않는다", async () => {
    hq(() => json({ desk }));
    const r = await getCrewDesk("web-shop");
    expect(r).not.toHaveProperty("problems");
  });

  it("겉이 틀리면 desk: null과 problems", async () => {
    hq(() => json({ desk: { ...desk, desk: "starship-desk/9" } }));
    const r = await getCrewDesk("web-shop");
    expect(r.desk).toBeNull();
    expect(r.problems?.[0]).toMatch(/^desk:/);
  });

  it("404면 책상이 없는 것, 500이면 실패", async () => {
    hq(() => json({}, 404));
    await expect(getCrewDesk("web-shop")).resolves.toEqual({ desk: null });
    hq(() => json({}, 500));
    await expect(getCrewDesk("web-shop")).rejects.toThrow("desk 500");
  });

  it("같은 책상을 잇달아 물으면 한 번만 묻는다", async () => {
    const { calls } = hq(() => json({ desk }));
    await Promise.all([getCrewDesk("web-shop"), getCrewDesk("web-shop")]);
    await getCrewDesk("web-shop");
    expect(calls).toHaveLength(1);
  });
});

describe("원격 모드: 동작", () => {
  it("본부 답을 그대로 주되 http(s)가 아닌 openUrl은 뺀다", async () => {
    hq(() =>
      json({ ok: true, note: "열어요", openUrl: "javascript:alert(1)" }),
    );
    await expect(
      runAction({ target: "task", id: "t1", action: "focus" }),
    ).resolves.toEqual({ ok: true, note: "열어요" });
  });

  it("거절하면 상태 번호를, 읽지 못할 답이면 그렇다고 알린다", async () => {
    hq(() => json({}, 409));
    await expect(
      runAction({ target: "task", id: "t1", action: "dismiss" }),
    ).resolves.toEqual({ ok: false, note: "서버가 거절했어요 (409)" });
    hq(() => json({ done: true }));
    await expect(
      runAction({ target: "task", id: "t1", action: "dismiss" }),
    ).resolves.toEqual({ ok: false, note: "본부의 답을 읽지 못했어요" });
  });

  it("시간을 넘기면 실패한다(경로가 '본부에 닿지 못했어요'로 바꾼다)", async () => {
    const { calls } = hq(() => {
      throw new DOMException("시간 초과", "TimeoutError");
    });
    await expect(
      runAction({ target: "task", id: "t1", action: "dismiss" }),
    ).rejects.toThrow();
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

/* ───────────── 데모 모드 ───────────── */

describe("데모 모드", () => {
  beforeEach(() => {
    vi.stubEnv("STARSHIP_SERVER_URL", "");
  });

  it("자리(seat)마다 상태가 따로다", async () => {
    const before = await getSnapshot("default", "/seat-a");
    const first = before.tasks[0];
    if (!first) throw new Error("데모 할 일이 없어요");
    await runAction(
      { target: "task", id: first.id, action: "dismiss" },
      "/seat-a",
    );
    const a = await getSnapshot("default", "/seat-a");
    const b = await getSnapshot("default", "/seat-b");
    expect(a.tasks.some((t) => t.id === first.id)).toBe(false);
    expect(b.tasks.some((t) => t.id === first.id)).toBe(true);
  });

  it("선실에서 답한 갈림길은 그 자리의 지도에서 정함이 된다(applyDecided)", async () => {
    const now = Date.parse("2026-11-03T12:00:00+09:00");
    const map = (await getCrewMap(DEMO_MAP_CREW, now, "/seat-sign")).map;
    const region = map?.regions.find((r) =>
      r.signs?.some((s) => s.id === "receipt"),
    );
    if (!region) throw new Error("데모 지도에 receipt 갈림길이 없어요");
    await runAction(
      {
        target: "sign",
        crewId: DEMO_MAP_CREW,
        region: region.id,
        id: "receipt",
        action: "answer",
        answer: "직접 발급",
      },
      "/seat-sign",
    );
    const after = await getCrewMap(DEMO_MAP_CREW, now, "/seat-sign");
    const sign = after.map?.regions
      .find((r) => r.id === region.id)
      ?.signs?.find((s) => s.id === "receipt");
    expect(sign).toMatchObject({ status: "decided", decided: "직접 발급" });
    const other = await getCrewMap(DEMO_MAP_CREW, now, "/seat-other");
    const untouched = other.map?.regions
      .find((r) => r.id === region.id)
      ?.signs?.find((s) => s.id === "receipt");
    expect(untouched).toMatchObject({ status: "open" });
  });

  it(`자리는 ${MAX_DEMO_SEATS}개까지, 넘으면 가장 오래 안 쓴 자리부터 버린다`, async () => {
    const first = (await getSnapshot("default", "/keep")).tasks[0];
    if (!first) throw new Error("데모 할 일이 없어요");
    const dismiss = (seat: string) =>
      runAction({ target: "task", id: first.id, action: "dismiss" }, seat);
    await dismiss("/keep");
    await dismiss("/gone");
    for (let i = 0; i < MAX_DEMO_SEATS + 10; i++) {
      await getSnapshot("default", `/flood-${i}`);
      if (i % 10 === 0) await getSnapshot("default", "/keep"); // 자주 쓰는 자리는 남는다
    }
    expect(demoSeatCount()).toBe(MAX_DEMO_SEATS);
    const has = async (seat: string) =>
      (await getSnapshot("default", seat)).tasks.some((t) => t.id === first.id);
    expect(await has("/keep")).toBe(false); // 치운 상태가 남아 있다
    expect(await has("/gone")).toBe(true); // 버려져 처음 상태로 다시 생겼다
  });

  it("아주 긴 seat는 200자로 잘라 같은 자리로 본다", async () => {
    const long = `/x${"a".repeat(500)}`;
    const snap = await getSnapshot("default", long);
    const first = snap.tasks[0];
    if (!first) throw new Error("데모 할 일이 없어요");
    await runAction({ target: "task", id: first.id, action: "dismiss" }, long);
    const cut = await getSnapshot("default", long.slice(0, 200));
    expect(cut.tasks.some((t) => t.id === first.id)).toBe(false);
  });
});
