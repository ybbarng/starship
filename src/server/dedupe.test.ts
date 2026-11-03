import { describe, expect, it } from "vitest";
import { buildDemoDesks } from "@/demo/desk";
import { buildSnapshot, createDemoState } from "@/demo/scenario";
import { dedupeDesk, dedupeSnapshot } from "./dedupe";

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

  it("같은 id의 교신도 하나만 남긴다", () => {
    const snap = base();
    const first = snap.hails[0];
    if (!first) throw new Error("데모에 교신이 있어야 한다");
    const out = dedupeSnapshot({ ...snap, hails: [...snap.hails, first] });
    expect(out.hails).toHaveLength(snap.hails.length);
    expect(out.hails[0]).toBe(first);
  });
});

describe("dedupeDesk", () => {
  const desk = () => {
    const d = Object.values(buildDemoDesks(t0)).find(
      (x) => (x.answers?.length ?? 0) > 0,
    );
    if (!d) throw new Error("데모에 답해 둔 것이 있는 책상이 있어야 한다");
    return d;
  };

  it("겹침이 없으면 같은 객체를 그대로 돌려준다", () => {
    const d = desk();
    expect(dedupeDesk(d)).toBe(d);
  });

  it("같은 id의 답이 두 번 오면 늦게 답한 쪽을 처음 자리에 하나만 남긴다", () => {
    const d = desk();
    const [first, ...rest] = d.answers ?? [];
    if (!first) throw new Error("답이 있어야 한다");
    const later = {
      ...first,
      a: "고쳐 적은 답",
      at: new Date(Date.parse(first.at) + 60_000).toISOString(),
    };
    const out = dedupeDesk({ ...d, answers: [first, ...rest, later] });
    expect(out.answers).toHaveLength(1 + rest.length);
    expect(out.answers?.[0]).toBe(later);
  });
});
