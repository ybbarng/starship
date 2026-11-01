import { describe, expect, it } from "vitest";
import { buildDemoLink } from "@/demo/link";
import { Link, Snapshot } from "@/protocol/v1";
import {
  chainNodes,
  clockKst,
  dropLine,
  formatSecs,
  HOP_MEANING,
  linkProblems,
  verdictDetail,
  vpnDetail,
  vpnOnlyProblem,
} from "./model";

const now = Date.parse("2026-10-29T03:00:00+09:00");

describe("관제 링크 프로토콜", () => {
  it("데모 여섯 가지가 스키마를 지킨다", () => {
    for (const mode of [
      "ok",
      "warn",
      "down",
      "off",
      "vpn-warn",
      "vpn-down",
    ] as const) {
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
      if (mode === "vpn-warn" || mode === "vpn-down") {
        // 인터넷은 정상이고 회사 VPN만 문제다.
        expect(snap.link?.verdict).toBe("ok");
        expect(snap.link?.vpn?.status).toBe(
          mode === "vpn-warn" ? "warn" : "error",
        );
      } else expect(snap.link?.verdict).toBe(mode);
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

describe("회사 VPN", () => {
  it("비서가 주는 값을 그대로 받는다", () => {
    const link = Link.parse({
      ...buildDemoLink("ok", now),
      vpn: { status: "ok", keyDays: 7, routers: { online: 3, total: 3 } },
    });
    expect(link.vpn).toEqual({
      status: "ok",
      keyDays: 7,
      routers: { online: 3, total: 3 },
    });
  });

  it("vpn 모양이 틀려도 링크 전체는 버리지 않는다", () => {
    const link = Link.parse({
      ...buildDemoLink("ok", now),
      vpn: { status: "?" },
    });
    expect(link.vpn).toBeUndefined();
    expect(link.verdict).toBe("ok");
  });

  it("작은 글: 키 남은 날과 라우터, 3일 안이면 '남음'", () => {
    expect(
      vpnDetail({ status: "ok", keyDays: 7, routers: { online: 3, total: 3 } }),
    ).toBe("키 7일 · 라우터 3/3");
    expect(vpnDetail({ status: "warn", keyDays: 2 })).toBe("키 2일 남음");
    expect(vpnDetail({ status: "error" })).toBe("");
  });

  it("인터넷은 되는데 VPN만 문제일 때를 가른다", () => {
    expect(vpnOnlyProblem(buildDemoLink("vpn-down", now))).toBe(true);
    expect(vpnOnlyProblem(buildDemoLink("vpn-warn", now))).toBe(true);
    expect(vpnOnlyProblem(buildDemoLink("ok", now))).toBe(false);
    // 인터넷이 끊겼으면 VPN 문제는 그 결과라 따로 가르지 않는다.
    expect(vpnOnlyProblem(buildDemoLink("down", now))).toBe(false);
  });
});

describe("칸의 실제 뜻", () => {
  it("사슬의 칸마다 마우스를 올리면 볼 뜻이 있다", () => {
    for (const n of chainNodes(buildDemoLink("ok", now)))
      expect(HOP_MEANING[n.id], n.id).toBeTruthy();
  });
});

describe("회선 불안 설명", () => {
  it("주의·끊김인 칸마다 이유를 모으고 원인을 붙인다", () => {
    const text = verdictDetail(buildDemoLink("down", now));
    expect(text).toContain(
      "지구(인터넷): 공유기 너머로 보낸 핑이 모두 돌아오지 않음",
    );
    expect(text).toContain(
      "원인: 공유기까지는 닿는데 그 너머 인터넷이 끊겼어요",
    );
  });
  it("정상이면 문제 줄 없이 뜻만", () => {
    expect(linkProblems(buildDemoLink("ok", now))).toEqual([]);
  });
});
