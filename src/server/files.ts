// 선실에서 파일 바로 보기·열기. 설계: docs/files.md.
// 허용 폴더(STARSHIP_FILE_ROOTS) 안의, 숨김이 아닌, 허용 확장자 파일만 다룬다.
// 판단은 순수 함수(checkResolved 등)로 두고, 디스크를 보는 일(realpath·stat)은 resolveFile 하나에 모은다.
import { constants } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** 보기(브라우저 새 탭)에서 주는 확장자와 Content-Type. svg·html은 스크립트를 담을 수 있어 넣지 않는다. */
export const VIEW_TYPES: Record<string, string> = {
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

/** 열기(맥의 맞는 프로그램)를 허용하는 확장자. 문서·이미지·영상·소리만. 실행 파일·스크립트·설치 파일은 없다. */
export const OPEN_EXTS = new Set([
  ...Object.keys(VIEW_TYPES),
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
  return path
    .relative(root, child)
    .split(path.sep)
    .some((part) => part.startsWith("."));
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

/** 다른 사이트가 &lt;img&gt;·fetch로 이 끝점을 부르지 못하게. 같은 출처거나 주소창에서 직접 연 것만. */
export function isTrustedFetch(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
