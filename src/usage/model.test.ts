import { describe, expect, it } from "vitest";
import {
  applyRecord,
  areaOf,
  bucketsFrom,
  buildReport,
  burnRate,
  costOf,
  parseAreaRules,
  rangeStart,
  recordFromLine,
  type UsageBucket,
  type UsageRecord,
} from "./model";

const HOME = "/Users/someone";

/** 실제 기록과 같은 모양의 assistant 줄 */
function line(over: {
  id?: string;
  session?: string;
  t?: string;
  model?: string;
  cwd?: string;
  sidechain?: boolean;
  usage?: Record<string, unknown>;
  content?: unknown[];
}): string {
  // 실제 기록과 같은 차례: message(model·id·content·usage) 다음에 맨 위 type·timestamp·cwd·sessionId
  return JSON.stringify({
    parentUuid: "p",
    isSidechain: over.sidechain ?? false,
    message: {
      model: over.model ?? "claude-opus-5-5",
      id: over.id ?? "msg_1",
      type: "message",
      role: "assistant",
      content: over.content ?? [{ type: "text", text: "고쳤어요" }],
      stop_reason: "end_turn",
      usage: over.usage ?? {
        input_tokens: 2,
        cache_creation_input_tokens: 45951,
        cache_read_input_tokens: 0,
        output_tokens: 366,
        output_tokens_details: { thinking_tokens: 15 },
        service_tier: "standard",
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 45951,
        },
        speed: "standard",
        iterations: [{ type: "message", output_tokens: 366 }],
      },
    },
    requestId: "req_1",
    type: "assistant",
    uuid: "u-1",
    timestamp: over.t ?? "2026-10-29T08:18:03.295Z",
    userType: "external",
    cwd: over.cwd ?? `${HOME}/personal/projects/starship`,
    sessionId: over.session ?? "s-1",
    version: "2.1.316",
  });
}

function rec(over: Partial<UsageRecord>): UsageRecord {
  return {
    id: "m",
    t: Date.parse("2026-10-30T03:00:00Z"),
    project: "-p-starship",
    session: "s-1",
    model: "claude-opus-5-5",
    input: 0,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
    output: 0,
    ...over,
  };
}

describe("기록 한 줄 읽기", () => {
  it("assistant 줄의 usage를 요청 하나로 뽑는다", () => {
    const got = recordFromLine(line({}), "-p-starship");
    expect(got?.record).toEqual({
      id: "msg_1",
      t: Date.parse("2026-10-29T08:18:03.295Z"),
      project: "-p-starship",
      session: "s-1",
      model: "claude-opus-5-5",
      fast: undefined,
      input: 2,
      cacheWrite5m: 45951,
      cacheWrite1h: 0,
      cacheRead: 0,
      output: 366,
    });
    expect(got?.cwd).toBe(`${HOME}/personal/projects/starship`);
  });

  it("캐시 쓰기를 5분과 1시간으로 나눈다", () => {
    const got = recordFromLine(
      line({
        usage: {
          input_tokens: 1,
          cache_creation_input_tokens: 1000,
          cache_creation: {
            ephemeral_5m_input_tokens: 300,
            ephemeral_1h_input_tokens: 700,
          },
          output_tokens: 5,
        },
      }),
      "x",
    );
    expect(got?.record.cacheWrite5m).toBe(300);
    expect(got?.record.cacheWrite1h).toBe(700);
  });

  it("user 줄·깨진 줄·usage 없는 줄은 건너뛴다", () => {
    expect(
      recordFromLine('{"type":"user","message":{"content":"usage"}}', "x"),
    ).toBeUndefined();
    expect(recordFromLine('{"type":"assistant","usage', "x")).toBeUndefined();
    expect(
      recordFromLine(
        JSON.stringify({
          type: "assistant",
          sessionId: "s",
          timestamp: "2026-10-29T00:00:00Z",
          message: { id: "m", content: "usage" },
        }),
        "x",
      ),
    ).toBeUndefined();
  });

  it("fast 모드를 표시한다", () => {
    const got = recordFromLine(
      line({ usage: { input_tokens: 1, output_tokens: 1, speed: "fast" } }),
      "x",
    );
    expect(got?.record.fast).toBe(true);
  });

  it("본문에 usage 글자가 있어도 진짜 usage(본문 뒤)를 읽는다", () => {
    const got = recordFromLine(
      line({
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              content:
                '{"type":"assistant","usage":{"input_tokens":999,"output_tokens":999},"cwd":"/elsewhere","sessionId":"fake"}',
            },
          },
        ],
      }),
      "x",
    );
    expect(got?.record).toMatchObject({ output: 366, session: "s-1" });
    expect(got?.cwd).toBe(`${HOME}/personal/projects/starship`);
  });

  it("본문이 길어도 앞뒤만 보고 읽는다", () => {
    const got = recordFromLine(
      line({ content: [{ type: "text", text: "가".repeat(200_000) }] }),
      "x",
    );
    expect(got?.record).toMatchObject({
      id: "msg_1",
      model: "claude-opus-5-5",
      output: 366,
    });
  });

  it("서브에이전트 줄을 알아본다", () => {
    expect(recordFromLine(line({ sidechain: true }), "x")?.sidechain).toBe(
      true,
    );
  });
});

