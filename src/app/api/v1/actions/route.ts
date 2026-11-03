import { ActionRequest, ActionResult } from "@/protocol/v1";
import { readJsonBody } from "@/server/body";
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
  const read = await readJsonBody(request);
  if (!read.ok) {
    return Response.json(
      { ok: false, note: "요청이 너무 커요" },
      { status: read.status },
    );
  }
  const body = read.value;
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
  // 본부가 멈췄거나(시간 초과) 꺼져 있어도 화면에는 한 줄로 알린다.
  const result = await runAction(parsed.data, seat).catch(
    (): ActionResult => ({ ok: false, note: "본부에 닿지 못했어요" }),
  );
  const checked = ActionResult.safeParse(result);
  return Response.json(
    checked.success
      ? checked.data
      : { ok: false, note: "본부의 답을 읽지 못했어요" },
  );
}
