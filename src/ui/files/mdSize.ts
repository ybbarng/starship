// md 보기 화면이 그려 보일 크기 상한. 넘으면 그리지 않고 날 글(새 탭)이나 열기를 권한다.
// /api/files는 200MB까지 내주지만, 그만한 md를 react-markdown으로 그리면 탭이 멈춘다.

export const MAX_MD_RENDER_BYTES = 2 * 1024 * 1024;

/** 응답의 Content-Length로 보아 그리기엔 너무 큰가. 길이를 모르면 그려 본다. */
export function mdTooBig(
  contentLength: string | null,
  max = MAX_MD_RENDER_BYTES,
): number | null {
  const n = Number(contentLength);
  return contentLength && Number.isFinite(n) && n > max ? n : null;
}

/** "3.4MB" */
export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
