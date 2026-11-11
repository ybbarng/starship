// 선실에서 파일 바로 보기·열기. 설계: docs/files.md.
// 허용 폴더(STARSHIP_FILE_ROOTS) 안의, 숨김이 아닌, 허용 확장자 파일만 다룬다.
// 판단은 순수 함수(checkResolved 등)로 두고, 디스크를 보는 일(realpath·stat)은 resolveFile 하나에 모은다.
import { constants } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { isLoopbackHost, LOOPBACK } from "./host";

/**
 * 보기(브라우저 새 탭)에서 주는 확장자와 Content-Type.
 * html은 세션이 만든 화면 시안을 휴대폰에서도 보려고 받는다. 스크립트가 돌 수 있어 viewPolicy로 따로 가둔다.
 * svg는 받지 않는다(이미지로 걸 일이 드물고, 가둘 까닭을 늘리지 않는다).
 */
export const VIEW_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  json: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
};

/** 보기 응답의 Content-Security-Policy. 모든 파일을 이 앱과 다른 출처(sandbox)로 가둔다. */
export const VIEW_POLICY = "sandbox";

/**
 * html 보기의 Content-Security-Policy. 시안이 스크립트로 그려지니 스크립트만 허용하고,
 * allow-same-origin을 주지 않아 출처는 계속 남남이다(이 앱의 API·저장소에 닿지 못한다).
 * 바깥 연결·폼 전송·다른 파일 불러오기는 모두 막아, 담긴 스크립트가 무엇을 내보내지도 못하게 한다.
 * 그래서 옆 파일(이미지·css)이나 CDN을 부르는 html은 그 부분이 빠져 보인다.
 */
export const HTML_VIEW_POLICY = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/** 확장자별 보기 Content-Security-Policy. */
export function viewPolicy(ext: string): string {
  return ext === "html" || ext === "htm" ? HTML_VIEW_POLICY : VIEW_POLICY;
}

/**
 * 열기(맥의 맞는 프로그램)를 허용하는 확장자. 문서·이미지·영상·소리만. 실행 파일·스크립트·설치 파일은 없다.
 * html은 열면 맥 브라우저가 가두지 않고 스크립트를 돌리니 넣지 않는다(보기로 본다).
 */
export const OPEN_EXTS = new Set([
  ...Object.keys(VIEW_TYPES).filter((e) => e !== "html" && e !== "htm"),
  "heic",
  "tiff",
  "mp3",
  "m4a",
  "wav",
  "rtf",
  "docx",
  "xlsx",
  "pptx",
  "key",
  "pages",
  "numbers",
]);

/** 보기 크기 상한. 넘으면 열기로 보게 한다. */
export const MAX_VIEW_BYTES = 200 * 1024 * 1024;

export type FilePurpose = "view" | "open";

export type FileCheck =
  | { ok: true; real: string; root: string; ext: string }
  | { ok: false; status: 400 | 403 | 404 | 413; reason: string };

/* ───────────── 허용 폴더 ───────────── */

/** "~/a:/b" → 펼친 절대 경로 목록. 비었거나 상대 경로인 조각은 버린다. */
export function parseRoots(
  raw: string | undefined,
  home = homedir(),
): string[] {
  if (!raw) return [];
  return raw
    .split(":")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s === "~" ? home : s.startsWith("~/") ? path.join(home, s.slice(2)) : s,
    )
    .filter((s) => path.isAbsolute(s))
    .map((s) => path.resolve(s));
}

/** 데모 모드에서 쓰는 예시 파일 폴더. 공개 저장소에 들어 있는 지어낸 파일만 있다. */
export function demoFilesDir(cwd = process.cwd()): string {
  return path.join(cwd, "public", "demo-files");
}

/**
 * 지금 쓸 허용 폴더. STARSHIP_FILE_ROOTS가 있으면 그것만 쓴다.
 * 없으면 데모 모드에서만 예시 폴더를 쓰고(demo: true, 열기는 실제로 실행하지 않는다), 서버 모드면 비운다(모두 거절).
 */
export function fileRoots(
  env: string | undefined,
  mode: "demo" | "remote",
  cwd = process.cwd(),
): { roots: string[]; demo: boolean } {
  const roots = parseRoots(env);
  if (roots.length > 0) return { roots, demo: false };
  return mode === "demo"
    ? { roots: [demoFilesDir(cwd)], demo: true }
    : { roots: [], demo: false };
}

