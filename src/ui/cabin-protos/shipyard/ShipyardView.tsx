"use client";

// 조선소 시안의 가운데 그림. 프로젝트 하나를 건조대 위에서 짓고 있는 우주선 한 척(옆모습)으로 그린다.
// 선체·무늬·크레인은 SVG로, 이름·단추·꼬리표·동물은 그 위 HTML로 얹는다(말줄임과 title을 쓰려고).
// 안개는 설계도 선만, 공사중은 비계와 용접 불꽃, 완공은 칠한 외판과 창 불빛, 막힘은 붉은 격벽.
import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isForkForMe,
  isNewFound,
  mapProgress,
  type Region,
  type Sign,
} from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  REGION_STATUS_COLOR,
  REGION_STATUS_LABEL,
  SIGN_ICON,
} from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import { type Block, hullEdges, layoutShip, type ShipLayout } from "./layout";
import styles from "./shipyard.module.css";

const HULL = "#1a2030";
const HULL_EDGE = "#8391b0";
const PAINT_TOP = "#3f8a6c";
const PAINT_BOTTOM = "#24584a";
const NEW_METAL = "#7ce0ff";

const hasForkForMe = (r: Region) => (r.signs ?? []).some(isForkForMe);

/** 꼬리표로 따로 보이는 내 갈림길과 끝난 것을 뺀 표지 */
const minorSigns = (r: Region): Sign[] =>
  (r.signs ?? []).filter(
    (s) =>
      !isForkForMe(s) &&
      !(s.type === "fork" && s.status === "decided") &&
      !(s.type === "talk" && s.status === "done"),
  );

export function ShipyardView({
  map,
  crew,
  selected,
  onSelect,
  showDropped,
  now,
}: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e)
        setSize({
          w: Math.floor(e.contentRect.width),
          h: Math.floor(e.contentRect.height),
        });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ship = useMemo(
    () =>
      size.w > 0
        ? layoutShip(map, { x: 0, y: 0, w: size.w, h: size.h }, { showDropped })
        : null,
    [map, size, showDropped],
  );
  const progress = useMemo(() => mapProgress(map).ratio, [map]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <section
      ref={ref}
      data-map
      className="relative h-full w-full overflow-hidden rounded-lg bg-[#070a12]"
      aria-label={`${map.title} 건조 중인 우주선`}
    >
      {ship && (
        <>
          <ShipArt
            ship={ship}
            w={size.w}
            h={size.h}
            uid={uid}
            here={map.here}
            selected={selected}
            progress={progress}
          />
          <Overlay
            ship={ship}
            title={map.title}
            goal={map.goal}
            here={map.here}
            crew={crew}
            selected={selected}
            onSelect={onSelect}
            now={now}
          />
        </>
      )}
    </section>
  );
}

/* ───────────── SVG: 조선소와 선체 ───────────── */

function stars(w: number, h: number) {
  // 늘 같은 자리에 찍히게 간단한 수열로 뽑는다.
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: 90 }, () => ({
    x: rnd() * w,
    y: rnd() * h,
    r: rnd() < 0.85 ? 0.7 : 1.3,
    o: 0.25 + rnd() * 0.5,
  }));
}

