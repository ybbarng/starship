"use client";

// 앱으로 설치한 선실의 Dock 아이콘에 "나를 기다리는 것" 수를 띄운다(Badging API).
// Chrome은 설치한 앱(PWA)에서만 보여 주고, 탭에서는 아무 일도 하지 않는다.
// 숫자는 모든 화면이 함께 쓰는 5초 스냅숏의 승무원별 desk.waiting 합계다. 설계: docs/files.md.
import { useEffect } from "react";
import { useSnapshot } from "@/data/hooks";
import type { Crew } from "@/protocol/v1";

/** 모든 승무원 책상의 기다림 수 합계. */
export function waitingTotal(crew: readonly Pick<Crew, "desk">[]): number {
  return crew.reduce((sum, c) => sum + (c.desk?.waiting ?? 0), 0);
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadge() {
  const { data } = useSnapshot();
  // 아직 못 받았거나 서버에 못 닿으면 마지막 숫자를 그대로 둔다.
  const total = data ? waitingTotal(data.crew) : null;

  useEffect(() => {
    if (total === null) return;
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {});
  }, [total]);

  return null;
}
