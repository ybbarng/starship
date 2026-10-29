"use client";

// 시안 5: 컨베이어 조립 공장. 공통 틀(Cabin)에 가운데 그림만 FactoryView로 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { FactoryView } from "./FactoryView";

export function FactoryCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={FactoryView}
      label="컨베이어 조립 공장"
      backHref="/proto/cabin"
    />
  );
}
