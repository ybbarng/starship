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
function demoState(seat: string) {
  g.__starshipDemoSeats ??= new Map();
  let s = g.__starshipDemoSeats.get(seat);
  if (!s) {
    s = createDemoState();
    g.__starshipDemoSeats.set(seat, s);
  }
  return s;
}

export function resetDemo(seat: string) {
  g.__starshipDemoSeats?.set(seat, createDemoState());
}

export async function getSnapshot(
  scenario: Scenario,
  seat = "default",
  link: LinkMode = "ok",
): Promise<Snapshot> {
  const info = sourceInfo();
  if (info.mode === "demo")
    return buildSnapshot(demoState(seat), scenario, Date.now(), link);
  const res = await fetch(`${info.base}/v1/snapshot`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return Snapshot.parse(await res.json());
}

/**
 * 승무원 하나의 지도. 서버 연결 모드는 {base}/v1/crew/{id}/map 을 그대로 중계한다.
 * 지도 형식이 이 화면이 아는 것과 다르면 응답 전체를 버리지 않고 map: null과 problems로 바꾼다.
 */
export async function getCrewMap(
  crewId: string,
  now = Date.now(),
  seat = "default",
): Promise<CrewMapResponse> {
  const info = sourceInfo();
  if (info.mode === "demo") {
    const decided = demoState(seat).decidedSigns;
    if (crewId === DEMO_BIG_MAP_CREW)
      return {
        map: applyDecided(buildBigDemoMap(now), crewId, decided),
        stale: false,
        mapAt: now - HOUR,
      };
    if (crewId !== DEMO_MAP_CREW) return { map: null };
    return {
      map: applyDecided(buildDemoMap(now), crewId, decided),
      stale: false,
      mapAt: now - 2 * HOUR,
    };
  }
  const res = await fetch(
    `${info.base}/v1/crew/${encodeURIComponent(crewId)}/map`,
    { cache: "no-store" },
  );
  if (res.status === 404) return { map: null };
  if (!res.ok) throw new Error(`map ${res.status}`);
  const body = MapEnvelope.parse(await res.json());
  if (body.map === null) return { ...body, map: null };
  const parsed = parseMap(body.map);
  return parsed.ok
    ? { ...body, map: parsed.map }
    : {
        ...body,
        map: null,
        problems: [...(body.problems ?? []), ...parsed.problems],
      };
}

/**
 * 승무원 하나의 지도가 지나온 모습(되감기). 서버 연결 모드는 {base}/v1/crew/{id}/map/history 를 중계하고,
 * 장마다 지도를 검사해 걸린 장은 뺀다. 서버가 이 끝점을 모르면(404) 빈 기록이다.
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
  const res = await fetch(
    `${info.base}/v1/crew/${encodeURIComponent(crewId)}/map/history`,
    { cache: "no-store" },
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
    return desk ? { desk, deskAt: Date.parse(desk.updatedAt) } : { desk: null };
  }
  const res = await fetch(
    `${info.base}/v1/crew/${encodeURIComponent(crewId)}/desk`,
    { cache: "no-store" },
  );
  if (res.status === 404) return { desk: null };
  if (!res.ok) throw new Error(`desk ${res.status}`);
  const body = DeskEnvelope.parse(await res.json());
  if (body.desk === null) return { ...body, desk: null };
  const parsed = parseDesk(body.desk);
  return parsed.ok
    ? { ...body, desk: parsed.desk }
    : {
        ...body,
        desk: null,
        problems: [...(body.problems ?? []), ...parsed.problems],
      };
}

/** 책상 응답에서 desk만 아직 검사하지 않은 껍데기. */
const DeskEnvelope = CrewDeskResponse.extend({ desk: z.unknown() });

export async function runAction(
  req: ActionRequest,
  seat = "default",
): Promise<ActionResult> {
  const info = sourceInfo();
  if (info.mode === "remote") {
    const res = await fetch(`${info.base}/v1/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok)
      return { ok: false, note: `서버가 거절했어요 (${res.status})` };
    return ActionResult.parse(await res.json());
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