/* ───────────── 순수 판단 ───────────── */

/** 확장자(점 없이, 소문자). 없으면 "". */
export function extOf(p: string): string {
  return path.extname(p).slice(1).toLowerCase();
}

/** child가 root 자신이거나 그 아래인가. 둘 다 이미 풀린 절대 경로여야 한다. */
export function isInside(child: string, root: string): boolean {
  const rel = path.relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** root 아래 상대 경로에 "."으로 시작하는 조각(.ssh, .env, .git…)이 있나. */
export function hasHiddenPart(child: string, root: string): boolean {
  const parts = path.relative(root, child).split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    // 세션 작업 사본(<저장소>/.claude/worktrees/<이름>/…)은 숨김 예외. 사본 안의 파일만 받고
    // (뒤에 조각이 더 있어야 한다), 그 아래의 .git·.env 같은 숨김 조각은 계속 막는다(2026-11-01 비서 요청).
    if (
      parts[i] === ".claude" &&
      parts[i + 1] === "worktrees" &&
      !(parts[i + 2] ?? ".").startsWith(".") &&
      i + 3 < parts.length
    ) {
      i += 2;
      continue;
    }
    if (parts[i]?.startsWith(".")) return true;
  }
  return false;
}

/**
 * "~/a/b.md"를 홈 아래 경로로 펼친다. 세션들이 경로를 ~로 적어서 받는다(2026-11-02).
 * path.join을 쓰지 않고 이어 붙인다. join은 ".."을 미리 풀어 버려 checkInput의 ".." 검사를 빠져나가게 한다("~/../x").
 */
export function expandHome(input: unknown, home = homedir()): unknown {
  return typeof input === "string" && input.startsWith("~/")
    ? `${home.replace(/\/+$/, "")}/${input.slice(2)}`
    : input;
}

/** 받은 경로 글 자체를 본다: 절대 경로인가, ".." 조각이나 NUL이 없나. */
export function checkInput(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 4096)
    return "경로가 비었거나 너무 길어요";
  if (input.includes("\0")) return "경로에 쓸 수 없는 글자가 있어요";
  if (!path.isAbsolute(input)) return "절대 경로만 받아요";
  if (input.split("/").includes("..")) return "..은 쓸 수 없어요";
  return null;
}

/**
 * realpath로 푼 경로와 풀린 허용 폴더들로 판단한다.
 * 허용 폴더 밖·숨김·허용하지 않는 확장자면 거절. 확장자는 풀린 실제 파일 이름으로 본다
 * (a.pdf라는 심볼릭 링크가 b.sh를 가리키면 sh로 본다).
 */
export function checkResolved(
  real: string,
  realRoots: string[],
  purpose: FilePurpose,
): FileCheck {
  const root = realRoots.find((r) => isInside(real, r));
  if (!root) return { ok: false, status: 403, reason: "허용 폴더 밖이에요" };
  if (real === root)
    return { ok: false, status: 403, reason: "폴더는 열 수 없어요" };
  if (hasHiddenPart(real, root))
    return { ok: false, status: 403, reason: "숨김 파일·폴더예요" };
  const ext = extOf(real);
  const allowed = purpose === "view" ? ext in VIEW_TYPES : OPEN_EXTS.has(ext);
  if (!allowed)
    return {
      ok: false,
      status: 403,
      reason: `${purpose === "view" ? "보기" : "열기"}를 허용하지 않는 종류예요(.${ext || "확장자 없음"})`,
    };
  return { ok: true, real, root, ext };
}

/* ───────────── 디스크 보기 ───────────── */

async function realOrNull(p: string): Promise<string | null> {
  try {
    return await realpath(p);
  } catch {
    return null;
  }
}

/**
 * 받은 경로를 검사해 실제 파일 경로를 돌려준다.
 * ① 글 검사 ② 경로와 허용 폴더를 realpath로 풀기(심볼릭 링크 탈출 막기) ③ 순수 판단
 * ④ 보통 파일인지(폴더·.app·장치 거절) ⑤ 열기는 실행 권한이 붙은 파일도 거절 ⑥ 보기는 크기 상한.
 */
