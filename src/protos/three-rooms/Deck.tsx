"use client";

// 스크롤 뒤 장면: 작업실 · 대기실(조종석 앞) · 휴게실이 나란히. 선원은 상태가 바뀌면 걸어서 방을 옮긴다.
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, CREW_STATUS_LABEL } from "@/ui/kit";
import { CrewCard, EntryCard } from "./Cards";
import { Robot, Visitor } from "./Figures";
import {
  DECK_H,
  DECK_W,
  type Figure,
  FLOOR,
  HATCH_POINT,
  HEADER,
  layoutDeck,
  ROOMS,
  WAIT_GEO,
} from "./layout";
import {
  entryName,
  type QueueEntry,
  ROOM_HINT,
  ROOM_LABEL,
  type Room,
  type RoomsModel,
} from "./model";

// ── 걷기 ─────────────────────────────────────────────

type Pt = { x: number; y: number };

/** 바닥으로 내려가 걷고, 목적지 높이로 올라간다(방 사이 문은 바닥에 있다). */
function walkPath(a: Pt, b: Pt): Pt[] {
  const pts: Pt[] = [a];
  if (Math.abs(a.x - b.x) > 40) {
    if (a.y !== FLOOR) pts.push({ x: a.x, y: FLOOR });
    if (b.y !== FLOOR) pts.push({ x: b.x, y: FLOOR });
  }
  pts.push(b);
  return pts;
}

let deckReady = false;

function Walker({
  fig,
  selected,
  onSelect,
  render,
  bubble,
}: {
  fig: Figure;
  selected: boolean;
  onSelect: () => void;
  render: (walking: boolean) => ReactNode;
  bubble?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const prev = useRef<{ x: number; y: number; size: number } | null>(null);
  const anim = useRef<Animation | null>(null);
  const [walking, setWalking] = useState(false);
  const { x, y, size } = fig;
  const h = size * 1.25;

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { x, y, size };
    const el = ref.current;
    if (!el) return;
    // 처음 보이는 순간: 이미 자리에 있던 선원은 그대로, 새로 온 방문객은 도킹 통로에서 걸어 들어온다
    const from =
      p ??
      (deckReady && fig.who === "visitor" ? { ...HATCH_POINT, size } : null);
    if (!from || (from.x === x && from.y === y && from.size === size)) return;
    const pts = walkPath(from, { x, y });
    const lens = pts.slice(1).map((q, i) => {
      const a = pts[i] as Pt;
      return Math.hypot(q.x - a.x, (q.y - a.y) * 1.6);
    });
    const total = lens.reduce((s, v) => s + v, 0) || 1;
    let acc = 0;
    const s0 = from.size / size;
    const frames = pts.map((q, i) => {
      if (i > 0) acc += lens[i - 1] ?? 0;
      const k = acc / total;
      const sc = s0 + (1 - s0) * k;
      return {
        transform: `translate(${q.x - x}px, ${q.y - y}px) scale(${sc})`,
        offset: k,
      };
    });
    anim.current?.cancel();
    setWalking(true);
    const a = el.animate(frames, {
      duration: Math.min(5200, Math.max(900, (total / 150) * 1000)),
      easing: "linear",
    });
    anim.current = a;
    a.onfinish = () => setWalking(false);
    a.oncancel = () => setWalking(false);
  }, [x, y, size, fig.who]);

  const dim =
    fig.who === "crew" && fig.crew.status === "off" && fig.room === "lounge";
  return (
    <button
      ref={ref}
      type="button"
      data-figure={fig.key}
      data-room={fig.room}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="absolute cursor-pointer outline-none"
      style={{
        left: x - size / 2,
        top: y - h,
        width: size,
        height: h,
        transformOrigin: "50% 100%",
        zIndex: walking ? 30 : selected ? 25 : fig.order >= 0 ? 12 : 10,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <span
        className="absolute inset-0 block transition-transform duration-300"
        style={{
          transform: selected ? "translateY(-8px) scale(1.18)" : undefined,
          transformOrigin: "50% 100%",
        }}
      >
        {render(walking)}
      </span>
      {selected && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-[110%] -translate-x-1/2 rounded-full bg-amber-300/50 blur-[3px]" />
      )}
      {!walking && bubble}
    </button>
  );
}

