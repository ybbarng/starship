"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type ActionRequest,
  ActionResult,
  type Crew,
  type CrewDeskResponse,
  CrewDeskResponse as CrewDeskResponseSchema,
  CrewMapHistoryResponse,
  type CrewMapResponse,
  CrewMapResponse as CrewMapResponseSchema,
  type Snapshot,
  Snapshot as SnapshotSchema,
  type Task,
} from "@/protocol/v1";
import type { UsageRange, UsageResponse } from "@/usage/model";
import { failNote } from "./actionNote";
import { useToast } from "./toast";

/** 데모 시나리오(?demo=, ?link=)와 자리(페이지 경로)를 서버에 넘긴다. */
function scenarioParam(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams({ seat: window.location.pathname });
  const demo = new URLSearchParams(window.location.search).get("demo");
  if (demo) q.set("demo", demo);
  const link = new URLSearchParams(window.location.search).get("link");
  if (link) q.set("link", link);
  return `?${q}`;
}

let resetDone = false;

/** 데모 모드에서 이 자리의 상태를 처음으로 돌린다. 주소에 ?reset=1이 있으면 처음 한 번 저절로. */
export async function resetDemo(): Promise<void> {
  await fetch(`/api/v1/actions${scenarioParam()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
}

async function fetchSnapshot(): Promise<Snapshot> {
  if (
    !resetDone &&
    new URLSearchParams(window.location.search).get("reset") === "1"
  ) {
    resetDone = true;
    await resetDemo();
  }
  const res = await fetch(`/api/v1/snapshot${scenarioParam()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return SnapshotSchema.parse(await res.json());
}

async function postAction(req: ActionRequest): Promise<ActionResult> {
  const res = await fetch(`/api/v1/actions${scenarioParam()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = ActionResult.safeParse(await res.json().catch(() => null));
  return body.success
    ? body.data
    : { ok: false, note: failNote(req, res.status) };
}

async function fetchCrewMap(crewId: string): Promise<CrewMapResponse> {
  const res = await fetch(
    `/api/v1/crew/${encodeURIComponent(crewId)}/map${scenarioParam()}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`map ${res.status}`);
  return CrewMapResponseSchema.parse(await res.json());
}

/** 승무원 하나의 지도. 자주 바뀌지 않으니 30초마다 다시 읽는다. */
export function useCrewMap(crewId: string) {
  return useQuery({
    queryKey: ["crew-map", crewId],
    queryFn: () => fetchCrewMap(crewId),
    refetchInterval: 30_000,
  });
}

/** 지도가 지나온 모습(되감기). 단추를 누를 때만 읽고 다시 읽지 않는다. */
export function useCrewMapHistory(
  crewId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["crew-map-history", crewId],
    queryFn: async (): Promise<CrewMapHistoryResponse> => {
      const res = await fetch(
        `/api/v1/crew/${encodeURIComponent(crewId ?? "")}/map/history`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`map history ${res.status}`);
      return CrewMapHistoryResponse.parse(await res.json());
    },
    enabled: enabled && !!crewId,
    staleTime: 5 * 60_000,
  });
}

async function fetchCrewDesk(crewId: string): Promise<CrewDeskResponse> {
  const res = await fetch(
    `/api/v1/crew/${encodeURIComponent(crewId)}/desk${scenarioParam()}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`desk ${res.status}`);
  return CrewDeskResponseSchema.parse(await res.json());
}

/** 승무원 하나의 책상. 세션이 자주 고치니 스냅샷처럼 5초마다 다시 읽는다. */
export function useCrewDesk(crewId: string) {
  return useQuery({
    queryKey: ["crew-desk", crewId],
    queryFn: () => fetchCrewDesk(crewId),
    refetchInterval: 5_000,
  });
}

/** 토큰 사용량. 서버가 5분보다 자주 기록을 다시 읽지 않으니 5분마다 묻는다. */
export function useUsage(range: UsageRange) {
  return useQuery({
    queryKey: ["usage", range],
    queryFn: async (): Promise<UsageResponse> => {
      const res = await fetch(`/api/usage?range=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`usage ${res.status}`);
      return (await res.json()) as UsageResponse;
    },
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/** 5초마다 새로 읽는 전체 상태. */
export function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot", scenarioParam()],
    queryFn: fetchSnapshot,
    refetchInterval: 5_000,
  });
}

