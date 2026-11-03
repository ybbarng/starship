// 화면이 받는 데이터의 출처. 기본은 데모, STARSHIP_SERVER_URL이 있으면 그 서버(프로토콜 v1)를 쓴다.

import { z } from "zod";
import type { LinkMode } from "@/demo/link";
import {
  buildBigDemoMap,
  buildDemoMap,
  DEMO_BIG_MAP_CREW,
  DEMO_MAP_CREW,
} from "@/demo/map";
import { demoMapHistory } from "@/demo/mapHistory";
import {
  buildSnapshot,
  createDemoState,
  type DemoState,
  demoDesks,
  type Scenario,
} from "@/demo/scenario";
import { parseWhen } from "@/protocol/common";
import { answerKey, parseDesk } from "@/protocol/desk";
import { type ProjectMap, parseMap } from "@/protocol/map";
import {
  type ActionRequest,
  ActionResult,
  CrewDeskResponse,
  type CrewMapHistoryResponse,
  CrewMapResponse,
  Snapshot,
} from "@/protocol/v1";
import { dedupeDesk, dedupeSnapshot } from "./dedupe";
import { ACTION_TIMEOUT_MS, createShared, fetchUpstream } from "./upstream";

const HOUR = 3_600_000;

export type SourceInfo = { mode: "demo" } | { mode: "remote"; base: string };

export function sourceInfo(): SourceInfo {
  const base = process.env.STARSHIP_SERVER_URL?.trim();
  return base
    ? { mode: "remote", base: base.replace(/\/$/, "") }
    : { mode: "demo" };
}

// dev 서버가 모듈을 다시 읽어도 데모 상태가 이어지게 globalThis에 둔다.
// 자리(seat, 보통 페이지 경로)마다 따로 두어 여러 시안이 서로의 데모를 건드리지 않게 한다.
const g = globalThis as typeof globalThis & {
  __starshipDemoSeats?: Map<string, DemoState>;
};
/** 자리 이름 길이 상한. 주소의 seat 쿼리를 그대로 쓰니 끝없이 긴 이름을 받지 않는다. */
export const MAX_SEAT_CHARS = 200;
/** 데모 자리 수 상한. 넘으면 가장 오래 안 쓴 자리를 버린다(아무 seat로 메모리를 채우지 못하게). */
export const MAX_DEMO_SEATS = 50;

function demoSeats() {
  g.__starshipDemoSeats ??= new Map();
  return g.__starshipDemoSeats;
}

/** 자리를 쓴다: 맨 뒤(가장 최근)로 옮기고, 많으면 맨 앞(가장 오래 안 쓴 것)부터 버린다. */
function putSeat(seat: string, s: DemoState) {
  const seats = demoSeats();
  seats.delete(seat);
  seats.set(seat, s);
  while (seats.size > MAX_DEMO_SEATS) {
    const oldest = seats.keys().next().value;
    if (oldest === undefined) break;
    seats.delete(oldest);
  }
}

function demoState(rawSeat: string) {
  const seat = rawSeat.slice(0, MAX_SEAT_CHARS);
  const s = demoSeats().get(seat) ?? createDemoState();
  putSeat(seat, s);
  return s;
}

export function resetDemo(seat: string) {
  putSeat(seat.slice(0, MAX_SEAT_CHARS), createDemoState());
}

/** 지금 데모 자리 수(시험용). */
export function demoSeatCount(): number {
  return demoSeats().size;
}

// 탭 여러 개가 몇 초마다 같은 것을 물어도 본부에는 1.5초에 한 번만(src/server/upstream.ts)
const shared = createShared();

export async function getSnapshot(
  scenario: Scenario,
  seat = "default",
  link: LinkMode = "ok",
): Promise<Snapshot> {
  const info = sourceInfo();
  if (info.mode === "demo")
    return buildSnapshot(demoState(seat), scenario, Date.now(), link);
  const url = `${info.base}/v1/snapshot`;
  return shared.get(url, async () => {
    const res = await fetchUpstream(url);
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    // 틀린 항목은 빼고 problems에(src/protocol/v1.ts). 같은 승무원·할 일을 두 번 보내도 화면에는 하나만(src/server/dedupe.ts)
    return dedupeSnapshot(Snapshot.parse(await res.json()));
  });
}

