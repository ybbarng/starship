"use client";

// 앱으로 설치한 선실의 Dock 아이콘에 "나를 기다리는 것" 수를 띄운다(Badging API).
// Chrome은 설치한 앱(PWA)에서만 보여 주고, 탭에서는 아무 일도 하지 않는다.
// 숫자는 조종석 결재함과 같다: 모든 화면이 함께 쓰는 5초 스냅숏의 결재 수(소식 뺀 할 일) + 승무원별 답해 둔 것(desk.answers).
// 책상 기다림은 `desk:` Task로 이미 할 일에 들어 있어 desk.waiting은 따로 더하지 않는다. 설계: docs/files.md.
import { useEffect } from "react";
import { useSnapshot } from "@/data/hooks";
import type { Crew, Task } from "@/protocol/v1";
import { decisionCount } from "@/protos/cockpit/inboxGroups";

/** Dock 배지 숫자: 결재 수 + 답해 둔 것 수 */
export function waitingTotal(
  tasks: readonly Task[],
  crew: readonly Pick<Crew, "desk">[],
): number {
  return (
    decisionCount(tasks) +
    crew.reduce((sum, c) => sum + (c.desk?.answers ?? 0), 0)
  );
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadge() {
  const { data } = useSnapshot();
  // 아직 못 받았거나 서버에 못 닿으면 마지막 숫자를 그대로 둔다.
  const total = data ? waitingTotal(data.tasks, data.crew) : null;

  useEffect(() => {
    if (total === null) return;
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {});
  }, [total]);

  return null;
}
