// 파일 보기: GET /api/files?path=<절대 경로>. 브라우저가 내려받지 않고 새 탭에서 바로 보여 준다.
// 검사 규칙은 src/server/files.ts, 설계는 docs/files.md.
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  boundToLoopback,
  fileRoots,
  isTrustedFetch,
  parseRange,
  resolveFile,
  VIEW_POLICY,
  VIEW_TYPES,
  viewPolicy,
} from "@/server/files";
import { sourceInfo } from "@/server/source";

/** 모든 응답에 붙인다. 파일 안 내용이 이 앱의 출처로 스크립트를 돌리지 못하게 한다. */
const SAFE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": VIEW_POLICY,
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function fail(status: number, reason: string) {
  return new Response(reason, {
    status,
    headers: { ...SAFE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  // 다른 사이트가 <img>·fetch로 내 파일을 끌어가지 못하게 막는다.
  if (!isTrustedFetch(request)) return fail(403, "다른 출처의 요청");
  const input = new URL(request.url).searchParams.get("path");
  const { roots, demo } = fileRoots(
    process.env.STARSHIP_FILE_ROOTS,
    sourceInfo().mode,
  );
  // 모든 주소로 뜬 서버는 다른 기기가 Host를 꾸며 들어올 수 있다. 데모 예시 파일만 예외.
  if (!demo && !boundToLoopback())
    return fail(
      403,
      "서버가 이 컴퓨터 밖에도 열려 있어 파일을 내주지 않아요(-H 127.0.0.1로 띄우세요)",
    );
  const file = await resolveFile(input, roots, "view");
  if (!file.ok) return fail(file.status, file.reason);

  const size = file.size ?? 0;
  const name = encodeURIComponent(path.basename(file.real));
  const headers: Record<string, string> = {
    ...SAFE_HEADERS,
    "Content-Security-Policy": viewPolicy(file.ext),
    "Content-Type": VIEW_TYPES[file.ext] ?? "text/plain; charset=utf-8",
    "Content-Disposition": `inline; filename*=UTF-8''${name}`,
    "Accept-Ranges": "bytes",
  };

  // 동영상 앞뒤 넘기기를 위해 구간 요청(Range) 하나를 받는다.
  const range = parseRange(request.headers.get("range"), size);
  if (range === "bad") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const body =
    size === 0
      ? null
      : (Readable.toWeb(
          createReadStream(file.real, { start, end }),
        ) as ReadableStream);
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "Content-Length": String(size === 0 ? 0 : end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
