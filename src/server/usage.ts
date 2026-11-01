// 토큰 사용량: Claude Code 기록(~/.claude/projects/<폴더>/<세션>.jsonl과 <세션>/subagents/*.jsonl)을 읽는다.
// 기록이 수 GB이고 세션이 쉬지 않고 쓰므로 맥북을 붙잡지 않게 다음을 지킨다. 설계: docs/usage.md.
// - 파일마다 (inode, 읽은 위치)를 기억해 늘어난 부분만 읽는다. 쓰는 중인 마지막 줄은 다음 차례로 미룬다.
// - 요청 하나하나가 아니라 날·프로젝트·세션·모델별 합계와 최근 요청 id만 남기고, 디스크에도 그것만 쓴다.
// - 저절로 돌지 않는다. 화면이 물을 때만, 그것도 5분보다 자주 읽지 않는다(다시 읽기 단추는 30초).
// - 1MB씩 줄 단위로 읽고 "usage" 표지가 없는 줄은 글자로 바꾸지도 않는다. 오래 걸리면 쉬어 가며 읽는다.
// STARSHIP_USAGE_DIR이 없으면 데모 데이터를 쓴다.
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
import { setTimeout as sleep } from "node:timers/promises";
import {
  buildDemoUsage,
  DEMO_USAGE_PATHS,
  DEMO_USAGE_RULES,
} from "@/demo/usage";
import {
  applyRecord,
  bucketsFrom,
  buildReport,
  burnRate,
  dayKey,
  HEAD_BYTES,
  keyOf,
  type ProjectPaths,
  parseAreaRules,
  recordFromWindows,
  TAIL_BYTES,
  USAGE_BYTES,
  USAGE_KEY,
  type UsageBucket,
  type UsageRange,
  type UsageRecord,
  type UsageResponse,
} from "@/usage/model";

const DAY = 86_400_000;
/** 30일 화면에 하루 여유를 둔다. 이보다 오래된 합계와 파일은 버린다. */
const KEEP_MS = 32 * DAY;
/** 화면이 물어도 이보다 자주 다시 읽지 않는다. */
export const SCAN_GAP_MS = 5 * 60_000;
/** "다시 읽기"를 눌렀을 때의 최소 간격 */
export const FRESH_GAP_MS = 30_000;
const CHUNK = 1024 * 1024;
/** 같은 요청의 줄은 붙어서 기록되니 최근 id 몇천 개면 중복을 거른다. */
const RECENT_IDS = 5_000;
/** 한 번에 이만큼 넘게 붙잡으면 그만큼 쉰다(코어 하나를 절반쯤만 쓴다). */
const BUSY_MS = 25;
const CACHE_VERSION = 4;

const USAGE_MARK = Buffer.from(USAGE_KEY);
const ASSISTANT_MARK = Buffer.from('"type":"assistant"');

type FileMark = { ino: number; offset: number };

export type UsageState = {
  files: Map<string, FileMark>;
  buckets: Map<string, UsageBucket>;
  /** 최근 요청 id → 그 요청이 더한 값. 같은 요청의 다음 줄이 오면 이걸 빼고 새 값을 더한다 */
  recent: Map<string, UsageRecord>;
  /** 32일 안에 센 요청 id → 날짜. 손으로 복사·이동한 기록 파일에 같은 요청이 또 있으면 거른다 */
  seen: Map<string, string>;
  /** 프로젝트(기록 폴더) → 작업 폴더별 줄 수. 가장 많은 것을 그 프로젝트의 경로로 본다 */
  cwds: Map<string, Map<string, number>>;
  scannedAt: number;
  scanMs: number;
  readBytes: number;
  loaded: boolean;
  running?: Promise<void>;
  /** 읽기용 1MB. 파일마다 새로 만들지 않고 다시 쓴다 */
  buffer: Buffer;
};

const g = globalThis as typeof globalThis & { __starshipUsage?: UsageState };

