"use client";

// 시안 2: 조선소에서 짓는 우주선. 공통 선실 틀에 가운데 그림만 ShipyardView로 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { ShipyardView } from "./ShipyardView";

export function ShipyardCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={ShipyardView}
      label="조선소에서 짓는 우주선"
      backHref="/proto/cabin"
    />
  );
}