/** 만든 시각(generatedAt)은 매번 바뀌니 뺀다. 그래야 내용이 같을 때 react-query가 같은 객체를 돌려준다. */
function withoutStamp(s: Snapshot): Omit<Snapshot, "generatedAt"> {
  const { generatedAt: _, ...rest } = s;
  return rest;
}

/** 화면이 바로 쓰기 좋게 묶은 값. */
export function useBridge() {
  // useSnapshot과 같은 열쇠라 요청은 하나다. select 결과도 구조를 비교해 같으면 그대로 둔다.
  const query = useQuery({
    queryKey: ["snapshot", scenarioParam()],
    queryFn: fetchSnapshot,
    refetchInterval: 5_000,
    select: withoutStamp,
  });
  const snap = query.data;
  const derived = useMemo(() => {
    const tasks = snap?.tasks ?? [];
    const crew = snap?.crew ?? [];
    const crewById = new Map(crew.map((c) => [c.id, c]));
    const tasksByCrew = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.crewId) continue;
      const list = tasksByCrew.get(t.crewId) ?? [];
      list.push(t);
      tasksByCrew.set(t.crewId, list);
    }
    return {
      now: tasks[0],
      next: tasks.slice(1, 4),
      tasks,
      loose: tasks.filter((t) => !t.crewId),
      hails: snap?.hails ?? [],
      crew,
      crewById,
      tasksByCrew,
      gauges: snap?.gauges ?? [],
      link: snap?.link,
      notice: snap?.notice,
    };
  }, [snap]);
  // 받은 때(dataUpdatedAt)·오류는 여기서 읽지 않는다. react-query는 읽은 값이 바뀔 때만 다시 그리게 하는데,
  // 받은 때는 내용이 같아도 5초마다 바뀌어 이 훅을 쓰는 화면 전체가 5초마다 다시 그려졌다(2026-11-03).
  // 그 둘이 필요한 곳(본부 연결 등, 빈 결재함)은 useBridgeStatus를 따로 쓴다.
  return {
    ...derived,
    isLoading: query.isLoading,
  };
}

/** 본부에서 받은 상태: 마지막으로 받은 때와 오류. 이 값을 쓰는 작은 부품만 5초마다 다시 그린다. */
export function useBridgeStatus() {
  const query = useSnapshot();
  return {
    /** 상태를 마지막으로 받은 때(Unix 밀리초, 아직 없으면 0) */
    updatedAt: query.dataUpdatedAt,
    /** 한 번이라도 받았는지 */
    ready: query.dataUpdatedAt > 0,
    error: query.error,
  };
}

/**
 * 할 일·승무원 동작. 결과 한 줄을 토스트로 띄우고 상태를 다시 읽는다.
 * 동작마다 결과(ActionResult)를 Promise로 돌려준다. 본부에 닿지 못해도 거부(reject)하지 않고
 * ok:false로 돌려주니, 부르는 쪽은 ok일 때만 글을 비우거나 접으면 된다.
 */
export function useAct() {
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  const mutation = useMutation({
    mutationFn: postAction,
    onSuccess: (result) => {
      if (result.openUrl) window.open(result.openUrl, "_blank", "noopener");
      if (result.note) toast(result.note, result.ok ? "ok" : "error");
      client.invalidateQueries({ queryKey: ["snapshot"] });
      client.invalidateQueries({ queryKey: ["crew-desk"] });
      client.invalidateQueries({ queryKey: ["crew-map"] });
    },
    onError: (_e, req) => toast(failNote(req), "error"),
  });
  const send = (req: ActionRequest): Promise<ActionResult> =>
    mutation.mutateAsync(req).catch(() => ({ ok: false }));
  return {
    task: (
      task: Task,
      action: Extract<ActionRequest, { target: "task" }>["action"],
      answer?: string,
    ) =>
      send({
        target: "task",
        id: task.id,
        action,
        answer,
        until: action === "snooze" ? Date.now() + 3_600_000 : undefined,
      }),
    crew: (crew: Crew, action: Crew["actions"][number]) =>
      send({ target: "crew", id: crew.id, action }),
    /** 책상의 답해 둔 것을 읽음으로(서버가 책상에서 뺀다) */
    answerRead: (crewId: string, id: string) =>
      send({ target: "answer", crewId, id, action: "read" }),
    /** 지도 갈림길에 답하기(세션에 전하고, map.json은 세션이 고친다) */
    sign: (crewId: string, region: string, id: string, answer: string) =>
      send({
        target: "sign",
        crewId,
        region,
        id,
        action: "answer",
        answer,
      }),
    pending: mutation.isPending,
  };
}
