import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createUsageState,
  loadCache,
  scanLogs,
  type UsageState,
} from "./usage";

const PROJECT = "-home-me-personal-projects-starship";

/** 실제 기록과 같은 모양의 assistant 줄 */
function line(
  id: string,
  output: number,
  more: { sidechain?: boolean; cwd?: string; text?: string } = {},
) {
  // 실제 기록과 같은 차례: message(model·id·content·usage) 다음에 맨 위 type·timestamp·cwd·sessionId
  return `${JSON.stringify({
    parentUuid: "p",
    isSidechain: more.sidechain ?? false,
    message: {
      model: "claude-opus-5-5",
      id,
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: more.text ?? "고쳤어요" }],
      usage: {
        input_tokens: 3,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1000,
        output_tokens: output,
      },
    },
    type: "assistant",
    timestamp: new Date().toISOString(),
    cwd: more.cwd ?? "/home/me/personal/projects/starship",
    sessionId: "sess-1",
  })}\n`;
}

const userLine = `${JSON.stringify({ type: "user", sessionId: "sess-1", message: { content: "usage 보여줘" } })}\n`;

/** 모든 칸을 더한 값 */
function sum(s: UsageState) {
  let requests = 0;
  let output = 0;
  for (const b of s.buckets.values()) {
    requests += b.requests;
    output += b.output;
  }
  return { requests, output };
}

describe("기록 훑기", () => {
  let root: string;
  let projects: string;
  let log: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "starship-usage-"));
    projects = join(root, "projects");
    await mkdir(join(projects, PROJECT, "sess-1", "subagents"), {
      recursive: true,
    });
    log = join(projects, PROJECT, "sess-1.jsonl");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("같은 요청의 여러 줄은 마지막 줄 하나로 센다", async () => {
    await writeFile(
      log,
      userLine + line("m1", 10) + line("m1", 40) + line("m2", 5),
    );
    const s = createUsageState();
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 2, output: 45 });
  });

  it("요청의 다음 줄이 다음 훑기에 와도 바꿔 끼운다", async () => {
    await writeFile(log, line("m1", 10));
    const s = createUsageState();
    await scanLogs(s, projects);
    await appendFile(log, line("m1", 40));
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 1, output: 40 });
  });

  it("반쯤 쓰인 줄은 남겨 두었다가 다 쓰이면 읽는다", async () => {
    const whole = line("m3", 77);
    await writeFile(log, line("m1", 1) + whole.slice(0, 30));
    const s = createUsageState();
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 1, output: 1 });
    await appendFile(log, whole.slice(30));
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 2, output: 78 });
  });

  it("1MB 조각을 넘는 긴 줄도 읽는다", async () => {
    const big = line("m4", 4, { text: "x".repeat(1_500_000) });
    await writeFile(log, line("m1", 1) + big + line("m5", 5));
    const s = createUsageState();
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 3, output: 10 });
  });

  it("다른 폴더에서 다시 연 세션이 앞 대화를 복사해도 두 번 세지 않는다", async () => {
    await writeFile(log, line("m1", 10) + line("m2", 20));
    const other = join(projects, "-home-me-renamed");
    await mkdir(other, { recursive: true });
    // 다시 연 세션: 앞 대화(m1, m2)를 복사하고 새 요청(m3)을 잇는다. 사이에 요청이 많아 recent에서 빠졌어도 같다.
    await writeFile(
      join(other, "sess-2.jsonl"),
      line("m1", 10) + line("m2", 20) + line("m3", 30),
    );
    const s = createUsageState();
    await scanLogs(s, projects);
    s.recent.clear();
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 3, output: 60 });
  });

  it('"usage":{ 표지가 1MB 조각 경계에 걸쳐도 읽는다', async () => {
    const probe = line("m6", 6, { text: "" });
    // 표지가 1MB 경계보다 3바이트 앞에서 시작하게 본문 길이를 맞춘다.
    const n = 1024 * 1024 - 3 - probe.indexOf('"usage":{');
    await writeFile(
      log,
      line("m6", 6, { text: "x".repeat(n) }) + line("m7", 7),
    );
    const s = createUsageState();
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 2, output: 13 });
  });

  it("두 번째 훑기는 늘어난 부분만 읽는다", async () => {
    await writeFile(log, line("m1", 1));
    const s = createUsageState();
    await scanLogs(s, projects);
    const first = s.readBytes;
    await scanLogs(s, projects);
    expect(s.readBytes).toBe(0);
    const more = line("m2", 2);
    await appendFile(log, more);
    await scanLogs(s, projects);
    expect(s.readBytes).toBe(Buffer.byteLength(more));
    expect(first).toBeGreaterThan(0);
  });

  it("서브에이전트 기록은 같은 프로젝트·부모 세션으로 묶고, 작업 폴더는 본 세션 것만 센다", async () => {
    await writeFile(log, line("m1", 1));
    await writeFile(
      join(projects, PROJECT, "sess-1", "subagents", "agent-a.jsonl"),
      line("s1", 9, {
        sidechain: true,
        cwd: "/home/me/personal/projects/starship/.claude/worktrees/agent-a",
      }),
    );
    const s = createUsageState();
    await scanLogs(s, projects);
    const buckets = [...s.buckets.values()];
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({
      project: PROJECT,
      session: "sess-1",
      requests: 2,
      output: 10,
    });
    expect([...(s.cwds.get(PROJECT)?.keys() ?? [])]).toEqual([
      "/home/me/personal/projects/starship",
    ]);
  });

  it("남긴 상태를 다시 읽으면 처음부터 읽지 않고, 이어서 온 줄도 바꿔 끼운다", async () => {
    await writeFile(log, line("m1", 1));
    const cache = join(root, "state", "usage-cache.json");
    await scanLogs(createUsageState(), projects, cache);
    const t = createUsageState();
    await loadCache(t, cache);
    expect(sum(t)).toEqual({ requests: 1, output: 1 });
    await appendFile(log, line("m1", 3));
    await scanLogs(t, projects, cache);
    expect(sum(t)).toEqual({ requests: 1, output: 3 });
  });

  it("파일이 짧아지면(다시 쓰였으면) 그 파일만 처음부터 읽는다", async () => {
    await writeFile(log, line("m1", 1) + line("m2", 2));
    const s = createUsageState();
    await scanLogs(s, projects);
    await writeFile(log, line("m9", 9));
    await scanLogs(s, projects);
    expect(sum(s)).toEqual({ requests: 3, output: 12 });
  });
});
