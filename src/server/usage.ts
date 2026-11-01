// 토큰 사용량: Claude Code 기록(~/.claude/projects/<폴더>/<세션>.jsonl과 <세션>/subagents/*.jsonl)을 읽는다.
// 기록이 수 GB라 파일마다 읽은 위치(offset)를 기억해 늘어난 부분만 읽고, 그 상태를 디스크에 남겨
// 앱을 다시 띄워도 처음부터 읽지 않는다. STARSHIP_USAGE_DIR이 없으면 데모 데이터를 쓴다. 설계: docs/usage.md.
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildDemoUsage,
  DEMO_USAGE_PATHS,
  DEMO_USAGE_RULES,
} from "@/demo/usage";
import {
  buildReport,
  type ProjectPaths,
  parseAreaRules,
  recordFromLine,
  type UsageRange,
  type UsageRecord,
  type UsageResponse,
} from "@/usage/model";

const DAY = 86_400_000;
/** 30일 화면에 하루 여유를 둔다. 이보다 오래된 요청과 파일은 버린다. */
const KEEP_MS = 32 * DAY;
/** 이보다 자주 다시 훑지 않는다. */
const MIN_SCAN_GAP_MS = 30_000;
const CHUNK = 4 * 1024 * 1024;
const CACHE_VERSION = 1;

type FileMark = { ino: number; offset: number };

export type UsageState = {
  files: Map<string, FileMark>;
  records: Map<string, UsageRecord>;
  /** 프로젝트(기록 폴더) → 작업 폴더별 요청 수. 가장 많은 것을 그 프로젝트의 경로로 본다 */
  cwds: Map<string, Map<string, number>>;
  scannedAt: number;
  scanMs: number;
  readBytes: number;
  loaded: boolean;
  running?: Promise<void>;
};

const g = globalThis as typeof globalThis & { __starshipUsage?: UsageState };

export function createUsageState(): UsageState {
  return {
    files: new Map(),
    records: new Map(),
    cwds: new Map(),
    scannedAt: 0,
    scanMs: 0,
    readBytes: 0,
    loaded: false,
  };
}

function state(): UsageState {
  g.__starshipUsage ??= createUsageState();
  return g.__starshipUsage;
}

function expandHome(p: string): string {
  return p.startsWith("~") ? homedir() + p.slice(1) : p;
}

function usageDir(): string | undefined {
  const v = process.env.STARSHIP_USAGE_DIR?.trim();
  return v ? expandHome(v) : undefined;
}

function cachePath(): string {
  const dir = expandHome(
    process.env.STARSHIP_STATE_DIR?.trim() || "~/.local/state/starship",
  );
  return join(dir, "usage-cache.json");
}

export async function getUsage(
  range: UsageRange,
  now = Date.now(),
): Promise<UsageResponse> {
  const dir = usageDir();
  if (!dir) {
    const records = buildDemoUsage(now);
    return {
      ...buildReport(records, {
        range,
        now,
        rules: DEMO_USAGE_RULES,
        paths: DEMO_USAGE_PATHS,
      }),
      meta: {
        source: "demo",
        scannedAt: now,
        scanMs: 0,
        readBytes: 0,
        files: 0,
        records: records.length,
        rules: true,
      },
    };
  }
  const s = state();
  if (!s.loaded) await loadCache(s, cachePath());
  if (now - s.scannedAt >= MIN_SCAN_GAP_MS) {
    s.running ??= scanLogs(s, dir, cachePath()).finally(() => {
      s.running = undefined;
    });
    await s.running;
  }
  const rules = parseAreaRules(process.env.STARSHIP_USAGE_AREAS, homedir());
  return {
    ...buildReport(s.records.values(), {
      range,
      now,
      rules,
      paths: projectPaths(s),
    }),
    meta: {
      source: "local",
      scannedAt: s.scannedAt,
      scanMs: s.scanMs,
      readBytes: s.readBytes,
      files: s.files.size,
      records: s.records.size,
      rules: rules.length > 0,
    },
  };
}

function projectPaths(s: UsageState): ProjectPaths {
  const out: ProjectPaths = {};
  for (const [project, counts] of s.cwds) {
    let best: string | undefined;
    let n = -1;
    for (const [cwd, c] of counts)
      if (c > n) {
        best = cwd;
        n = c;
      }
    out[project] = best;
  }
  return out;
}

/* ───────────── 훑기 ───────────── */

