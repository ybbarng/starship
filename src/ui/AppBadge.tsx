"use client";

// 앱으로 설치한 선실의 Dock 아이콘에 "나를 기다리는 것" 수를 띄운다(Badging API).
// 설치한 앱(PWA)으로 열렸을 때만 건다(isInstalledApp). Chrome 탭은 원래 무시하지만, Electron 앱의 내장 탭은 앱 전체 아이콘에 붙인다.
// 숫자 = 결재 + 읽지 않은 답해 둔 것. 선실 "할 일" 배지(crewTaskCount)와 같은 정의를 모든 승무원에 더한 것이다(docs/crew-views.md "건수").
// 결재는 조종석 결재함 "결재 n"과 같은 decisionCount(5초 스냅숏의 소식 뺀 할 일), 답은 승무원별 desk.answers(본부가 읽음을 받으면 뺀다).
// 책상 기다림은 `desk:` Task로 이미 결재에 들어 있어 desk.waiting은 따로 더하지 않는다(미룬 것·Task가 아직 없는 것은 결재가 아니다). 설계: docs/files.md.
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

/**
 * 설치한 앱(PWA, manifest display: standalone)으로 열렸나. 배지는 이때만 건다.
 * Electron 앱(Orca 등)의 내장 탭에서 setAppBadge를 부르면 그 앱 전체 아이콘에 숫자가 붙고,
 * 탭을 닫아도 남는다(2026-11-06). 보통 탭은 display-mode가 browser라 걸지 않는다.
 */
export function isInstalledApp(matches: (query: string) => boolean): boolean {
  return (
    matches("(display-mode: standalone)") ||
    matches("(display-mode: window-controls-overlay)")
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
    // 탭에서는 걸지도 지우지도 않는다. 지우면 다른 앱이 건 배지까지 지울 수 있다
    if (!isInstalledApp((q) => window.matchMedia(q).matches)) return;
    (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {});
  }, [total]);

  return null;
}
