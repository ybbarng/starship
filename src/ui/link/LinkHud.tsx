"use client";

// 관제 링크 HUD: 우주선 → 중계 위성 → 지상국 → 지구 → 항법 신호로 이어지는 통신 사슬.
// 평소(ok)에는 작고 흐리게, 불안(warn)이면 호박색, 끊김(down)이면 붉게 빛나며 끊긴 칸에서 사슬이 끊겨 보인다.
// 측정이 멈추면(off) "관제 신호 없음"으로 회색 점선.
import type { GaugeStatus, Link } from "@/protocol/v1";
import styles from "./link.module.css";
import {
  type ChainNode,
  chainNodes,
  dropLine,
  placeLabel,
  VERDICT_LABEL,
} from "./model";

const DOT: Record<GaugeStatus, string> = {
  ok: "bg-[#5ee08a] shadow-[0_0_6px_#5ee08a]",
  warn: "bg-[#ffcf5c] shadow-[0_0_7px_#ffcf5c]",
  error: "bg-[#ff6b6b] shadow-[0_0_9px_#ff6b6b]",
  off: "border border-white/30 bg-transparent",
};

const FRAME: Record<Link["verdict"], string> = {
  ok: "border-white/[0.12] bg-[#08101e]/40 text-white/70",
  warn: `border-[#ffcf5c]/60 bg-[#2a2210]/70 text-white/90 ${styles.warn}`,
  down: `border-[#ff6b6b]/80 bg-[#2a1014]/80 text-white ${styles.down}`,
  off: "border-dashed border-white/20 bg-[#08101e]/40 text-white/50",
};

const VERDICT_COLOR: Record<Link["verdict"], string> = {
  ok: "text-[#8ff0b0]",
  warn: "text-[#ffd84a]",
  down: "text-[#ff8f8f]",
  off: "text-white/55",
};

export function LinkHud({ link, now }: { link: Link; now: number }) {
  const nodes = chainNodes(link);
  const loud = link.verdict === "warn" || link.verdict === "down";
  const ageSecs = Math.max(0, Math.round((now - link.at) / 1000));
  return (
    <section
      data-link-hud
      data-verdict={link.verdict}
      aria-label={`관제 링크 · ${VERDICT_LABEL[link.verdict]}`}
      className={`rounded-xl border px-3 pt-2 pb-2 backdrop-blur-sm ${FRAME[link.verdict]} ${loud ? "w-[370px]" : "w-[340px]"}`}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold tracking-[0.16em] text-white/45">
          관제 링크
        </span>
        <span className={`font-semibold ${VERDICT_COLOR[link.verdict]}`}>
          {VERDICT_LABEL[link.verdict]}
        </span>
        {link.place && (
          <span className="rounded bg-white/[0.08] px-1.5 text-[10.5px] text-white/65">
            {placeLabel(link.place)}
          </span>
        )}
        <span className="ml-auto text-[10px] text-white/35 tabular-nums">
          {link.verdict === "off"
            ? `마지막 측정 ${ageLabel(ageSecs)} 전`
            : ageSecs > 40
              ? `${ageLabel(ageSecs)} 전 측정`
              : ""}
        </span>
      </div>

      <Chain nodes={nodes} verdict={link.verdict} />

      <div className="mt-1 flex items-center gap-2 text-[10.5px] text-white/50">
        <span data-link-drops className="truncate">
          {dropLine(link.drops)}
        </span>
        {link.tunnel && (
          <span
            className="ml-auto flex shrink-0 items-center gap-1"
            title="비밀 통로(VPN·터널) 상태"
          >
            <span
              className={`inline-block h-[6px] w-[6px] rounded-full ${DOT[link.tunnel]}`}
            />
            비밀 통로
          </span>
        )}
      </div>
      {link.cause && link.verdict !== "ok" && (
        <p
          data-link-cause
          className="mt-1 text-[11.5px] leading-snug text-white/85"
        >
          {link.cause}
        </p>
      )}
    </section>
  );
}

function ageLabel(secs: number): string {
  if (secs < 60) return `${secs}초`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간`;
}

function Chain({
  nodes,
  verdict,
}: {
  nodes: ChainNode[];
  verdict: Link["verdict"];
}) {
  return (
    <ol className="mt-1.5 flex items-start" data-link-chain>
      {nodes.map((n, i) => (
        <li
          key={n.id}
          className={`flex min-w-0 items-start ${i > 0 ? "flex-1" : ""}`}
        >
          {i > 0 && <Segment to={n} verdict={verdict} />}
          <Node node={n} />
        </li>
      ))}
    </ol>
  );
}

/** 앞 칸과 이 칸 사이의 신호 선. 이 칸이 끊겼으면 가운데가 벌어지고 ✕. */
function Segment({ to, verdict }: { to: ChainNode; verdict: Link["verdict"] }) {
  if (to.status === "error")
    return (
      <span className="relative mt-[4px] flex h-[2px] min-w-3 flex-1 items-center">
        <span className="h-full w-[38%] bg-[#ff6b6b]" />
        <span className="mx-auto -mt-[1px] text-[10px] leading-none font-bold text-[#ff6b6b]">
          ✕
        </span>
        <span className="h-full w-[38%] bg-[#ff6b6b]/30" />
      </span>
    );
  const cls =
    to.cut || verdict === "off" || to.status === "off"
      ? "border-t border-dashed border-white/20"
      : to.status === "warn"
        ? `${styles.flow} ${styles.flowWarn}`
        : styles.flow;
  return <span className={`mt-[4px] h-[2px] min-w-3 flex-1 ${cls}`} />;
}

function Node({ node }: { node: ChainNode }) {
  return (
    <span
      data-hop={node.id}
      data-hop-status={node.status}
      className={`flex max-w-[84px] min-w-[52px] shrink-0 flex-col items-center text-center ${node.cut ? "opacity-40" : ""}`}
      title={`${node.label}${node.value ? ` · ${node.value}` : ""}`}
    >
      <span
        className={`inline-block h-[10px] w-[10px] rounded-full ${DOT[node.status]}`}
      />
      <span className="mt-0.5 text-[10px] leading-tight whitespace-nowrap text-white/70">
        {node.label}
      </span>
      {node.value && (
        <span className="max-w-full truncate font-mono text-[9.5px] leading-tight text-white/45">
          {node.value}
        </span>
      )}
    </span>
  );
}
