"use client";

// 감상 모드 위에 얹는 것: 2차 "트인 함교"의 조종석 층 부품을 그대로 쓴다.
//   왼쪽 위 = 항법 계기(진짜 값, 속도계), 아래 가운데 = 행성 단추 줄, 오른쪽 가장자리 = 교신 칩,
//   아래 왼쪽 = 일 신호 띠(급한 일을 조용히 알리고, 누르면 조종석으로 돌아가 주 표시창에서 답한다),
//   오른쪽 위 구석 = "◂ 조종석으로".
import type { Hail, Task } from "@/protocol/v1";
import { HailChips } from "@/protos/open-bridge/cockpit/Hails";
import { NavInstrument } from "@/protos/open-bridge/cockpit/NavInstrument";
import { PlanetBar } from "@/protos/open-bridge/cockpit/PlanetBar";
import { WorkStrip } from "@/protos/open-bridge/cockpit/Tasks";

export function GazeLayer({
  tasks,
  hails,
  seen,
  now,
  hailOpen,
  grid,
  onGrid,
  lines,
  onLines,
  onHail,
  onExit,
}: {
  tasks: Task[];
  hails: Hail[];
  seen: Set<string>;
  now: number;
  hailOpen: boolean;
  grid: boolean;
  onGrid: () => void;
  lines: boolean;
  onLines: () => void;
  onHail: (id: string) => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 text-white">
      <div className="absolute top-9 left-4">
        <NavInstrument
          grid={grid}
          onGrid={onGrid}
          lines={lines}
          onLines={onLines}
        />
      </div>

      <button
        type="button"
        data-exit-gaze
        onClick={onExit}
        className="pointer-events-auto absolute top-3 right-4 flex items-center gap-2 rounded-full border border-white/[0.14] bg-[#060a14]/65 px-3.5 py-1.5 text-[12px] text-white/85 shadow-[0_6px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:border-white/30 hover:bg-[#0c1424]/80 hover:text-white"
      >
        <span aria-hidden>◂</span>
        조종석으로
        <kbd className="rounded border border-white/15 px-1 font-mono text-[10px] text-white/40">
          Esc
        </kbd>
      </button>

      {!hailOpen && (
        <div className="absolute top-1/2 right-4 -translate-y-1/2">
          <HailChips hails={hails} seen={seen} now={now} onOpen={onHail} />
        </div>
      )}

      <div
        className="absolute bottom-4 left-4"
        title="누르면 조종석으로 돌아가 답해요"
      >
        <WorkStrip
          tasks={tasks}
          hailCount={hails.length}
          open={false}
          now={now}
          onToggle={onExit}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <PlanetBar />
      </div>
    </div>
  );
}
