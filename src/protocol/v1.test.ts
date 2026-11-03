import { describe, expect, it } from "vitest";
import { PROTOCOL, Snapshot } from "./v1";

const task = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: "question",
  source: { kind: "session" },
  context: "work",
  title: `할 일 ${id}`,
  from: "세션",
  since: 1_000,
  actions: ["answer"],
  ...over,
});

const base = (over: Record<string, unknown> = {}) => ({
  protocol: PROTOCOL,
  generatedAt: 2_000,
  tasks: [task("t1"), task("t2")],
  hails: [],
  crew: [],
  gauges: [],
  ...over,
});

describe("Snapshot: 틀린 항목만 빼기", () => {
  it("모두 맞으면 problems가 없다", () => {
    const snap = Snapshot.parse(base());
    expect(snap.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(snap.problems).toBeUndefined();
  });

  it("task 하나의 kind가 모르는 값이면 나머지는 남고 problems에 적힌다", () => {
    const snap = Snapshot.parse(
      base({ tasks: [task("t1"), task("t2", { kind: "wish" }), task("t3")] }),
    );
    expect(snap.tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(snap.problems).toHaveLength(1);
    expect(snap.problems?.[0]).toMatch(/^tasks\[1\] \(id t2\): kind/);
  });

  it("hails·crew·gauges도 항목마다 따로 본다", () => {
    const snap = Snapshot.parse(
      base({
        crew: [
          {
            id: "a",
            name: "A",
            context: "work",
            status: "napping",
            onDeck: true,
            actions: [],
          },
          {
            id: "b",
            name: "B",
            context: "work",
            status: "idle",
            onDeck: false,
            actions: [],
          },
        ],
        gauges: [{ id: "g", label: "등", status: "purple" }],
      }),
    );
    expect(snap.crew.map((c) => c.id)).toEqual(["b"]);
    expect(snap.gauges).toEqual([]);
    expect(snap.problems).toHaveLength(2);
  });

  it("본부가 보낸 problems에 Starship이 찾은 것을 덧붙인다", () => {
    const snap = Snapshot.parse(
      base({
        problems: ["본부: 메일을 못 읽음"],
        tasks: [task("t1", { since: "어제" })],
      }),
    );
    expect(snap.tasks).toEqual([]);
    expect(snap.problems?.[0]).toBe("본부: 메일을 못 읽음");
    expect(snap.problems).toHaveLength(2);
  });

  it("바깥(protocol·generatedAt)은 엄격하다", () => {
    expect(Snapshot.safeParse(base({ protocol: "starship/2" })).success).toBe(
      false,
    );
    expect(Snapshot.safeParse(base({ generatedAt: "지금" })).success).toBe(
      false,
    );
    expect(Snapshot.safeParse(base({ tasks: "없음" })).success).toBe(false);
  });

  it("한 번 읽은 결과를 다시 읽어도 같다(화면이 한 번 더 parse한다)", () => {
    const once = Snapshot.parse(
      base({ tasks: [task("t1"), task("t2", { actions: ["fly"] })] }),
    );
    expect(Snapshot.parse(once)).toEqual(once);
  });
});
