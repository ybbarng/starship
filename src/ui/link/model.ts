// 관제 링크를 화면 글로 바꾸는 순수 함수. 우주선 → 중계 위성 → 지상국 → 지구 → 항법 신호.
import type { GaugeStatus, Link } from "@/protocol/v1";

export const HOP_LABEL: Record<string, string> = {
  ship: "우주선",
  wifi: "중계 위성",
  gateway: "지상국",
  internet: "지구",
  dns: "항법 신호",
};

export const VERDICT_LABEL: Record<Link["verdict"], string> = {
  ok: "회선 정상",
  warn: "회선 불안",
  down: "회선 끊김",
  off: "관제 신호 없음",
};

const PLACE_LABEL: Record<string, string> = {
  home: "집",
  office: "회사",
  other: "기타",
};

export function placeLabel(place: string): string {
  return PLACE_LABEL[place] ?? place;
}

export type ChainNode = {
  id: string;
  label: string;
  status: GaugeStatus;
  value?: string;
  /** 앞쪽 칸이 끊겨 신호가 닿지 않는 칸 */
  cut: boolean;
};

/**
 * 사슬의 칸들. 맨 앞은 우주선(이 컴퓨터)이고 측정이 멈추지 않았다면 늘 ok다.
 * 처음 error인 칸부터 뒤는 cut(신호가 닿지 않음)이다.
 */
export function chainNodes(link: Link): ChainNode[] {
  const nodes: Omit<ChainNode, "cut">[] = [
    {
      id: "ship",
      label: HOP_LABEL.ship ?? "우주선",
      status: link.verdict === "off" ? "off" : "ok",
    },
    ...link.hops.map((h) => ({
      id: h.id,
      label: HOP_LABEL[h.id] ?? h.id,
      status: h.status,
      value: h.value,
    })),
  ];
  const broken = nodes.findIndex((n) => n.status === "error");
  return nodes.map((n, i) => ({ ...n, cut: broken >= 0 && i > broken }));
}

/** 43초 · 1분 43초 · 2분 · 1시간 5분 */
export function formatSecs(secs: number): string {
  const s = Math.round(secs);
  if (s < 60) return `${s}초`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}분 ${r}초` : `${m}분`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 한국 시각 "2:17", "14:05" */
export function clockKst(ms: number): string {
  return CLOCK.format(new Date(ms)).replace(/^0(\d)/, "$1");
}

/** "오늘 1번 끊김 · 마지막 1분 43초, 2:17" / "오늘 끊김 없음" */
export function dropLine(drops: Link["drops"]): string {
  if (drops.today === 0) return "오늘 끊김 없음";
  const last =
    drops.lastSecs !== undefined || drops.lastAt !== undefined
      ? ` · 마지막 ${[
          drops.lastSecs !== undefined ? formatSecs(drops.lastSecs) : "",
          drops.lastAt !== undefined ? clockKst(drops.lastAt) : "",
        ]
          .filter(Boolean)
          .join(", ")}`
      : "";
  return `오늘 ${drops.today}번 끊김${last}`;
}
