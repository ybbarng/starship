"use client";

// 계정 사용 한도(주간·5시간). 서버가 본부 값을 1분 동안 기억하니 1분마다 묻는다.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UsageLimitsResponse } from "@/protocol/limits";

export function useUsageLimits() {
  return useQuery({
    queryKey: ["usage-limits"],
    queryFn: async (): Promise<UsageLimitsResponse> => {
      const res = await fetch("/api/v1/usage/limits", { cache: "no-store" });
      if (!res.ok) throw new Error(`limits ${res.status}`);
      return UsageLimitsResponse.parse(await res.json());
    },
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
}

/** 1분마다 바뀌는 지금 시각("n시간 뒤" 글을 고친다). 첫 그림은 0이라 서버와 브라우저 그림이 같다 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
