"use client";

// 시안 4. 퍼져 가는 육각 개척지: 공통 선실 틀에 가운데 그림만 FrontierView로 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { FrontierView } from "./FrontierView";

export function FrontierCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={FrontierView}
      label="퍼져 가는 육각 개척지"
      backHref="/proto/cabin"
    />
  );
}