describe("업무·개인 구분", () => {
  const rules = parseAreaRules(
    "work:~/company; personal:~/personal\npersonal:~/.local/state/helper;nope:~/x;broken",
    HOME,
  );

  it("설정 글을 규칙으로 읽고 틀린 조각은 버린다", () => {
    expect(rules).toEqual([
      { prefix: `${HOME}/company`, area: "work" },
      { prefix: `${HOME}/personal`, area: "personal" },
      { prefix: `${HOME}/.local/state/helper`, area: "personal" },
    ]);
  });

  it("경로 접두사로 고르고, 이름만 비슷한 폴더는 맞추지 않는다", () => {
    expect(areaOf(`${HOME}/company/app`, rules)).toBe("work");
    expect(areaOf(`${HOME}/company`, rules)).toBe("work");
    expect(areaOf(`${HOME}/company-old/app`, rules)).toBe("other");
    expect(areaOf(`${HOME}/personal/projects/starship`, rules)).toBe(
      "personal",
    );
    expect(areaOf(undefined, rules)).toBe("other");
  });

  it("가장 긴 접두사가 이긴다", () => {
    const nested = parseAreaRules(
      "personal:~/personal;work:~/personal/client",
      HOME,
    );
    expect(areaOf(`${HOME}/personal/client/a`, nested)).toBe("work");
  });

  it("규칙이 없으면 모두 기타", () => {
    expect(areaOf(`${HOME}/company/app`, parseAreaRules(undefined, HOME))).toBe(
      "other",
    );
  });
});

describe("비용 추정", () => {
  it("Opus 5.5: 입력 $4, 캐시 쓰기 5분 1.25배·1시간 2배, 캐시 읽기 $0.20, 출력 $20", () => {
    const c = costOf(
      rec({
        input: 1_000_000,
        cacheWrite5m: 1_000_000,
        cacheWrite1h: 1_000_000,
        cacheRead: 1_000_000,
        output: 1_000_000,
      }),
    );
    expect(c).toBeCloseTo(4 + 5 + 8 + 0.2 + 20);
  });

  it("fast 모드는 2배, 모르는 모델은 세지 않는다", () => {
    expect(costOf(rec({ output: 1_000_000, fast: true }))).toBeCloseTo(40);
    expect(costOf(rec({ model: "<synthetic>", output: 10 }))).toBeUndefined();
  });
});

describe("묶기", () => {
  const now = new Date(2026, 9, 31, 15, 0).getTime(); // 이 컴퓨터 시간대 10월 31일 15시
  const day = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();
  const rules = parseAreaRules("work:~/company;personal:~/personal", HOME);
  const paths = {
    "-co-app": `${HOME}/company/app`,
    "-pe-starship": `${HOME}/personal/projects/starship`,
  };
  const records = [
    rec({
      id: "a",
      t: day(31),
      project: "-co-app",
      session: "w1",
      output: 100,
    }),
    rec({
      id: "b",
      t: day(31),
      project: "-pe-starship",
      session: "p1",
      output: 300,
    }),
    rec({
      id: "c",
      t: day(30),
      project: "-pe-starship",
      session: "p2",
      output: 50,
    }),
    rec({
      id: "d",
      t: day(20),
      project: "-pe-starship",
      session: "p3",
      output: 999,
    }),
    rec({ id: "e", t: day(29), project: "-unknown", session: "x", output: 7 }),
  ];

  it("오늘은 이 컴퓨터 시간대 자정부터", () => {
    expect(rangeStart("today", now)).toBe(new Date(2026, 9, 31).getTime());
    expect(rangeStart("7d", now)).toBe(new Date(2026, 9, 25).getTime());
  });

  it("기간 안의 요청만 영역·프로젝트·세션으로 센다", () => {
    const r = buildReport(bucketsFrom(records).values(), {
      range: "7d",
      now,
      rules,
      paths,
    });
    expect(r.total.requests).toBe(4);
    expect(r.areas.work.output).toBe(100);
    expect(r.areas.personal.output).toBe(350);
    expect(r.areas.other.output).toBe(7);
    expect(
      r.projects.map((p) => [p.name, p.output, p.sessions.length]),
    ).toEqual([
      ["starship", 350, 2],
      ["app", 100, 1],
      ["-unknown", 7, 1],
    ]);
    expect(r.projects[0]?.sessions.map((s) => s.id)).toEqual(["p1", "p2"]);
  });

  it("날마다 영역별 출력을 빈 날까지 채운다", () => {
    const r = buildReport(bucketsFrom(records).values(), {
      range: "7d",
      now,
      rules,
      paths,
    });
    expect(r.days).toHaveLength(7);
    expect(r.days.at(-1)).toEqual({
      day: "2026-10-31",
      work: 100,
      personal: 300,
      other: 0,
    });
    expect(r.days[0]).toEqual({
      day: "2026-10-25",
      work: 0,
      personal: 0,
      other: 0,
    });
  });

  it("작업 폴더가 같은 기록 폴더 둘은 한 프로젝트로 묶는다(폴더 이름을 바꾼 경우)", () => {
    const r = buildReport(
      bucketsFrom([
        rec({
          id: "x1",
          t: day(31),
          project: "-old-name",
          session: "a",
          output: 5,
        }),
        rec({
          id: "x2",
          t: day(31),
          project: "-pe-starship",
          session: "b",
          output: 7,
        }),
      ]).values(),
      {
        range: "7d",
        now,
        rules,
        paths: { ...paths, "-old-name": `${HOME}/personal/projects/starship` },
      },
    );
    expect(
      r.projects.map((p) => [p.name, p.output, p.sessions.length]),
    ).toEqual([["starship", 12, 2]]);
  });

  it("작업 폴더 이름만 같은 두 프로젝트는 부모 폴더를 붙여 나눈다", () => {
    const r = buildReport(
      bucketsFrom([
        rec({ id: "y1", t: day(31), project: "-a", session: "a", output: 5 }),
        rec({ id: "y2", t: day(31), project: "-b", session: "b", output: 7 }),
      ]).values(),
      {
        range: "7d",
        now,
        rules,
        paths: {
          "-a": `${HOME}/personal/projects/game`,
          "-b": `${HOME}/personal/projects/game/game`,
        },
      },
    );
    expect(r.projects.map((p) => p.name)).toEqual([
      "game/game",
      "projects/game",
    ]);
  });

  it("오늘만 고르면 어제 것은 빠진다", () => {
    const r = buildReport(bucketsFrom(records).values(), {
      range: "today",
      now,
      rules,
      paths,
    });
    expect(r.total.output).toBe(400);
  });
});