/** 기록 폴더를 훑어 늘어난 부분만 읽는다. cacheFile을 주면 새로 읽은 것이 있을 때 상태를 남긴다. */
export async function scanLogs(
  s: UsageState,
  dir: string,
  cacheFile?: string,
  started = Date.now(),
): Promise<void> {
  const cutoff = started - KEEP_MS;
  let readBytes = 0;
  const seen = new Set<string>();
  for (const { path, project } of await listLogs(dir)) {
    const st = await stat(path).catch(() => undefined);
    if (!st || st.mtimeMs < cutoff) continue;
    seen.add(path);
    const prev = s.files.get(path);
    // 파일이 바뀌어 짧아졌거나 다른 파일이면 처음부터 다시 읽는다.
    const from =
      prev && prev.ino === st.ino && prev.offset <= st.size ? prev.offset : 0;
    if (from === st.size) {
      s.files.set(path, { ino: st.ino, offset: from });
      continue;
    }
    const offset = await readFrom(path, from, st.size, project, s);
    readBytes += offset - from;
    s.files.set(path, { ino: st.ino, offset });
  }
  for (const path of s.files.keys()) if (!seen.has(path)) s.files.delete(path);
  for (const [id, r] of s.records) if (r.t < cutoff) s.records.delete(id);
  s.scannedAt = Date.now();
  s.scanMs = s.scannedAt - started;
  s.readBytes = readBytes;
  if (cacheFile && readBytes > 0)
    await saveCache(s, cacheFile).catch(() => undefined);
}

/** 기록 파일 목록: 폴더마다 세션 기록과 그 세션의 서브에이전트 기록. */
async function listLogs(
  dir: string,
): Promise<{ path: string; project: string }[]> {
  const out: { path: string; project: string }[] = [];
  const projects = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const p of projects) {
    if (!p.isDirectory()) continue;
    const pdir = join(dir, p.name);
    for (const e of await readdir(pdir, { withFileTypes: true }).catch(
      () => [],
    )) {
      if (e.isFile() && e.name.endsWith(".jsonl"))
        out.push({ path: join(pdir, e.name), project: p.name });
      else if (e.isDirectory()) {
        const sub = join(pdir, e.name, "subagents");
        for (const f of await readdir(sub).catch(() => []))
          if (f.endsWith(".jsonl"))
            out.push({ path: join(sub, f), project: p.name });
      }
    }
  }
  return out;
}

/** from부터 end까지 읽어 끝난 줄만 처리하고, 처리한 마지막 줄 다음 위치를 돌려준다. */
async function readFrom(
  path: string,
  from: number,
  end: number,
  project: string,
  s: UsageState,
): Promise<number> {
  const fh = await open(path, "r");
  try {
    let pos = from;
    let done = from;
    let rest = Buffer.alloc(0);
    const buf = Buffer.alloc(CHUNK);
    while (pos < end) {
      const { bytesRead } = await fh.read(
        buf,
        0,
        Math.min(CHUNK, end - pos),
        pos,
      );
      if (bytesRead === 0) break;
      pos += bytesRead;
      const data = rest.length
        ? Buffer.concat([rest, buf.subarray(0, bytesRead)])
        : buf.subarray(0, bytesRead);
      const last = data.lastIndexOf(0x0a);
      if (last < 0) {
        rest = Buffer.from(data);
        continue;
      }
      for (const line of data.subarray(0, last).toString("utf8").split("\n"))
        take(line, project, s);
      // data는 pos에서 끝난다. 마지막 줄바꿈 뒤의 남은 조각은 다음에 이어 읽는다.
      done = pos - (data.length - last - 1);
      rest = Buffer.from(data.subarray(last + 1));
    }
    return done;
  } finally {
    await fh.close();
  }
}

function take(line: string, project: string, s: UsageState) {
  const got = recordFromLine(line, project);
  if (!got) return;
  // 한 요청이 여러 줄에 걸쳐 남는다. 같은 id면 나중 줄로 덮어 마지막 줄만 센다.
  s.records.set(got.record.id, got.record);
  if (got.cwd && !got.sidechain) {
    const counts = s.cwds.get(project) ?? new Map<string, number>();
    counts.set(got.cwd, (counts.get(got.cwd) ?? 0) + 1);
    s.cwds.set(project, counts);
  }
}

/* ───────────── 디스크에 남기기 ───────────── */

type Cache = {
  v: number;
  scannedAt: number;
  files: [string, FileMark][];
  records: UsageRecord[];
  cwds: [string, [string, number][]][];
};

export async function loadCache(s: UsageState, file: string) {
  s.loaded = true;
  try {
    const c = JSON.parse(await readFile(file, "utf8")) as Cache;
    if (c.v !== CACHE_VERSION) return;
    s.files = new Map(c.files);
    s.records = new Map(c.records.map((r) => [r.id, r]));
    s.cwds = new Map(c.cwds.map(([p, list]) => [p, new Map(list)]));
  } catch {
    // 없거나 깨졌으면 처음부터 읽는다.
  }
}

async function saveCache(s: UsageState, file: string) {
  const c: Cache = {
    v: CACHE_VERSION,
    scannedAt: s.scannedAt,
    files: [...s.files],
    records: [...s.records.values()],
    cwds: [...s.cwds].map(([p, m]) => [p, [...m]]),
  };
  await mkdir(join(file, ".."), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(c));
  await rename(tmp, file);
}
