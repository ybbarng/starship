// 지도 형식 starship-map/1. 프로젝트 저장소 안의 map.json 한 장이 프로젝트 전체 그림이다.
// 이 파일이 스키마의 원본이다. 비서도 같은 규칙(검사·진행률)으로 읽으니 여기 함수는 모두 순수 함수로 둔다.
// 자세한 설명은 docs/map.md.
import { z } from "zod";
import {
  issuesText,
  itemLabel,
  parseEach,
  parseWhen,
  WebUrl,
  When,
} from "./common";

export const MAP_FORMAT = "starship-map/1" as const;

/** 구역 안에 구역을 둘 수 있는 깊이. 맨 위 구역이 1단이다. */
export const MAX_DEPTH = 3;

/** "새 땅"으로 보이는 기간: 발견된 지 7일 안. */
export const NEW_FOUND_MS = 7 * 86_400_000;

/**
 * 구역 상태.
 * - fog: 안개. 아직 손대지 않았고 윤곽만 안다
 * - building: 공사중
 * - done: 완공
 * - blocked: 막힘
 * - dropped: 버림. 진행률에서 빠지고 화면에서는 기본으로 숨긴다
 */
export const RegionStatus = z.enum([
  "fog",
  "building",
  "done",
  "blocked",
  "dropped",
]);
export type RegionStatus = z.infer<typeof RegionStatus>;

/** 구역이 가리키는 문서. path는 저장소 안 파일, url은 바깥 주소. */
export const RegionLink = z.object({
  label: z.string().min(1),
  path: z.string().min(1).optional(),
  url: WebUrl.optional(),
});
export type RegionLink = z.infer<typeof RegionLink>;

/** 갈림길: 정해야 할 것. owner가 "me"면 나(지도를 보는 사람)가 정한다. */
export const ForkSign = z.object({
  id: z.string().min(1),
  type: z.literal("fork"),
  title: z.string().min(1),
  owner: z.string().min(1),
  options: z.array(z.string().min(1)).optional(),
  recommend: z.string().optional(),
  status: z.enum(["open", "decided"]),
  decided: z.string().optional(),
});

/** 교신: 다른 사람과 이야기해야 하는 것. 초안 → 보냄 → 답 기다림 → 끝. */
export const TalkSign = z.object({
  id: z.string().min(1),
  type: z.literal("talk"),
  title: z.string().min(1),
  with: z.string().min(1),
  status: z.enum(["draft", "sent", "waiting", "done"]),
  path: z.string().optional(),
});

/** 위험: 아직 답이 없는 걱정거리. */
export const RiskSign = z.object({
  id: z.string().min(1),
  type: z.literal("risk"),
  title: z.string().min(1),
});

export const Sign = z.discriminatedUnion("type", [
  ForkSign,
  TalkSign,
  RiskSign,
]);
export type Sign = z.infer<typeof Sign>;
export type SignType = Sign["type"];

export const Region = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 감싸는 구역 id. 없으면 맨 위 구역(대륙). */
  parent: z.string().min(1).optional(),
  status: RegionStatus,
  /** 1~5, 대략의 크기. 지도에서 차지하는 넓이이자 진행률의 무게. */
  size: z.number().int().min(1).max(5).default(1),
  summary: z.string().optional(),
  next: z.string().optional(),
  /** 이 상태가 된 날. */
  since: When.optional(),
  /** 처음 계획에 없다가 생긴 구역만 적는다. 생긴 날. */
  found: When.optional(),
  links: z.array(RegionLink).optional(),
  signs: z.array(Sign).optional(),
});
export type Region = z.infer<typeof Region>;

/** map.json 한 장. 모르는 필드는 버린다(같은 버전 안에서 필드를 더할 수 있게). */
export const ProjectMap = z.object({
  map: z.literal(MAP_FORMAT),
  title: z.string().min(1),
  /** 끝났다고 볼 기준. */
  goal: z.string().optional(),
  /** 처음 계획을 세운 날. 이날 이후 생긴 구역이 "발견". */
  baselineAt: When.optional(),
  updatedAt: When.optional(),
  /** 지금 공사하는 구역 id. */
  here: z.string().min(1).optional(),
  regions: z.array(Region),
});
export type ProjectMap = z.infer<typeof ProjectMap>;

/* ───────────── 검사 ───────────── */

/**
 * 스키마로 잡지 못하는 짜임 검사: id 중복, 없는 parent, 고리, 깊이, 없는 here, 구역 안 표지 id 중복.
 * 문제가 없으면 빈 배열. 사람이 읽을 한 줄씩 돌려준다.
 */
