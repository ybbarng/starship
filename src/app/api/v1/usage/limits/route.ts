// 계정 사용 한도(주간·5시간). 원격 모드는 본부의 {base}/v1/usage/limits를 중계하고, 데모 모드는 지어낸 값을 준다.
// 본부가 없거나(404) 처음부터 실패하면 ok:false와 빈 limits를 준다. 화면은 그때 칸을 숨긴다.
// 한 번 받은 뒤 잠깐 실패하면 마지막 성공값에 stale:true를 붙여 준다. 설명: docs/protocol.md.
import { demoLimits } from "@/demo/limits";
import { UsageLimits, type UsageLimitsResponse } from "@/protocol/limits";
import { sourceInfo } from "@/server/source";
import { keepLastGood } from "@/usage/limits";

export const dynamic = "force-dynamic";

/** 본부 값은 세션이 화면을 바꿀 때만 바뀌니 1분 동안은 다시 묻지 않는다. 실패는 15초만 기억한다 */
const OK_TTL = 60_000;
const FAIL_TTL = 15_000;

const NO_ENDPOINT = "본부가 한도 끝점을 몰라요";

const g = globalThis as typeof globalThis & {
  __starshipLimits?: { base: string; until: number; body: UsageLimitsResponse };
  /** 마지막으로 받은 성공값(본부가 잠깐 실패할 때 대신 준다) */
  __starshipLimitsGood?: { base: string; body: UsageLimitsResponse };
};

async function fromRemote(base: string): Promise<UsageLimitsResponse> {
  try {
    const res = await fetch(`${base}/v1/usage/limits`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404)
      return {
        ok: false,
        source: "remote",
        limits: [],
        note: NO_ENDPOINT,
      };
    if (!res.ok)
      return {
        ok: false,
        source: "remote",
        limits: [],
        note: `본부 ${res.status}`,
      };
    const parsed = UsageLimits.safeParse(await res.json());
    if (!parsed.success)
      return {
        ok: false,
        source: "remote",
        limits: [],
        note: "본부 응답 형식이 달라요",
      };
    return { ok: true, source: "remote", ...parsed.data };
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    return { ok: false, source: "remote", limits: [], note };
  }
}

export async function GET() {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const body: UsageLimitsResponse = {
      ok: true,
      source: "demo",
      ...demoLimits(Date.now()),
    };
    return Response.json(body);
  }
  const now = Date.now();
  const cached = g.__starshipLimits;
  if (cached && cached.base === info.base && cached.until > now)
    return Response.json(cached.body);
  const fresh = await fromRemote(info.base);
  if (fresh.ok) g.__starshipLimitsGood = { base: info.base, body: fresh };
  const good = g.__starshipLimitsGood;
  // 본부가 잠깐 실패하면 마지막 성공값을 stale로 준다(띠·주 연료통이 사라지지 않고 흐려진다).
  // 끝점을 모른다(404)는 답은 실패가 아니라 "없음"이라 그대로 준다.
  const body =
    fresh.ok || fresh.note === NO_ENDPOINT
      ? fresh
      : keepLastGood(fresh, good?.base === info.base ? good.body : undefined);
  g.__starshipLimits = {
    base: info.base,
    until: now + (fresh.ok ? OK_TTL : FAIL_TTL),
    body,
  };
  return Response.json(body);
}
