import { describe, expect, it } from "vitest";
import type { Desk, Doing } from "@/protocol/desk";
import type { Crew } from "@/protocol/v1";
import {
  FAN,
  fanOffset,
  MAX_TEAMS,
  placeTeams,
  type TeamOnMap,
  teamRegion,
} from "./teams";

/** 소장 web-shop 지도에 있는 구역(src/demo/map.ts) */
const REGIONS = new Set(["server-coupon", "front-cart", "server-payment"]);
const has = (id: string) => REGIONS.has(id);

function desk(doing: Doing[]): Desk {
  return {
    desk: "starship-desk/1",
    updatedAt: "2026-11-06T10:00:00+09:00",
    waiting: [],
    doing,
  };
}

function team(id: string, doing: Doing[] | null): TeamOnMap {
  const crew: Crew = {
    id,
    name: id,
    context: "work",
    status: "working",
    onDeck: true,
    actions: ["focus", "brief"],
    foreman: "web-shop",
  };
  return { crew, desk: doing ? desk(doing) : null };
}

describe("teamRegion: 작업팀이 서는 구역", () => {
  it("region이 있는 첫 doing 항목의 구역", () => {
    expect(
      teamRegion(
        desk([
          { id: "a", title: "회의 기록 정리" },
          { id: "b", title: "쿠폰 계산", region: "server-coupon" },
          { id: "c", title: "장바구니", region: "front-cart" },
        ]),
        has,
      ),
    ).toBe("server-coupon");
  });

  it("region이 하나도 없거나 책상이 없으면 착륙선 옆(null)", () => {
    expect(teamRegion(desk([{ id: "a", title: "살피는 중" }]), has)).toBeNull();
    expect(teamRegion(desk([]), has)).toBeNull();
    expect(teamRegion(null, has)).toBeNull();
    expect(teamRegion(undefined, has)).toBeNull();
  });

  it("첫 일터가 지도에 없으면 다음 항목으로 넘어가지 않고 착륙선 옆", () => {
    expect(
      teamRegion(
        desk([
          { id: "a", title: "새 구역", region: "server-gift" },
          { id: "b", title: "쿠폰 계산", region: "server-coupon" },
        ]),
        has,
      ),
    ).toBeNull();
  });
});

describe("placeTeams: 그림 자리와 비켜 서기", () => {
  it("넷까지만 세운다", () => {
    const many = ["t1", "t2", "t3", "t4", "t5"].map((id) => team(id, null));
    expect(placeTeams(many, has)).toHaveLength(MAX_TEAMS);
  });

  it("같은 자리끼리 차례를 매기고 가운데를 0으로 고르게 편다", () => {
    const spots = placeTeams(
      [
        team("a", [{ id: "x", title: "쿠폰", region: "server-coupon" }]),
        team("b", null),
        team("c", [{ id: "y", title: "쿠폰 시험", region: "server-coupon" }]),
      ],
      has,
    );
    expect(spots.map((s) => [s.crew.id, s.region, s.nth, s.of])).toEqual([
      ["a", "server-coupon", 0, 2],
      ["b", null, 0, 1],
      ["c", "server-coupon", 1, 2],
    ]);
    expect(spots.map((s) => s.dx)).toEqual([-FAN / 2, 0, FAN / 2]);
  });

  it("소장 그림(지금 여기)이 선 구역이면 소장 오른쪽으로 줄을 선다", () => {
    const spots = placeTeams(
      [
        team("a", [{ id: "x", title: "쿠폰", region: "server-coupon" }]),
        team("b", [{ id: "y", title: "쿠폰", region: "server-coupon" }]),
      ],
      has,
      "server-coupon",
    );
    expect(spots.map((s) => [s.nth, s.of, s.dx])).toEqual([
      [1, 3, FAN],
      [2, 3, 2 * FAN],
    ]);
  });

  it("혼자 서면 비키지 않는다", () => {
    expect(fanOffset(0, 1)).toBe(0);
  });
});
