import { describe, expect, it } from "vitest";
import {
  checkMap,
  isNewFound,
  mapProgress,
  type ProjectMap,
  parseMap,
  type Region,
  summarizeMap,
} from "./map";

function region(id: string, more: Partial<Region> = {}): Region {
  return { id, title: id, status: "fog", size: 1, ...more };
}

function map(regions: Region[], more: Partial<ProjectMap> = {}): ProjectMap {
  return { map: "starship-map/1", title: "시험", regions, ...more };
}

describe("parseMap", () => {
  it("설계 문서의 예시를 받는다", () => {
    const result = parseMap({
      map: "starship-map/1",
      title: "온라인 상점",
      goal: "첫 고객이 주문하고 결제·배송까지 끝난다",
      baselineAt: "2026-10-22",
      updatedAt: "2026-10-29T10:12:00+09:00",
      here: "server-payment",
      regions: [
        { id: "server", title: "서버", status: "building" },
        {
          id: "server-payment",
          title: "서버: 결제",
          parent: "server",
          status: "building",
          size: 3,
          found: "2026-10-23",
          links: [
            { label: "결정 0002", path: "docs/decisions/0002-payment.md" },
            { label: "PAY-12", url: "https://example.com/PAY-12" },
          ],
          signs: [
            {
              id: "receipt",
              type: "fork",
              title: "영수증 발급 방식",
              owner: "me",
              options: ["A", "B"],
              recommend: "A",
              status: "open",
            },
            {
              id: "kim-refund",
              type: "talk",
              title: "환불 정책",
              with: "Kim",
              status: "draft",
            },
            { id: "outage", type: "risk", title: "대행사 장애" },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    // size를 적지 않으면 1
    expect(result.map?.regions[0]?.size).toBe(1);
  });

  it("모르는 필드는 버리고 받는다", () => {
    const result = parseMap({
      map: "starship-map/1",
      title: "t",
      owner: "누군가",
      regions: [{ id: "a", title: "a", status: "fog", pos: [1, 2] }],
    });
    expect(result.ok).toBe(true);
  });

  it("구역 형식이 틀리면 그 구역만 빼고 어디가 틀렸는지 알려 준다", () => {
    const result = parseMap({
      map: "starship-map/1",
      title: "t",
      regions: [
        { id: "a", title: "a", status: "paused", size: 9 },
        { id: "b", title: "b", status: "fog" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.map?.regions.map((r) => r.id)).toEqual(["b"]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/^regions\[0\] \(id a\): status: /);
    expect(result.problems[0]).toContain("; size: ");
  });

  it("겉이 틀리면 지도 전체를 거절한다", () => {
    for (const bad of [
      { map: "starship-map/2", title: "t", regions: [] },
      { map: "starship-map/1", title: "", regions: [] },
      { map: "starship-map/1", title: "t", regions: "없음" },
      { map: "starship-map/1", title: "t", updatedAt: "어제쯤", regions: [] },
    ]) {
      const result = parseMap(bad);
      expect(result.ok).toBe(false);
      expect(result.map).toBeNull();
      expect(result.problems.length).toBeGreaterThan(0);
    }
  });
});

describe("parseMap: 틀린 것만 빼거나 맨 위로 올린다", () => {
  /** 고친 지도는 늘 짜임 검사를 통과해야 한다 */
  function parsed(m: unknown) {
    const result = parseMap(m);
    expect(result.ok).toBe(true);
    if (!result.map) throw new Error("지도가 없어요");
    expect(checkMap(result.map)).toEqual([]);
    const parents = Object.fromEntries(
      result.map.regions.map((r) => [r.id, r.parent ?? null]),
    );
    return { map: result.map, parents, problems: result.problems };
  }

  it("형식이 틀린 구역은 자손까지 함께 뺀다(형제·다른 대륙은 남는다)", () => {
    const { parents, problems } = parsed(
      map([
        region("server"),
        { ...region("pay", { parent: "server" }), status: "paused" } as never,
        region("pay-card", { parent: "pay" }),
        region("pay-card-3ds", { parent: "pay-card" }),
        region("auth", { parent: "server" }),
        region("web"),
      ]),
    );
    expect(parents).toEqual({ server: null, auth: "server", web: null });
    expect(problems).toEqual([
      expect.stringMatching(/^regions\[1\] \(id pay\): status: /),
      'regions[2] (id pay-card): 감싸는 구역 "pay"가 빠져 함께 뺐어요',
      'regions[3] (id pay-card-3ds): 감싸는 구역 "pay-card"가 빠져 함께 뺐어요',
    ]);
  });

  it("자손이 감싸는 구역보다 앞에 적혀 있어도 함께 뺀다", () => {
    const { parents } = parsed(
      map([
        region("leaf", { parent: "mid" }),
        region("mid", { parent: "bad" }),
        { ...region("bad"), size: 9 } as never,
        region("ok"),
      ]),
    );
    expect(parents).toEqual({ ok: null });
  });

  it("없는 parent·자기 자신을 감싼 구역은 맨 위로 올린다", () => {
    const { parents, problems } = parsed(
      map([
        region("a", { parent: "x" }),
        region("b", { parent: "b" }),
        region("c", { parent: "a" }),
      ]),
    );
    expect(parents).toEqual({ a: null, b: null, c: "a" });
    expect(problems).toEqual([
      'regions[0] (id a): parent "x"가 없어 맨 위로 올렸어요',
      "regions[1] (id b): 자기 자신을 감싸서 맨 위로 올렸어요",
    ]);
  });

  it("고리는 구역 하나만 맨 위로 올려 끊는다", () => {
    const { parents, problems } = parsed(
      map([
        region("a", { parent: "c" }),
        region("b", { parent: "a" }),
        region("c", { parent: "b" }),
        region("d", { parent: "a" }),
      ]),
    );
    // 고리 a→c→b→a에서 가장 먼저 적힌 a를 올린다. 고리 밖에서 고리로 들어오는 d는 그대로 a 아래
    expect(parents).toEqual({ a: null, b: "a", c: "b", d: "a" });
    expect(problems).toEqual([
      "regions[0] (id a): parent를 따라가면 고리가 생겨 맨 위로 올렸어요",
    ]);
  });

  it("3단을 넘는 구역은 맨 위로 올리고, 그 아래는 따라 올라간다", () => {
    const { parents, problems } = parsed(
      map([
        region("e", { parent: "d" }),
        region("a"),
        region("b", { parent: "a" }),
        region("c", { parent: "b" }),
        region("d", { parent: "c" }),
      ]),
    );
    expect(parents).toMatchObject({ d: null, e: "d" });
    expect(problems).toEqual([
      "regions[4] (id d): 4단이라(3단까지 둘 수 있어요) 맨 위로 올렸어요",
    ]);
  });

  it("겹친 구역 id는 뒤쪽만 빼고, 자손은 앞쪽에 붙는다", () => {
    const { map: m, problems } = parsed(
      map([
        region("a", { title: "앞" }),
        region("a", { title: "뒤" }),
        region("b", { parent: "a" }),
      ]),
    );
    expect(m.regions.map((r) => r.title)).toEqual(["앞", "b"]);
    expect(problems).toEqual(["regions[1] (id a): id가 앞 구역과 겹쳐 뺐어요"]);
  });

  it("http(s)가 아닌 링크는 그 링크만 뺀다(구역과 지도는 남는다)", () => {
    const { map: m, problems } = parsed(
      map([
        region("a", {
          links: [
            { label: "x", url: "javascript:alert(1)" },
            { label: "결정 0002", path: "docs/decisions/0002-payment.md" },
          ],
        }),
      ]),
    );
    expect(m.regions[0]?.links).toEqual([
      { label: "결정 0002", path: "docs/decisions/0002-payment.md" },
    ]);
    expect(problems).toEqual([
      expect.stringMatching(/^regions\[0\] \(id a\)\.links\[0\]: url: /),
    ]);
  });

  it("틀린 표지와 겹친 표지 id는 그 표지만 뺀다", () => {
    const { map: m, problems } = parsed(
      map([
        region("a", {
          signs: [
            { id: "s", type: "risk", title: "1" },
            { id: "s", type: "risk", title: "2" },
            { id: "w", type: "wish", title: "3" } as never,
          ],
        }),
      ]),
    );
    expect(m.regions[0]?.signs).toEqual([
      { id: "s", type: "risk", title: "1" },
    ]);
    expect(problems).toEqual([
      "regions[0] (id a).signs[1] (id s): id가 앞 항목과 겹쳐 뺐어요",
      expect.stringMatching(/^regions\[0\] \(id a\)\.signs\[2\] \(id w\): /),
    ]);
  });

  it("here가 가리키는 구역이 없으면 here만 뺀다", () => {
    const { map: m, problems } = parsed(
      map([region("a"), { ...region("b"), status: "?" } as never], {
        here: "b",
      }),
    );
    expect(m.here).toBeUndefined();
    expect(problems.at(-1)).toBe('here "b" 구역이 없어 뺐어요');
  });
});

describe("checkMap", () => {
  it("맞는 지도는 문제가 없다", () => {
    const m = map(
      [region("a"), region("b", { parent: "a" }), region("c", { parent: "b" })],
      { here: "c" },
    );
    expect(checkMap(m)).toEqual([]);
  });

  it("id 중복", () => {
    expect(checkMap(map([region("a"), region("a")]))).toEqual([
      '구역 id "a"가 겹쳐요',
    ]);
  });

  it("없는 parent", () => {
    expect(checkMap(map([region("a", { parent: "x" })]))).toEqual([
      '구역 "a"의 parent "x"가 없어요',
    ]);
  });

  it("고리는 한 번만 알린다", () => {
    const problems = checkMap(
      map([region("a", { parent: "b" }), region("b", { parent: "a" })]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("고리");
  });

  it("자기 자신을 parent로", () => {
    expect(checkMap(map([region("a", { parent: "a" })]))).toEqual([
      '구역 "a"가 자기 자신을 감싸요',
    ]);
  });

  it("4단은 안 된다", () => {
    const problems = checkMap(
      map([
        region("a"),
        region("b", { parent: "a" }),
        region("c", { parent: "b" }),
        region("d", { parent: "c" }),
      ]),
    );
    expect(problems).toEqual(['구역 "d"가 4단이에요. 3단까지 둘 수 있어요']);
  });

  it("없는 here, 겹치는 표지 id", () => {
    const problems = checkMap(
      map(
        [
          region("a", {
            signs: [
              { id: "s", type: "risk", title: "1" },
              { id: "s", type: "risk", title: "2" },
            ],
          }),
        ],
        { here: "zz" },
      ),
    );
    expect(problems).toEqual([
      'here "zz" 구역이 없어요',
      '구역 "a"에 표지 id "s"가 겹쳐요',
    ]);
  });
});

describe("mapProgress", () => {
  it("size 합으로 센다", () => {
    const m = map([
      region("a", { status: "done", size: 3 }),
      region("b", { status: "building", size: 1 }),
    ]);
    expect(mapProgress(m)).toEqual({ done: 3, total: 4, ratio: 0.75 });
  });

  it("자식이 있는 구역은 자식으로만 센다", () => {
    const m = map([
      region("p", { status: "done", size: 5 }),
      region("c1", { parent: "p", status: "done", size: 1 }),
      region("c2", { parent: "p", status: "fog", size: 1 }),
    ]);
    expect(mapProgress(m)).toEqual({ done: 1, total: 2, ratio: 0.5 });
  });

  it("버린 구역과 그 아래는 뺀다", () => {
    const m = map([
      region("a", { status: "done", size: 2 }),
      region("x", { status: "dropped", size: 5 }),
      region("p", { status: "dropped" }),
      region("pc", { parent: "p", status: "fog", size: 4 }),
    ]);
    expect(mapProgress(m)).toEqual({ done: 2, total: 2, ratio: 1 });
  });

  it("자식이 모두 버림이면 자기 크기로 센다", () => {
    const m = map([
      region("p", { status: "building", size: 3 }),
      region("c", { parent: "p", status: "dropped" }),
    ]);
    expect(mapProgress(m)).toEqual({ done: 0, total: 3, ratio: 0 });
  });

  it("빈 지도는 0", () => {
    expect(mapProgress(map([])).ratio).toBe(0);
  });
});

describe("summarizeMap", () => {
  it("구역·발견·내가 정할 갈림길을 센다", () => {
    const m = map([
      region("a", {
        status: "done",
        signs: [
          { id: "f1", type: "fork", title: "t", owner: "me", status: "open" },
          {
            id: "f2",
            type: "fork",
            title: "t",
            owner: "me",
            status: "decided",
          },
          { id: "f3", type: "fork", title: "t", owner: "Lee", status: "open" },
        ],
      }),
      region("b", { found: "2026-10-25" }),
      region("x", {
        status: "dropped",
        found: "2026-10-25",
        signs: [
          { id: "f", type: "fork", title: "t", owner: "me", status: "open" },
        ],
      }),
    ]);
    expect(summarizeMap(m)).toEqual({
      progress: 0.5,
      regions: 2,
      found: 1,
      forksForMe: 1,
    });
  });
});

describe("isNewFound", () => {
  const now = Date.parse("2026-10-29T12:00:00+09:00");
  it("7일 안이면 새 땅", () => {
    expect(isNewFound(region("a", { found: "2026-10-25" }), now)).toBe(true);
    expect(isNewFound(region("a", { found: "2026-10-10" }), now)).toBe(false);
    expect(isNewFound(region("a"), now)).toBe(false);
  });

  it("날짜만 적은 found는 이 컴퓨터의 자정부터 센다", () => {
    const found = "2026-10-22";
    const midnight = new Date(2026, 9, 22).getTime();
    expect(isNewFound(region("a", { found }), midnight + 7 * 86_400_000)).toBe(
      true,
    );
    expect(
      isNewFound(region("a", { found }), midnight + 7 * 86_400_000 + 1),
    ).toBe(false);
  });
});
