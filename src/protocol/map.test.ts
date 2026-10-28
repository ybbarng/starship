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

  it("형식이 틀리면 어디가 틀렸는지 알려 준다", () => {
    const result = parseMap({
      map: "starship-map/1",
      title: "t",
      regions: [{ id: "a", title: "a", status: "paused", size: 9 }],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("regions.0.status");
    expect(result.problems.join("\n")).toContain("regions.0.size");
  });

  it("다른 형식 이름은 받지 않는다", () => {
    expect(
      parseMap({ map: "starship-map/2", title: "t", regions: [] }).ok,
    ).toBe(false);
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

  it("parseMap도 짜임 문제로 거절한다", () => {
    const result = parseMap(map([region("a"), region("a")]));
    expect(result.ok).toBe(false);
    expect(result.map).toBeNull();
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
});
