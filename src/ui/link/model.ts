// 관제 링크를 화면 글로 바꾸는 순수 함수. 우주선 → 중계 위성 → 지상국 → 지구 → 항법 신호.
import type { GaugeStatus, Link } from "@/protocol/v1";

export const HOP_LABEL: Record<string, string> = {
  ship: "우주선",
  wifi: "중계 위성",
  gateway: "지상국",
  internet: "지구",
  dns: "항법 신호",
};

/** 칸마다 실제 뜻. 화면에서 칸에 마우스를 올리면 보인다. */
export const HOP_MEANING: Record<string, string> = {
  ship: "이 맥북 (측정이 돌고 있는지)",
  wifi: "Wi-Fi 연결 (값은 Wi-Fi 이름)",
  gateway: "집·사무실 공유기 (핑 손실)",
  internet: "인터넷 (바깥까지 핑 손실)",
  dns: "DNS (이름 조회)",
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
  /** 주의·끊김일 때 왜 그런지(서버가 준 한 줄) */
  why?: string;
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
      why: h.why,
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

export const VPN_LABEL: Record<GaugeStatus, string> = {
  ok: "정상",
  warn: "주의",
  error: "끊김",
  off: "꺼짐",
};

/** 함대 통신망(회사 VPN) 줄의 작은 글: "키 7일 · 라우터 3/3". 키가 3일 안이면 "키 2일 남음". */
export function vpnDetail(vpn: NonNullable<Link["vpn"]>): string {
  const parts: string[] = [];
  if (vpn.keyDays !== undefined)
    parts.push(
      vpn.keyDays <= 3 ? `키 ${vpn.keyDays}일 남음` : `키 ${vpn.keyDays}일`,
    );
  if (vpn.routers)
    parts.push(`라우터 ${vpn.routers.online}/${vpn.routers.total}`);
  return parts.join(" · ");
}

/** 인터넷은 되는데 VPN만 문제인가. 화면은 이때 "인터넷은 정상"을 붙여 둘을 가른다. */
export function vpnOnlyProblem(link: Link): boolean {
  const vpn = link.vpn;
  if (!vpn || vpn.status === "ok") return false;
  const internet = link.hops.find((h) => h.id === "internet");
  return link.verdict !== "down" && internet?.status !== "error";
}

/** 주의·끊김인 칸마다 "지상국(공유기): 이유" 한 줄. why가 없으면 상태만 적는다. */
export function linkProblems(link: Link): string[] {
  return link.hops
    .filter((h) => h.status === "warn" || h.status === "error")
    .map((h) => {
      const name = HOP_LABEL[h.id] ?? h.id;
      const plain = HOP_MEANING[h.id]?.replace(/ \(.*\)$/, "");
      const head = plain ? `${name}(${plain})` : name;
      return `${head}: ${h.why ?? (h.status === "error" ? "끊김" : "불안")}`;
    });
}

/** "회선 불안"·"끊김" 글에 마우스를 올리면 보일 글: 어느 칸이 왜 그런지 모음과 원인 한 줄. */
export function verdictDetail(link: Link): string {
  const lines = [
    "관제 링크 = 이 맥북의 회선(Wi-Fi → 공유기 → 인터넷 → DNS)을 20초마다 잰 결과",
    ...linkProblems(link).map((l) => `· ${l}`),
  ];
  if (link.cause) lines.push(`원인: ${link.cause}`);
  return lines.join("\n");
}
