import { describe, expect, it } from "vitest";
import {
  entropy,
  HIDDEN_ARG,
  looksSecret,
  REDACTED_BY_HQ,
  scrubArg,
  scrubArgs,
  scrubText,
} from "./secret";

describe("scrubText: 글 속 낱말", () => {
  it("값처럼 보이는 낱말만 지우고 나머지 글과 빈칸은 둔다", () => {
    const r = scrubText(`sh -c "op read x"  password=${TOKEN} 끝`);
    expect(r.text).toBe(`sh -c "op read x"  password=${HIDDEN_ARG} 끝`);
    expect(r.hidden).toBe(1);
  });

  it("값이 없으면 그대로", () => {
    expect(scrubText("배포 토큰을 갱신한다")).toEqual({
      text: "배포 토큰을 갱신한다",
      hidden: 0,
    });
  });
});

// 시험용 가짜 값. 비밀 검사(gitleaks)가 글자 그대로의 가짜 토큰도 잡아서 조각을 이어 만든다
const TOKEN = ["q7Rk2LmZ", "x9VbT4nW", "c8YpJ3sD"].join("");
const HEX = ["9f3c1a7b", "e04d52c8", "6a1f0e3b", "7d29c4a5"].join("");

describe("looksSecret: 긴 무작위 문자열만 걸린다", () => {
  it("대소문자·숫자가 섞인 긴 토큰", () => {
    expect(looksSecret(TOKEN)).toBe(true);
  });

  it("앞에 짧은 머리말이 붙은 토큰도 걸린다", () => {
    expect(looksSecret(`tok_${TOKEN}`)).toBe(true);
  });

  it("소문자·숫자만 섞인 긴 16진수도 걸린다", () => {
    expect(looksSecret(HEX)).toBe(true);
  });

  it("짧은 글은 걸리지 않는다", () => {
    expect(looksSecret("q7Rk2LmZx9")).toBe(false);
  });

  it("op:// 참조와 슬래시가 든 경로는 걸리지 않는다", () => {
    expect(looksSecret("op://Personal/blog.deploy.prod/DEPLOY_TOKEN")).toBe(
      false,
    );
    expect(looksSecret("/Users/someone/projects/web-shop2026")).toBe(false);
  });

  it("슬래시·더하기가 섞인 base64 값도 걸린다", () => {
    expect(looksSecret(`${TOKEN.slice(0, 16)}/${TOKEN.slice(16)}+aB==`)).toBe(
      true,
    );
  });

  it("낱말을 이은 이름은 걸리지 않는다", () => {
    expect(looksSecret("WEB_SHOP_DEPLOY_TOKEN_PROD")).toBe(false);
    expect(looksSecret("blog.deploy.production.v2")).toBe(false);
  });

  it("빈칸이 든 문장은 걸리지 않는다", () => {
    expect(looksSecret("Deploy token for web shop 2026")).toBe(false);
  });

  it("엔트로피: 같은 글자만이면 0, 섞일수록 커진다", () => {
    expect(entropy("aaaa")).toBe(0);
    expect(entropy(TOKEN)).toBeGreaterThan(4);
  });
});

describe("scrubArg·scrubArgs: 값만 지우고 나머지는 그대로", () => {
  it("값처럼 보이는 인자는 통째로 바꾼다", () => {
    expect(scrubArg(TOKEN)).toEqual({ arg: HIDDEN_ARG, hidden: true });
  });

  it("--이름=값 꼴이면 등호 뒤만 바꾼다", () => {
    expect(scrubArg(`--token=${TOKEN}`)).toEqual({
      arg: `--token=${HIDDEN_ARG}`,
      hidden: true,
    });
  });

  it("비서가 이미 가린 <가림>은 그대로 둔다", () => {
    expect(scrubArg(REDACTED_BY_HQ)).toEqual({
      arg: REDACTED_BY_HQ,
      hidden: false,
    });
  });

  it("목록에서 지운 개수를 센다", () => {
    const r = scrubArgs([
      "item",
      "edit",
      "blog.deploy.prod",
      `password=${TOKEN}`,
    ]);
    expect(r.args).toEqual([
      "item",
      "edit",
      "blog.deploy.prod",
      `password=${HIDDEN_ARG}`,
    ]);
    expect(r.hidden).toBe(1);
    expect(r.args.join(" ")).not.toContain(TOKEN);
  });
});
