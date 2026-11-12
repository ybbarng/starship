// 나르기 기록의 출처. 데모 모드는 지어낸 기록(src/demo/relays.ts), 서버 연결 모드는 비서 서버의 기록만 쓴다.
// 두 모드를 섞지 않는다: 서버 연결 모드에서 지어낸 나르기가 보이면 진짜 일로 오해한다. 설명: docs/hq.md.
import { demoRelayLog } from "@/demo/relays";
import { RelayLog, type RelayResponse } from "@/protocol/relay";
import { sourceInfo } from "./source";
import { createShared, fetchUpstream } from "./upstream";

/** 한 번에 받을 기록 줄 수 */
export const RELAY_LIMIT = 200;

/**
 * 비서 서버의 나르기 기록 주소. 보안 기록(src/server/secure.ts)처럼 STARSHIP_SERVER_URL의 origin에 /api/relays를 붙인다.
 */
export function relaysUrl(base: string): string {
  return `${new URL(base).origin}/api/relays?limit=${RELAY_LIMIT}`;
}

const EMPTY: RelayLog = { relays: [] };

// 탭 여러 개가 몇 초마다 물어도 비서에는 1.5초에 한 번만
const shared = createShared();

/** GET /api/v1/relays 의 본문. 비서가 실패하면 던진다(라우트가 502로 바꾼다). */
export async function getRelays(now = Date.now()): Promise<RelayResponse> {
  const info = sourceInfo();
  if (info.mode === "demo")
    return {
      source: "demo",
      status: "ok",
      log: RelayLog.parse(demoRelayLog(now)),
    };
  const url = relaysUrl(info.base);
  return shared.get(url, async (): Promise<RelayResponse> => {
    const res = await fetchUpstream(url);
    if (res.status === 404)
      return { source: "remote", status: "none", log: EMPTY };
    if (!res.ok) throw new Error(`비서 서버가 ${res.status}로 답했어요`);
    const parsed = RelayLog.safeParse(await res.json().catch(() => null));
    if (!parsed.success)
      throw new Error("비서 서버의 나르기 기록 형식이 달라요");
    return { source: "remote", status: "ok", log: parsed.data };
  });
}
