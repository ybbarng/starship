"use client";

// 시안 3. 함께 쌓는 탑: 공통 선실 틀에 가운데 그림만 탑으로 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { TowersView } from "./TowersView";

export function TowersCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={TowersView}
      label="함께 쌓는 탑"
      backHref="/proto/cabin"
    />
  );
}
