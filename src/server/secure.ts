// 보안 구역 기록의 출처. 데모 모드는 지어낸 기록(src/demo/secure.ts), 서버 연결 모드는 비서 서버의 기록만 쓴다.
// 두 모드를 섞지 않는다: 서버 연결 모드에서 시험 기록이 보이면 진짜 보안 기록으로 오해한다.
// 내려 보내기 전에 값처럼 보이는 글자를 지운다(휴대폰으로 가는 응답에도 남지 않게). 설명: docs/secure.md.
import { demoSecureLog } from "@/demo/secure";
import { SecureLog, type SecureResponse } from "@/protocol/secure";
import { scrubArgs, scrubText } from "@/secure/secret";
import { sourceInfo } from "./source";
import { createShared, fetchUpstream } from "./upstream";

/** 한 번에 받을 기록 수 */
export const SECURE_LIMIT = 200;

/**
 * 비서 서버의 보안 기록 주소. 비서는 프로토콜 끝점을 STARSHIP_SERVER_URL(예: http://127.0.0.1:7787/starship)
 * 아래에 두고, 자기 API는 같은 서버 뿌리의 /api/ 아래에 둔다. 그래서 주소의 origin에 /api/secure를 붙인다.
 */
export function secureUrl(base: string): string {
  return `${new URL(base).origin}/api/secure?limit=${SECURE_LIMIT}`;
}

/** 값처럼 보이는 글자를 지운 기록과 지운 개수. */
export function scrubLog(log: SecureLog): { log: SecureLog; hidden: number } {
  let hidden = 0;
  const text = (s: string) => {
    const r = scrubText(s);
    hidden += r.hidden;
    return r.text;
  };
  const maybe = (s: string | undefined) => (s === undefined ? s : text(s));
  const requests = log.requests.map((r) => ({
    ...r,
    purpose: text(r.purpose),
    plan: r.plan.map(text),
    items: r.items.map((i) => ({ ...i, ref: text(i.ref) })),
    ...(r.card === undefined ? {} : { card: text(r.card) }),
  }));
  const calls = log.calls.map((c) => {
    const args = scrubArgs(c.command.args);
    hidden += args.hidden;
    return {
      ...c,
      command: { sub: text(c.command.sub), args: args.args },
      ...(c.context
        ? {
            context: {
              ...c.context,
              parentCmd: maybe(c.context.parentCmd),
            },
          }
        : {}),
    };
  });
  return { log: { ...log, requests, calls }, hidden };
}

const EMPTY: SecureLog = { requests: [], calls: [] };

// 탭 여러 개가 5초마다 물어도 비서에는 1.5초에 한 번만
const shared = createShared();

/** GET /api/v1/secure 의 본문. 비서가 실패하면 던진다(라우트가 502로 바꾼다). */
export async function getSecure(now = Date.now()): Promise<SecureResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const { log, hidden } = scrubLog(SecureLog.parse(demoSecureLog(now)));
    return { source: "demo", status: "ok", hidden, log };
  }
  const url = secureUrl(info.base);
  return shared.get(url, async (): Promise<SecureResponse> => {
    const res = await fetchUpstream(url);
    if (res.status === 404)
      return { source: "remote", status: "none", hidden: 0, log: EMPTY };
    if (!res.ok) throw new Error(`비서 서버가 ${res.status}로 답했어요`);
    const parsed = SecureLog.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new Error("비서 서버의 보안 기록 형식이 달라요");
    const { log, hidden } = scrubLog(parsed.data);
    return { source: "remote", status: "ok", hidden, log };
  });
}