export async function resolveFile(
  input: unknown,
  roots: string[],
  purpose: FilePurpose,
): Promise<FileCheck & { size?: number }> {
  input = expandHome(input);
  const bad = checkInput(input);
  if (bad) return { ok: false, status: 400, reason: bad };
  if (roots.length === 0)
    return { ok: false, status: 403, reason: "허용 폴더가 설정되지 않았어요" };
  const realRoots = (await Promise.all(roots.map(realOrNull))).filter(
    (r): r is string => r !== null,
  );
  const real = await realOrNull(input as string);
  if (!real) return { ok: false, status: 404, reason: "파일이 없어요" };
  const checked = checkResolved(real, realRoots, purpose);
  if (!checked.ok) return checked;
  const st = await stat(real).catch(() => null);
  if (!st) return { ok: false, status: 404, reason: "파일이 없어요" };
  if (!st.isFile())
    return { ok: false, status: 403, reason: "보통 파일만 다뤄요" };
  if (
    purpose === "open" &&
    st.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)
  )
    return { ok: false, status: 403, reason: "실행 권한이 붙은 파일이에요" };
  if (purpose === "view" && st.size > MAX_VIEW_BYTES)
    return {
      ok: false,
      status: 413,
      reason: "보기에는 너무 커요. 열기로 보세요",
    };
  return { ...checked, size: st.size };
}

/* ───────────── 보기 응답 도움 ───────────── */

/** "bytes=a-b" 한 구간만 읽는다. 못 읽으면 null(전체를 준다), 범위 밖이면 "bad". */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "bad" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "bad";
  return { start, end };
}

export { isLoopbackHost };

/**
 * 서버를 이 컴퓨터 자신(-H 127.0.0.1 등)에만 열고 띄웠나.
 * ① 띄울 때 인자(-H·--hostname, 여러 개면 next처럼 마지막 것)가 있으면 그 값이 이 컴퓨터 자신이어야 하고,
 *    STARSHIP_BIND도 있으면 그것까지 이 컴퓨터 자신일 때만 true. 인자가 실제로 묶은 주소라 밝힌 값보다 앞선다.
 * ② 인자가 없으면 STARSHIP_BIND 환경 변수(띄우는 쪽이 밝힌 값) ③ 그것도 없으면 HOSTNAME 환경 변수.
 * 다 없으면 모든 주소로 뜬 것으로 보고 false.
 * `next dev`는 서버를 자식 프로세스로 띄우며 인자를 넘기지 않아 ①이 보이지 않는다(next/dist/cli/next-dev.js). 그래서 ②를 둔다.
 * 전에는 ②를 ①보다 먼저 봐서, 스크립트가 붙인 STARSHIP_BIND=127.0.0.1 때문에 -H 0.0.0.0으로 띄워도 파일을 내줬다(2026-11-03).
 * 모든 주소로 뜨면 같은 Wi-Fi·VPN의 다른 기기가 Host를 꾸며 들어올 수 있어 파일을 내주지 않는다(2026-11-01 비서 지적).
 */
export function boundToLoopback(
  argv: readonly string[] = process.argv,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const loop = (h: string) => LOOPBACK.has(h.trim().toLowerCase());
  const bind = env.STARSHIP_BIND?.trim() || undefined;
  const host = lastHostArg(argv);
  if (host !== undefined)
    return loop(host) && (bind === undefined || loop(bind));
  if (bind !== undefined) return loop(bind);
  return env.HOSTNAME !== undefined && loop(env.HOSTNAME);
}

/** 인자 가운데 마지막 -H·--hostname 값. next도 같은 이름을 여러 번 주면 마지막 것을 쓴다. 없으면 undefined */
export function lastHostArg(argv: readonly string[]): string | undefined {
  let host: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "-H" || a === "--hostname") host = argv[i + 1] ?? "";
    else if (a.startsWith("--hostname=")) host = a.slice("--hostname=".length);
  }
  return host;
}

/**
 * 보기 요청을 믿어도 되나: 같은 출처에서 연 것(Sec-Fetch-Site same-origin)이고 Host가 이 컴퓨터 자신일 때만.
 * "none"(주소창에 직접 친 것)은 브라우저가 아닌 클라이언트가 마음대로 넣을 수 있어 받지 않는다.
 * Host를 보면 DNS 재바인딩(남의 도메인이 127.0.0.1을 가리키게 하는 것)도 막힌다.
 */
export function isTrustedFetch(request: Request): boolean {
  return (
    request.headers.get("sec-fetch-site") === "same-origin" &&
    isLoopbackHost(request.headers.get("host"))
  );
}