export function checkMap(map: ProjectMap): string[] {
  const problems: string[] = [];
  const byId = new Map<string, Region>();
  for (const r of map.regions) {
    if (byId.has(r.id)) problems.push(`구역 id "${r.id}"가 겹쳐요`);
    else byId.set(r.id, r);
  }
  for (const r of byId.values()) {
    if (r.parent === undefined) continue;
    if (r.parent === r.id) problems.push(`구역 "${r.id}"가 자기 자신을 감싸요`);
    else if (!byId.has(r.parent))
      problems.push(`구역 "${r.id}"의 parent "${r.parent}"가 없어요`);
  }
  // 고리와 깊이: 위로 올라가며 센다. 고리가 있으면 같은 구역을 다시 만난다.
  const reported = new Set<string>();
  for (const r of byId.values()) {
    const seen = new Set<string>([r.id]);
    let depth = 1;
    let cur = r;
    while (cur.parent !== undefined && cur.parent !== cur.id) {
      const up = byId.get(cur.parent);
      if (!up) break;
      if (seen.has(up.id)) {
        const key = [...seen].sort().join(",");
        if (!reported.has(key)) {
          reported.add(key);
          problems.push(`구역 "${r.id}"의 parent를 따라가면 고리가 생겨요`);
        }
        depth = 0;
        break;
      }
      seen.add(up.id);
      depth++;
      cur = up;
    }
    if (depth > MAX_DEPTH)
      problems.push(
        `구역 "${r.id}"가 ${depth}단이에요. ${MAX_DEPTH}단까지 둘 수 있어요`,
      );
  }
  if (map.here !== undefined && !byId.has(map.here))
    problems.push(`here "${map.here}" 구역이 없어요`);
  for (const r of byId.values()) {
    const ids = new Set<string>();
    for (const s of r.signs ?? []) {
      if (ids.has(s.id))
        problems.push(`구역 "${r.id}"에 표지 id "${s.id}"가 겹쳐요`);
      ids.add(s.id);
    }
  }
  return problems;
}

/**
 * 지도를 읽은 결과. ok면 map은 checkMap을 통과하는 지도이고, problems에는 빼거나 옮긴 것이 한 줄씩 남는다(없으면 빈 배열).
 * 겉(map 이름·title·regions 배열 자체 등)이 틀릴 때만 ok가 false이고 map이 null이다.
 */
export type MapParse =
  | { ok: true; map: ProjectMap; problems: string[] }
  | { ok: false; map: null; problems: string[] };

/** 지도의 겉. 구역은 아직 보지 않는다. */
const MapShell = ProjectMap.extend({ regions: z.array(z.unknown()) });

/** 구역 하나의 필드. links·signs는 항목마다 따로 봐서 틀린 링크·표지만 뺀다. */
const RegionFields = Region.extend({
  links: z.array(z.unknown()).optional(),
  signs: z.array(z.unknown()).optional(),
});

/** 읽은 구역과, problems에 쓸 머리말("regions[3] (id a)"). */
type Entry = { r: Region; at: string };

function withoutParent(r: Region): Region {
  const { parent: _, ...rest } = r;
  return rest;
}

/** 구역 id → 깊이(맨 위가 1). 고리가 없다고 본다(고리는 먼저 끊는다). */
function depthOf(r: Region, byId: Map<string, Entry>): number {
  let depth = 1;
  let cur = r;
  for (let i = 0; cur.parent !== undefined && i <= byId.size; i++) {
    const up = byId.get(cur.parent);
    if (!up) break;
    depth++;
    cur = up.r;
  }
  return depth;
}

