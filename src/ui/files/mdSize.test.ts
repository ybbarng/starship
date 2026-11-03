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

  it("크기 글", () => {
    expect(megabytes(3.4 * 1024 * 1024)).toBe("3.4MB");
  });
});
