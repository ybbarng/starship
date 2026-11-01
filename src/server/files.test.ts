import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  boundToLoopback,
  checkInput,
  checkResolved,
  fileRoots,
  hasHiddenPart,
  isInside,
  isLoopbackHost,
  isTrustedFetch,
  parseRange,
  parseRoots,
  resolveFile,
} from "./files";

// 임시 폴더 구조
// base/
//   root/            ← 허용 폴더
//     shot.png, doc.pdf, note.md, page.html, run.sh, tool.pdf(실행 권한), App.app/
//     .env, .git/config.txt
//     out-link.png  → base/outside/secret.png  (밖으로 나가는 링크)
//     in-link.png   → root/shot.png            (안에서 도는 링크)
//     fake.pdf      → root/run.sh              (이름만 pdf)
//     hidden-link.txt → root/.git/config.txt
//   outside/secret.png
//   root-sibling/x.png   ← 이름이 root로 시작하는 옆 폴더
let base: string;
let root: string;
const at = (...p: string[]) => path.join(root, ...p);

beforeAll(() => {
  base = realpathSync(mkdtempSync(path.join(tmpdir(), "starship-files-")));
  root = path.join(base, "root");
  mkdirSync(root);
  mkdirSync(path.join(base, "outside"));
  mkdirSync(path.join(base, "root-sibling"));
  mkdirSync(at(".git"));
  mkdirSync(at("App.app"));
  for (const f of ["shot.png", "doc.pdf", "note.md", "page.html", ".env"])
    writeFileSync(at(f), "x");
  writeFileSync(at("run.sh"), "#!/bin/sh\necho hi\n");
  writeFileSync(at("tool.pdf"), "x");
  chmodSync(at("tool.pdf"), 0o755);
  writeFileSync(at(".git", "config.txt"), "x");
  writeFileSync(path.join(base, "outside", "secret.png"), "x");
  writeFileSync(path.join(base, "root-sibling", "x.png"), "x");
  symlinkSync(path.join(base, "outside", "secret.png"), at("out-link.png"));
  symlinkSync(at("shot.png"), at("in-link.png"));
  symlinkSync(at("run.sh"), at("fake.pdf"));
  symlinkSync(at(".git", "config.txt"), at("hidden-link.txt"));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("parseRoots", () => {
  it("콜론으로 나누고 ~를 펼치고 상대 경로는 버린다", () => {
    expect(parseRoots("~/Desktop: /tmp/a/ ::rel/x:~", "/Users/me")).toEqual([
      "/Users/me/Desktop",
      "/tmp/a",
      "/Users/me",
    ]);
  });
  it("없으면 빈 목록", () => {
    expect(parseRoots(undefined)).toEqual([]);
    expect(parseRoots("")).toEqual([]);
  });
});

describe("fileRoots", () => {
  it("환경 변수가 있으면 그것만", () => {
    expect(fileRoots("/a", "demo", "/app")).toEqual({
      roots: ["/a"],
      demo: false,
    });
  });
  it("없으면 데모 모드는 예시 폴더, 서버 모드는 모두 거절", () => {
    expect(fileRoots(undefined, "demo", "/app")).toEqual({
      roots: ["/app/public/demo-files"],
      demo: true,
    });
    expect(fileRoots(undefined, "remote", "/app")).toEqual({
      roots: [],
      demo: false,
    });
  });
});

describe("순수 판단", () => {
  it("isInside는 이름이 같은 앞부분인 옆 폴더를 안으로 보지 않는다", () => {
    expect(isInside("/a/root/x.png", "/a/root")).toBe(true);
    expect(isInside("/a/root-sibling/x.png", "/a/root")).toBe(false);
    expect(isInside("/a/x.png", "/a/root")).toBe(false);
  });
  it("hasHiddenPart는 허용 폴더 아래 조각만 본다", () => {
    expect(hasHiddenPart("/h/.config/root/a.png", "/h/.config/root")).toBe(
      false,
    );
    expect(hasHiddenPart("/r/.ssh/id.txt", "/r")).toBe(true);
    expect(hasHiddenPart("/r/a/.env", "/r")).toBe(true);
  });
  it("세션 작업 사본(.claude/worktrees/<이름>/) 안의 파일만 숨김 예외", () => {
    const wt = "/r/game/.claude/worktrees/agent-a1b2";
    expect(hasHiddenPart(`${wt}/README.md`, "/r")).toBe(false);
    expect(hasHiddenPart(`${wt}/docs/shot.png`, "/r")).toBe(false);
    // 사본 안의 숨김 조각은 계속 막는다
    expect(hasHiddenPart(`${wt}/.env`, "/r")).toBe(true);
    expect(hasHiddenPart(`${wt}/.git/config`, "/r")).toBe(true);
    expect(hasHiddenPart(`${wt}/a/.ssh/id.txt`, "/r")).toBe(true);
    // .claude의 다른 곳, worktrees 바로 아래 파일, 숨김 이름의 사본은 막는다
    expect(hasHiddenPart("/r/game/.claude/settings.json", "/r")).toBe(true);
    expect(hasHiddenPart("/r/game/.claude/worktrees/x.md", "/r")).toBe(true);
    expect(hasHiddenPart("/r/game/.claude/worktrees/.hidden/a.md", "/r")).toBe(
      true,
    );
  });
  it("checkInput은 상대 경로·..·NUL을 거절한다", () => {
    expect(checkInput("/a/b.png")).toBeNull();
    expect(checkInput("a/b.png")).not.toBeNull();
    expect(checkInput("/a/../etc/passwd")).not.toBeNull();
    expect(checkInput("/a/b\0.png")).not.toBeNull();
    expect(checkInput(42)).not.toBeNull();
    expect(checkInput("")).not.toBeNull();
  });
  it("checkResolved는 보기와 열기의 확장자를 따로 본다", () => {
    expect(checkResolved("/r/a.png", ["/r"], "view").ok).toBe(true);
    expect(checkResolved("/r/a.docx", ["/r"], "view").ok).toBe(false);
    expect(checkResolved("/r/a.docx", ["/r"], "open").ok).toBe(true);
    for (const bad of ["svg", "html", "sh", "command", "tool", "pkg", "app"]) {
      expect(checkResolved(`/r/a.${bad}`, ["/r"], "view").ok).toBe(false);
      expect(checkResolved(`/r/a.${bad}`, ["/r"], "open").ok).toBe(false);
    }
    expect(checkResolved("/r/noext", ["/r"], "open").ok).toBe(false);
    expect(checkResolved("/r", ["/r"], "open").ok).toBe(false);
  });
});

describe("resolveFile (임시 폴더)", () => {
  const view = (p: string) => resolveFile(p, [root], "view");
  const open = (p: string) => resolveFile(p, [root], "open");

  it("허용 폴더 안의 보통 파일은 통과한다", async () => {
    const r = await view(at("shot.png"));
    expect(r).toMatchObject({ ok: true, real: at("shot.png"), ext: "png" });
    expect((await open(at("doc.pdf"))).ok).toBe(true);
  });

  it("허용 폴더가 없으면 모두 거절한다", async () => {
    expect((await resolveFile(at("shot.png"), [], "view")).ok).toBe(false);
  });

  it("../로 밖에 나가는 경로를 거절한다", async () => {
    const r = await view(`${root}/../outside/secret.png`);
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("허용 폴더 밖과 이름만 비슷한 옆 폴더를 거절한다", async () => {
    expect(await view(path.join(base, "outside", "secret.png"))).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await view(path.join(base, "root-sibling", "x.png"))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("밖을 가리키는 심볼릭 링크를 거절하고, 안에서 도는 링크는 받는다", async () => {
    expect((await view(at("out-link.png"))).ok).toBe(false);
    expect(await view(at("in-link.png"))).toMatchObject({
      ok: true,
      real: at("shot.png"),
    });
  });

  it("이름만 pdf인 링크는 가리키는 실제 파일(sh)로 판단한다", async () => {
    expect((await view(at("fake.pdf"))).ok).toBe(false);
    expect((await open(at("fake.pdf"))).ok).toBe(false);
  });

  it("숨김 파일·폴더와 숨김을 가리키는 링크를 거절한다", async () => {
    expect((await view(at(".env"))).ok).toBe(false);
    expect((await view(at(".git", "config.txt"))).ok).toBe(false);
    expect((await view(at("hidden-link.txt"))).ok).toBe(false);
  });

  it("세션 작업 사본 안의 파일은 받고, 같은 사본의 .env는 거절한다", async () => {
    const wt = path.join(root, "repo", ".claude", "worktrees", "agent-x");
    mkdirSync(wt, { recursive: true });
    writeFileSync(path.join(wt, "README.md"), "# 사본");
    writeFileSync(path.join(wt, ".env"), "KEY=1");
    expect(await view(path.join(wt, "README.md"))).toMatchObject({ ok: true });
    expect(await view(path.join(wt, ".env"))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("보기는 html을, 열기는 sh·폴더(.app)·실행 권한 파일을 거절한다", async () => {
    expect((await view(at("page.html"))).ok).toBe(false);
    expect((await open(at("run.sh"))).ok).toBe(false);
    expect((await open(at("App.app"))).ok).toBe(false);
    expect(await open(at("tool.pdf"))).toMatchObject({
      ok: false,
      reason: "실행 권한이 붙은 파일이에요",
    });
  });

  it("없는 파일은 404", async () => {
    expect(await view(at("nope.png"))).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});

describe("parseRange", () => {
  it("구간 하나를 읽는다", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 });
  });
  it("없거나 못 읽으면 null, 범위 밖이면 bad", () => {
    expect(parseRange(null, 10)).toBeNull();
    expect(parseRange("bytes=0-1,4-5", 10)).toBeNull();
    expect(parseRange("bytes=20-30", 10)).toBe("bad");
  });
});

describe("isTrustedFetch", () => {
  const req = (site?: string, host = "127.0.0.1:7790") => {
    // Request는 host 머리글을 직접 못 넣으니 headers만 꾸민다.
    const headers = new Headers(site ? { "sec-fetch-site": site } : {});
    headers.set("host", host);
    return { headers } as unknown as Request;
  };
  it("같은 출처이고 Host가 이 컴퓨터 자신일 때만 받는다", () => {
    expect(isTrustedFetch(req("same-origin"))).toBe(true);
    expect(isTrustedFetch(req("same-origin", "localhost:7790"))).toBe(true);
    expect(isTrustedFetch(req("same-origin", "[::1]:7790"))).toBe(true);
  });
  it("주소창(none)은 아무 클라이언트나 꾸밀 수 있어 받지 않는다", () => {
    expect(isTrustedFetch(req("none"))).toBe(false);
  });
  it("다른 사이트·머리글 없음은 거절", () => {
    expect(isTrustedFetch(req("cross-site"))).toBe(false);
    expect(isTrustedFetch(req("same-site"))).toBe(false);
    expect(isTrustedFetch(req())).toBe(false);
  });
  it("Host가 LAN 주소·남의 도메인이면 거절(DNS 재바인딩 포함)", () => {
    for (const host of [
      "192.168.0.10:7790",
      "100.64.1.2:7790",
      "evil.example:7790",
      "127.0.0.1.evil.example",
    ])
      expect(isTrustedFetch(req("same-origin", host)), host).toBe(false);
  });
});

describe("isLoopbackHost", () => {
  it("이 컴퓨터 자신만", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("LOCALHOST:7795")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("0.0.0.0:7790")).toBe(false);
    expect(isLoopbackHost(null)).toBe(false);
  });
});

describe("boundToLoopback", () => {
  it("띄울 때 -H·--hostname이 이 컴퓨터 자신이면 true", () => {
    expect(
      boundToLoopback(["node", "next", "start", "-H", "127.0.0.1"], {}),
    ).toBe(true);
    expect(boundToLoopback(["node", "next", "--hostname=localhost"], {})).toBe(
      true,
    );
  });
  it("인자가 없으면 HOSTNAME 환경 변수를 본다", () => {
    expect(
      boundToLoopback(["node", "next", "start"], { HOSTNAME: "127.0.0.1" }),
    ).toBe(true);
  });
  it("모든 주소(0.0.0.0)나 아무 표시가 없으면 false", () => {
    expect(
      boundToLoopback(["node", "next", "start", "-H", "0.0.0.0"], {}),
    ).toBe(false);
    expect(boundToLoopback(["node", "next", "start"], {})).toBe(false);
    expect(
      boundToLoopback(["node", "next", "start"], { HOSTNAME: "my-mac" }),
    ).toBe(false);
  });
});