// ── 머리 위 말풍선과 이름표 ─────────────────────────────

function Bubble({
  fig,
  title,
  name,
  since,
  first,
}: {
  fig: Figure;
  title: string;
  name: string;
  since?: number;
  first: boolean;
}) {
  const w = 190;
  const h = fig.size * 1.25;
  // 방 밖으로 나가지 않게
  const room = ROOMS.wait;
  const left = Math.min(
    Math.max(fig.x - w / 2, room.x + 38),
    room.x + room.w - w - 6,
  );
  const bottom = h + 6 + fig.tier * 54;
  return (
    <span
      className={`pointer-events-none absolute block rounded-xl border px-2.5 py-1.5 text-left shadow-lg ${
        first
          ? "border-amber-300/70 bg-[#2a2210]/95"
          : "border-white/15 bg-[#0b1020]"
      }`}
      style={{ width: w, left: left - (fig.x - fig.size / 2), bottom }}
    >
      <span className="flex items-center gap-1 text-[10.5px] leading-tight text-white/60">
        {first && (
          <b className="rounded bg-amber-300 px-1 text-[10px] text-hull-950">
            맨 앞
          </b>
        )}
        <span className="truncate">{name}</span>
        {since !== undefined && (
          <span className="ml-auto shrink-0 font-semibold text-amber-200">
            {ago(since)}
          </span>
        )}
      </span>
      <span className="mt-0.5 block truncate text-[12.5px] leading-snug font-medium text-white">
        {title}
      </span>
      {/* 꼬리 */}
      <span
        className={`absolute -bottom-[5px] block size-2.5 rotate-45 border-r border-b ${
          first
            ? "border-amber-300/70 bg-[#2a2210]"
            : "border-white/15 bg-hull-900"
        }`}
        style={{ left: fig.x - left - 5 }}
      />
    </span>
  );
}

function NameTag({
  text,
  sub,
  color,
  size,
}: {
  text: string;
  sub?: string;
  color: string;
  size: number;
}) {
  const w = Math.max(size + 8, 46);
  return (
    <span
      className="pointer-events-none absolute top-full left-1/2 mt-0.5 block -translate-x-1/2 text-center leading-tight"
      style={{ width: w }}
    >
      <span
        className="block truncate rounded-sm px-1 text-[9.5px] font-semibold"
        style={{ color, background: "rgba(5,7,13,.65)" }}
      >
        {text}
      </span>
      {sub && (
        <span className="block truncate text-[9px] text-white/50">{sub}</span>
      )}
    </span>
  );
}

// ── 방 그림 ─────────────────────────────────────────

const PANEL_LINES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const STAR_IDS = Array.from({ length: 34 }, (_, i) => i);

function Platforms({ rows, room }: { rows: number[]; room: Room }) {
  const { x, w } = ROOMS[room];
  return (
    <>
      {rows.slice(1).map((y) => (
        <g key={y}>
          <rect
            x={x + 8}
            y={y + 1}
            width={w - 16}
            height={6}
            rx={2}
            fill="#2b3550"
          />
          <rect
            x={x + 8}
            y={y + 7}
            width={w - 16}
            height={2}
            fill="#000"
            opacity={0.35}
          />
          {/* 사다리 */}
          <g stroke="#3d4a6b" strokeWidth={2}>
            <line x1={x + w - 22} y1={y + 7} x2={x + w - 22} y2={y + 60} />
            <line x1={x + w - 12} y1={y + 7} x2={x + w - 12} y2={y + 60} />
          </g>
        </g>
      ))}
    </>
  );
}

