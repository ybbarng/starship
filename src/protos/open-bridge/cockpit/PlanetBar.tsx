"use client";

// 행성 단추 줄(아래 가운데): 전경 · 수성~해왕성 · 더 먼 곳…(목적지 모달).
// 천체를 직접 눌러도 날아간다는 것을 위에 작은 글로 알려 준다.
import { useState } from "react";
import { ScaleNote } from "@/sky/ScaleNote";
import { useDestination, useVoyage } from "@/sky/voyage";
import { DestinationPicker, Modal } from "@/ui/kit";

const PLANETS: { id: string; ko: string; color: string; size: number }[] = [
  { id: "mercury", ko: "수성", color: "#b5afa8", size: 6 },
  { id: "venus", ko: "금성", color: "#e8d3a2", size: 8 },
  { id: "earth", ko: "지구", color: "#4a8ad6", size: 8 },
  { id: "mars", ko: "화성", color: "#d0643f", size: 7 },
  { id: "jupiter", ko: "목성", color: "#d8b48a", size: 12 },
  { id: "saturn", ko: "토성", color: "#e3cf98", size: 10 },
  { id: "uranus", ko: "천왕성", color: "#9fd8e0", size: 9 },
  { id: "neptune", ko: "해왕성", color: "#5a7ce0", size: 9 },
];

function Dot({
  color,
  size,
  ringed,
}: {
  color: string;
  size: number;
  ringed?: boolean;
}) {
  return (
    <span
      className={`relative inline-block h-3.5 shrink-0 ${ringed ? "mx-0.5 w-[18px]" : "w-3.5"}`}
      aria-hidden
    >
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 35%, #fff8 0, ${color} 45%, #0008 120%)`,
        }}
      />
      {ringed && (
        <span
          className="absolute top-1/2 left-1/2 h-[4px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#e3cf98]/70"
          style={{ transform: "translate(-50%,-50%) rotate(-18deg)" }}
        />
      )}
    </span>
  );
}

export function PlanetBar() {
  const dest = useDestination();
  const travelTo = useVoyage((s) => s.travelTo);
  const [picker, setPicker] = useState(false);
  const btn = (on: boolean) =>
    `flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] transition ${
      on
        ? "bg-white/[0.16] text-white"
        : "text-white/60 hover:bg-white/[0.08] hover:text-white/90"
    }`;
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5">
      <p className="flex items-center gap-2 text-[10.5px] text-white/35">
        끌어서 둘러보고, 천체나 이름을 눌러도 날아갑니다
        <span className="text-white/20">·</span>
        <ScaleNote />
      </p>
      <nav
        aria-label="행성으로 이동"
        className="flex items-center gap-0.5 rounded-full border border-white/[0.09] bg-[#060a14]/60 px-1 py-1 backdrop-blur-md"
      >
        <button
          type="button"
          data-planet="overview"
          onClick={() => travelTo("overview")}
          className={btn(dest.id === "overview")}
        >
          전경
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-white/[0.12]" />
        {PLANETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-planet={p.id}
            onClick={() => travelTo(p.id)}
            className={btn(dest.id === p.id)}
          >
            <Dot color={p.color} size={p.size} ringed={p.id === "saturn"} />
            {p.ko}
          </button>
        ))}
        <span className="mx-0.5 h-3.5 w-px bg-white/[0.12]" />
        <button
          type="button"
          data-planet="more"
          onClick={() => setPicker(true)}
          className={btn(false)}
        >
          더 먼 곳…
        </button>
      </nav>
      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="어디로 갈까요"
        width={720}
      >
        <div data-scroll-inside>
          <DestinationPicker onPick={() => setPicker(false)} />
        </div>
      </Modal>
    </div>
  );
}
