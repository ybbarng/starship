"use client";

// 교신을 "포트에 붙은 배"로 묶는다. 오래 기다린 배가 앞 포트.
import { useMemo } from "react";
import * as THREE from "three";
import { useBridge } from "@/data/hooks";
import type { Context, Hail, Task } from "@/protocol/v1";
import { raDecToEcliptic, toThree } from "@/sky/astro";
import { projector } from "@/sky/projector";
import { isHail, sourceLabel } from "@/ui/kit";
import { SHIP, type ShipKind, shipKindOf } from "./ships";

export const PORT_COUNT = 6;

export type Berth = {
  id: string;
  kind: ShipKind;
  from: string;
  where?: string;
  /** "Slack", "GitHub"처럼 출처 이름 */
  source: string;
  line: string;
  since: number;
  context: Context;
  crewId?: string;
  url?: string;
  task?: Task;
};

function fromHail(h: Hail, task: Task | undefined): Berth {
  const kind = shipKindOf(h.source.kind);
  return {
    id: h.id,
    kind,
    from: h.from.name,
    where: h.from.where,
    source: h.source.service ?? SHIP[kind].source,
    line: h.line,
    since: h.since,
    context: h.context,
    crewId: h.crewId,
    url: h.url,
    task,
  };
}

function fromTask(t: Task): Berth {
  return {
    id: `h-${t.id}`,
    kind: shipKindOf(t.source.kind),
    from: t.from,
    source: sourceLabel(t.source),
    line: t.title,
    since: t.since,
    context: t.context,
    crewId: t.crewId,
    url: t.url,
    task: t,
  };
}

/** 교신 목록 + 교신 아닌 사람 부름(할 일만 있는 것)을 합쳐 오래된 순으로 */
export function useBerths() {
  const bridge = useBridge();
  const berths = useMemo(() => {
    const byId = new Map(bridge.tasks.map((t) => [t.id, t]));
    const out: Berth[] = bridge.hails.map((h) =>
      fromHail(h, h.taskId ? byId.get(h.taskId) : undefined),
    );
    const covered = new Set(bridge.hails.map((h) => h.taskId));
    for (const t of bridge.tasks) {
      if (isHail(t) && !covered.has(t.id)) out.push(fromTask(t));
    }
    return out.sort((a, b) => a.since - b.since);
  }, [bridge.hails, bridge.tasks]);
  const nowBerth = bridge.now
    ? berths.find((b) => b.task?.id === bridge.now?.id)
    : undefined;
  return { ...bridge, berths, nowBerth };
}

const v = new THREE.Vector3();
const fwd = new THREE.Vector3();

/**
 * 항구 별이 창(변환 전 크기) 안 어디에 보이나. 창 밖이면 가장자리 안쪽으로 붙인 점과 방향을 준다.
 * box: 별 이름표를 둘 수 있는 영역(창 좌표).
 */
export function starOnWindow(
  ra: number,
  dec: number,
  box: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number; inside: boolean; angle: number } | null {
  const cam = projector.camera;
  const W = projector.width;
  const H = projector.height;
  if (!cam || !W || !H) return null;
  const [x, y, z] = toThree(raDecToEcliptic(ra, dec));
  cam.getWorldDirection(fwd);
  const behind = fwd.x * x + fwd.y * y + fwd.z * z < 0;
  v.set(x, y, z).multiplyScalar(1000).add(cam.position).project(cam);
  let px = (v.x * 0.5 + 0.5) * W;
  let py = (-v.y * 0.5 + 0.5) * H;
  const cx = W / 2;
  const cy = (box.top + box.bottom) / 2;
  if (behind) {
    // 뒤쪽 별은 투영이 뒤집힌다. 반대 방향으로 멀리 보낸다.
    px = cx - (px - cx) * 50;
    py = cy - (py - cy) * 50;
  }
  const inside =
    !behind &&
    px >= box.left &&
    px <= box.right &&
    py >= box.top &&
    py <= box.bottom;
  const angle = Math.atan2(py - cy, px - cx);
  if (inside) return { x: px, y: py, inside, angle };
  // 가운데에서 그 방향으로 영역 테두리까지
  const dx = px - cx;
  const dy = py - cy;
  const tx =
    dx === 0 ? Infinity : (dx > 0 ? box.right - cx : box.left - cx) / dx;
  const ty =
    dy === 0 ? Infinity : (dy > 0 ? box.bottom - cy : box.top - cy) / dy;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t, inside: false, angle };
}
