import { describe, expect, it } from "vitest";
import { buildDemoLink } from "@/demo/link";
import { Snapshot } from "@/protocol/v1";
import { chainNodes, clockKst, dropLine, formatSecs } from "./model";

const now = Date.parse("2026-10-29T03:00:00+09:00");

describe("관제 링크 프로토콜", () => {
  it("데모 네 가지가 스키마를 지킨다", () => {
    for (const mode of ["ok", "warn", "down", "off"] as const) {
      const link = buildDemoLink(mode, now);
      const snap = Snapshot.parse({
        protocol: "starship/1",
        generatedAt: now,
        tasks: [],
        hails: [],
        crew: [],
        gauges: [],
        link,
      });
      expect(snap.link?.verdict).toBe(mode);
    }
  });

  it("link 형식이 틀려도 스냅샷은 받고 link만 뺀다", () => {
    const snap = Snapshot.parse({
      protocol: "starship/1",
      generatedAt: now,
      tasks: [],
      hails: [],
      crew: [],
      gauges: [],
      link: { verdict: "maybe" },
    });
    expect(snap.link).toBeUndefined();
  });
});

describe("chainNodes", () => {
  it("우주선이 맨 앞이고, 처음 끊긴 칸 뒤는 신호가 닿지 않는다", () => {
    const nodes = chainNodes(buildDemoLink("down", now));
    expect(nodes.map((n) => n.label)).toEqual([
      "우주선",
      "중계 위성",
      "지상국",
      "지구",
      "항법 신호",
    ]);
    expect(nodes.map((n) => n.cut)).toEqual([false, false, false, false, true]);
  });

  it("측정이 멈추면 우주선도 off", () => {
    expect(chainNodes(buildDemoLink("off", now))[0]?.status).toBe("off");
  });

  it("모르는 칸은 id를 그대로 이름으로", () => {
    const link = buildDemoLink("ok", now);
    link.hops.push({ id: "relay", status: "ok" });
    expect(chainNodes(link).at(-1)?.label).toBe("relay");
  });
});

describe("글", () => {
  it("끊긴 길이", () => {
    expect(formatSecs(43)).toBe("43초");
    expect(formatSecs(103)).toBe("1분 43초");
    expect(formatSecs(120)).toBe("2분");
    expect(formatSecs(3900)).toBe("1시간 5분");
  });

  it("한국 시각", () => {
    expect(clockKst(Date.parse("2026-10-29T02:17:00+09:00"))).toBe("2:17");
    expect(clockKst(Date.parse("2026-10-29T14:05:00+09:00"))).toBe("14:05");
  });

  it("오늘 끊김 줄", () => {
    expect(
      dropLine({
        today: 1,
        lastAt: Date.parse("2026-10-29T02:17:00+09:00"),
        lastSecs: 103,
      }),
    ).toBe("오늘 1번 끊김 · 마지막 1분 43초, 2:17");
    expect(dropLine({ today: 0 })).toBe("오늘 끊김 없음");
    expect(dropLine({ today: 3 })).toBe("오늘 3번 끊김");
  });
});
