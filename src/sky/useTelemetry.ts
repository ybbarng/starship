"use client";

// 계기판 글이 telemetry·시계를 옮겨 오는 훅. 따로 타이머를 돌리지 않고 앱 박자(onPaceTick, docs/pace.md)에 맞춘다.
// 그래서 창이 안 보이면 멈추고, 초점이 없으면 박자(1초 6번)와 같은 때에 함께 바뀐다.
// 값이 그대로면 setState를 부르지 않는다(다시 그리지 않는다). 규칙: telemetrySnap.ts.
import { useEffect, useRef, useState } from "react";
import { onPaceTick } from "@/ui/kit/pace";
import { type Telemetry, telemetry } from "./telemetry";
import {
  copyTelemetry,
  periodDue,
  sameTelemetry,
  samplePeriod,
  shallowSame,
} from "./telemetrySnap";

/**
 * telemetry에서 화면에 쓸 것만 골라(pick) 1초에 hz번(이동 중이 아니면 idleHz번) 옮겨 온다.
 * 고른 값이 같으면(same, 기본은 얕은 비교) 다시 그리지 않는다. pick·same은 모듈 바깥에 둔 고정 함수로 넘긴다.
 */
export function useTelemetryPick<T extends object>(
  pick: (t: Telemetry) => T,
  hz = 6,
  idleHz = hz,
  same: (a: T, b: T) => boolean = shallowSame,
): T {
  const [snap, setSnap] = useState<T>(() => pick(telemetry));
  const shown = useRef(snap);
  useEffect(() => {
    let last = Date.now();
    return onPaceTick(() => {
      const now = Date.now();
      if (!periodDue(last, now, samplePeriod(telemetry.traveling, hz, idleHz)))
        return;
      last = now;
      const next = pick(telemetry);
      if (same(shown.current, next)) return;
      shown.current = next;
      setSnap(next);
    });
  }, [pick, hz, idleHz, same]);
  return snap;
}

/** telemetry 전체(자리·보는 방향까지). 값이 하나라도 바뀌어야 다시 그린다 */
export function useTelemetry(hz = 6, idleHz = hz): Telemetry {
  return useTelemetryPick(copyTelemetry, hz, idleHz, sameTelemetry);
}

/** 한국 시각 "15:42:07". 서버와 브라우저의 첫 글이 어긋나지 않게 화면이 뜬 뒤에 채운다. 박자에 맞춰 초가 바뀔 때만 */
export function useKoreaTime(): { time: string; date: string } {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let last = Date.now();
    setNow(new Date(last));
    return onPaceTick(() => {
      const n = Date.now();
      if (!periodDue(last, n, 1000)) return;
      last = n;
      setNow(new Date(n));
    });
  }, []);
  if (!now) return { time: "--:--:--", date: "" };
  const time = now.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
  const date = now.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return { time, date };
}
