"use client";

// 시안 4. 돌아오는 회전 고리. 첫 화면은 조종석, 아래로 밀면 고리 우주선 전경.
import { useEffect, useState } from "react";
import { useBridge } from "@/data/hooks";
import { useVoyage } from "@/sky/voyage";
import {
  DestinationPicker,
  Modal,
  ProtoBadge,
  Toasts,
  useScrollStage,
} from "@/ui/kit";
import { Cockpit } from "./Cockpit";
import { CrewDetail, HailList } from "./CrewDetail";
import { RING_CSS, useViewport } from "./common";
import { RingView, ringGeo } from "./RingView";
import { Viewport } from "./Viewport";

type Open =
  | { kind: "crew"; id: string }
  | { kind: "hail"; id?: string }
  | { kind: "nav" }
  | null;

export function RingProto() {
  const { w, h } = useViewport();
  const { progress: p, push, goTo, stage } = useScrollStage();
  const { crewById, hails } = useBridge();
  const [open, setOpen] = useState<Open>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // 창밖은 위에서 본 태양계로 시작한다(처음 한 번은 날아가지 않고 바로)
  useEffect(() => {
    useVoyage.setState({
      destinationId: "overview",
      previousId: null,
      phase: "cruise",
      progress: 1,
    });
  }, []);

  // 조종석으로 돌아오면 고른 칸을 놓는다
  useEffect(() => {
    if (stage === 0) setSelected(null);
  }, [stage]);

  const close = () => setOpen(null);
  const crewOpen = open?.kind === "crew" ? crewById.get(open.id) : undefined;
  const geo = ringGeo(w, h);

  // 창 높이: 58% → 1/3
  const winH = h * (0.58 - (0.58 - 1 / 3) * p);
  // 계기판은 고리 가운데 함교로 줄어든다
  const dashTop = h * 0.58;
  const dashH = h * 0.42;
  const dashCx = w / 2;
  const dashCy = dashTop + dashH / 2;
  const dashScale = 1 - 0.9 * p;
  const dashX = (geo.cx - dashCx) * p;
  const dashY = (geo.cy - dashCy) * p;
  const ringOn = p > 0.02;
  const newest = [...hails].sort((a, b) => b.since - a.since)[0];

  return (
    <main
      className="fixed inset-0 overflow-hidden text-white select-none"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 70%, #0d1530 0%, #05070d 70%)",
      }}
    >
      <style>{RING_CSS}</style>

      {/* 전경(고리) — 조종석 뒤에서 나타난다 */}
      {ringOn && (
        <div
          className="absolute inset-0"
          style={{
            opacity: Math.min(1, Math.max(0, (p - 0.25) / 0.6)),
            transform: `scale(${1.3 - 0.3 * p})`,
            transformOrigin: `${geo.cx}px ${geo.cy}px`,
            pointerEvents: p > 0.6 ? "auto" : "none",
          }}
        >
          <RingView
            w={w}
            h={h}
            selectedId={selected}
            onSelect={setSelected}
            onBridge={() => goTo(0)}
          />
        </div>
      )}

      {/* 창밖 */}
      <div className="absolute inset-x-0 top-0 z-10" style={{ height: winH }}>
        <Viewport
          compact={p}
          hail={newest}
          hailCount={hails.length}
          onHail={(id) => setOpen({ kind: "hail", id })}
          onNav={() => setOpen({ kind: "nav" })}
        />
      </div>

      {/* 계기판 */}
      {p < 0.98 && (
        <div
          className="absolute inset-x-0 z-20"
          style={{
            top: dashTop,
            height: dashH,
            transform: `translate(${dashX}px, ${dashY}px) scale(${dashScale})`,
            transformOrigin: "center",
            opacity: Math.max(0, 1 - p * 1.6),
            borderRadius: `${p * 400}px`,
            overflow: "hidden",
            pointerEvents: p > 0.3 ? "none" : "auto",
          }}
        >
          <Cockpit
            push={stage === 0 ? push : 0}
            onCrew={(id) => setOpen({ kind: "crew", id })}
            onHail={(id) => setOpen({ kind: "hail", id })}
            onNav={() => setOpen({ kind: "nav" })}
            onRing={() => goTo(1)}
          />
        </div>
      )}

      {stage === 1 && p > 0.9 && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 text-[10.5px] text-white/40"
          style={{ top: winH + 4 }}
        >
          위로 밀면 조종석 ▴{" "}
          <span className="inline-block h-1 w-14 overflow-hidden rounded-full bg-white/10 align-middle">
            <span
              className="block h-full bg-[#6cb6ff]"
              style={{ width: `${push * 100}%` }}
            />
          </span>
        </div>
      )}

      <Modal
        open={open?.kind === "nav"}
        onClose={close}
        title="항법 · 목적지"
        width={720}
      >
        <DestinationPicker onPick={close} />
      </Modal>
      <Modal
        open={open?.kind === "hail"}
        onClose={close}
        title="교신 수신함"
        width={620}
      >
        <HailList focusId={open?.kind === "hail" ? open.id : undefined} />
      </Modal>
      <Modal open={!!crewOpen} onClose={close} title="승무원 칸" width={560}>
        {crewOpen && <CrewDetail crew={crewOpen} />}
      </Modal>

      <ProtoBadge name="돌아오는 회전 고리" />
      <Toasts />
    </main>
  );
}