/**
 * map.json 내용(이미 JSON.parse한 값)을 읽는다(2026-11-03, 스냅숏·책상과 같이 틀린 것만 뺀다).
 * 구역은 parent로 서로 이어져 있어 하나만 빼면 뜻이 달라질 수 있다. 그래서 고르는 길이 둘이다.
 *
 * ① 구역 하나의 필드 형식이 틀리면 그 구역을 빼고, 그 아래 구역(자손)도 함께 뺀다.
 *    자손을 맨 위로 올리지 않는 까닭: 자손의 제목·크기는 감싸는 구역 안에서 뜻이 있고(예: "서버: 결제"),
 *    감싸던 구역이 버림(dropped)이었다면 올린 자손이 진행률에 다시 들어와 숫자가 틀어진다.
 *    보이지 않는 것이 틀린 그림을 보이는 것보다 낫다. 뺀 까닭은 자손마다 problems에 남는다.
 * ② 필드는 맞는데 짜임만 틀리면(없는 parent, 자기 자신을 감쌈, 고리, 3단 넘김) 그 구역만 맨 위로 올린다.
 *    이때는 구역 자체의 내용이 맞으니 지우지 않고, 어디에 붙을지만 모르는 것으로 본다.
 *    고리는 고리 속 구역 가운데 지도에 가장 먼저 적힌 하나를 올려 끊는다. 깊이는 얕은 구역부터 올린다
 *    (감싸는 구역을 올리면 그 아래가 따라 올라가 더 올릴 것이 줄어든다).
 * ③ 겉이 틀리면 지금처럼 지도 전체를 거절한다.
 *
 * 그 밖에: 겹친 구역 id는 앞쪽을 남기고 뒤쪽을 뺀다(자손은 앞쪽에 붙는다). 링크·표지는 틀린 것만 빼고,
 * 한 구역 안 겹친 표지 id도 뒤쪽만 뺀다. here가 가리키는 구역이 없으면 here만 뺀다.
 * 돌려준 지도는 checkMap을 늘 통과한다.
 */
export function parseMap(raw: unknown): MapParse {
  const shell = MapShell.safeParse(raw);
  if (!shell.success) {
    return {
      ok: false,
      map: null,
      problems: shell.error.issues.map(
        (i) => `${i.path.join(".") || "(맨 위)"}: ${i.message}`,
      ),
    };
  }
  const problems: string[] = [];
  const note = (e: Entry, why: string) => problems.push(`${e.at}: ${why}`);

  // 1. 구역마다 필드를 읽는다. 틀린 구역의 id는 자손을 찾으려고 남겨 둔다.
  const failed = new Set<string>();
  let entries: Entry[] = [];
  const kept = new Set<string>();
  shell.data.regions.forEach((v, i) => {
    const at = itemLabel("regions", i, v);
    const r = RegionFields.safeParse(v);
    if (!r.success) {
      problems.push(`${at}: ${issuesText(r.error)}`);
      const id = (v as { id?: unknown } | null)?.id;
      if (typeof id === "string") failed.add(id);
      return;
    }
    if (kept.has(r.data.id)) {
      problems.push(`${at}: id가 앞 구역과 겹쳐 뺐어요`);
      return;
    }
    const { links, signs, ...rest } = r.data;
    const region: Region = { ...rest };
    if (links)
      region.links = parseEach(links, RegionLink, `${at}.links`, problems);
    if (signs)
      region.signs = parseEach(signs, Sign, `${at}.signs`, problems, {
        keyOf: (s) => s.id,
      });
    kept.add(region.id);
    entries.push({ r: region, at });
  });

  // 2. 틀려서 뺀 구역의 자손도 뺀다(①). 같은 id가 남아 있으면 자손은 그쪽에 붙으니 빼지 않는다.
  const gone = new Set([...failed].filter((id) => !kept.has(id)));
  for (let changed = true; changed; ) {
    changed = false;
    entries = entries.filter((e) => {
      const p = e.r.parent;
      if (p === undefined || !gone.has(p)) return true;
      note(e, `감싸는 구역 "${p}"가 빠져 함께 뺐어요`);
      gone.add(e.r.id);
      changed = true;
      return false;
    });
  }

  // 3. 짜임만 틀린 구역은 맨 위로 올린다(②).
  const byId = new Map(entries.map((e) => [e.r.id, e]));
  const lift = (e: Entry, why: string) => {
    e.r = withoutParent(e.r);
    note(e, `${why} 맨 위로 올렸어요`);
  };
  for (const e of entries) {
    const p = e.r.parent;
    if (p === undefined) continue;
    if (p === e.r.id) lift(e, "자기 자신을 감싸서");
    else if (!byId.has(p)) lift(e, `parent "${p}"가 없어`);
  }
  for (const e of entries) {
    // 위로 올라가며 지나온 길. 이미 지나온 구역을 다시 만나면 그 뒤쪽이 고리다
    const path: Entry[] = [e];
    let cur = e;
    while (cur.r.parent !== undefined) {
      const up = byId.get(cur.r.parent);
      if (!up) break;
      const at = path.indexOf(up);
      if (at >= 0) {
        // 고리 속 구역 가운데 지도에 가장 먼저 적힌 것을 올린다
        const ring = path.slice(at);
        const first = ring.reduce((a, b) =>
          entries.indexOf(b) < entries.indexOf(a) ? b : a,
        );
        lift(first, "parent를 따라가면 고리가 생겨");
        break;
      }
      path.push(up);
      cur = up;
    }
  }
  const byDepth = [...entries].sort(
    (a, b) => depthOf(a.r, byId) - depthOf(b.r, byId),
  );
  for (const e of byDepth) {
    const depth = depthOf(e.r, byId);
    if (depth > MAX_DEPTH)
      lift(e, `${depth}단이라(${MAX_DEPTH}단까지 둘 수 있어요)`);
  }

  const { here, ...top } = shell.data;
  const map: ProjectMap = { ...top, regions: entries.map((e) => e.r) };
  if (here !== undefined) {
    if (byId.has(here)) map.here = here;
    else problems.push(`here "${here}" 구역이 없어 뺐어요`);
  }
  return { ok: true, map, problems };
}

