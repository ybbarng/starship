// 데모 모드의 관제 링크(회선 상태). SSID와 장소는 지어낸 것이다.
// 주소 뒤 ?link=ok|warn|down|off 로 네 가지 모습을 고른다. 기본은 ok(오늘 한 번 끊겼다 돌아옴).
import type { Link } from "@/protocol/v1";

const MIN = 60_000;

export type LinkMode = Link["verdict"];

export function parseLinkMode(value: string | null | undefined): LinkMode {
  return value === "warn" || value === "down" || value === "off" ? value : "ok";
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
