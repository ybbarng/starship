import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUsageState, loadCache, scanLogs } from "./usage";

/** 실제 기록과 같은 모양의 assistant 줄 */
function line(id: string, output: number, more: Record<string, unknown> = {}) {
  return `${JSON.stringify({
    type: "assistant",
    isSidechain: false,
    cwd: "/home/me/personal/projects/starship",
    sessionId: "sess-1",
    timestamp: new Date().toISOString(),
    message: {
      id,
      model: "claude-opus-5-5",
      usage: {
        input_tokens: 3,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 1000,
        output_tokens: output,
      },
    },
    ...more,
  })}\n`;
}

const userLine = `${JSON.stringify({ type: "user", sessionId: "sess-1", message: { content: "usage 보여줘" } })}\n`;

describe("기록 훑기", () => {
  let root: string;
  let projects: string;
  let log: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "starship-usage-"));
    projects = join(root, "projects");
    await mkdir(
      join(
        projects,
        "-home-me-personal-projects-starship",
        "sess-1",
        "subagents",
      ),
      {
        recursive: true,
      },
    );
    log = join(projects, "-home-me-personal-projects-starship", "sess-1.jsonl");
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
    expect(s.records.size).toBe(2);
    expect(s.records.get("m1")?.output).toBe(40);
  });

  it("반쯤 쓰인 줄은 남겨 두었다가 다 쓰이면 읽는다", async () => {
    const whole = line("m3", 77);
    await writeFile(log, line("m1", 1) + whole.slice(0, 30));
    const s = createUsageState();
    await scanLogs(s, projects);
    expect([...s.records.keys()]).toEqual(["m1"]);
    await appendFile(log, whole.slice(30));
    await scanLogs(s, projects);
    expect(s.records.get("m3")?.output).toBe(77);
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
      join(
        projects,
        "-home-me-personal-projects-starship",
        "sess-1",
        "subagents",
        "agent-a.jsonl",
      ),
      line("s1", 9, {
        isSidechain: true,
        cwd: "/home/me/personal/projects/starship/.claude/worktrees/agent-a",
      }),
    );
    const s = createUsageState();
    await scanLogs(s, projects);
    expect(s.records.get("s1")).toMatchObject({
      project: "-home-me-personal-projects-starship",
      session: "sess-1",
    });
    expect([
      ...(s.cwds.get("-home-me-personal-projects-starship")?.keys() ?? []),
    ]).toEqual(["/home/me/personal/projects/starship"]);
  });

  it("남긴 상태를 다시 읽으면 처음부터 읽지 않는다", async () => {
    await writeFile(log, line("m1", 1));
    const cache = join(root, "state", "usage-cache.json");
    const s = createUsageState();
    await scanLogs(s, projects, cache);
    const t = createUsageState();
    await loadCache(t, cache);
    expect(t.records.size).toBe(1);
    await scanLogs(t, projects, cache);
    expect(t.readBytes).toBe(0);
  });

  it("파일이 짧아지면(다시 쓰였으면) 처음부터 읽는다", async () => {
    await writeFile(log, line("m1", 1) + line("m2", 2));
    const s = createUsageState();
    await scanLogs(s, projects);
    await writeFile(log, line("m9", 9));
    await scanLogs(s, projects);
    expect(s.records.get("m9")?.output).toBe(9);
  });
});
