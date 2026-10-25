// 화면이 받는 데이터의 출처. 기본은 데모, STARSHIP_SERVER_URL이 있으면 그 서버(프로토콜 v1)를 쓴다.
import {
  buildSnapshot,
  createDemoState,
  type DemoState,
  type Scenario,
} from "@/demo/scenario";
import { type ActionRequest, ActionResult, Snapshot } from "@/protocol/v1";

const HOUR = 3_600_000;

export type SourceInfo = { mode: "demo" } | { mode: "remote"; base: string };

export function sourceInfo(): SourceInfo {
  const base = process.env.STARSHIP_SERVER_URL?.trim();
  return base
    ? { mode: "remote", base: base.replace(/\/$/, "") }
    : { mode: "demo" };
}

// dev 서버가 모듈을 다시 읽어도 데모 상태가 이어지게 globalThis에 둔다.
const g = globalThis as typeof globalThis & { __starshipDemo?: DemoState };
function demoState() {
  g.__starshipDemo ??= createDemoState();
  return g.__starshipDemo;
}

export function resetDemo() {
  g.__starshipDemo = createDemoState();
}

export async function getSnapshot(scenario: Scenario): Promise<Snapshot> {
  const info = sourceInfo();
  if (info.mode === "demo") return buildSnapshot(demoState(), scenario);
  const res = await fetch(`${info.base}/v1/snapshot`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return Snapshot.parse(await res.json());
}

export async function runAction(req: ActionRequest): Promise<ActionResult> {
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
  return demoAction(req);
}

function demoAction(req: ActionRequest): ActionResult {
  const state = demoState();
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
