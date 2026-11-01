import { describe, expect, it } from "vitest";
import {
  areaOf,
  buildReport,
  costOf,
  parseAreaRules,
  rangeStart,
  recordFromLine,
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
}): string {
  return JSON.stringify({
    parentUuid: "p",
    isSidechain: over.sidechain ?? false,
    type: "assistant",
    cwd: over.cwd ?? `${HOME}/personal/projects/starship`,
    sessionId: over.session ?? "s-1",
    timestamp: over.t ?? "2026-10-29T08:18:03.295Z",
    message: {
      id: over.id ?? "msg_1",
      model: over.model ?? "claude-opus-5-5",
      role: "assistant",
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
      },
    },
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
    const r = buildReport(records, { range: "7d", now, rules, paths });
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
    const r = buildReport(records, { range: "7d", now, rules, paths });
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

  it("오늘만 고르면 어제 것은 빠진다", () => {
    const r = buildReport(records, { range: "today", now, rules, paths });
    expect(r.total.output).toBe(400);
  });
});
