"use client";

// 비교용: 지금 선실(squarified treemap) 그대로. 다른 시안 쪽은 이 파일처럼 View만 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { MapView } from "@/ui/map/MapView";

export function TreemapCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={MapView}
      label="지금 선실 (treemap)"
      backHref="/proto/cabin"
    />
  );
}
