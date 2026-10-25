/** 요청의 Origin이 이 앱 자신(Host)과 같을 때만 true. Origin이 없으면 거절한다. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
