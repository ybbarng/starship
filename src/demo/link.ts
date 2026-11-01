// 데모 모드의 관제 링크(회선 상태). SSID와 장소는 지어낸 것이다.
// 주소 뒤 ?link=ok|warn|down|off|vpn-warn|vpn-down 으로 모습을 고른다. 기본은 ok(오늘 한 번 끊겼다 돌아옴).
// vpn-warn·vpn-down은 인터넷은 정상인데 회사 VPN만 문제인 경우다.
import type { Link } from "@/protocol/v1";

const MIN = 60_000;

export type LinkMode = Link["verdict"] | "vpn-warn" | "vpn-down";

const MODES: LinkMode[] = ["ok", "warn", "down", "off", "vpn-warn", "vpn-down"];

export function parseLinkMode(value: string | null | undefined): LinkMode {
  return MODES.find((m) => m === value) ?? "ok";
}

const SSID = "별빛정거장-5G";

export function buildDemoLink(mode: LinkMode, now = Date.now()): Link {
  switch (mode) {
    case "ok":
      return {
        at: now - 12_000,
        place: "home",
        verdict: "ok",
        hops: [
          { id: "wifi", status: "ok", value: SSID },
          { id: "gateway", status: "ok", value: "2ms" },
          { id: "internet", status: "ok", value: "18ms" },
          { id: "dns", status: "ok" },
        ],
        drops: { today: 1, lastAt: now - 47 * MIN, lastSecs: 103 },
        tunnel: "ok",
        vpn: { status: "ok", keyDays: 7, routers: { online: 3, total: 3 } },
      };
    case "vpn-warn":
    case "vpn-down":
      return {
        ...buildDemoLink("ok", now),
        vpn:
          mode === "vpn-warn"
            ? {
                status: "warn",
                cause: "기기 키가 2일 뒤 만료돼요. 다시 로그인해 주세요",
                keyDays: 2,
                routers: { online: 2, total: 3 },
              }
            : {
                status: "error",
                cause: "회사 망 라우터가 모두 꺼졌어요",
                keyDays: 6,
                routers: { online: 0, total: 3 },
              },
      };
    case "warn":
      return {
        at: now - 8_000,
        place: "office",
        verdict: "warn",
        cause: "인터넷까지 지연이 길어요(평소 18ms → 240ms)",
        hops: [
          { id: "wifi", status: "ok", value: SSID },
          { id: "gateway", status: "ok", value: "3ms" },
          { id: "internet", status: "warn", value: "240ms" },
          { id: "dns", status: "ok" },
        ],
        drops: { today: 0 },
        tunnel: "warn",
        vpn: { status: "ok", keyDays: 7, routers: { online: 3, total: 3 } },
      };
    case "down":
      return {
        at: now - 5_000,
        place: "home",
        verdict: "down",
        cause: "공유기까지는 닿는데 그 너머 인터넷이 끊겼어요",
        hops: [
          { id: "wifi", status: "ok", value: SSID },
          { id: "gateway", status: "ok", value: "2ms" },
          { id: "internet", status: "error" },
          { id: "dns", status: "off" },
        ],
        drops: { today: 2, lastAt: now - 2 * MIN, lastSecs: 120 },
        tunnel: "error",
        vpn: {
          status: "error",
          cause: "인터넷이 끊겨 회사 망에 닿지 않아요",
          keyDays: 7,
          routers: { online: 0, total: 3 },
        },
      };
    case "off":
      return {
        at: now - 6 * MIN,
        place: "home",
        verdict: "off",
        cause: "측정이 6분째 멈췄어요",
        hops: [
          { id: "wifi", status: "off" },
          { id: "gateway", status: "off" },
          { id: "internet", status: "off" },
          { id: "dns", status: "off" },
        ],
        drops: { today: 1, lastAt: now - 3 * 60 * MIN, lastSecs: 41 },
        tunnel: "off",
      };
  }
}
