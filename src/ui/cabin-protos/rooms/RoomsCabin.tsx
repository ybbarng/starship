"use client";

// 시안 1: 선원 작업실 단면도. 공통 틀(Cabin)에 가운데 그림만 RoomsView로 바꿔 끼운다.
import { Cabin } from "@/ui/map/Cabin";
import { RoomsView } from "./RoomsView";

export function RoomsCabin({ crewId }: { crewId: string }) {
  return (
    <Cabin
      crewId={crewId}
      View={RoomsView}
      label="선원 작업실 단면도"
      backHref="/proto/cabin"
    />
  );
}
