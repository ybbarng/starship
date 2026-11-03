import { describe, expect, it } from "vitest";
import { MAX_MD_RENDER_BYTES, mdTooBig, megabytes } from "./mdSize";

describe("md 보기 크기 상한", () => {
  it("2MB를 넘으면 그 크기를 돌려준다", () => {
    expect(mdTooBig(String(MAX_MD_RENDER_BYTES + 1))).toBe(
      MAX_MD_RENDER_BYTES + 1,
    );
  });

  it("2MB까지는 그린다", () => {
    expect(mdTooBig(String(MAX_MD_RENDER_BYTES))).toBeNull();
    expect(mdTooBig("1200")).toBeNull();
  });

  it("길이를 모르면 그려 본다", () => {
    expect(mdTooBig(null)).toBeNull();
    expect(mdTooBig("")).toBeNull();
    expect(mdTooBig("많음")).toBeNull();
  });

  it("길이를 모를 때 받은 글을 주면 그 바이트 수로 다시 본다", () => {
    // 한글 한 글자는 UTF-8로 3바이트: 글자 수로는 상한 아래여도 바이트로는 넘는다
    const big = "가".repeat(MAX_MD_RENDER_BYTES / 3 + 1);
    expect(mdTooBig(null, MAX_MD_RENDER_BYTES, big)).toBe(
      new TextEncoder().encode(big).byteLength,
    );
    expect(mdTooBig("", MAX_MD_RENDER_BYTES, big)).not.toBeNull();
    expect(mdTooBig(null, MAX_MD_RENDER_BYTES, "# 제목\n본문")).toBeNull();
    // 길이를 적었으면 그것을 믿는다(받은 글을 다시 재지 않는다)
    expect(mdTooBig("1200", MAX_MD_RENDER_BYTES, big)).toBeNull();
  });

  it("크기 글", () => {
    expect(megabytes(3.4 * 1024 * 1024)).toBe("3.4MB");
  });
});