function ShipArt({
  ship,
  w,
  h,
  uid,
  here,
  selected,
  progress,
}: {
  ship: ShipLayout;
  w: number;
  h: number;
  uid: string;
  here?: string;
  selected: string | null;
  progress: number;
}) {
  const sky = useMemo(() => stars(w, h), [w, h]);
  const id = (n: string) => `sy-${uid}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const hereBlock = ship.blocks.find((b) => b.region.id === here);
  const sel = ship.blocks.find((b) => b.region.id === selected);
  const left = 4;
  const right = w - 4;
  const launched = progress >= 1;
  const foundCount = ship.blocks.filter(
    (b) => b.region.found !== undefined,
  ).length;
  const planEdge = hullEdges(ship, ship.planX);

  return (
    <svg
      className="absolute inset-0"
      width={w}
      height={h}
      aria-hidden
      role="presentation"
    >
      <defs>
        <clipPath id={id("hull")}>
          <path d={ship.bodyPath} />
        </clipPath>
        <pattern
          id={id("fog")}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M12 0H0V12"
            fill="none"
            stroke="#8fb4ff"
            strokeOpacity="0.13"
            strokeWidth="1"
          />
        </pattern>
        <pattern
          id={id("scaf")}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0H16M0 0V16M0 16L16 0"
            fill="none"
            stroke="#ffcf5c"
            strokeOpacity="0.42"
            strokeWidth="1.2"
          />
        </pattern>
        <pattern
          id={id("hazard")}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill="#3a1418" />
          <rect width="5" height="12" fill="#b8343c" />
        </pattern>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAINT_TOP} />
          <stop offset="1" stopColor={PAINT_BOTTOM} />
        </linearGradient>
        <radialGradient id={id("planet")} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#6f5fb8" />
          <stop offset="0.6" stopColor="#2c2a5c" />
          <stop offset="1" stopColor="#11122a" />
        </radialGradient>
        <linearGradient id={id("spot")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe39a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffe39a" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={id("flame")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.4" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff6b3d" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 먼 하늘: 별과 행성 하나 */}
      {sky.map((s) => (
        <circle
          key={`${s.x}-${s.y}`}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#fff"
          opacity={s.o}
        />
      ))}
      <circle
        cx={w - Math.min(w, h) * 0.12}
        cy={Math.min(w, h) * 0.12}
        r={Math.min(w, h) * 0.2}
        fill={url("planet")}
        opacity="0.55"
      />

      {/* 바닥과 크레인 다리 */}
      <rect
        x={0}
        y={ship.floorY}
        width={w}
        height={h - ship.floorY}
        fill="#0d1220"
      />
      <line
        x1={0}
        x2={w}
        y1={ship.floorY}
        y2={ship.floorY}
        stroke="#3a4560"
        strokeWidth="2"
      />
      <Lattice
        x1={left}
        y1={ship.beamY}
        x2={left + 8}
        y2={ship.floorY}
        vertical
      />
      <Lattice
        x1={right - 8}
        y1={ship.beamY}
        x2={right}
        y2={ship.floorY}
        vertical
      />
      <Lattice x1={left} y1={ship.beamY} x2={right} y2={ship.beamY + 10} />

      {/* 구획 이름표를 매단 줄 */}
      {ship.columns.map((c) => (
        <line
          key={c.region.id}
          x1={c.x + c.w / 2}
          x2={c.x + c.w / 2}
          y1={ship.beamY + 10}
          y2={ship.plateY}
          stroke="#56627f"
          strokeWidth="1"
        />
      ))}

      {/* 지금 여기: 크레인 수레에서 내려오는 작업등 */}
      {hereBlock && (
        <g>
          <polygon
            points={`${hereBlock.x + hereBlock.w / 2 - 5},${ship.beamY + 14} ${hereBlock.x + hereBlock.w / 2 + 5},${ship.beamY + 14} ${hereBlock.x + hereBlock.w + 6},${hereBlock.safe.y} ${hereBlock.x - 6},${hereBlock.safe.y}`}
            fill={url("spot")}
          />
          <rect
            x={hereBlock.x + hereBlock.w / 2 - 9}
            y={ship.beamY + 7}
            width="18"
            height="8"
            rx="2"
            fill="#ffcf5c"
          />
        </g>
      )}

      {/* 받침대 */}
      {ship.cradles.map((c) => (
        <polygon
          key={c.x}
          points={`${c.x - 10},${c.top} ${c.x + 10},${c.top} ${c.x + 18},${ship.floorY} ${c.x - 18},${ship.floorY}`}
          fill="#2a3246"
          stroke="#46516d"
        />
      ))}

      {/* 선체 바탕: 뱃머리, 몸통, 엔진실 */}
      <path
        d={ship.bowPath}
        fill="#252d42"
        stroke={HULL_EDGE}
        strokeWidth="1.5"
      />
      <path d={ship.bridgePath} fill="#7ce0ff" opacity="0.55" />
      <path
        d={ship.enginePath}
        fill="#2a3043"
        stroke={HULL_EDGE}
        strokeWidth="1.5"
      />
      {ship.nozzles.map((n) => (
        <g key={n.y}>
          {launched && (
            <rect
              className={styles.flame}
              x={n.x + n.w}
              y={n.y + n.h * 0.1}
              width={n.w * 2.2}
              height={n.h * 0.8}
              rx={n.h * 0.4}
              fill={url("flame")}
            />
          )}
          <polygon
            points={`${n.x},${n.y + n.h * 0.18} ${n.x + n.w},${n.y} ${n.x + n.w},${n.y + n.h} ${n.x},${n.y + n.h * 0.82}`}
            fill="#3a4258"
            stroke={HULL_EDGE}
          />
        </g>
      ))}
      <path d={ship.bodyPath} fill={HULL} />

      {/* 블록: 선체 곡선으로 자른다 */}
      <g clipPath={url("hull")}>
        {ship.blocks.map((b) => (
          <BlockArt
            key={b.region.id}
            b={b}
            url={url}
            here={b.region.id === here}
          />
        ))}
        {/* 구획 사이 늑골과 리벳 */}
        {ship.columns.slice(1).map((c) => (
          <g key={c.region.id}>
            <rect
              x={c.x - 5}
              y={ship.y0}
              width="5"
              height={ship.y1 - ship.y0}
              fill="#0b0f18"
            />
            {rivets(ship.y0, ship.y1, 12).map((y) => (
              <circle key={y} cx={c.x - 2.5} cy={y} r="0.9" fill="#56627f" />
            ))}
          </g>
        ))}
        {sel && sel.region.status !== "dropped" && (
          <rect
            x={sel.x + 1.5}
            y={sel.y + 1.5}
            width={Math.max(0, sel.w - 3)}
            height={Math.max(0, sel.h - 3)}
            rx="3"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            style={{ filter: "drop-shadow(0 0 6px rgb(124 224 255 / 0.8))" }}
          />
        )}
      </g>
      <path
        d={ship.bodyPath}
        fill="none"
        stroke={HULL_EDGE}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 처음 설계는 여기서 끝났다: 몸통을 가로지르는 점선 */}
      {ship.planX < ship.x1 - 2 && (
        <line
          x1={ship.planX}
          x2={ship.planX}
          y1={planEdge.top - 6}
          y2={planEdge.bottom + 6}
          stroke={NEW_METAL}
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      )}

      <Ruler ship={ship} found={foundCount} />

      {launched && (
        <text
          x={ship.nozzles[0]?.x ?? ship.x1}
          y={(ship.nozzles[0]?.y ?? ship.y0) - 10}
          fill="#ffd27a"
          fontSize="12"
          fontWeight="700"
        >
          진수 준비 끝
        </text>
      )}
      {ship.pile.length > 0 && (
        <text
          x={(ship.pile.at(-1)?.x ?? 0) - 8}
          y={ship.pileY + 17}
          fill="#8792a8"
          fontSize="11"
          textAnchor="end"
        >
          떼어 낸 블록
        </text>
      )}
    </svg>
  );
}

function rivets(y0: number, y1: number, step: number): number[] {
  const out: number[] = [];
  for (let y = y0 + step / 2; y < y1; y += step) out.push(Math.round(y));
  return out;
}

function Lattice({
  x1,
  y1,
  x2,
  y2,
  vertical,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vertical?: boolean;
}) {
  const step = 12;
  const zig: string[] = [];
  if (vertical) {
    for (let y = y1, i = 0; y < y2; y += step, i++)
      zig.push(`${i % 2 ? x2 : x1},${y}`);
  } else {
    for (let x = x1, i = 0; x < x2; x += step, i++)
      zig.push(`${x},${i % 2 ? y2 : y1}`);
  }
  return (
    <g stroke="#4b5675" strokeWidth="1.2" fill="none">
      {vertical ? (
        <>
          <line x1={x1} x2={x1} y1={y1} y2={y2} />
          <line x1={x2} x2={x2} y1={y1} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} x2={x2} y1={y1} y2={y1} />
          <line x1={x1} x2={x2} y1={y2} y2={y2} />
        </>
      )}
      <polyline points={zig.join(" ")} strokeOpacity="0.7" />
    </g>
  );
}

function BlockArt({
  b,
  url,
  here,
}: {
  b: Block;
  url: (n: string) => string;
  here: boolean;
}) {
  const { x, y, w, h } = b;
  const r = b.region;
  if (!b.leaf) {
    // 칸을 품은 블록: 어두운 틀과 이름 띠
    if (b.depth === 1) return null;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="#121827"
          stroke="#4b5675"
        />
        <rect x={x} y={b.safe.y} width={w} height={b.header} fill="#232b3e" />
        {b.found && (
          <rect
            x={x}
            y={b.safe.y}
            width={w}
            height="2"
            fill={NEW_METAL}
            opacity="0.7"
          />
        )}
      </g>
    );
  }
  const s = r.status;
  const inset = 0.75;
  const base = {
    x: x + inset,
    y: y + inset,
    width: Math.max(0, w - inset * 2),
    height: Math.max(0, h - inset * 2),
  };
  const safeBottom = b.safe.y + b.safe.h;
  return (
    <g>
      {s === "fog" && (
        <>
          <rect {...base} fill="#0e1424" />
          <rect {...base} fill={url("fog")} />
          <rect
            {...base}
            fill="none"
            stroke="#8fb4ff"
            strokeOpacity="0.55"
            strokeDasharray="4 3"
          />
        </>
      )}
      {s === "building" && (
        <>
          <rect {...base} fill="#211f1a" />
          {/* 반쯤 붙인 외판 + 나머지는 비계 */}
          <rect
            x={base.x}
            y={base.y}
            width={base.width * 0.45}
            height={base.height}
            fill="#4a5168"
          />
          <rect
            x={base.x + base.width * 0.45}
            y={base.y}
            width={base.width * 0.55}
            height={base.height}
            fill={url("scaf")}
          />
          <rect {...base} fill="none" stroke="#ffcf5c" strokeOpacity="0.75" />
          <Sparks
            x={base.x + base.width * 0.45}
            y={b.safe.y + b.safe.h * 0.6}
            big={here}
          />
        </>
      )}
      {s === "done" && (
        <>
          <rect {...base} fill={url("paint")} />
          <rect {...base} fill="none" stroke="#7fe0a8" strokeOpacity="0.45" />
          {/* 외판 이음선과 리벳 */}
          {seams(base.x, base.width, 46).map((sx) => (
            <line
              key={sx}
              x1={sx}
              x2={sx}
              y1={base.y}
              y2={base.y + base.height}
              stroke="#0f2a22"
              strokeOpacity="0.5"
            />
          ))}
          {b.safe.h > 20 &&
            seams(base.x, base.width, 9).map((rx) => (
              <circle
                key={rx}
                cx={rx}
                cy={b.safe.y + 3}
                r="0.9"
                fill="#bff5d6"
                opacity="0.5"
              />
            ))}
          {/* 창 불빛 */}
          {b.safe.h >= 34 &&
            seams(base.x + 4, base.width - 8, 15).map((wx) => (
              <rect
                key={wx}
                x={wx - 3}
                y={safeBottom - 9}
                width="6"
                height="4"
                rx="1.5"
                fill="#ffe39a"
                opacity="0.9"
              />
            ))}
        </>
      )}
      {s === "blocked" && (
        <>
          <rect {...base} fill={url("hazard")} />
          <rect {...base} fill="#2a0f12" opacity="0.35" />
          <rect {...base} fill="none" stroke="#ff6b6b" strokeWidth="2.5" />
        </>
      )}
      {b.found && s !== "fog" && (
        <rect
          x={base.x}
          y={b.safe.y}
          width={base.width}
          height="2"
          fill={NEW_METAL}
          opacity="0.75"
        />
      )}
      {/* 격벽 안 칸 사이를 어둡게 */}
      {b.depth === 3 && (
        <rect {...base} fill="none" stroke="#070a12" strokeWidth="1.5" />
      )}
    </g>
  );
}

/** start부터 길이 len 안에 step 간격으로 찍을 x들(양 끝은 비운다) */
function seams(start: number, len: number, step: number): number[] {
  const n = Math.floor(len / step);
  if (n < 1) return [];
  const gap = len / (n + 1);
  return Array.from({ length: n }, (_, i) => Math.round(start + gap * (i + 1)));
}

function Sparks({ x, y, big }: { x: number; y: number; big: boolean }) {
  const r = big ? 2 : 1.4;
  return (
    <g>
      <circle
        className={styles.glow}
        cx={x}
        cy={y}
        r={big ? 5 : 3.5}
        fill="#fff3c4"
        opacity="0.9"
      />
      <g fill="#ffcf5c">
        <circle
          className={styles.spark}
          cx={x}
          cy={y}
          r={r}
          style={{ "--dx": "7px", "--dy": "6px" } as CSSProperties}
        />
        <circle
          className={styles.spark}
          cx={x}
          cy={y}
          r={r}
          style={{ "--dx": "-6px", "--dy": "8px" } as CSSProperties}
        />
        <circle
          className={styles.spark}
          cx={x}
          cy={y}
          r={r}
          style={{ "--dx": "2px", "--dy": "10px" } as CSSProperties}
        />
      </g>
    </g>
  );
}

/** 몸통 아래 길이 눈금: 처음 설계 길이(점선)와 발견으로 늘어난 길이(새 금속색) */
function Ruler({ ship, found }: { ship: ShipLayout; found: number }) {
  const y = ship.rulerY;
  const grown = ship.planX < ship.x1 - 2;
  const planW = ship.planX - ship.x0;
  const growW = ship.x1 - ship.planX;
  return (
    <g fontSize="11">
      <line x1={ship.x0} x2={ship.x0} y1={y - 5} y2={y + 5} stroke="#9fb0d0" />
      <line
        x1={ship.x0}
        x2={ship.planX}
        y1={y}
        y2={y}
        stroke="#9fb0d0"
        strokeDasharray="5 4"
      />
      {/* 처음 설계대로라면 꼬리가 여기 붙었다: 점선 분사구 */}
      {grown && (
        <polygon
          points={`${ship.planX},${y - 4} ${ship.planX + 12},${y - 7} ${ship.planX + 12},${y + 7} ${ship.planX},${y + 4}`}
          fill="none"
          stroke="#9fb0d0"
          strokeDasharray="2 2"
        />
      )}
      {planW > 96 && (
        <text
          x={ship.x0 + planW / 2}
          y={y + 15}
          fill="#9fb0d0"
          textAnchor="middle"
        >
          처음 설계 길이
        </text>
      )}
      {grown && (
        <>
          <line
            x1={ship.planX + 14}
            x2={ship.x1}
            y1={y}
            y2={y}
            stroke={NEW_METAL}
            strokeWidth="2.5"
          />
          <line
            x1={ship.x1}
            x2={ship.x1}
            y1={y - 5}
            y2={y + 5}
            stroke={NEW_METAL}
          />
          <text
            x={ship.planX + 14 + Math.max(0, (growW - 14) / 2)}
            y={y + 15}
            fill={NEW_METAL}
            textAnchor="middle"
          >
            {growW > 150
              ? `발견한 ${found}구역만큼 늘어남`
              : growW > 60
                ? `+${found}구역`
                : `+${found}`}
          </text>
        </>
      )}
    </g>
  );
}

/* ───────────── HTML: 이름·단추·꼬리표·선원 ───────────── */

function Overlay({
  ship,
  title,
  goal,
  here,
  crew,
  selected,
  onSelect,
  now,
}: {
  ship: ShipLayout;
  title: string;
  goal?: string;
  here?: string;
  crew?: Crew;
  selected: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const hereBlock = ship.blocks.find((b) => b.region.id === here);
  const forkHere = hereBlock ? hasForkForMe(hereBlock.region) : false;
  return (
    <div className="absolute inset-0">
      {/* 뱃머리 배 이름 */}
      <div
        className="absolute truncate text-[12px] font-bold tracking-wide text-white/85"
        style={{
          left: ship.bowTip.x + ship.bowLen * 0.28,
          top: ship.bowTip.y - 9,
          width: ship.bowLen * 0.66,
        }}
        title={goal ? `${title} · 진수 목표: ${goal}` : title}
      >
        {title}
      </div>

      {/* 구획 이름표 */}
      {ship.columns.map((c) => (
        <Plate
          key={c.region.id}
          b={c}
          y={ship.plateY}
          h={ship.plateH}
          selected={selected === c.region.id}
          onSelect={onSelect}
          now={now}
        />
      ))}

      {ship.blocks.map((b) =>
        b.depth === 1 && !b.leaf ? null : b.leaf ? (
          <LeafButton
            key={b.region.id}
            b={b}
            selected={selected === b.region.id}
            onSelect={onSelect}
            now={now}
            hereSpace={b.region.id === here}
          />
        ) : (
          <HeaderButton
            key={b.region.id}
            b={b}
            selected={selected === b.region.id}
            onSelect={onSelect}
          />
        ),
      )}

      {/* 내가 정할 갈림길: 노란 도면 꼬리표 */}
      {ship.blocks
        .filter((b) => b.depth > 1 && hasForkForMe(b.region))
        .map((b) => (
          <ForkTag key={b.region.id} b={b} onSelect={onSelect} />
        ))}

      {hereBlock && crew && (
        <HereAnimal b={hereBlock} ship={ship} crew={crew} wave={forkHere} />
      )}

      {ship.pile.map((b, i) => (
        <button
          key={b.region.id}
          type="button"
          data-region={b.region.id}
          data-status="dropped"
          title={`${b.region.title} · 버림`}
          aria-pressed={selected === b.region.id}
          onClick={() => onSelect(b.region.id)}
          className="absolute truncate rounded-sm border border-white/15 bg-[#2a2f3c] px-1.5 text-left text-[11px] leading-[24px] text-white/55"
          style={{
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            transform: `rotate(${i % 2 ? 2.5 : -3}deg)`,
            boxShadow: selected === b.region.id ? "0 0 0 2px #fff" : undefined,
          }}
        >
          {b.region.title}
        </button>
      ))}
    </div>
  );
}

function statusText(r: Region) {
  return `${r.title} · ${REGION_STATUS_LABEL[r.status]}`;
}

function Plate({
  b,
  y,
  h,
  selected,
  onSelect,
  now,
}: {
  b: Block;
  y: number;
  h: number;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = b.region;
  const mine = hasForkForMe(r);
  const fresh = isNewFound(r, now);
  return (
    <button
      type="button"
      data-region={r.id}
      data-status={r.status}
      aria-pressed={selected}
      title={`${statusText(r)}${b.found ? " · 처음 계획에 없던 구획" : ""}`}
      onClick={() => onSelect(r.id)}
      className={`${styles.plate} absolute flex items-center gap-1 overflow-hidden rounded-sm border px-1.5 text-left text-[11.5px] font-semibold text-white/85`}
      style={{
        left: b.x,
        top: y,
        width: b.w,
        height: h,
        background: "#232b3e",
        borderColor: b.found ? NEW_METAL : "#4b5675",
        boxShadow: selected
          ? "0 0 0 2px #fff, 0 0 10px rgb(124 224 255 / 0.6)"
          : undefined,
      }}
    >
      {b.w > 44 && (
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: REGION_STATUS_COLOR[r.status] }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{r.title}</span>
      {fresh && b.w > 90 && (
        <span className="shrink-0 text-[9.5px] text-[#7ce0ff]">새</span>
      )}
      {mine && (
        <span className="shrink-0 rounded-sm bg-[#ffd84a] px-0.5 text-[11px] leading-[14px] font-bold text-[#2a2100]">
          {SIGN_ICON.fork}
        </span>
      )}
    </button>
  );
}

function HeaderButton({
  b,
  selected,
  onSelect,
}: {
  b: Block;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const r = b.region;
  const mine = hasForkForMe(r);
  return (
    <button
      type="button"
      data-region={r.id}
      data-status={r.status}
      aria-pressed={selected}
      title={statusText(r)}
      onClick={() => onSelect(r.id)}
      className={`${styles.block} absolute flex items-center gap-1 overflow-hidden px-1.5 text-left text-[10.5px] font-semibold text-white/75`}
      style={{
        left: b.x,
        top: b.safe.y,
        width: b.w,
        height: b.header,
        paddingRight: mine ? 30 : undefined,
      }}
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: REGION_STATUS_COLOR[r.status] }}
      />
      <span className="min-w-0 truncate">{r.title}</span>
    </button>
  );
}

function LeafButton({
  b,
  selected,
  onSelect,
  now,
  hereSpace,
}: {
  b: Block;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
  hereSpace: boolean;
}) {
  const r = b.region;
  const s = b.safe;
  const status = r.status;
  const mine = hasForkForMe(r);
  const fresh = isNewFound(r, now);
  const signs = minorSigns(r);
  const tiny = s.w < 30 || s.h < 15;
  const twoLines = s.h >= 46 && s.w >= 60;
  const showStatus = s.h >= 52 && s.w >= 70;
  const showSigns = signs.length > 0 && s.h >= 34;
  const tagW = mine ? (s.w >= 100 ? 62 : 22) : 0;
  const animalW = hereSpace ? animalSize(b) + 6 : 0;
  const label = `${statusText(r)}${b.found ? " · 처음 계획에 없던 블록" : ""}${fresh ? " · 새로 발견" : ""}${
    signs.length ? ` · ${signs.map((x) => x.title).join(", ")}` : ""
  }`;
  const textColor =
    status === "fog"
      ? "text-[#c9d6f2]/80"
      : status === "blocked"
        ? "text-[#ffe3e3]"
        : "text-white";
  return (
    <button
      type="button"
      data-region={r.id}
      data-status={status}
      aria-pressed={selected}
      title={label}
      onClick={() => onSelect(r.id)}
      className={`${styles.block} absolute flex flex-col items-start overflow-hidden text-left`}
      style={{
        left: s.x,
        top: s.y,
        width: s.w,
        height: s.h,
        padding: tiny ? 0 : "3px 4px",
        paddingRight: tiny ? 0 : 4 + tagW,
      }}
    >
      {!tiny && (
        <span
          className={`${styles.chip} ${textColor} max-w-full rounded-[3px] px-1 text-[11.5px] leading-[15px] font-medium ${
            twoLines ? "line-clamp-2" : "truncate"
          }`}
        >
          {status === "blocked" && "⛔ "}
          {r.title}
        </span>
      )}
      {showStatus && (
        <span
          className="mt-0.5 max-w-full truncate px-1 text-[10px] font-semibold whitespace-nowrap"
          style={{ color: REGION_STATUS_COLOR[status] }}
        >
          {REGION_STATUS_LABEL[status]}
          {fresh && <span className="ml-1 text-[#7ce0ff]">· 새로 발견</span>}
        </span>
      )}
      {showSigns && (
        <span className="mt-auto flex gap-0.5" style={{ marginRight: animalW }}>
          {signs.slice(0, s.w > 90 ? 3 : 1).map((x) => (
            <span
              key={x.id}
              title={x.title}
              className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10.5px] leading-none ${
                x.type === "risk"
                  ? "bg-[#ff9b5c]/30 text-[#ffc9a3]"
                  : "bg-black/55 text-white/85"
              }`}
            >
              {SIGN_ICON[x.type]}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function ForkTag({
  b,
  onSelect,
}: {
  b: Block;
  onSelect: (id: string) => void;
}) {
  const s = b.leaf ? b.safe : { ...b.safe, h: b.header };
  const wide = s.w >= 100;
  const fork = (b.region.signs ?? []).find(isForkForMe);
  const h = b.leaf ? 18 : Math.max(12, b.header - 2);
  return (
    <button
      type="button"
      title={`내가 정할 갈림길: ${fork?.title ?? ""}`}
      onClick={() => onSelect(b.region.id)}
      className={`${styles.tag} absolute flex items-center justify-center gap-0.5 rounded-[3px] text-[10.5px] font-bold whitespace-nowrap`}
      style={{
        left: s.x + s.w - (wide ? 62 : 22) - 3,
        top: s.y + (b.leaf ? 4 : 1),
        width: wide ? 62 : 22,
        height: h,
      }}
    >
      <span className="text-[12px] leading-none">{SIGN_ICON.fork}</span>
      {wide && "정할 것"}
    </button>
  );
}

