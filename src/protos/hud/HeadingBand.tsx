"use client";

// 창 위쪽의 얇은 방위 띠. 지금 바라보는 황경을 눈금으로, 그 아래에 목적지 이름과 한 줄 사실.
import { type CSSProperties, useEffect, useRef } from "react";
import * as THREE from "three";
import { projector } from "@/sky/projector";
import { useDestination, useVoyage } from "@/sky/voyage";
import s from "./hud.module.css";

const PX_PER_DEG = 4;
const TAPE_W = 520;
const dir = new THREE.Vector3();

function Ticks() {
  const marks = [];
  for (let d = -180; d <= 540; d += 5) {
    const x = (d + 180) * PX_PER_DEG;
    const major = d % 30 === 0;
    const label = ((d % 360) + 360) % 360;
    marks.push(
      <g key={d}>
        <line
          x1={x}
          x2={x}
          y1={major ? 0 : 3}
          y2={major ? 11 : 7}
          stroke="#a6fbff"
          strokeOpacity={major ? 0.95 : 0.5}
          strokeWidth={major ? 1.4 : 1}
        />
        {major && (
          <text
            x={x}
            y={23}
            textAnchor="middle"
            fontSize="10.5"
            fill="#a6fbff"
            fontFamily="ui-monospace, monospace"
          >
            {String(label).padStart(3, "0")}
          </text>
        )}
      </g>,
    );
  }
  return (
    <svg width={720 * PX_PER_DEG + 2} height={26} aria-hidden>
      {marks}
    </svg>
  );
}

export function HeadingBand() {
  const tape = useRef<HTMLDivElement>(null);
  const pitch = useRef<HTMLSpanElement>(null);
  const yawText = useRef<HTMLSpanElement>(null);
  const dest = useDestination();
  const phase = useVoyage((st) => st.phase);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cam = projector.camera;
      if (!cam || !tape.current) return;
      cam.getWorldDirection(dir);
      // three(x, y, z) = 황도(x, z, -y)
      const lon = ((Math.atan2(-dir.z, dir.x) * 180) / Math.PI + 360) % 360;
      const lat = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
      const shift = (lon + 180) * PX_PER_DEG - TAPE_W / 2;
      tape.current.style.transform = `translateX(${-shift}px)`;
      if (yawText.current)
        yawText.current.textContent = String(Math.round(lon)).padStart(3, "0");
      if (pitch.current)
        pitch.current.textContent = `${lat >= 0 ? "+" : "−"}${Math.abs(Math.round(lat))}°`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-2"
      style={{ "--hud": "#a6fbff", "--glow": 0.8 } as CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span
          className={`${s.hudText} w-16 text-right font-mono text-[11px] opacity-80`}
        >
          황경 <span ref={yawText}>000</span>
        </span>
        <div
          className="relative h-[27px] overflow-hidden"
          style={{
            width: TAPE_W,
            maskImage:
              "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
          }}
        >
          <div ref={tape} className="absolute top-0 left-0">
            <Ticks />
          </div>
          <div className="absolute top-0 left-1/2 h-[14px] w-px -translate-x-1/2 bg-white shadow-[0_0_6px_#a6fbff]" />
        </div>
        <span className={`${s.hudText} w-16 font-mono text-[11px] opacity-80`}>
          고도 <span ref={pitch}>+0°</span>
        </span>
      </div>
      <svg width="14" height="8" className="-mt-px" aria-hidden>
        <path d="M0 8 L7 0 L14 8" fill="#a6fbff" />
      </svg>
      <div
        className={`${s.hudText} mt-0.5 flex items-baseline gap-2 text-[15px] font-semibold`}
      >
        <span className="font-mono text-[10.5px] tracking-wide opacity-70">
          {phase === "travel" ? "이동 중 ▸" : "목적지"}
        </span>
        {dest.ko}
        {dest.distance && (
          <span className="text-[12px] font-normal opacity-75">
            {dest.distance}
          </span>
        )}
      </div>
      <div
        className={`${s.hudText} max-w-[560px] truncate text-[12px] opacity-75`}
      >
        {dest.fact}
      </div>
    </div>
  );
}
