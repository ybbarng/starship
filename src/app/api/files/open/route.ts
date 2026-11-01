// 파일 열기: POST /api/files/open {path}. 맥의 `open`으로 맞는 프로그램(미리보기·QuickTime 등)에서 연다.
// 셸을 거치지 않는다(execFile). 검사 규칙은 src/server/files.ts, 설계는 docs/files.md.
import { execFile } from "node:child_process";
import { z } from "zod";
import {
  boundToLoopback,
  fileRoots,
  isLoopbackHost,
  resolveFile,
} from "@/server/files";
import { isSameOrigin } from "@/server/origin";
import { sourceInfo } from "@/server/source";

const Body = z.object({ path: z.string() });

function openOnMac(file: string): Promise<string | null> {
  return new Promise((resolve) => {
    // "--" 뒤에 두어 경로가 옵션으로 읽히지 않게 한다.
    execFile("/usr/bin/open", ["--", file], { timeout: 10_000 }, (err) =>
      resolve(err ? err.message : null),
    );
  });
}

export async function POST(request: Request) {
  // 다른 사이트가 이 로컬 앱을 거쳐 내 맥에서 파일을 열지 못하게 막는다.
  if (!isSameOrigin(request) || !isLoopbackHost(request.headers.get("host"))) {
    return Response.json(
      { ok: false, note: "다른 출처의 요청" },
      { status: 403 },
    );
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, note: "잘못된 요청" }, { status: 400 });
  }
  const { roots, demo } = fileRoots(
    process.env.STARSHIP_FILE_ROOTS,
    sourceInfo().mode,
  );
  const file = await resolveFile(parsed.data.path, roots, "open");
  if (!file.ok) {
    return Response.json(
      { ok: false, note: file.reason },
      { status: file.status },
    );
  }
  // 데모는 검사까지만 하고 실제로 열지 않는다(데모를 띄운 기계에서 창이 뜨지 않게).
  if (demo) {
    return Response.json({ ok: true, note: "데모라 실제로 열지는 않았어요" });
  }
  // 모든 주소로 뜬 서버는 다른 기기가 Host·Origin을 꾸며 내 맥에서 파일을 열 수 있다.
  if (!boundToLoopback()) {
    return Response.json(
      {
        ok: false,
        note: "서버가 이 컴퓨터 밖에도 열려 있어 열지 않아요(-H 127.0.0.1로 띄우세요)",
      },
      { status: 403 },
    );
  }
  if (process.platform !== "darwin") {
    return Response.json(
      { ok: false, note: "열기는 맥에서만 돼요" },
      { status: 501 },
    );
  }
  const err = await openOnMac(file.real);
  return err
    ? Response.json({ ok: false, note: "열지 못했어요" }, { status: 500 })
    : Response.json({ ok: true, note: "맥에서 열었어요" });
}