/* ───────────── 계층 ───────────── */

/** 구역 id → 바로 아래 구역들(지도에 적힌 순서). 맨 위 구역은 키 ""에 둔다. */
export function childrenOf(map: ProjectMap): Map<string, Region[]> {
  const ids = new Set(map.regions.map((r) => r.id));
  const out = new Map<string, Region[]>();
  for (const r of map.regions) {
    const key = r.parent !== undefined && ids.has(r.parent) ? r.parent : "";
    const list = out.get(key) ?? [];
    list.push(r);
    out.set(key, list);
  }
  return out;
}

/** 자신이나 조상 중 하나가 버림이면 버린 것으로 본다. 검사를 통과한 지도(고리 없음)를 전제한다. */
export function droppedIds(map: ProjectMap): Set<string> {
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const out = new Set<string>();
  for (const r of map.regions) {
    let cur: Region | undefined = r;
    for (let i = 0; cur && i <= map.regions.length; i++) {
      if (cur.status === "dropped") {
        out.add(r.id);
        break;
      }
      cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
    }
  }
  return out;
}

/* ───────────── 진행률 ───────────── */

export type MapProgress = {
  /** 완공한 크기 합 */
  done: number;
  /** 버림을 뺀 전체 크기 합 */
  total: number;
  /** done ÷ total, 0..1. 셀 것이 없으면 0 */
  ratio: number;
};

/**
 * 진행률은 size 합으로 센다: 완공 크기 ÷ 버림을 뺀 전체 크기.
 * 자식이 있는 구역은 자기 size 대신 자식으로만 센다. 버린 구역과 그 아래는 모두 뺀다.
 * 자식이 모두 버림이면 그 구역은 자식이 없는 것처럼 자기 크기로 센다.
 */
export function mapProgress(map: ProjectMap): MapProgress {
  const dropped = droppedIds(map);
  const kids = childrenOf(map);
  let done = 0;
  let total = 0;
  for (const r of map.regions) {
    if (dropped.has(r.id)) continue;
    const live = (kids.get(r.id) ?? []).some((k) => !dropped.has(k.id));
    if (live) continue;
    total += r.size;
    if (r.status === "done") done += r.size;
  }
  return { done, total, ratio: total > 0 ? done / total : 0 };
}

/** 갑판에 작게 보일 지도 요약. Crew.map의 stale을 뺀 나머지와 같다. */
export type MapSummary = {
  /** 진행률 0..1 */
  progress: number;
  /** 버림을 뺀 구역 수 */
  regions: number;
  /** 그 가운데 발견된(처음 계획에 없던) 구역 수 */
  found: number;
  /** 내가 정할 열린 갈림길 수 */
  forksForMe: number;
};

export function summarizeMap(map: ProjectMap): MapSummary {
  const dropped = droppedIds(map);
  const live = map.regions.filter((r) => !dropped.has(r.id));
  return {
    progress: mapProgress(map).ratio,
    regions: live.length,
    found: live.filter((r) => r.found !== undefined).length,
    forksForMe: live.flatMap((r) => r.signs ?? []).filter(isForkForMe).length,
  };
}

/** 내가 정할 열린 갈림길인가. */
export function isForkForMe(sign: Sign): boolean {
  return sign.type === "fork" && sign.owner === "me" && sign.status === "open";
}

/** 발견된 지 7일 안이면 "새 땅". */
export function isNewFound(region: Region, now: number): boolean {
  if (region.found === undefined) return false;
  return now - parseWhen(region.found) <= NEW_FOUND_MS;
}
