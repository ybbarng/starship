import { describe, expect, it } from "vitest";
import { fileViewHref, findPaths } from "./filePaths";

describe("findPaths: 글 속 파일 경로 찾기", () => {
  it("세부 글에 적힌 절대 경로를 찾는다(뒤에 붙은 조사는 빼고)", () => {
    expect(
      findPaths(
        "어제 드리프트 점검 결과는 /Users/me/.local/state/secretary/runs/drift/2026-10-30.md를 보세요.",
      ),
    ).toEqual(["/Users/me/.local/state/secretary/runs/drift/2026-10-30.md"]);
  });

  it("여러 개면 나온 순서대로, 같은 것은 한 번만", () => {
    expect(
      findPaths(
        "스크린숏 /Users/me/Desktop/a.png, 녹화 /Users/me/Desktop/b.mov\n다시: /Users/me/Desktop/a.png.",
      ),
    ).toEqual(["/Users/me/Desktop/a.png", "/Users/me/Desktop/b.mov"]);
  });

  it("문장 끝 마침표가 붙어도 잡는다", () => {
    expect(findPaths("결과는 /Users/me/Desktop/run.log.")).toEqual([
      "/Users/me/Desktop/run.log",
    ]);
  });

  it("괄호·백틱·따옴표 안의 경로도 잡는다", () => {
    expect(
      findPaths('보고서(`/private/tmp/out/report.pdf`)와 "/Users/me/x/y.json"'),
    ).toEqual(["/private/tmp/out/report.pdf", "/Users/me/x/y.json"]);
  });

  it("~/로 적은 홈 경로도 잡는다(세션들이 이렇게 적는다)", () => {
    expect(
      findPaths(
        "시안: ~/personal/projects/game/review/gate-phone.png, ~/personal/projects/game/review/letter-phone.png",
      ),
    ).toEqual([
      "~/personal/projects/game/review/gate-phone.png",
      "~/personal/projects/game/review/letter-phone.png",
    ]);
  });

  it("URL 속 경로·확장자 없는 폴더는 잡지 않는다", () => {
    expect(
      findPaths(
        "https://github.com/ybbarng/starship/blob/main/docs/desk.md 폴더 /Users/me/Desktop ~/Desktop",
      ),
    ).toEqual([]);
  });

  it("경로가 없으면 빈 목록", () => {
    expect(findPaths("쿠폰 입력 방식 두 가지 중 고르기")).toEqual([]);
  });
});

describe("fileViewHref: 보기 단추 주소", () => {
  it("md는 읽기 좋게 그린 화면으로(경로는 주소용으로 감싼다)", () => {
    const p = "/private/tmp/s/scratchpad/릴리스 노트.md";
    expect(fileViewHref(p)).toBe(`/files/view?path=${encodeURIComponent(p)}`);
    expect(fileViewHref("~/notes/README.MD")).toMatch(/^\/files\/view\?path=/);
  });

  it("md가 아니면 파일을 그대로 내주는 끝점으로", () => {
    const p = "/Users/me/Desktop/a.png";
    expect(fileViewHref(p)).toBe(`/api/files?path=${encodeURIComponent(p)}`);
    expect(fileViewHref("/Users/me/Desktop/run.log")).toMatch(
      /^\/api\/files\?/,
    );
  });
});
