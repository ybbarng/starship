// 보안 구역 기록. 데모 모드는 지어낸 기록, 서버 연결 모드는 비서 서버의 /api/secure를 중계한다(섞지 않는다).
// 비서가 끝점을 모르면(404) status: "none", 실패하면 502와 이유. 값처럼 보이는 글자는 지운 뒤 보낸다.
// 설명: docs/secure.md.
import { getSecure } from "@/server/secure";
import { READ_TIMEOUT_MS } from "@/server/upstream";

export const dynamic = "force-dynamic";

function reason(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError")
    return `비서 서버가 ${READ_TIMEOUT_MS / 1000}초 안에 답하지 않았어요`;
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function GET() {
  try {
    return Response.json(await getSecure(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json({ error: reason(error) }, { status: 502 });
  }
}
