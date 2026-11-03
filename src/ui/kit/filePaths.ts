// 글 속의 파일 경로를 찾는다. 결재함 서류의 제목·세부에 적힌 경로에 "보기·열기"를 달려고(2026-11-02 사용자 요청).
// 허용 폴더·숨김·종류 검사는 서버(/api/files, src/server/files.ts)가 한다. 여기서는 모양만 본다.

/**
 * 절대 경로·홈 경로(/ 또는 ~/로 시작, 폴더가 하나 이상, 확장자로 끝남)를 나온 순서대로, 겹치지 않게 돌려준다.
 * 경로 앞은 글 처음·빈칸·여는 괄호·따옴표·백틱이어야 한다(URL 안의 /a/b.md는 잡지 않는다).
 * 확장자 바로 뒤에 붙은 한국어 조사·문장 끝 마침표는 경로에 넣지 않는다("…/2026-10-30.md를 보세요", "…/a.png.").
 * ~/ 경로는 서버가 홈 폴더로 펼친 뒤 같은 검사를 한다(expandHome). 세션들이 경로를 ~로 적는다.
 */
export function findPaths(text: string): string[] {
  const re =
    /(?:^|[\s("'`「『[])((?:~|)\/(?:[^\s"'`()<>[\]「」『』]+\/)+[^\s"'`()<>[\]「」『』/]*?\.[A-Za-z0-9]{1,8})(?=$|[^A-Za-z0-9./_-]|\.(?:$|[^A-Za-z0-9]))/g;
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const p = m[1];
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** 파일 이름(경로 마지막 조각) */
export function baseName(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

/** 마크다운으로 그려 보여 줄 파일인가. 서버 보기 종류(VIEW_TYPES)에 있는 md만 본다. */
export function isMarkdown(p: string): boolean {
  return /\.md$/i.test(p);
}

/**
 * "보기" 단추의 주소. md는 읽기 좋게 그린 화면(/files/view, 그 화면이 /api/files를 fetch한다),
 * 나머지는 파일을 그대로 내주는 /api/files. 검사는 어느 쪽이든 /api/files가 한다.
 */
export function fileViewHref(p: string): string {
  const q = encodeURIComponent(p);
  return isMarkdown(p) ? `/files/view?path=${q}` : `/api/files?path=${q}`;
}