/**
 * 승무원 하나의 지도. 서버 연결 모드는 {base}/v1/crew/{id}/map 을 그대로 중계한다.
 * 지도의 겉이 이 화면이 아는 것과 다르면 응답 전체를 버리지 않고 map: null과 problems로 바꾼다.
 * 구역·링크·표지 하나가 틀리면 그것만 빼거나 맨 위로 올리고 나머지는 보인다.
 */
export async function getCrewMap(
  crewId: string,
  // 데모 지도는 데모 시작 시각을 쓰고, 서버 연결 모드는 시각을 받지 않는다. 부르는 쪽 자리를 지키려 남겨 둔다
  _now = Date.now(),
  seat = "default",
): Promise<CrewMapResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    // 지도 시각도 데모 시작 기준(src/demo/scenario.ts DemoState.startedAt). 내용이 같으면 같은 값
    const { decidedSigns: decided, startedAt } = demoState(seat);
    if (crewId === DEMO_BIG_MAP_CREW)
      return {
        map: applyDecided(buildBigDemoMap(startedAt), crewId, decided),
        stale: false,
        mapAt: startedAt - HOUR,
      };
    if (crewId !== DEMO_MAP_CREW) return { map: null };
    return {
      map: applyDecided(buildDemoMap(startedAt), crewId, decided),
      stale: false,
      mapAt: startedAt - 2 * HOUR,
    };
  }
  const res = await fetchUpstream(
    `${info.base}/v1/crew/${encodeURIComponent(crewId)}/map`,
  );
  if (res.status === 404) return { map: null };
  if (!res.ok) throw new Error(`map ${res.status}`);
  const body = MapEnvelope.parse(await res.json());
  if (body.map === null) return { ...body, map: null };
  // 틀린 구역·링크만 빼거나 맨 위로 올린 지도를 쓰고, 그 까닭은 본부 problems 뒤에 붙인다(src/protocol/map.ts parseMap)
  const parsed = parseMap(body.map);
  return withProblems({ ...body, map: parsed.map }, body.problems, parsed);
}

/** 본부가 보낸 problems 뒤에 Starship이 다시 검사하며 찾은 것을 붙인다. 둘 다 없으면 problems를 두지 않는다. */
function withProblems<T extends { problems?: string[] }>(
  res: T,
  fromHq: string[] | undefined,
  parsed: { problems: string[] },
): T {
  const all = [...(fromHq ?? []), ...parsed.problems];
  const { problems: _drop, ...rest } = res;
  return (all.length ? { ...rest, problems: all } : rest) as T;
}

/**
 * 승무원 하나의 지도가 지나온 모습(되감기). 서버 연결 모드는 {base}/v1/crew/{id}/map/history 를 중계하고,
 * 장마다 지도를 검사해 겉이 틀린 장은 빼고, 구역 몇 개만 틀린 장은 그것만 고친 채 쓴다(되감기는 문제를 따로 알리지 않는다).
 * 서버가 이 끝점을 모르면(404) 빈 기록이다.
 */
export async function getCrewMapHistory(
  crewId: string,
  now = Date.now(),
): Promise<CrewMapHistoryResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    if (crewId === DEMO_BIG_MAP_CREW)
      return { frames: demoMapHistory(buildBigDemoMap(now), now) };
    if (crewId !== DEMO_MAP_CREW) return { frames: [] };
    return { frames: demoMapHistory(buildDemoMap(now), now) };
  }
  const res = await fetchUpstream(
    `${info.base}/v1/crew/${encodeURIComponent(crewId)}/map/history`,
  );
  if (res.status === 404) return { frames: [] };
  if (!res.ok) throw new Error(`map history ${res.status}`);
  const body = HistoryEnvelope.parse(await res.json());
  const frames = body.frames.flatMap((f) => {
    const parsed = parseMap(f.map);
    return parsed.ok ? [{ at: f.at, map: parsed.map }] : [];
  });
  return { frames };
}

const HistoryEnvelope = z.object({
  frames: z.array(z.object({ at: z.number(), map: z.unknown() })),
});

/** 데모: 선실에서 답한 갈림길을 정함으로(실제로는 세션이 map.json을 고친다) */
function applyDecided(
  map: ProjectMap,
  crewId: string,
  decided: Map<string, string> | undefined,
): ProjectMap {
  if (!decided?.size) return map;
  return {
    ...map,
    regions: map.regions.map((r) => ({
      ...r,
      signs: r.signs?.map((s) => {
        const answer = decided.get(`${crewId}/${r.id}/${s.id}`);
        return s.type === "fork" && answer
          ? { ...s, status: "decided" as const, decided: answer }
          : s;
      }),
    })),
  };
}

