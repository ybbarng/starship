import { describe, expect, it } from "vitest";
import { PLANETS, planetFor } from "./planet";

describe("planetFor: 승무원마다 행성", () => {
  it("같은 승무원은 늘 같은 행성", () => {
    expect(planetFor("web-shop")).toBe(planetFor("web-shop"));
  });

  it("승무원이 여럿이면 여러 행성이 고루 나온다", () => {
    // 승무원 id 모양(저장소 폴더 이름). 데모 승무원 이름만 쓴다
    const ids = [
      "web-shop",
      "billing",
      "lunar-blog",
      "pixel-forge",
      "orbit-notes",
      "admin-console",
      "starship",
      "recipe-box",
      "tide-chart",
      "garden-log",
    ];
    const kinds = new Set(ids.map((id) => planetFor(id).id));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("행성 id는 겹치지 않는다", () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(PLANETS.length);
  });
});
