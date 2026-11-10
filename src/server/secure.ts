// 보안 구역 기록의 출처. 데모 모드는 지어낸 기록(src/demo/secure.ts), 서버 연결 모드는 비서 서버의 기록만 쓴다.
// 두 모드를 섞지 않는다: 서버 연결 모드에서 시험 기록이 보이면 진짜 보안 기록으로 오해한다.
// 내려 보내기 전에 값처럼 보이는 글자를 지운다(휴대폰으로 가는 응답에도 남지 않게). 설명: docs/secure.md.
import { demoSecureLog } from "@/demo/secure";
import {
  type SecureAckResponse,
  SecureAckResult,
  SecureLog,
  type SecureResponse,
} from "@/protocol/secure";
import { scrubArgs, scrubText } from "@/secure/secret";
import { sourceInfo } from "./source";
import { ACTION_TIMEOUT_MS, createShared, fetchUpstream } from "./upstream";

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

/**
 * 데모의 확인함 표시. 서버 메모리에만 두고(다시 띄우면 사라진다) 데모 기록에 입힌다. 화면 확인용이다.
 * 서버 연결 모드에서는 쓰지 않는다(진짜 기록에 데모 상태를 섞지 않는다).
 */
const demoAcks = new Map<string, { at: number; by: string }>();

/** 시험에서 데모 확인함 표시를 비운다. */
export function resetDemoAcks() {
  demoAcks.clear();
}

/** 데모 기록에 확인함 표시를 입힌다. 비서처럼 확인 안 한 것은 ack: null. */
function withDemoAcks(raw: ReturnType<typeof demoSecureLog>) {
  return {
    ...raw,
    calls: raw.calls.map((c) => ({ ...c, ack: demoAcks.get(c.id) ?? null })),
  };
}

/**
 * 비서의 확인함 끝점. 보안 기록과 같이 서버 뿌리의 /api/ 아래에 있다.
 * 비서는 Origin이 자기 origin이 아니면 403으로 막는다.
 */
export function secureAckUrl(base: string): string {
  return `${new URL(base).origin}/api/secure/ack`;
}

/** 비서가 확인함 끝점을 모를 때(404)의 이유 */
export const ACK_NOT_READY = "비서가 아직 확인 표시를 받지 못해요";

/**
 * 호출 기록 id들에 확인함 표시를 하거나(undo면) 거둔다. 기록은 지우지 않는다. 같은 id를 다시 표시하면 처음 시각이 남는다.
 * demo는 서버 메모리, remote는 비서에 보낸다. 비서가 실패하면 던진다(라우트가 502로 바꾼다).
 */
export async function ackSecure(
  ids: readonly string[],
  undo = false,
  now = Date.now(),
): Promise<SecureAckResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const known = new Set(demoSecureLog(now).calls.map((c) => c.id));
    const done: string[] = [];
    const unknown: string[] = [];
    for (const id of new Set(ids)) {
      if (!known.has(id)) unknown.push(id);
      else {
        if (undo) demoAcks.delete(id);
        else if (!demoAcks.has(id))
          demoAcks.set(id, { at: now, by: "starship" });
        done.push(id);
      }
    }
    return {
      source: "demo",
      acked: undo ? [] : done,
      undone: undo ? done : [],
      unknown,
    };
  }
  const origin = new URL(info.base).origin;
  try {
    const res = await fetchUpstream(
      secureAckUrl(info.base),
      {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          ids,
          ...(undo ? { undo: true } : {}),
          by: "starship",
        }),
      },
      ACTION_TIMEOUT_MS,
    );
    if (res.status === 404) throw new Error(ACK_NOT_READY);
    if (!res.ok) throw new Error(`비서 서버가 ${res.status}로 답했어요`);
    const parsed = SecureAckResult.safeParse(
      await res.json().catch(() => null),
    );
    if (!parsed.success)
      throw new Error("비서 서버의 확인 표시 답 형식이 달라요");
    return {
      source: "remote",
      acked: parsed.data.acked ?? [],
      undone: parsed.data.undone ?? [],
      unknown: parsed.data.unknown ?? [],
    };
  } finally {
    // 다음 GET이 표시 전 기록을 다시 보이지 않게
    shared.clear();
  }
}

/** GET /api/v1/secure 의 본문. 비서가 실패하면 던진다(라우트가 502로 바꾼다). */
export async function getSecure(now = Date.now()): Promise<SecureResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const { log, hidden } = scrubLog(
      SecureLog.parse(withDemoAcks(demoSecureLog(now))),
    );
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