/** 지도 응답에서 map만 아직 검사하지 않은 껍데기. */
const MapEnvelope = CrewMapResponse.extend({ map: z.unknown() });

/**
 * 승무원 하나의 책상. 서버 연결 모드는 {base}/v1/crew/{id}/desk 를 그대로 중계한다.
 * 데모 모드는 자리(seat)의 상태를 써서, 답한 기다림이 책상에서도 빠진다.
 */
export async function getCrewDesk(
  crewId: string,
  seat = "default",
  now = Date.now(),
): Promise<CrewDeskResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const desk = demoDesks(demoState(seat), now)[crewId];
    return desk
      ? { desk: dedupeDesk(desk), deskAt: parseWhen(desk.updatedAt) }
      : { desk: null };
  }
  const url = `${info.base}/v1/crew/${encodeURIComponent(crewId)}/desk`;
  return shared.get(url, async (): Promise<CrewDeskResponse> => {
    const res = await fetchUpstream(url);
    if (res.status === 404) return { desk: null };
    if (!res.ok) throw new Error(`desk ${res.status}`);
    const body = DeskEnvelope.parse(await res.json());
    if (body.desk === null) return { ...body, desk: null };
    // 틀린 기다림·하는 일·답만 빼고 나머지는 보인다(src/protocol/desk.ts parseDesk). 겉이 틀릴 때만 desk: null
    const parsed = parseDesk(body.desk);
    return withProblems(
      { ...body, desk: parsed.ok ? dedupeDesk(parsed.desk) : null },
      body.problems,
      parsed,
    );
  });
}

/** 책상 응답에서 desk만 아직 검사하지 않은 껍데기. */
const DeskEnvelope = CrewDeskResponse.extend({ desk: z.unknown() });

export async function runAction(
  req: ActionRequest,
  seat = "default",
): Promise<ActionResult> {
  const info = sourceInfo();
  if (info.mode === "remote") {
    try {
      const res = await fetchUpstream(
        `${info.base}/v1/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
        },
        ACTION_TIMEOUT_MS,
      );
      if (!res.ok)
        return { ok: false, note: `서버가 거절했어요 (${res.status})` };
      const body = ActionResult.safeParse(await res.json().catch(() => null));
      return body.success
        ? body.data
        : { ok: false, note: "본부의 답을 읽지 못했어요" };
    } finally {
      // 동작 뒤 읽기가 동작 전 스냅숏·책상을 다시 보이지 않게
      shared.clear();
    }
  }
  return demoAction(req, seat);
}

function demoAction(req: ActionRequest, seat: string): ActionResult {
  const state = demoState(seat);
  if (req.target === "answer") {
    state.dismissed.add(answerKey(req.crewId, req.id));
    return { ok: true, note: "읽음으로 했어요" };
  }
  if (req.target === "sign") {
    state.decidedSigns ??= new Map();
    state.decidedSigns.set(`${req.crewId}/${req.region}/${req.id}`, req.answer);
    return {
      ok: true,
      note: `“${req.answer}”로 정해 ${req.crewId} 세션에 전했어요 (데모)`,
    };
  }
  if (req.target === "crew") {
    return req.action === "focus"
      ? { ok: true, note: `${req.id} 창으로 옮겼어요 (데모)` }
      : { ok: true, note: `${req.id} 브리핑을 다시 만들게요 (데모)` };
  }
  const snap = buildSnapshot(state, "default");
  const task = snap.tasks.find((t) => t.id === req.id);
  switch (req.action) {
    case "focus":
      if (task?.url)
        return { ok: true, note: "원래 서비스에서 열어요", openUrl: task.url };
      return { ok: true, note: "그 세션 창으로 옮겼어요 (데모)" };
    case "answer":
      state.dismissed.add(req.id);
      return { ok: true, note: `“${req.answer ?? "답"}”이라고 답했어요` };
    case "snooze":
      state.snoozed.set(req.id, req.until ?? Date.now() + HOUR);
      return { ok: true, note: "1시간 뒤에 다시 보여 줄게요" };
    case "dismiss":
      state.dismissed.add(req.id);
      return { ok: true, note: "치웠어요" };
    case "handoff":
      state.dismissed.add(req.id);
      return { ok: true, note: "비서에게 넘겼어요" };
  }
}
