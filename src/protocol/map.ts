// 지도 형식 starship-map/1. 프로젝트 저장소 안의 map.json 한 장이 프로젝트 전체 그림이다.
// 이 파일이 스키마의 원본이다. 비서도 같은 규칙(검사·진행률)으로 읽으니 여기 함수는 모두 순수 함수로 둔다.
// 자세한 설명은 docs/map.md.
import { z } from "zod";

export const MAP_FORMAT = "starship-map/1" as const;

/** 구역 안에 구역을 둘 수 있는 깊이. 맨 위 구역이 1단이다. */
export const MAX_DEPTH = 3;

/** "새 땅"으로 보이는 기간: 발견된 지 7일 안. */
export const NEW_FOUND_MS = 7 * 86_400_000;

/** 날짜("2026-10-22")나 시각("2026-10-29T10:12:00+09:00"). 읽을 수 있는 글이면 받는다. */
const When = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "날짜로 읽을 수 없어요");

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
  url: z.url().optional(),
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

export type MapParse =
  | { ok: true; map: ProjectMap; problems: [] }
  | { ok: false; map: null; problems: string[] };

/** map.json 내용(이미 JSON.parse한 값)을 읽어 형식과 짜임을 함께 검사한다. */
export function parseMap(raw: unknown): MapParse {
  const parsed = ProjectMap.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      map: null,
      problems: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(맨 위)"}: ${i.message}`,
      ),
    };
  }
  const problems = checkMap(parsed.data);
  return problems.length > 0
    ? { ok: false, map: null, problems }
    : { ok: true, map: parsed.data, problems: [] };
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
  return now - Date.parse(region.found) <= NEW_FOUND_MS;
}
