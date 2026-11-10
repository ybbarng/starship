import { describe, expect, it } from "vitest";
import { maskRef, maskRefsIn, maskSegment, tokenizeArgs } from "./mask";
import { HIDDEN_ARG } from "./secret";

// 시험용 가짜 값. 비밀 검사(gitleaks)가 글자 그대로의 가짜 토큰도 잡아서 조각을 이어 만든다
const TOKEN = ["q7Rk2LmZ", "x9VbT4nW", "c8YpJ3sD"].join("");

describe("maskSegment: 조각마다 일부만 남긴다", () => {
  it("짧은 조각은 앞 1~3글자만", () => {
    expect(maskSegment("v1")).toBe("v•••");
    expect(maskSegment("prod")).toBe("pr•••");
    expect(maskSegment("Personal")).toBe("Per•••");
  });

  it("긴 조각은 앞 몇 글자와 끝 몇 글자", () => {
    expect(maskSegment("DEPLOY_TOKEN")).toBe("DEPLO•••EN");
    expect(maskSegment("WEB_SHOP_API_SECRET")).toBe("WEB_SHO•••RET");
  });

  it("가린 글은 원래 글 전체를 담지 않는다", () => {
    const seg = "blog.deploy.production";
    expect(maskSegment(seg)).not.toContain(seg);
    expect(maskSegment(seg)).toContain("•••");
  });
});

describe("maskRef·maskRefsIn", () => {
  it("op://는 남기고 금고·항목·칸을 따로 가린다", () => {
    expect(maskRef("op://Personal/blog.deploy.prod/DEPLOY_TOKEN")).toBe(
      "op://Per•••/blog.d•••rod/DEPLO•••EN",
    );
  });

  it("물음표 뒤 속성은 그대로 둔다", () => {
    expect(maskRef("op://Personal/home-router/one-time?attribute=otp")).toBe(
      "op://Per•••/home•••er/one•••?attribute=otp",
    );
  });

  it("글 속의 참조만 찾아 가린다", () => {
    expect(maskRefsIn("TOKEN=op://Personal/blog/key")).toBe(
      "TOKEN=op://Per•••/bl•••/k•••",
    );
  });
});

describe("tokenizeArgs: 인자를 화면 조각으로", () => {
  it("op read 참조는 name(처음엔 가림, 누르면 전체)", () => {
    expect(
      tokenizeArgs("read", ["op://Personal/blog.deploy.prod/DEPLOY_TOKEN"]),
    ).toEqual([
      {
        kind: "name",
        full: "op://Personal/blog.deploy.prod/DEPLOY_TOKEN",
        short: "op://Per•••/blog.d•••rod/DEPLO•••EN",
      },
    ]);
  });

  it("item get 뒤 항목 이름과 --vault 값을 가리고, 동사와 --format 값은 그대로", () => {
    const t = tokenizeArgs("item", [
      "get",
      "blog.deploy.prod",
      "--vault",
      "Personal",
      "--format",
      "json",
    ]);
    expect(t).toEqual([
      { kind: "text", text: "get" },
      { kind: "name", full: "blog.deploy.prod", short: "blog.d•••rod" },
      { kind: "text", text: "--vault" },
      { kind: "name", full: "Personal", short: "Per•••" },
      { kind: "text", text: "--format" },
      { kind: "text", text: "json" },
    ]);
  });

  it("--vault=이름 꼴도 값만 가린다", () => {
    expect(tokenizeArgs("item", ["list", "--vault=Personal"])).toEqual([
      { kind: "text", text: "list" },
      { kind: "name", full: "--vault=Personal", short: "--vault=Per•••" },
    ]);
  });

  it("값처럼 보이는 인자와 서버가 지운 자리는 hidden이고 글자를 담지 않는다", () => {
    const t = tokenizeArgs("item", [
      "edit",
      "blog.deploy.prod",
      `password=${TOKEN}`,
      `token=${HIDDEN_ARG}`,
      TOKEN,
    ]);
    expect(t.slice(2)).toEqual([
      { kind: "hidden", prefix: "password=" },
      { kind: "hidden", prefix: "token=" },
      { kind: "hidden", prefix: "" },
    ]);
    expect(JSON.stringify(t)).not.toContain(TOKEN);
  });

  it("비서가 가린 <가림>은 글 그대로", () => {
    expect(tokenizeArgs("read", ["<가림>"])).toEqual([
      { kind: "text", text: "<가림>" },
    ]);
  });
});
