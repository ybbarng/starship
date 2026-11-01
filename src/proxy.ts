// 앱 전체 Host 검사: 이 컴퓨터 자신(127.0.0.1·localhost·[::1])을 가리키는 Host만 받는다.
// DNS 재바인딩(남의 도메인이 127.0.0.1을 가리키게 해 브라우저가 그 사이트 이름으로 이 서버를 부르는 것)을 막는다.
// 조종석을 다른 기기에서 보지 않기로 해 로그인 없이 이것만 둔다(2026-11-01 사용자 결정, 비서 전달).
// 다른 기기(폰·Tailscale)에서 보게 되면 이 검사를 넓히기 전에 로그인부터 둔다. 설계: docs/files.md.
import { type NextRequest, NextResponse } from "next/server";
import { isLoopbackHost } from "@/server/host";

export function proxy(request: NextRequest) {
  if (isLoopbackHost(request.headers.get("host"))) return NextResponse.next();
  return new NextResponse(
    "이 컴퓨터 자신(127.0.0.1·localhost)으로만 열 수 있어요",
    {
      status: 421,
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  );
}
