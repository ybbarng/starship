"use client";

// 본부 방 "시설" 판: 비서가 돌보는 시설을 한곳에 모은다. 새 데이터 없이 스냅숏의 정기 작업 계기(gauges)와
// 연결 상태(link)를 조종석과 같은 부품(GaugeList, LinkHud)으로 그린다. 설계: docs/hq.md "방에 둘 것".
import type { Gauge, Link } from "@/protocol/v1";
import { GaugeList } from "@/protos/cockpit/Lists";
import { agoLabel } from "@/ui/kit/labels";
import { LinkHud } from "@/ui/link/LinkHud";

const H3 = "mb-2 text-[10.5px] font-semibold tracking-[0.18em] text-white/35";

export function FacilityBoard({
  gauges,
  link,
  connected,
  lastAt,
  now,
}: {
  gauges: Gauge[];
  link?: Link;
  /** 비서 서버에 닿는지(조종석 본부 연결 등과 같은 판단, src/protos/cockpit/hqLink.ts) */
  connected: boolean;
  /** 비서에게서 상태를 마지막으로 받은 때(아직 없으면 0) */
  lastAt: number;
  now: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5 text-[13px]" data-facility>
      {!connected && (
        <p
          data-hq-unreachable
          className="rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3 py-2 font-semibold text-[#ffd0d0]"
        >
          본부에 닿지 못해요
          {lastAt > 0 && (
            <span className="ml-1 font-normal text-white/55">
              · 마지막으로 받은 때 {agoLabel(lastAt, now, { seconds: true })}
            </span>
          )}
        </p>
      )}
      <section>
        <h3 className={H3}>비서 서버</h3>
        <p className="flex items-center gap-2" data-hq-server>
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[#5ee08a] shadow-[0_0_7px_#5ee08a]" : "bg-[#ff6b6b] shadow-[0_0_9px_#ff6b6b]"}`}
          />
          <span className="text-white/85">
            {connected ? "답하고 있어요" : "답이 없어요"}
          </span>
          {lastAt > 0 && (
            <span className="ml-auto text-[11px] text-white/35">
              {agoLabel(lastAt, now, { seconds: true })} 받음
            </span>
          )}
        </p>
      </section>
      <section>
        <h3 className={H3}>정기 작업 · 점검 {gauges.length}</h3>
        <GaugeList gauges={gauges} now={now} />
      </section>
      <section>
        <h3 className={H3}>인터넷 연결 · 회사 VPN</h3>
        {link ? (
          <LinkHud link={link} now={now} fluid />
        ) : (
          <p className="text-white/40">연결 측정 기록이 없어요</p>
        )}
      </section>
    </div>
  );
}
