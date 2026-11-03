import { describe, expect, it } from "vitest";
import { buildSnapshot, createDemoState } from "@/demo/scenario";
import { dedupeSnapshot } from "./dedupe";

const t0 = Date.parse("2026-11-03T12:00:00+09:00");
const base = () => buildSnapshot(createDemoState(t0), "default", t0);

describe("dedupeSnapshot", () => {
  it("겹침이 없으면 같은 객체를 그대로 돌려준다", () => {
    const snap = base();
    expect(dedupeSnapshot(snap)).toBe(snap);
  });

  it("같은 승무원이 꺼진 것과 일하는 것으로 두 번 오면 일하는 쪽을 처음 자리에 남긴다", () => {
    const snap = base();
    const live = snap.crew.find((c) => c.status !== "off");
    if (!live) throw new Error("데모에 일하는 승무원이 있어야 한다");
    const ghost = { ...live, status: "off" as const };
    const at = snap.crew.indexOf(live);
    const crew = [...snap.crew];
    crew.splice(at, 1, ghost);
    crew.push(live);
    const out = dedupeSnapshot({ ...snap, crew });
    expect(out.crew).toHaveLength(snap.crew.length);
    expect(out.crew[at]).toBe(live);
  });

  it("같은 id의 할 일은 하나만 남긴다", () => {
    const snap = base();
    const first = snap.tasks[0];
    if (!first) throw new Error("데모에 할 일이 있어야 한다");
    const out = dedupeSnapshot({ ...snap, tasks: [...snap.tasks, first] });
    expect(out.tasks).toHaveLength(snap.tasks.length);
    expect(new Set(out.tasks.map((t) => t.id)).size).toBe(out.tasks.length);
  });
});
