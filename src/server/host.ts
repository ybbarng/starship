/** 이 컴퓨터 자신을 가리키는 이름. Host 검사(proxy.ts, 파일 끝점)와 띄운 주소 검사가 함께 쓴다. */
export const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** "127.0.0.1:7790" · "localhost" · "[::1]:7790" 처럼 이 컴퓨터 자신을 가리키는 Host인가. */
export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? "");
  return LOOPBACK.has(name.toLowerCase());
}