export function createUsageState(): UsageState {
  return {
    files: new Map(),
    buckets: new Map(),
    recent: new Map(),
    seen: new Map(),
    cwds: new Map(),
    scannedAt: 0,
    scanMs: 0,
    readBytes: 0,
    loaded: false,
    buffer: Buffer.alloc(CHUNK),
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
  opts: { fresh?: boolean; now?: number } = {},
): Promise<UsageResponse> {
  const now = opts.now ?? Date.now();
  const dir = usageDir();
  if (!dir) {
    const records = buildDemoUsage(now);
    const buckets = bucketsFrom(records);
    return {
      ...buildReport(buckets.values(), {
        range,
        now,
        rules: DEMO_USAGE_RULES,
        paths: DEMO_USAGE_PATHS,
      }),
      burn: burnRate(records, {
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
        buckets: buckets.size,
        rules: true,
      },
    };
  }
  const s = state();
  if (!s.loaded) await loadCache(s, cachePath());
  const gap = opts.fresh ? FRESH_GAP_MS : SCAN_GAP_MS;
  if (now - s.scannedAt >= gap) {
    s.running ??= scanLogs(s, dir, cachePath()).finally(() => {
      s.running = undefined;
    });
    await s.running;
  }
  const rules = parseAreaRules(process.env.STARSHIP_USAGE_AREAS, homedir());
  const paths = projectPaths(s);
  return {
    ...buildReport(s.buckets.values(), { range, now, rules, paths }),
    // 지금 속도는 최근 요청(recent, 마지막 5천 개)으로 셈한다. 최대 5분 늦을 수 있다(읽기 간격).
    burn: burnRate(s.recent.values(), { now, rules, paths }),
    meta: {
      source: "local",
      scannedAt: s.scannedAt,
      scanMs: s.scanMs,
      readBytes: s.readBytes,
      files: s.files.size,
      buckets: s.buckets.size,
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
  const pacer = { since: performance.now() };
  let readBytes = 0;
  const seen = new Set<string>();
  for (const { path, project } of await listLogs(dir)) {
    const st = await stat(path).catch(() => undefined);
    if (!st || st.mtimeMs < cutoff) continue;
    seen.add(path);
    const prev = s.files.get(path);
    // 파일이 짧아졌거나(다시 쓰임) 다른 파일이면 그 파일만 처음부터 읽는다.
    const from =
      prev && prev.ino === st.ino && prev.offset <= st.size ? prev.offset : 0;
    if (from < st.size) {
      const offset = await readFrom(path, from, st.size, project, s, pacer);
      readBytes += offset - from;
      s.files.set(path, { ino: st.ino, offset });
    } else s.files.set(path, { ino: st.ino, offset: from });
  }
  for (const path of s.files.keys()) if (!seen.has(path)) s.files.delete(path);
  const oldest = dayKey(cutoff);
  for (const [key, b] of s.buckets) if (b.day < oldest) s.buckets.delete(key);
  for (const [id, day] of s.seen) if (day < oldest) s.seen.delete(id);
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

/**
 * from부터 end까지 1MB씩 읽어 끝난 줄만 처리하고, 처리한 마지막 줄 다음 위치를 돌려준다.
 * 줄마다 세 창(앞 2KB, "usage":{부터 4KB, 끝 4KB)만 쥔다. 조각을 넘는 긴 줄(수 MB짜리 도구 결과)도
 * 그 셋만 남기므로 메모리가 줄 길이만큼 늘지 않는다. "usage":{가 없는 줄은 글자로 바꾸지 않는다.
 */
async function readFrom(
  path: string,
  from: number,
  end: number,
  project: string,
  s: UsageState,
  pacer: { since: number },
): Promise<number> {
  const fh = await open(path, "r");
  try {
    let pos = from;
    let done = from;
    /** 앞 조각에서 끝나지 않은 줄 */
    let long: LongLine | undefined;
    const buf = s.buffer;
    while (pos < end) {
      const { bytesRead } = await fh.read(
        buf,
        0,
        Math.min(CHUNK, end - pos),
        pos,
      );
      if (bytesRead === 0) break;
      const chunk = buf.subarray(0, bytesRead);
      let start = 0;
      for (
        let nl = chunk.indexOf(0x0a, start);
        nl >= 0;
        nl = chunk.indexOf(0x0a, start)
      ) {
        const piece = chunk.subarray(start, nl);
        if (long) {
          long.feed(piece);
          takeWindows(long.head, long.usage, long.tail, project, s);
          long = undefined;
        } else {
          const at = piece.indexOf(USAGE_MARK);
          if (at >= 0)
            takeWindows(
              piece.subarray(0, HEAD_BYTES),
              piece.subarray(at, at + USAGE_BYTES),
              piece.subarray(-TAIL_BYTES),
              project,
              s,
            );
        }
        start = nl + 1;
        done = pos + start;
      }
      // 줄이 조각을 넘으면 세 창만 복사해 둔다(buf는 다음 읽기에 다시 쓴다).
      if (start < bytesRead) {
        long ??= new LongLine();
        long.feed(chunk.subarray(start));
      }
      pos += bytesRead;
      // 오래 붙잡았으면 그만큼 쉬어서 다른 일(화면 요청, 다른 앱)에 자리를 내준다.
      const busy = performance.now() - pacer.since;
      if (busy > BUSY_MS) {
        await sleep(busy);
        pacer.since = performance.now();
      }
    }
    return done;
  } finally {
    await fh.close();
  }
}

/** 1MB 조각을 넘는 줄: 조각을 받으며 세 창(앞, "usage":{부터, 끝)만 남긴다. */
class LongLine {
  head = Buffer.alloc(0);
  usage?: Buffer;
  tail = Buffer.alloc(0);
  /** 표지가 조각 경계에 걸칠 때를 위해 앞 조각의 끝 몇 바이트 */
  private carry = Buffer.alloc(0);

  feed(piece: Buffer) {
    if (this.head.length < HEAD_BYTES)
      this.head = Buffer.concat([
        this.head,
        piece.subarray(0, HEAD_BYTES - this.head.length),
      ]);
    const k = USAGE_MARK.length - 1;
    if (!this.usage) {
      const at = piece.indexOf(USAGE_MARK);
      if (at >= 0)
        this.usage = Buffer.from(piece.subarray(at, at + USAGE_BYTES));
      else {
        const edge = Buffer.concat([this.carry, piece.subarray(0, k)]);
        const b = edge.indexOf(USAGE_MARK);
        if (b >= 0)
          this.usage = Buffer.concat([
            edge.subarray(b),
            piece.subarray(k, k + USAGE_BYTES),
          ]).subarray(0, USAGE_BYTES);
        else this.carry = Buffer.from(piece.subarray(-k));
      }
    } else if (this.usage.length < USAGE_BYTES)
      this.usage = Buffer.concat([
        this.usage,
        piece.subarray(0, USAGE_BYTES - this.usage.length),
      ]);
    this.tail =
      piece.length >= TAIL_BYTES
        ? Buffer.from(piece.subarray(-TAIL_BYTES))
        : Buffer.from(Buffer.concat([this.tail, piece]).subarray(-TAIL_BYTES));
  }
}

/** 세 창이 갖춰지고 assistant 줄이면 글자로 바꿔 읽는다(창마다 몇 KB). */
function takeWindows(
  head: Buffer,
  usage: Buffer | undefined,
  tail: Buffer,
  project: string,
  s: UsageState,
) {
  if (!usage) return;
  if (!tail.includes(ASSISTANT_MARK) && !head.includes(ASSISTANT_MARK)) return;
  take(
    head.toString("utf8"),
    usage.toString("utf8"),
    tail.toString("utf8"),
    project,
    s,
  );
}

function take(
  head: string,
  usage: string,
  tail: string,
  project: string,
  s: UsageState,
) {
  const got = recordFromWindows(head, usage, tail, project);
  if (!got) return;
  const r = got.record;
  const prev = s.recent.get(r.id);
  if (prev) {
    // 한 요청이 여러 줄로 남는다(붙어서). 앞 줄이 더한 값을 빼고 이 줄 값으로 바꾼다.
    applyRecord(s.buckets, prev, -1);
    s.recent.delete(r.id);
  } else if (s.seen.has(r.id)) {
    // 기록 파일을 손으로 복사·이동하면 같은 요청이 두 파일에 있게 된다(2026-11-01 mighty→game 폴더 이사: 한 파일 6천 개 중 5.6천 개).
    // 이미 센 요청이니 건너뛴다.
    return;
  }
  applyRecord(s.buckets, r, 1);
  s.recent.set(r.id, r);
  s.seen.set(r.id, dayKey(r.t));
  if (s.recent.size > RECENT_IDS) {
    const oldest = s.recent.keys().next().value;
    if (oldest !== undefined) s.recent.delete(oldest);
  }
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
  buckets: UsageBucket[];
  recent: UsageRecord[];
  seen: [string, string][];
  cwds: [string, [string, number][]][];
};

export async function loadCache(s: UsageState, file: string) {
  s.loaded = true;
  try {
    const c = JSON.parse(await readFile(file, "utf8")) as Cache;
    if (c.v !== CACHE_VERSION) return;
    s.files = new Map(c.files);
    s.buckets = new Map();
    for (const b of c.buckets) s.buckets.set(keyOf(b), b);
    s.recent = new Map(c.recent.map((r) => [r.id, r]));
    s.seen = new Map(c.seen);
    s.cwds = new Map(c.cwds.map(([p, list]) => [p, new Map(list)]));
  } catch {
    // 없거나 깨졌거나 옛 형식이면 처음부터 읽는다.
  }
}

async function saveCache(s: UsageState, file: string) {
  const c: Cache = {
    v: CACHE_VERSION,
    scannedAt: s.scannedAt,
    files: [...s.files],
    buckets: [...s.buckets.values()],
    recent: [...s.recent.values()],
    seen: [...s.seen],
    cwds: [...s.cwds].map(([p, m]) => [p, [...m]]),
  };
  await mkdir(join(file, ".."), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(c));
  await rename(tmp, file);
}
