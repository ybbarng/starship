import { describe, expect, it } from "vitest";
import type { Waiting } from "@/protocol/desk";
import { entryPaths, waitFiles } from "./waitFiles";

describe("entryPaths: 선택지·항목 하나에 붙일 경로", () => {
  it("path가 있으면 그것만(글 속 경로는 보지 않는다)", () => {
    expect(
      entryPaths({
        label: "초안 /tmp/x/other.md",
        path: "/Users/me/Desktop/a.png",
      }),
    ).toEqual(["/Users/me/Desktop/a.png"]);
  });

  it("path가 없으면 label·look·note 글 속 경로를 나온 순서대로", () => {
    expect(
      entryPaths({
        label: "초안 /private/tmp/s/scratchpad/foo.md",
        look: "보낼 곳, 표는 ~/Desktop/table.csv와 맞나",
        note: "다시 /private/tmp/s/scratchpad/foo.md",
      }),
    ).toEqual(["/private/tmp/s/scratchpad/foo.md", "~/Desktop/table.csv"]);
  });

  it("경로가 없으면 빈 목록", () => {
    expect(entryPaths({ label: "결제 칸 안에 바로 입력" })).toEqual([]);
  });
});

describe("waitFiles: 기다림 하나의 자리별 경로", () => {
  it("check 항목마다 경로를 고르고, 세부 글의 경로 중 항목에 붙은 것은 뺀다", () => {
    const w: Waiting = {
      id: "draft",
      type: "check",
      title: "초안 확인",
      detail:
        "초안은 /tmp/s/foo.md, 참고 자료는 /tmp/s/ref.pdf에 있어요. 다시 /tmp/s/foo.md.",
      items: [
        { label: "초안 /tmp/s/foo.md", look: "보낼 곳" },
        { label: "그림", path: "/tmp/s/fig.png" },
        { label: "같은 초안 다시 /tmp/s/foo.md" },
      ],
    };
    expect(waitFiles(w)).toEqual({
      detail: ["/tmp/s/ref.pdf"],
      options: [],
      items: [["/tmp/s/foo.md"], ["/tmp/s/fig.png"], []],
    });
  });

  it("decide 선택지는 path가 없을 때 label·note에서 찾는다", () => {
    const w: Waiting = {
      id: "pick",
      type: "decide",
      title: "둘 중 고르기",
      options: [
        { id: "a", label: "가안", note: "화면 /Users/me/Desktop/a.png" },
        { id: "b", label: "나안", path: "/Users/me/Desktop/b.png" },
      ],
    };
    expect(waitFiles(w)).toEqual({
      detail: [],
      options: [["/Users/me/Desktop/a.png"], ["/Users/me/Desktop/b.png"]],
      items: [],
    });
  });

  it("선택지·항목이 없으면 세부 글의 경로만", () => {
    const w: Waiting = {
      id: "ok",
      type: "approve",
      title: "올려도 될까요",
      detail: "바뀐 점은 ~/notes/changes.md를 보세요",
    };
    expect(waitFiles(w).detail).toEqual(["~/notes/changes.md"]);
  });
});