function RoomShell({ room, tint }: { room: Room; tint: string }) {
  const { x, w } = ROOMS[room];
  return (
    <g>
      <rect
        x={x}
        y={0}
        width={w}
        height={DECK_H}
        rx={18}
        fill="#0e1427"
        stroke="#2a3657"
        strokeWidth={2}
      />
      {/* 뒷벽 판넬 */}
      <rect
        x={x + 6}
        y={HEADER}
        width={w - 12}
        height={FLOOR - HEADER}
        fill={tint}
        opacity={0.07}
      />
      {PANEL_LINES.slice(0, Math.floor((w - 12) / 64)).map((i) => (
        <line
          key={i}
          x1={x + 6 + (i + 1) * 64}
          y1={HEADER}
          x2={x + 6 + (i + 1) * 64}
          y2={FLOOR}
          stroke="#ffffff"
          strokeOpacity={0.035}
        />
      ))}
      {/* 머리 띠 */}
      <rect
        x={x + 2}
        y={2}
        width={w - 4}
        height={HEADER - 4}
        rx={16}
        fill="#151d35"
      />
      <rect
        x={x + 16}
        y={HEADER - 4}
        width={w - 32}
        height={2}
        fill={tint}
        opacity={0.6}
      />
      {/* 바닥 */}
      <rect
        x={x + 2}
        y={FLOOR}
        width={w - 4}
        height={DECK_H - FLOOR - 2}
        fill="#252f4a"
      />
      <rect
        x={x + 2}
        y={FLOOR}
        width={w - 4}
        height={2}
        fill={tint}
        opacity={0.35}
      />
      {/* 천장 등 */}
      {[0.25, 0.5, 0.75].map((f) => (
        <rect
          key={f}
          x={x + w * f - 18}
          y={HEADER + 2}
          width={36}
          height={3}
          rx={1.5}
          fill="#fff4d6"
          opacity={0.35}
        />
      ))}
    </g>
  );
}

