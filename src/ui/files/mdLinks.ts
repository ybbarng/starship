// md 보기 화면의 링크 풀기와 제목 id(2026-11-03). 설계: docs/files.md "md 보기 화면".
// 여기서는 글만 다룬다. 허용 폴더·숨김·종류 검사는 풀린 경로를 받은 서버(/api/files)가 그대로 한다.

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * md 속 상대 경로 링크(`map.md`, `./a/b.md#절`, `../x.md`)를 지금 파일의 폴더 기준으로 풀어
 * 절대 경로(또는 `~/` 경로)와 `#` 뒤 조각으로 나눈다.
 * 풀 수 없으면 null: 주소 scheme이 있거나, `/`·`~`로 시작하거나(상대 경로가 아님),
 * 경로가 비었거나, `..`이 맨 위 폴더를 넘거나, 지금 파일이 절대·홈 경로가 아닐 때.
 * `?` 뒤는 버린다. `%20` 같은 글은 풀어 둔다(못 풀면 적힌 그대로).
 */
export function resolveMdLink(
  current: string,
  href: string,
): { path: string; hash?: string } | null {
  if (!href || SCHEME.test(href) || /^[/~#]/.test(href)) return null;
  const at = href.indexOf("#");
  const rawPath = (at < 0 ? href : href.slice(0, at)).split("?")[0] ?? "";
  const rawHash = at < 0 ? "" : href.slice(at + 1);
  if (!rawPath) return null;

  let prefix: string;
  let rest: string;
  if (current.startsWith("~/")) {
    prefix = "~/";
    rest = current.slice(2);
  } else if (current.startsWith("/")) {
    prefix = "/";
    rest = current.slice(1);
  } else return null;

  // 지금 파일 이름을 떼어 폴더만 남긴다
  const dir = rest.split("/").filter(Boolean).slice(0, -1);
  for (const part of decode(rawPath).split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (dir.length === 0) return null;
      dir.pop();
    } else dir.push(part);
  }
  if (dir.length === 0) return null;
  const path = prefix + dir.join("/");
  return rawHash ? { path, hash: decode(rawHash) } : { path };
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * 제목 글을 GitHub식 id로: 소문자로, 글자·숫자·`-`·`_`·빈칸 밖의 문장부호는 빼고, 빈칸은 `-`로.
 * 한글 같은 다른 글자는 그대로 둔다.
 */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** 한 문서 안에서 쓰는 id 만들기. 같은 id가 또 나오면 `-1`, `-2`를 붙인다(GitHub과 같은 규칙). */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugOf(text);
    let id = base;
    let n = seen.get(base) ?? 0;
    while (seen.has(id)) {
      n += 1;
      id = `${base}-${n}`;
    }
    seen.set(base, n);
    seen.set(id, 0);
    return id;
  };
}