describe("미리 합치기", () => {
  it("같은 요청의 줄이 다시 오면 앞 값을 빼고 새 값으로 바꾼다", () => {
    const buckets = new Map<string, UsageBucket>();
    const first = rec({ id: "m1", output: 10, cacheRead: 100 });
    applyRecord(buckets, first, 1);
    const later = { ...first, output: 40 };
    applyRecord(buckets, first, -1);
    applyRecord(buckets, later, 1);
    const [b] = [...buckets.values()];
    expect(b).toMatchObject({ requests: 1, output: 40, cacheRead: 100 });
  });

  it("날·프로젝트·세션·모델이 같으면 한 칸에 더하고, 다 빼면 칸을 지운다", () => {
    const a = rec({ id: "a", output: 1 });
    const b = rec({ id: "b", output: 2, t: a.t + 60_000 });
    const buckets = bucketsFrom([a, b, { ...a, output: 5 }]);
    expect(buckets.size).toBe(1);
    expect([...buckets.values()][0]).toMatchObject({
      requests: 2,
      output: 7,
      first: a.t,
      last: a.t + 60_000,
    });
    applyRecord(buckets, { ...a, output: 5 }, -1);
    applyRecord(buckets, b, -1);
    expect(buckets.size).toBe(0);
  });
});

describe("시간별과 지금 속도", () => {
  const now = new Date(2026, 9, 31, 15, 30).getTime();
  const at = (h: number, m = 0) => new Date(2026, 9, 31, h, m).getTime();
  const rules = parseAreaRules("work:~/company;personal:~/personal", HOME);
  const paths = {
    "-co-app": `${HOME}/company/app`,
    "-pe-starship": `${HOME}/personal/projects/starship`,
  };

  it("같은 날이라도 시간이 다르면 다른 칸에 모인다", () => {
    const buckets = bucketsFrom([
      rec({ id: "h1", t: at(9, 10), output: 1 }),
      rec({ id: "h2", t: at(9, 50), output: 2 }),
      rec({ id: "h3", t: at(14, 5), output: 4 }),
    ]);
    expect([...buckets.values()].map((b) => [b.hour, b.output])).toEqual([
      [9, 3],
      [14, 4],
    ]);
  });

  it("오늘은 자정부터 지금까지 시간 칸이 있고 영역별로 모인다", () => {
    const r = buildReport(
      bucketsFrom([
        rec({ id: "a", t: at(9, 10), project: "-co-app", output: 5 }),
        rec({ id: "b", t: at(14, 5), project: "-pe-starship", output: 7 }),
      ]).values(),
      { range: "today", now, rules, paths },
    );
    expect(r.hours).toHaveLength(16);
    expect(r.hours[9]).toMatchObject({ work: 5, personal: 0 });
    expect(r.hours[14]).toMatchObject({ work: 0, personal: 7 });
  });

  it("지금 속도는 최근 15분 출력을 분으로 나눈 값", () => {
    const burn = burnRate(
      [
        rec({ id: "x", t: now - 5 * 60_000, project: "-co-app", output: 300 }),
        rec({
          id: "y",
          t: now - 10 * 60_000,
          project: "-pe-starship",
          output: 150,
        }),
        rec({
          id: "z",
          t: now - 40 * 60_000,
          project: "-pe-starship",
          output: 999,
        }),
      ],
      { now, rules, paths },
    );
    expect(burn.perMin.work).toBe(20);
    expect(burn.perMin.personal).toBe(10);
    expect(burn.total).toBe(30);
  });
});