function WorkFurniture() {
  const { x, w } = ROOMS.work;
  return (
    <g>
      {/* 벽 화면: 진행 막대 */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${x + 30 + i * 118} ${HEADER + 14})`}>
          <rect width={96} height={40} rx={5} fill="#0a1222" stroke="#2f4a77" />
          <rect
            x={8}
            y={9}
            width={58 - i * 12}
            height={4}
            rx={2}
            fill="#6cb6ff"
            opacity={0.8}
          />
          <rect
            x={8}
            y={18}
            width={74 - i * 20}
            height={4}
            rx={2}
            fill="#5ee08a"
            opacity={0.6}
          />
          <rect
            x={8}
            y={27}
            width={40 + i * 10}
            height={4}
            rx={2}
            fill="#6cb6ff"
            opacity={0.4}
          />
        </g>
      ))}
      <text
        x={x + w / 2}
        y={FLOOR + 9}
        fontSize={8}
        fill="#8fa0c8"
        textAnchor="middle"
        opacity={0.6}
      >
        ← 대기실로 가는 문 →
      </text>
    </g>
  );
}

function LoungeFurniture({
  sofas,
}: {
  sofas: { x: number; y: number; size: number }[];
}) {
  const { x, w } = ROOMS.lounge;
  return (
    <g>
      {/* 큰 창: 쉬는 선원이 같은 하늘을 본다 */}
      <rect
        x={x + 18}
        y={HEADER + 12}
        width={w - 36}
        height={78}
        rx={30}
        fill="#03050c"
        stroke="#3a4a72"
        strokeWidth={3}
      />
      {STAR_IDS.map((i) => {
        const sx = x + 30 + ((i * 97) % (w - 60));
        const sy = HEADER + 20 + ((i * 53) % 62);
        return (
          <circle
            key={i}
            cx={sx}
            cy={sy}
            r={i % 7 === 0 ? 1.4 : 0.8}
            fill="#fff"
            opacity={0.4 + (i % 5) * 0.12}
            className={i % 6 === 0 ? "tr-blink" : undefined}
          />
        );
      })}
      <circle
        cx={x + w - 70}
        cy={HEADER + 48}
        r={14}
        fill="#d9a46c"
        opacity={0.85}
      />
      <ellipse
        cx={x + w - 70}
        cy={HEADER + 48}
        rx={24}
        ry={5}
        fill="none"
        stroke="#efd9b9"
        strokeOpacity={0.7}
      />
      {/* 화분 */}
      <g transform={`translate(${x + w - 34} ${FLOOR - 34})`}>
        <path d="M-10 34 L-7 16 L7 16 L10 34 Z" fill="#b36a45" />
        <path
          d="M0 16 C -14 4 -12 -8 -2 -10 C 0 -2 0 6 0 16 C 4 4 12 -2 14 -6 C 16 4 8 12 0 16"
          fill="#5ec27a"
        />
      </g>
      {/* 소파 */}
      {sofas.map((s) => (
        <g key={`${s.x}-${s.y}`} transform={`translate(${s.x} ${s.y})`}>
          <rect
            x={-s.size * 0.62}
            y={-s.size * 0.62}
            width={s.size * 1.24}
            height={s.size * 0.5}
            rx={s.size * 0.14}
            fill="#6d4a8c"
          />
          <rect
            x={-s.size * 0.7}
            y={-s.size * 0.2}
            width={s.size * 1.4}
            height={s.size * 0.2}
            rx={s.size * 0.08}
            fill="#8a63ab"
          />
          <rect
            x={-s.size * 0.74}
            y={-s.size * 0.42}
            width={s.size * 0.16}
            height={s.size * 0.42}
            rx={s.size * 0.06}
            fill="#5a3b75"
          />
          <rect
            x={s.size * 0.58}
            y={-s.size * 0.42}
            width={s.size * 0.16}
            height={s.size * 0.42}
            rx={s.size * 0.06}
            fill="#5a3b75"
          />
        </g>
      ))}
    </g>
  );
}

function WaitFurniture({ overflow }: { overflow: number }) {
  const R = ROOMS.wait;
  const { door, porthole, hatch, bench } = WAIT_GEO;
  return (
    <g>
      {/* 조종석 문 */}
      <g transform={`translate(${R.x} 0)`}>
        <rect
          x={porthole.x - 6}
          y={porthole.y - 6}
          width={porthole.w + 12}
          height={porthole.h + 12}
          rx={10}
          fill="#1b2440"
          stroke="#ffcf5c"
          strokeOpacity={0.6}
          strokeWidth={2}
        />
        <rect
          x={porthole.x}
          y={porthole.y}
          width={porthole.w}
          height={porthole.h}
          rx={6}
          fill="#02030a"
        />
        <text
          x={porthole.x + porthole.w / 2}
          y={porthole.y - 12}
          fontSize={10}
          fill="#ffcf5c"
          textAnchor="middle"
          fontWeight={700}
        >
          조종석 ▲
        </text>
        <rect
          x={door.x - 8}
          y={door.y - 6}
          width={door.w + 16}
          height={door.h + 6}
          rx={14}
          fill="#26304d"
        />
        <rect
          x={door.x}
          y={door.y}
          width={door.w}
          height={door.h}
          rx={10}
          fill="#334063"
          stroke="#4d5d88"
        />
        <line
          x1={door.x + door.w / 2}
          y1={door.y + 6}
          x2={door.x + door.w / 2}
          y2={FLOOR}
          stroke="#1c2440"
          strokeWidth={2}
        />
        <rect
          x={door.x + 10}
          y={door.y + 36}
          width={door.w - 20}
          height={12}
          rx={6}
          fill="#ffcf5c"
          opacity={0.85}
          className="tr-blink"
        />
        {/* 줄 방향 표시 */}
        <g opacity={0.55}>
          <line
            x1={40}
            y1={FLOOR + 7}
            x2={door.x - 14}
            y2={FLOOR + 7}
            stroke="#ffcf5c"
            strokeWidth={2}
            strokeDasharray="6 4"
            className="tr-dash"
          />
          <path
            d={`M${door.x - 14} ${FLOOR + 3} l7 4 l-7 4 z`}
            fill="#ffcf5c"
          />
        </g>
        {/* 다음 줄 단 */}
        <rect
          x={bench.x0 - 22}
          y={bench.y + 1}
          width={bench.gap * bench.n + 8}
          height={7}
          rx={3}
          fill="#2b3550"
        />
        <rect
          x={bench.x0 - 22}
          y={bench.y + 8}
          width={bench.gap * bench.n + 8}
          height={2}
          fill="#000"
          opacity={0.4}
        />
        <text
          x={bench.x0 - 18}
          y={bench.y - 62}
          fontSize={10}
          fill="#8fa0c8"
          opacity={0.75}
        >
          ← 다음 줄 · 앞줄이 비면 내려가요
        </text>
        {/* 도킹 통로 */}
        <rect
          x={hatch.x}
          y={hatch.y}
          width={hatch.w}
          height={hatch.h}
          rx={6}
          fill="#141b2f"
          stroke="#7f8fff"
          strokeOpacity={0.5}
        />
        <circle
          cx={hatch.x + hatch.w / 2}
          cy={hatch.y + 24}
          r={8}
          fill="none"
          stroke="#7f8fff"
          strokeOpacity={0.7}
          strokeWidth={2}
        />
        <text
          x={hatch.x + hatch.w / 2}
          y={hatch.y - 6}
          fontSize={8.5}
          fill="#a9b4ff"
          textAnchor="middle"
          opacity={0.85}
        >
          도킹
        </text>
        {/* 벽 안내 */}
        <g transform="translate(20 66)">
          <rect
            width={300}
            height={52}
            rx={10}
            fill="#141b2f"
            stroke="#2c3a5c"
          />
          <text x={14} y={22} fontSize={12} fill="#e8ecf6" fontWeight={600}>
            줄 맨 앞 = 지금 할 일
          </text>
          <text x={14} y={40} fontSize={10.5} fill="#8fa0c8">
            누르면 앞으로 나와 카드를 내밀어요
          </text>
        </g>
        {overflow > 0 && (
          <g
            transform={`translate(${bench.x0 + bench.gap * (bench.n - 1) - 20} ${bench.y - 44})`}
          >
            <rect width={40} height={22} rx={5} fill="#ffcf5c" />
            <rect x={18} y={22} width={4} height={22} fill="#8b93a8" />
            <text
              x={20}
              y={15}
              fontSize={11}
              fontWeight={700}
              fill="#141b2f"
              textAnchor="middle"
            >
              외 {overflow}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}

// ── 떠나는 방문객 ─────────────────────────────────────

type Ghost = { fig: Figure; id: number };

function GhostWalker({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pts = walkPath({ x: fig.x, y: fig.y }, HATCH_POINT);
    const frames = pts.map((q, i) => ({
      transform: `translate(${q.x - fig.x}px, ${q.y - fig.y}px)`,
      opacity: i === pts.length - 1 ? 0 : 1,
      offset: i / (pts.length - 1),
    }));
    const a = el.animate(frames, { duration: 2400, easing: "linear" });
    a.onfinish = () => done.current();
  }, [fig]);
  const h = fig.size * 1.25;
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{ left: fig.x - fig.size / 2, top: fig.y - h, zIndex: 31 }}
    >
      {fig.who === "visitor" ? (
        <Visitor
          source={fig.entry.task?.source.kind ?? "chat"}
          service={fig.entry.task?.source.service}
          size={fig.size}
          pose="walk"
        />
      ) : null}
    </div>
  );
}

// ── 갑판 ─────────────────────────────────────────────

export function Deck({
  model,
  onCockpit,
  active,
}: {
  model: RoomsModel;
  onCockpit: () => void;
  active: boolean;
}) {
  const layout = useMemo(() => layoutDeck(model), [model]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prevFigs = useRef<Map<string, Figure>>(new Map());

  // 줄에서 사라진 방문객은 도킹 통로로 걸어 나간다
  useEffect(() => {
    const now = new Map(layout.figures.map((f) => [f.key, f]));
    const gone: Ghost[] = [];
    for (const [k, f] of prevFigs.current) {
      if (!now.has(k) && f.who === "visitor")
        gone.push({ fig: f, id: Math.random() });
    }
    prevFigs.current = now;
    if (gone.length && deckReady) setGhosts((g) => [...g, ...gone]);
    if (layout.figures.length) deckReady = true;
  }, [layout]);

  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);

  const sel = layout.figures.find((f) => f.key === selected);
  // 치워서 방을 옮기면 카드를 닫아 걸어가는 모습을 보인다
  const selRoom = useRef<string | null>(null);
  useEffect(() => {
    if (selected && !sel) setSelected(null);
    const [key, room] = (selRoom.current ?? ":").split(":");
    if (sel && key === sel.key && room !== sel.room) setSelected(null);
    selRoom.current = sel ? `${sel.key}:${sel.room}` : null;
  }, [selected, sel]);

  const counts = {
    work: model.work.length,
    wait: model.queue.length,
    lounge: model.lounge.length,
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 빈 곳을 누르면 카드를 닫는다(Esc도 된다)
    <div
      className="relative select-none"
      style={{ width: DECK_W, height: DECK_H }}
      onClick={() => setSelected(null)}
      onKeyDown={(e) => e.key === "Escape" && setSelected(null)}
    >
      <svg
        width={DECK_W}
        height={DECK_H}
        className="absolute inset-0"
        aria-hidden
      >
        <RoomShell room="work" tint="#6cb6ff" />
        <RoomShell room="wait" tint="#ffcf5c" />
        <RoomShell room="lounge" tint="#c58cff" />
        {/* 방 사이 문(바닥 쪽 틈) */}
        {[ROOMS.work.x + ROOMS.work.w, ROOMS.wait.x + ROOMS.wait.w].map(
          (gx) => (
            <rect
              key={gx}
              x={gx - 4}
              y={FLOOR - 70}
              width={22}
              height={70}
              fill="#1b2440"
            />
          ),
        )}
        <WorkFurniture />
        <Platforms rows={layout.workRows} room="work" />
        <WaitFurniture overflow={layout.overflow} />
        <LoungeFurniture sofas={layout.sofas} />
        <Platforms rows={layout.loungeRows} room="lounge" />
      </svg>

      {/* 방 이름과 인원 */}
      {(Object.keys(ROOMS) as Room[]).map((r) => (
        <div
          key={r}
          className="pointer-events-none absolute flex items-baseline gap-2 px-5"
          style={{ left: ROOMS[r].x, width: ROOMS[r].w, top: 9 }}
        >
          <span className="text-[17px] font-bold text-white">
            {ROOM_LABEL[r]}
          </span>
          <span
            className="text-[22px] leading-none font-black tabular-nums"
            style={{
              color:
                r === "wait" ? "#ffcf5c" : r === "work" ? "#6cb6ff" : "#c58cff",
            }}
          >
            {counts[r]}
          </span>
          <span className="text-xs text-white/50">{ROOM_HINT[r]}</span>
          {r === "wait" && (
            <span className="ml-auto text-[11px] text-white/45">
              급한 순 · 오래 기다린 순
            </span>
          )}
        </div>
      ))}

      {/* 조종석으로 돌아가는 문 */}
      <button
        type="button"
        aria-label="조종석으로"
        onClick={(e) => {
          e.stopPropagation();
          onCockpit();
        }}
        className="absolute rounded-xl"
        style={{
          left: ROOMS.wait.x + WAIT_GEO.door.x,
          top: WAIT_GEO.door.y,
          width: WAIT_GEO.door.w,
          height: 60,
        }}
      />

      {/* 선원과 방문객 */}
      {layout.figures.map((f) => (
        <Walker
          key={f.key}
          fig={f}
          selected={selected === f.key}
          onSelect={() => setSelected((s) => (s === f.key ? null : f.key))}
          render={(walking) => <FigureArt fig={f} walking={walking} />}
          bubble={<FigureLabel fig={f} />}
        />
      ))}
      {ghosts.map((g) => (
        <GhostWalker
          key={g.id}
          fig={g.fig}
          onDone={() => setGhosts((all) => all.filter((x) => x.id !== g.id))}
        />
      ))}

      {sel && <SceneCard fig={sel} onClose={() => setSelected(null)} />}
      {model.queue.length === 0 && (
        <div
          className="pointer-events-none absolute text-center"
          style={{ left: ROOMS.wait.x, width: ROOMS.wait.w - 100, top: 400 }}
        >
          <div className="text-lg font-semibold text-white/85">
            대기실이 비었어요
          </div>
          <div className="mt-1 text-sm text-white/50">
            할 일이 없어요 · 선원들은 일하거나 쉬는 중
          </div>
        </div>
      )}
    </div>
  );
}

function FigureArt({ fig, walking }: { fig: Figure; walking: boolean }) {
  if (fig.who === "crew") {
    const status = fig.crew.status;
    const pose = walking
      ? "walk"
      : fig.room === "wait"
        ? "wave"
        : fig.room === "work"
          ? "work"
          : poseFor(status);
    return (
      <Animal
        kind={animalFor(fig.crew.id)}
        pose={pose}
        context={fig.crew.context}
        size={fig.size}
        furniture={fig.room === "work" && !walking}
        label={`${fig.crew.name}, ${CREW_STATUS_LABEL[status]}`}
      />
    );
  }
  const task = fig.entry.task;
  if (!task) return null;
  return fig.who === "visitor" ? (
    <Visitor
      source={task.source.kind}
      service={task.source.service}
      size={fig.size}
      pose={walking ? "walk" : "wave"}
    />
  ) : (
    <Robot source={task.source.kind} size={fig.size} />
  );
}

function FigureLabel({ fig }: { fig: Figure }) {
  if (fig.room === "wait" && fig.entry) {
    const e: QueueEntry = fig.entry;
    const task = e.task;
    if (fig.tier >= 0) {
      return (
        <Bubble
          fig={fig}
          name={`${entryName(e)}${e.who === "crew" && e.extra ? ` · +${e.extra}` : ""}`}
          title={
            task?.title ??
            (fig.who === "crew" ? fig.crew.activity : undefined) ??
            "나를 기다려요"
          }
          since={task?.since}
          first={fig.order === 0}
        />
      );
    }
    return (
      <NameTag
        text={entryName(e)}
        sub={task ? ago(task.since) : undefined}
        color={task ? CONTEXT_COLOR[task.context] : "#fff"}
        size={fig.size}
      />
    );
  }
  if (fig.who !== "crew") return null;
  return (
    <NameTag
      text={fig.crew.name}
      color={CONTEXT_COLOR[fig.crew.context]}
      size={fig.size}
      sub={
        fig.room === "lounge" && fig.crew.status === "off"
          ? "자리 비움"
          : undefined
      }
    />
  );
}

function SceneCard({ fig, onClose }: { fig: Figure; onClose: () => void }) {
  const w = 372;
  const right = fig.x > DECK_W / 2;
  const left = right
    ? Math.max(8, fig.x - fig.size / 2 - w - 18)
    : Math.min(DECK_W - w - 8, fig.x + fig.size / 2 + 18);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 카드 안 클릭이 바깥 닫기로 번지지 않게
    // biome-ignore lint/a11y/noStaticElementInteractions: 위와 같음
    <div
      data-scroll-inside
      onClick={(e) => e.stopPropagation()}
      className="tr-pop absolute z-40 overflow-auto rounded-2xl border border-amber-300/40 bg-[#0b1020] p-4 text-white shadow-2xl"
      style={{ left, width: w, top: 54, maxHeight: DECK_H - 70 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      {fig.entry ? (
        <EntryCard entry={fig.entry} />
      ) : fig.who === "crew" ? (
        <CrewCard crew={fig.crew} />
      ) : null}
    </div>
  );
}