function animalSize(b: Block) {
  return Math.round(
    Math.max(18, Math.min(44, b.safe.h * 0.62, b.safe.w * 0.4)),
  );
}

function HereAnimal({
  b,
  ship,
  crew,
  wave,
}: {
  b: Block;
  ship: ShipLayout;
  crew: Crew;
  wave: boolean;
}) {
  let size: number;
  let left: number;
  let top: number;
  if (b.leaf) {
    size = animalSize(b);
    left = b.safe.x + b.safe.w - size - 4;
    top = b.safe.y + b.safe.h - size * 1.25 - 1;
  } else if (b.depth === 1) {
    // 구획 전체가 여기라면 이름표 옆에 선다
    size = 22;
    left = b.x + b.w - size - 2;
    top = ship.plateY - size * 1.25 + ship.plateH;
  } else {
    size = 18;
    left = b.x + b.w - size - 3;
    top = b.safe.y + b.header - size * 1.25;
  }
  const pose = wave
    ? "wave"
    : crew.status === "off"
      ? "stand"
      : poseFor(crew.status);
  return (
    <span
      data-here
      title="지금 여기"
      className="pointer-events-none absolute"
      style={{ left, top, width: size }}
    >
      <Animal
        kind={animalFor(crew.id)}
        pose={pose}
        context={crew.context}
        size={size}
        furniture={false}
        urgency={wave ? 0.8 : undefined}
        label={`${crew.name} 선원, 지금 여기`}
      />
    </span>
  );
}
