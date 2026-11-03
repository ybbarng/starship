"use client";

// 교신을 "도킹 베이에 붙은 배"로 묶는다. 오래 기다린 배가 앞 포트(1차 도킹 시안의 모델을 줄여 옮김).
import { useMemo } from "react";
import type { Context, Hail, Task } from "@/protocol/v1";
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

/**
 * 본부가 준 교신(hails)만 배로 만든다. 조종석 교신 수와 선내 교신선 수가 같아야 해서다.
 * 전에는 출처가 사람 쪽(chat·review 등)인 할 일도 배로 더해, 책상 코드 리뷰(`desk:` 할 일)가
 * 포트를 차지하고 사람 교신이 베이 밖으로 밀렸다(2026-11-03). 본부는 책상 리뷰로 교신을 만들지 않는다(docs/protocol.md).
 */
export function berthsOf(
  hails: readonly Hail[],
  tasks: readonly Task[],
): Berth[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return hails
    .map((h) => fromHail(h, h.taskId ? byId.get(h.taskId) : undefined))
    .sort((a, b) => a.since - b.since);
}

export function useBerths(hails: Hail[], tasks: Task[]): Berth[] {
  return useMemo(() => berthsOf(hails, tasks), [hails, tasks]);
}
