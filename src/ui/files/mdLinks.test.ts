import { describe, expect, it } from "vitest";
import { createSlugger, resolveMdLink, slugOf } from "./mdLinks";

const here = "/Users/me/notes/docs/files.md";

describe("resolveMdLink", () => {
  it("같은 폴더의 파일", () => {
    expect(resolveMdLink(here, "map.md")).toEqual({
      path: "/Users/me/notes/docs/map.md",
    });
    expect(resolveMdLink(here, "./sub/a.md")).toEqual({
      path: "/Users/me/notes/docs/sub/a.md",
    });
  });

  it("..은 글로 풀어 위 폴더로", () => {
    expect(resolveMdLink(here, "../README.md")).toEqual({
      path: "/Users/me/notes/README.md",
    });
    expect(resolveMdLink(here, "../src/../x/./y.png")).toEqual({
      path: "/Users/me/notes/x/y.png",
    });
  });

  it("#절은 경로와 따로, 글은 풀어서", () => {
    expect(resolveMdLink(here, "desk.md#할-일로-바꿀-때")).toEqual({
      path: "/Users/me/notes/docs/desk.md",
      hash: "할-일로-바꿀-때",
    });
    expect(resolveMdLink(here, "my%20file.md#%EC%88%AB%EC%9E%90")).toEqual({
      path: "/Users/me/notes/docs/my file.md",
      hash: "숫자",
    });
    expect(resolveMdLink(here, "a.md?x=1")).toEqual({
      path: "/Users/me/notes/docs/a.md",
    });
  });

  it("~/ 경로에서도 ~/를 지킨다", () => {
    expect(resolveMdLink("~/Desktop/a/b.md", "../c.md")).toEqual({
      path: "~/Desktop/c.md",
    });
    expect(resolveMdLink("~/a.md", "../c.md")).toBeNull();
  });

  it("맨 위를 넘는 ..은 풀지 않는다", () => {
    expect(resolveMdLink("/a/b.md", "../../c.md")).toBeNull();
    expect(resolveMdLink("/b.md", "..")).toBeNull();
  });

  it("절대·홈 경로는 확장자가 있으면 그대로 받는다(지금 파일과 상관없이)", () => {
    expect(
      resolveMdLink(here, "/Users/me/work/public/demo-files/coupon-sheet.png"),
    ).toEqual({ path: "/Users/me/work/public/demo-files/coupon-sheet.png" });
    expect(resolveMdLink(here, "~/notes/y.md#다음-할-일")).toEqual({
      path: "~/notes/y.md",
      hash: "다음-할-일",
    });
    expect(resolveMdLink("docs/a.md", "~/notes/y.md")).toEqual({
      path: "~/notes/y.md",
    });
    expect(resolveMdLink(here, "/Users/me/a/../b/./c.md")).toEqual({
      path: "/Users/me/b/c.md",
    });
  });

  it("절대·홈 경로라도 확장자가 없거나 위를 넘거나 다른 사이트면 null", () => {
    for (const href of [
      "/etc/passwd",
      "/about",
      "~/notes/",
      "/Users/me/.env",
      "//evil.example.com/x.md",
      "~other/x.md",
      "/../x.md",
    ])
      expect(resolveMdLink(here, href)).toBeNull();
  });

  it("주소이거나 비었으면 null", () => {
    for (const href of [
      "",
      "#절",
      "https://example.com/a.md",
      "mailto:a@example.com",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "?x=1",
    ])
      expect(resolveMdLink(here, href)).toBeNull();
  });

  it("지금 파일이 절대·홈 경로가 아니면 null", () => {
    expect(resolveMdLink("docs/a.md", "b.md")).toBeNull();
    expect(resolveMdLink("", "b.md")).toBeNull();
  });
});

describe("slugOf", () => {
  it("소문자로, 빈칸은 -로, 문장부호는 뺀다", () => {
    expect(slugOf("Hello World")).toBe("hello-world");
    expect(slugOf("1. 데이터의 뜻·연결·책임")).toBe("1-데이터의-뜻연결책임");
    expect(slugOf("Task.url (v1)")).toBe("taskurl-v1");
    expect(slugOf("snake_case-and-dash")).toBe("snake_case-and-dash");
  });

  it("한글은 그대로", () => {
    expect(slugOf("할 일로 바꿀 때")).toBe("할-일로-바꿀-때");
  });

  it("빈칸이 여럿이면 -도 여럿", () => {
    expect(slugOf("a  b")).toBe("a--b");
  });
});

describe("createSlugger", () => {
  it("겹치면 -1, -2", () => {
    const slug = createSlugger();
    expect(["숫자", "숫자", "숫자", "숫자-1"].map(slug)).toEqual([
      "숫자",
      "숫자-1",
      "숫자-2",
      "숫자-1-1",
    ]);
  });

  it("문서마다 새로 센다", () => {
    expect(createSlugger()("a")).toBe("a");
    expect(createSlugger()("a")).toBe("a");
  });
});
