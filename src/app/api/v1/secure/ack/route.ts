// 보안 구역 "확인함" 표시. 빨간 줄을 사용자가 봤다고 표시하거나(undo면) 거둔다. 기록은 지우지 않는다.
// 데모 모드는 서버 메모리, 서버 연결 모드는 비서 서버의 /api/secure/ack에 보낸다(섞지 않는다).
// 설명: docs/secure.md.
import { SecureAckBody } from "@/protocol/secure";
import { readJsonBody } from "@/server/body";
import { isSameOrigin } from "@/server/origin";
import { ackSecure } from "@/server/secure";
import { ACTION_TIMEOUT_MS } from "@/server/upstream";

export const dynamic = "force-dynamic";

function reason(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError")
    return `비서 서버가 ${ACTION_TIMEOUT_MS / 1000}초 안에 답하지 않았어요`;
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(request: Request) {
  // 다른 사이트가 이 로컬 앱을 거쳐 표시를 바꾸지 못하게 막는다.
  if (!isSameOrigin(request))
    return Response.json({ error: "다른 출처의 요청" }, { status: 403 });
  const read = await readJsonBody(request);
  if (!read.ok)
    return Response.json(
      { error: "요청이 너무 커요" },
      { status: read.status },
    );
  const parsed = SecureAckBody.safeParse(read.value);
  if (!parsed.success)
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  try {
    return Response.json(
      await ackSecure(parsed.data.ids, parsed.data.undo ?? false),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: reason(error) }, { status: 502 });
  }
}
