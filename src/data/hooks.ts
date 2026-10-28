"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type ActionRequest,
  ActionResult,
  type Crew,
  type CrewMapResponse,
  CrewMapResponse as CrewMapResponseSchema,
  type Snapshot,
  Snapshot as SnapshotSchema,
  type Task,
} from "@/protocol/v1";
import { useToast } from "./toast";

/** 데모 시나리오(?demo=)와 자리(페이지 경로)를 서버에 넘긴다. */
function scenarioParam(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams({ seat: window.location.pathname });
  const demo = new URLSearchParams(window.location.search).get("demo");
  if (demo) q.set("demo", demo);
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
  return body.success ? body.data : { ok: false, note: `실패 (${res.status})` };
}

async function fetchCrewMap(crewId: string): Promise<CrewMapResponse> {
  const res = await fetch(`/api/v1/crew/${encodeURIComponent(crewId)}/map`, {
    cache: "no-store",
  });
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

/** 5초마다 새로 읽는 전체 상태. */
export function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot", scenarioParam()],
    queryFn: fetchSnapshot,
    refetchInterval: 5_000,
  });
}

/** 화면이 바로 쓰기 좋게 묶은 값. */
export function useBridge() {
  const query = useSnapshot();
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
      notice: snap?.notice,
    };
  }, [snap]);
  return { ...derived, isLoading: query.isLoading, error: query.error };
}

/** 할 일·승무원 동작. 결과 한 줄을 토스트로 띄우고 상태를 다시 읽는다. */
export function useAct() {
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  const mutation = useMutation({
    mutationFn: postAction,
    onSuccess: (result) => {
      if (result.openUrl) window.open(result.openUrl, "_blank", "noopener");
      if (result.note) toast(result.note, result.ok ? "ok" : "error");
      client.invalidateQueries({ queryKey: ["snapshot"] });
    },
    onError: () => toast("요청을 보내지 못했어요", "error"),
  });
  return {
    task: (
      task: Task,
      action: Extract<ActionRequest, { target: "task" }>["action"],
      answer?: string,
    ) =>
      mutation.mutate({
        target: "task",
        id: task.id,
        action,
        answer,
        until: action === "snooze" ? Date.now() + 3_600_000 : undefined,
      }),
    crew: (crew: Crew, action: Crew["actions"][number]) =>
      mutation.mutate({ target: "crew", id: crew.id, action }),
    pending: mutation.isPending,
  };
}
