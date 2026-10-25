"use client";

import { useEffect, useState } from "react";
import { type Telemetry, telemetry } from "./telemetry";

/** 계기판 글이 쓰기 좋게 초당 몇 번만 값을 옮겨 온다(매 프레임 다시 그리지 않게). */
export function useTelemetry(hz = 6): Telemetry {
  const [snap, setSnap] = useState<Telemetry>(() => ({ ...telemetry }));
  useEffect(() => {
    const t = window.setInterval(
      () => setSnap({ ...telemetry, view: { ...telemetry.view } }),
      1000 / hz,
    );
    return () => window.clearInterval(t);
  }, [hz]);
  return snap;
}

/** 한국 시각 "15:42:07" */
export function useKoreaTime(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
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
