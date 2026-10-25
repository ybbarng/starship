"use client";

// 교신을 "도킹 베이에 붙은 배"로 묶는다. 오래 기다린 배가 앞 포트(1차 도킹 시안의 모델을 줄여 옮김).
import { useMemo } from "react";
import type { Context, Hail, Task } from "@/protocol/v1";
import { isHail, sourceLabel } from "@/ui/kit";
import { SHIP, type ShipKind, shipKindOf } from "./ships";

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

/** 교신 + 교신 아닌 사람 부름(할 일만 있는 것)을 합쳐 오래된 순으로 */
export function useBerths(hails: Hail[], tasks: Task[]): Berth[] {
  return useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const out: Berth[] = hails.map((h) =>
      fromHail(h, h.taskId ? byId.get(h.taskId) : undefined),
    );
    const covered = new Set(hails.map((h) => h.taskId));
    for (const t of tasks) {
      if (isHail(t) && !covered.has(t.id)) out.push(fromTask(t));
    }
    return out.sort((a, b) => a.since - b.since);
  }, [hails, tasks]);
}
