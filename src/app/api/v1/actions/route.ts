import { ActionRequest } from "@/protocol/v1";
import { isSameOrigin } from "@/server/origin";
import { resetDemo, runAction, sourceInfo } from "@/server/source";

export async function POST(request: Request) {
  // 다른 사이트가 이 로컬 앱을 거쳐 동작을 보내지 못하게 막는다.
  if (!isSameOrigin(request)) {
    return Response.json(
      { ok: false, note: "다른 출처의 요청" },
      { status: 403 },
    );
  }
  const seat = new URL(request.url).searchParams.get("seat") ?? "default";
  const body: unknown = await request.json().catch(() => null);
  if (
    sourceInfo().mode === "demo" &&
    typeof body === "object" &&
    body !== null &&
    "reset" in body
  ) {
    resetDemo(seat);
    return Response.json({ ok: true, note: "데모를 처음 상태로 돌렸어요" });
  }
  const parsed = ActionRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, note: "잘못된 요청" }, { status: 400 });
  }
  return Response.json(await runAction(parsed.data, seat));
}
