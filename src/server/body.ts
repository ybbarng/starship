// 요청 본문을 크기 상한을 두고 읽는다. 동작·파일 열기 요청은 몇백 바이트라 64KB면 넉넉하다.

export const MAX_BODY_BYTES = 64 * 1024;

export type BodyRead =
  | { ok: true; value: unknown }
  | { ok: false; status: 413 };

/**
 * JSON 본문을 읽는다. Content-Length가 상한을 넘으면 읽지 않고 413, 길이를 적지 않았으면 읽은 뒤 잰다.
 * JSON이 아니면 value가 null이다(형식 검사에서 400으로 걸린다).
 */
export async function readJsonBody(
  request: Request,
  max = MAX_BODY_BYTES,
): Promise<BodyRead> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max)
    return { ok: false, status: 413 };
  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).byteLength > max)
    return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: true, value: null };
  }
}
