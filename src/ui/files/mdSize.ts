// md 보기 화면이 그려 보일 크기 상한. 넘으면 그리지 않고 날 글(새 탭)이나 열기를 권한다.
// /api/files는 200MB까지 내주지만, 그만한 md를 react-markdown으로 그리면 탭이 멈춘다.

export const MAX_MD_RENDER_BYTES = 2 * 1024 * 1024;

/**
 * 그리기엔 너무 큰가(너무 크면 그 바이트 수). 응답의 Content-Length로 보고, 길이를 모르면
 * 받은 글(received)의 UTF-8 바이트 수로 다시 본다(2026-11-03, 전에는 길이를 모르면 그냥 그렸다).
 * 길이도 받은 글도 없으면 그려 본다.
 */
export function mdTooBig(
  contentLength: string | null,
  max = MAX_MD_RENDER_BYTES,
  received?: string,
): number | null {
  const n = Number(contentLength);
  if (contentLength && Number.isFinite(n)) return n > max ? n : null;
  if (received === undefined) return null;
  const bytes = new TextEncoder().encode(received).byteLength;
  return bytes > max ? bytes : null;
}

/** "3.4MB" */
export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
