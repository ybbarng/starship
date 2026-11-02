// 날씨와 낮밤: 숫자 대신 분위기로 승무원 상태를 알린다(2026-11-02 사용자).
//   밤: 세션이 꺼져 있다(status off). 땅이 어두워지고 착륙선 불이 꺼지고 승무원이 잔다.
//   모래 폭풍: 지도가 일보다 오래 뒤처졌다(crew.map.stale). 지도가 흐릿하게 덮인다.
import type { Crew } from "@/protocol/v1";

export type Weather = { night: boolean; storm: boolean };

export function weatherOf(crew: Crew | undefined): Weather {
  return {
    night: crew?.status === "off",
    storm: crew?.map?.stale === true,
  };
}
