// 선실 현황판의 판 구성과 처음 여는 판. 화면 역할: docs/crew-views.md, 본부 방: docs/hq.md.

/** 할 일 · 지도 · 브리핑, 본부 방은 할 일 · 나르기 · 시설 · 지도 */
export type SideTab = "tasks" | "map" | "brief" | "relays" | "facility";

export const TAB_LABEL: Record<SideTab, string> = {
  tasks: "할 일",
  map: "지도",
  brief: "브리핑",
  relays: "나르기",
  facility: "시설",
};

/**
 * 판 구성과 지금 보일 판.
 * - 보통 선실: 할 일 · 지도(· 브리핑이 있으면 브리핑). 고르기 전에는 기다리는 것이 있으면 할 일, 없으면 지도.
 * - 본부 방: 할 일 · 나르기 · 시설(· 지도가 있으면 지도). 고르기 전에는 기다리는 것이 있으면 할 일, 없으면 나르기.
 * 고른 판이 지금 구성에 없으면(지도가 사라짐 등) 고르기 전처럼 정한다.
 */
export function cabinTabs({
  hq,
  hasMap,
  hasBrief,
  waiting,
  picked,
}: {
  hq: boolean;
  hasMap: boolean;
  hasBrief: boolean;
  waiting: number;
  picked: SideTab | null;
}): { tabs: SideTab[]; tab: SideTab } {
  const tabs: SideTab[] = hq
    ? ["tasks", "relays", "facility", ...(hasMap ? (["map"] as const) : [])]
    : hasBrief
      ? ["tasks", "map", "brief"]
      : ["tasks", "map"];
  const tab: SideTab =
    picked && tabs.includes(picked)
      ? picked
      : waiting > 0
        ? "tasks"
        : hq
          ? "relays"
          : "map";
  return { tabs, tab };
}
