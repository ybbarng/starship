"use client";

// 시안 4. 퍼져 가는 육각 개척지: 프로젝트 하나를 우리 우주선이 내려앉은 행성의 개척지로 그린다.
// 가운데 착륙선(목표) 둘레로 구역마다 육각 칸 size개가 붙고, 맨 위 구역(지역)은 굵은 색 경계로 묶인다.
// 상태는 땅 모습으로: 안개는 모래 폭풍, 공사중은 갈아엎은 흙과 장비, 완공은 초록 돔, 막힘은 붉은 울타리.
// 배치는 hex.ts(순수 함수)가 정하고, 여기서는 칸 반지름만 화면에 맞춰 곱한다.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  droppedIds,
  isForkForMe,
  isNewFound,
  type Region,
  type RegionStatus,
} from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { REGION_STATUS_LABEL } from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import styles from "./frontier.module.css";
import {
  add,
  clip,
  corners,
  EDGE_DIRS,
  type Hex,
  hexKey,
  type LabelAsk,
  layoutFrontier,
  type PlacedLabel,
  placeLabels,
  type Rect,
  ringOf,
  textWidth,
  toPixel,
  wedgeAngle,
} from "./hex";

/** 지역 색. 지도에 적힌 차례대로 고른다. 상태 색(초록·빨강·노랑)과 겹치지 않게 골랐다 */
const TERRITORY_COLORS = [
  "#e9b872",
  "#9db4ff",
  "#cf9ef5",
  "#6fd6cb",
  "#f4a0bf",
  "#c6d27a",
];

/** 상태별 땅 바탕 */
const GROUND: Record<RegionStatus, string> = {
  fog: "#454c5e",
  building: "#6a4627",
  done: "#2e7350",
  blocked: "#5e2329",
  dropped: "#262a33",
};

type P = { x: number; y: number };

export function FrontierView({
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
  const [hover, setHover] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const layout = useMemo(() => layoutFrontier(map), [map]);
  const dropped = useMemo(() => droppedIds(map), [map]);

  return (
    <section
      ref={ref}
      data-map
      className="relative h-full w-full overflow-hidden rounded-lg"
      aria-label={`${map.title} 개척지 지도`}
    >
      {size.w > 0 && size.h > 0 && (
        <Scene
          key={`${size.w}x${size.h}`}
          w={size.w}
          h={size.h}
          uid={uid}
          map={map}
          crew={crew}
          layout={layout}
          dropped={dropped}
          selected={selected}
          hover={hover}
          setHover={setHover}
          onSelect={onSelect}
          showDropped={showDropped}
          now={now}
        />
      )}
      {map.goal && (
        <div
          className="pointer-events-none absolute bottom-2 left-3 max-w-[46%] text-[11.5px] leading-snug"
          title={map.goal}
        >
          <span className="text-white/45">착륙선 목표 · </span>
          <span className="text-white/75">{clip(map.goal, 40)}</span>
        </div>
      )}
    </section>
  );
}

const CAPTION_H = 26;

function Scene({
  w,
  h,
  uid,
  map,
  crew,
  layout,
  dropped,
  selected,
  hover,
  setHover,
  onSelect,
  showDropped,
  now,
}: {
  w: number;
  h: number;
  uid: string;
  map: MapViewProps["map"];
  crew?: Crew;
  layout: ReturnType<typeof layoutFrontier>;
  dropped: Set<string>;
  selected: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  showDropped: boolean;
  now: number;
}) {
  const visible = (id: string) => showDropped || !dropped.has(id);
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const leafById = new Map(layout.leaves.map((l) => [l.region.id, l]));
  const terrIndex = new Map(
    layout.territories.map((t) => [t.region.id, t.index]),
  );
  const colorOf = (territory: string) =>
    TERRITORY_COLORS[(terrIndex.get(territory) ?? 0) % 6] ?? "#fff";

  /* ── 크기 맞추기: 칸 전체(숨긴 칸 포함, 껐다 켜도 크기가 그대로)와 지역 이름표 띠 ── */
  let minX = -2.8;
  let maxX = 2.8;
  let minY = -2.6;
  let maxY = 2.6;
  for (const l of layout.leaves)
    for (const c of l.cells) {
      const p = toPixel(c);
      minX = Math.min(minX, p.x - 1);
      maxX = Math.max(maxX, p.x + 1);
      minY = Math.min(minY, p.y - 0.9);
      maxY = Math.max(maxY, p.y + 0.9);
    }
  const band = 1.7;
  const availH = h - CAPTION_H - 10;
  const s = Math.max(
    9,
    Math.min(
      44,
      (w - 40) / (maxX - minX + 2 * band),
      availH / (maxY - minY + 2 * band),
    ),
  );
  const ox = w / 2 - (s * (minX + maxX)) / 2;
  const oy = 6 + availH / 2 - (s * (minY + maxY)) / 2;
  const px = (hx: Hex): P => {
    const p = toPixel(hx, s);
    return { x: ox + p.x, y: oy + p.y };
  };
  const poly = (c: P, k = 1) =>
    corners(c.x, c.y, s * k)
      .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
      .join(" ");

  /* ── 칸 주인(보이는 잎만) ── */
  const owner = new Map<string, string>();
  for (const l of layout.leaves)
    if (visible(l.region.id))
      for (const c of l.cells) owner.set(hexKey(c), l.region.id);

  /* ── 경계선: 지역(굵게, 지역 색) · 구역(중간) · 3단(얇게) · 같은 구역 칸 사이(흐리게) ── */
  const terrEdges = new Map<string, string[]>();
  const regionEdges: string[] = [];
  const subEdges: string[] = [];
  const cellEdges: string[] = [];
  const seg = (a?: P, b?: P) =>
    a && b
      ? `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
      : "";
  for (const l of layout.leaves) {
    if (!visible(l.region.id)) continue;
    for (const c of l.cells) {
      const p = px(c);
      const cs = corners(p.x, p.y, s);
      const inset = corners(p.x, p.y, s * 0.9);
      EDGE_DIRS.forEach((d, i) => {
        const nid = owner.get(hexKey(add(c, d)));
        const other = nid ? leafById.get(nid) : undefined;
        if (!other || other.territory !== l.territory) {
          const list = terrEdges.get(l.territory) ?? [];
          list.push(seg(inset[i], inset[(i + 1) % 6]));
          terrEdges.set(l.territory, list);
        } else if (other.group !== l.group)
          regionEdges.push(seg(cs[i], cs[(i + 1) % 6]));
        else if (other.region.id !== l.region.id)
          subEdges.push(seg(cs[i], cs[(i + 1) % 6]));
        else if (i < 3) cellEdges.push(seg(cs[i], cs[(i + 1) % 6]));
      });
    }
  }
  /** 구역(자손 포함) 둘레 선 */
  const outline = (id: string, k = 1) => {
    const cells = layout.cellsOf.get(id) ?? [];
    const keys = new Set(
      cells.filter((c) => owner.has(hexKey(c))).map((c) => hexKey(c)),
    );
    const out: string[] = [];
    for (const c of cells) {
      if (!keys.has(hexKey(c))) continue;
      const p = px(c);
      const cs = corners(p.x, p.y, s * k);
      EDGE_DIRS.forEach((d, i) => {
        if (!keys.has(hexKey(add(c, d)))) out.push(seg(cs[i], cs[(i + 1) % 6]));
      });
    }
    return out.join("");
  };

  /* ── 구역마다 가운데 칸과 표지 자리 ── */
  type Spot = { leaf: (typeof layout.leaves)[number]; center: P; slots: P[] };
  const spots = new Map<string, Spot>();
  for (const l of layout.leaves) {
    const ps = l.cells.map(px);
    const c = {
      x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
      y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
    };
    // 가운데 가까운 칸부터. 칸보다 표지가 많으면 칸 안 좌우로 나눈다
    const sorted = [...ps].sort(
      (a, b) =>
        Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
    );
    const slots = [
      ...sorted,
      ...sorted.map((p) => ({ x: p.x + s * 0.42, y: p.y + s * 0.1 })),
      ...sorted.map((p) => ({ x: p.x - s * 0.42, y: p.y + s * 0.1 })),
    ];
    spots.set(l.region.id, { leaf: l, center: c, slots });
  }
  /** 구역(자손 포함) 무게중심 */
  const centerOf = (id: string): P | undefined => {
    const cells = (layout.cellsOf.get(id) ?? []).filter((c) =>
      owner.has(hexKey(c)),
    );
    if (cells.length === 0) return undefined;
    const ps = cells.map(px);
    return {
      x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
      y: ps.reduce((a, p) => a + p.y, 0) / ps.length,
    };
  };

  const statusOf = (r: Region): RegionStatus =>
    dropped.has(r.id) ? "dropped" : r.status;
  const activeSigns = (r: Region) =>
    (r.signs ?? [])
      .filter((x) => !(x.type === "fork" && x.status === "decided"))
      .filter((x) => !(x.type === "talk" && x.status === "done"))
      .sort((a, b) => Number(isForkForMe(b)) - Number(isForkForMe(a)));

  /* ── 동물 선원 ── */
  const hereLeaf = map.here ? spots.get(map.here) : undefined;
  const hereCenter = map.here
    ? hereLeaf && visible(map.here)
      ? hereLeaf.slots[0]
      : visible(map.here)
        ? centerOf(map.here)
        : undefined
    : undefined;
  const animalSize = Math.max(26, Math.min(58, s * 1.55));

  /* ── 장애물: 착륙선, 동물, 내 깃발 ── */
  const center = { x: ox, y: oy };
  const obstacles: Rect[] = [
    { x: center.x - s * 1.3, y: center.y - s * 1.4, w: s * 2.6, h: s * 2.6 },
    { x: 0, y: h - CAPTION_H, w: w * 0.5, h: CAPTION_H },
  ];
  if (hereCenter)
    obstacles.push({
      x: hereCenter.x - animalSize / 2,
      y: hereCenter.y - animalSize * 1.2,
      w: animalSize,
      h: animalSize * 1.2,
    });
  const flagSpots: { id: string; p: P }[] = [];
  for (const sp of spots.values()) {
    const r = sp.leaf.region;
    if (!visible(r.id) || dropped.has(r.id)) continue;
    if (!activeSigns(r).some(isForkForMe)) continue;
    // 깃발은 동물이 없는 칸, 착륙장에서 먼 칸에 꽂는다
    const free = sp.slots
      .slice(0, sp.leaf.cells.length)
      .filter((p) => p !== hereCenter);
    const p =
      [...free].sort(
        (a, b) =>
          Math.hypot(b.x - center.x, b.y - center.y) -
          Math.hypot(a.x - center.x, a.y - center.y),
      )[0] ?? sp.slots[0];
    if (!p) continue;
    flagSpots.push({ id: r.id, p });
    obstacles.push({ x: p.x - 3, y: p.y - s * 1.6, w: s * 1.05, h: s * 1.7 });
  }

  /* ── 이름표: 지역 이름은 늘, 구역 이름은 자리가 날 때만 ── */
  const bounds = { x: 4, y: 4, w: w - 8, h: h - CAPTION_H - 4 };
  const terrAsks: (LabelAsk & { text: string; color: string; sub: string })[] =
    [];
  for (const t of layout.territories) {
    const cells = (layout.cellsOf.get(t.region.id) ?? []).filter((c) =>
      owner.has(hexKey(c)),
    );
    if (cells.length === 0) continue;
    const a = (wedgeAngle(t.wedge) * Math.PI) / 180;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    let far = 0;
    for (const c of cells) {
      const p = toPixel(c);
      far = Math.max(far, p.x * dir.x + p.y * dir.y);
    }
    const doneCells = layout.leaves
      .filter((l) => l.territory === t.region.id && visible(l.region.id))
      .filter((l) => statusOf(l.region) === "done")
      .reduce((n, l) => n + l.cells.length, 0);
    const text = clip(t.region.title, 10);
    const sub = `완공 ${doneCells}/${cells.length}`;
    const fs = 13;
    const tw = textWidth(text, fs) + textWidth(sub, 10.5) + 22;
    const d = (far + 1.05) * s;
    let ax = center.x + dir.x * d;
    let ay = center.y + dir.y * d;
    ax = Math.min(
      bounds.x + bounds.w - tw / 2 - 2,
      Math.max(bounds.x + tw / 2 + 2, ax),
    );
    ay = Math.min(bounds.y + bounds.h - 12, Math.max(bounds.y + 12, ay));
    terrAsks.push({
      id: t.region.id,
      anchor: { x: ax, y: ay + 11 },
      w: tw,
      h: 22,
      text,
      sub,
      color: colorOf(t.region.id),
    });
  }
  const terrPlaced = placeLabels(terrAsks, bounds, [], 0);
  // 자리가 없던 지역 이름표도 버리지 않고 제자리에 둔다(늘 보여야 한다)
  const terrLabels: (PlacedLabel & {
    text: string;
    color: string;
    sub: string;
  })[] = terrAsks.map((a) => {
    const p = terrPlaced.find((x) => x.id === a.id);
    return {
      ...a,
      ...(p ?? {
        side: "up" as const,
        x: a.anchor.x - a.w / 2,
        y: a.anchor.y - a.h,
        w: a.w,
        h: a.h,
      }),
    };
  });

  // 구역 이름표 후보: 보이는 잎과 2단 묶음 구역. 중요한 것부터
  type RegionAsk = LabelAsk & { text: string; tone: string; fresh: boolean };
  const regionAsks: (RegionAsk & { rank: number })[] = [];
  const cellDots = [...owner.keys()].map((key) => {
    const [q = 0, r = 0] = key.split(",").map(Number);
    const p = px({ q, r });
    return { key, x: p.x - s * 0.6, y: p.y - s * 0.5, w: s * 1.2, h: s };
  });
  for (const r of map.regions) {
    const depth = layout.depthOf.get(r.id) ?? 1;
    if (depth === 1 && !leafById.has(r.id)) continue;
    if (!visible(r.id)) continue;
    const isLeaf = leafById.has(r.id);
    if (!isLeaf && depth !== 2) continue;
    const c = isLeaf ? spots.get(r.id)?.center : centerOf(r.id);
    if (!c) continue;
    const signs = activeSigns(r);
    const mine = signs.some(isForkForMe);
    const st = statusOf(r);
    const fresh = isNewFound(r, now);
    let rank = (layout.cellsOf.get(r.id)?.length ?? 1) + (isLeaf ? 0 : 6);
    if (r.id === map.here) rank += 100;
    if (mine) rank += 80;
    if (st === "blocked") rank += 60;
    if (r.id === selected) rank += 200;
    const text = clip(r.title, r.id === selected ? 22 : 11);
    const own = new Set((layout.cellsOf.get(r.id) ?? []).map(hexKey));
    const fs = 11;
    regionAsks.push({
      id: r.id,
      anchor: { x: c.x, y: c.y - s * 0.15 },
      w: textWidth(text, fs) + (fresh ? 16 : 0) + 12,
      // 꼭 보일 것(지금 여기·내 갈림길·막힘·고른 구역)이 아니면 다른 구역 칸을 덮지 않는다
      avoid: rank >= 60 ? undefined : cellDots.filter((d) => !own.has(d.key)),
      h: 17,
      text,
      fresh,
      tone: mine
        ? "#ffd84a"
        : st === "blocked"
          ? "#ff6b6b"
          : r.id === map.here
            ? "#7ce0ff"
            : "rgba(255,255,255,0.22)",
      rank,
    });
  }
  regionAsks.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  const regionLabels = placeLabels(
    regionAsks,
    bounds,
    [...obstacles, ...terrLabels],
    s * 0.45,
  ).map((p) => ({
    ...p,
    ...(regionAsks.find((a) => a.id === p.id) as RegionAsk),
  }));
  const shownIds = new Set(regionLabels.map((l) => l.id));

  // 마우스를 올린 구역: 숨은 이름표면 전체 이름을 맨 위에
  const hoverRegion = hover ? byId.get(hover) : undefined;
  const hoverC = hover
    ? (spots.get(hover)?.center ?? centerOf(hover))
    : undefined;

  /* ── 하늘·지평선·별 ── */
  const stars = useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: 70 }, () => ({
      x: rnd(),
      y: rnd(),
      r: rnd() * 0.9 + 0.3,
      o: rnd() * 0.5 + 0.2,
    }));
  }, []);
  const limbY = Math.max(14, h * 0.07);
  const planetR = Math.max(w, h) * 2.2;

  const selectOf = (id: string) => () => onSelect(id);
  const keyOf = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  // 개척할 땅: 바깥 두 고리까지 옅은 칸 윤곽
  const ghostRing = layout.maxRing + 2;
  const ghosts: Hex[] = [];
  for (let q = -ghostRing; q <= ghostRing; q++)
    for (let r = -ghostRing; r <= ghostRing; r++) {
      const hx = { q, r };
      const n = ringOf(hx);
      if (n <= 1 || n > ghostRing || owner.has(hexKey(hx))) continue;
      ghosts.push(hx);
    }

  return (
    <svg
      width={w}
      height={h}
      className="absolute inset-0 select-none"
      role="img"
      aria-label={`${map.title} 개척지`}
    >
      <defs>
        <radialGradient id={`ground${uid}`} cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#3a2a26" />
          <stop offset="55%" stopColor="#24191b" />
          <stop offset="100%" stopColor="#161015" />
        </radialGradient>
        <linearGradient id={`air${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9a37a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#e9a37a" stopOpacity="0" />
        </linearGradient>
        <pattern
          id={`soil${uid}`}
          width={Math.max(4, s * 0.28)}
          height={Math.max(4, s * 0.28)}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(28)"
        >
          <rect
            width={Math.max(4, s * 0.28)}
            height={Math.max(1.2, s * 0.07)}
            fill="#3a2414"
          />
        </pattern>
        <pattern
          id={`dust${uid}`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="0.9" fill="#d8dce8" opacity="0.35" />
          <circle cx="5" cy="4.6" r="0.7" fill="#d8dce8" opacity="0.25" />
        </pattern>
        <clipPath id={`planet${uid}`}>
          <circle cx={w / 2} cy={limbY + planetR} r={planetR} />
        </clipPath>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* 하늘과 행성 표면 */}
      <rect width={w} height={h} fill="#05070d" />
      {stars.map((st, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 별 목록
          key={i}
          cx={st.x * w}
          cy={st.y * limbY * 1.6}
          r={st.r}
          fill="#fff"
          opacity={st.o}
          className={i % 9 === 0 ? styles.twinkle : undefined}
        />
      ))}
      <circle
        cx={w * 0.9}
        cy={limbY * 0.55}
        r={Math.max(5, limbY * 0.32)}
        fill="#c9cfdc"
        opacity="0.7"
      />
      <circle
        cx={w * 0.9 + 2.5}
        cy={limbY * 0.55 - 1}
        r={Math.max(5, limbY * 0.32)}
        fill="#05070d"
        opacity="0.75"
      />
      <circle
        cx={w / 2}
        cy={limbY + planetR}
        r={planetR}
        fill={`url(#ground${uid})`}
      />
      <rect
        x={0}
        y={limbY - 2}
        width={w}
        height={limbY * 1.4}
        fill={`url(#air${uid})`}
        opacity="0.5"
      />

      {/* 개척할 땅(옅은 칸) */}
      <g
        stroke="rgba(255,230,210,0.07)"
        fill="none"
        strokeWidth="1"
        clipPath={`url(#planet${uid})`}
      >
        {ghosts.map((g) => (
          <polygon key={hexKey(g)} points={poly(px(g), 0.96)} />
        ))}
      </g>

      {/* 착륙장과 착륙선 */}
      <g>
        <title>{`착륙선 · 목표: ${map.goal ?? map.title}`}</title>
        <circle
          cx={center.x}
          cy={center.y}
          r={s * 2.35}
          fill="#2b2d35"
          stroke="#5c6070"
          strokeDasharray="4 3"
        />
        <circle
          cx={center.x}
          cy={center.y}
          r={s * 1.5}
          fill="none"
          stroke="#ffd84a"
          strokeOpacity="0.25"
          strokeWidth={s * 0.08}
        />
        <Lander x={center.x} y={center.y} s={s} />
      </g>

      {/* 구역 땅 */}
      {layout.leaves.map((l) => {
        const r = l.region;
        if (!visible(r.id)) return null;
        const st = statusOf(r);
        const fresh = isNewFound(r, now);
        const tint = colorOf(l.territory);
        const label = `${r.title} · ${REGION_STATUS_LABEL[st]}${fresh ? " · 새 땅" : ""}`;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
          <g
            key={r.id}
            data-region={r.id}
            data-status={st}
            className={styles.leaf}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected === r.id}
            onClick={selectOf(r.id)}
            onKeyDown={keyOf(r.id)}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
            opacity={st === "dropped" ? 0.6 : 1}
          >
            <title>{label}</title>
            {l.cells.map((c) => {
              const p = px(c);
              return (
                <g key={hexKey(c)}>
                  <polygon
                    className={styles.ground}
                    points={poly(p)}
                    fill={GROUND[st]}
                  />
                  <polygon
                    points={poly(p)}
                    fill={tint}
                    opacity={st === "fog" ? 0.16 : 0.1}
                  />
                  <CellDecor st={st} p={p} s={s} uid={uid} />
                  {fresh && (
                    <polygon
                      points={poly(p, 0.7)}
                      fill="none"
                      stroke="#7ce0ff"
                      strokeWidth="1.3"
                      strokeDasharray="3 2.5"
                      opacity="0.9"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 경계 */}
      <g fill="none" pointerEvents="none" strokeLinecap="round">
        <path
          d={cellEdges.join("")}
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="0.8"
        />
        <path
          d={subEdges.join("")}
          stroke="rgba(12,10,16,0.55)"
          strokeWidth="1.1"
          strokeDasharray="2.5 2"
        />
        <path
          d={regionEdges.join("")}
          stroke="#120d12"
          strokeWidth={Math.max(1.6, s * 0.08)}
        />
        {[...terrEdges.entries()].map(([t, list]) => (
          <path
            key={t}
            d={list.join("")}
            stroke={colorOf(t)}
            strokeWidth={Math.max(2.2, s * 0.12)}
            opacity="0.95"
          />
        ))}
      </g>

      {/* 막힘: 붉은 울타리 */}
      <g pointerEvents="none">
        {layout.leaves
          .filter(
            (l) => visible(l.region.id) && statusOf(l.region) === "blocked",
          )
          .map((l) => {
            const sp = spots.get(l.region.id);
            const p = sp?.slots[0];
            return (
              <g key={l.region.id}>
                <path
                  d={outline(l.region.id, 0.8)}
                  fill="none"
                  stroke="#ff6b6b"
                  strokeWidth={Math.max(2, s * 0.1)}
                  strokeDasharray={`${s * 0.22} ${s * 0.12}`}
                />
                {l.cells.flatMap((c) =>
                  corners(px(c).x, px(c).y, s * 0.8).map((v, i) => (
                    <circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: 칸 꼭짓점 차례
                      key={`${hexKey(c)}-${i}`}
                      cx={v.x}
                      cy={v.y}
                      r={Math.max(1.4, s * 0.06)}
                      fill="#ffc2c2"
                    />
                  )),
                )}
                {p && <NoEntry x={p.x} y={p.y} s={s} />}
              </g>
            );
          })}
      </g>

      {/* 공사 장비 */}
      <g pointerEvents="none">
        {layout.leaves
          .filter(
            (l) => visible(l.region.id) && statusOf(l.region) === "building",
          )
          .map((l) => {
            const sp = spots.get(l.region.id);
            const slots = sp?.slots.slice(0, l.cells.length) ?? [];
            const p =
              slots.find(
                (x) => x !== hereCenter && !flagSpots.some((f) => f.p === x),
              ) ?? sp?.slots[l.cells.length];
            return p ? <Rig key={l.region.id} x={p.x} y={p.y} s={s} /> : null;
          })}
      </g>

      {/* 갈림길·교신·위험 표지 */}
      <g pointerEvents="none">
        {[...spots.values()].map((sp) => {
          const r = sp.leaf.region;
          if (!visible(r.id)) return null;
          const signs = activeSigns(r);
          if (signs.length === 0) return null;
          const taken = new Set<P>([
            ...(hereCenter ? [hereCenter] : []),
            ...flagSpots.map((f) => f.p),
          ]);
          const free = sp.slots.filter((x) => !taken.has(x));
          let k = 0;
          return (
            <g key={r.id}>
              {signs.map((sign) => {
                if (isForkForMe(sign)) {
                  const f = flagSpots.find((x) => x.id === r.id);
                  return f ? (
                    <MyFlag
                      key={sign.id}
                      x={f.p.x}
                      y={f.p.y}
                      s={s}
                      title={sign.title}
                    />
                  ) : null;
                }
                const p = free[k++ % Math.max(1, free.length)] ?? sp.slots[0];
                if (!p) return null;
                if (sign.type === "fork")
                  return <OtherFlag key={sign.id} x={p.x} y={p.y} s={s} />;
                if (sign.type === "talk")
                  return (
                    <Antenna
                      key={sign.id}
                      x={p.x}
                      y={p.y}
                      s={s}
                      waiting={
                        sign.status === "waiting" || sign.status === "sent"
                      }
                    />
                  );
                return <Crack key={sign.id} x={p.x} y={p.y} s={s} />;
              })}
            </g>
          );
        })}
      </g>

      {/* 내가 정할 갈림길 땅: 노랗게 숨쉬는 둘레 */}
      <g pointerEvents="none" fill="none">
        {flagSpots.map((f) => (
          <path
            key={f.id}
            className={styles.breathe}
            d={outline(f.id, 0.93)}
            stroke="#ffd84a"
            strokeWidth={Math.max(2, s * 0.11)}
          />
        ))}
      </g>

      {/* 고른 구역 */}
      {selected && (
        <g pointerEvents="none" fill="none">
          <path
            d={outline(selected)}
            stroke="#fff"
            strokeWidth="7"
            opacity="0.25"
            filter={`url(#glow${uid})`}
          />
          <path d={outline(selected)} stroke="#fff" strokeWidth="2.6" />
        </g>
      )}

      {/* 지금 여기: 동물 선원 */}
      {hereCenter && (
        <g pointerEvents="none">
          <ellipse
            cx={hereCenter.x}
            cy={hereCenter.y + s * 0.38}
            rx={s * 0.75}
            ry={s * 0.28}
            fill="#7ce0ff"
            opacity="0.25"
          />
          <ellipse
            className={styles.ping}
            cx={hereCenter.x}
            cy={hereCenter.y + s * 0.38}
            rx={s * 0.75}
            ry={s * 0.28}
            fill="none"
            stroke="#7ce0ff"
          />
          <g
            transform={`translate(${hereCenter.x - animalSize / 2} ${hereCenter.y + s * 0.45 - animalSize * 1.25})`}
          >
            <HereAnimal crew={crew} size={animalSize} />
          </g>
        </g>
      )}

      {/* 지역 이름표 */}
      {terrLabels.map((l) => (
        // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
        <g
          key={l.id}
          data-region-label={l.id}
          role="button"
          tabIndex={0}
          onClick={selectOf(l.id)}
          onKeyDown={keyOf(l.id)}
          className="cursor-pointer"
        >
          <title>{byId.get(l.id)?.title ?? l.id}</title>
          <rect
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            rx={l.h / 2}
            fill="rgba(10,8,14,0.82)"
            stroke={l.color}
            strokeWidth={selected === l.id ? 2.4 : 1.4}
          />
          <text
            x={l.x + 11}
            y={l.y + 15.5}
            fontSize="13"
            fontWeight="700"
            fill={l.color}
          >
            {l.text}
            <tspan
              dx="6"
              fontSize="10.5"
              fontWeight="500"
              fill="rgba(255,255,255,0.55)"
            >
              {l.sub}
            </tspan>
          </text>
        </g>
      ))}

      {/* 구역 이름표(말풍선) */}
      {regionLabels.map((l) => (
        <Bubble
          key={l.id}
          l={l}
          s={s}
          selected={selected === l.id}
          onClick={selectOf(l.id)}
          onHover={setHover}
          title={byId.get(l.id)?.title ?? l.id}
        />
      ))}
      {hoverRegion && hoverC && !shownIds.has(hoverRegion.id) && (
        <HoverTip region={hoverRegion} at={hoverC} s={s} w={w} />
      )}
    </svg>
  );
}

/* ───────────── 칸 무늬 ───────────── */

function CellDecor({
  st,
  p,
  s,
  uid,
}: {
  st: RegionStatus;
  p: P;
  s: number;
  uid: string;
}) {
  const pts = corners(p.x, p.y, s)
    .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
    .join(" ");
  if (st === "fog")
    return (
      <g pointerEvents="none">
        <polygon points={pts} fill={`url(#dust${uid})`} />
        <g className={styles.drift} fill="#e2e6f0">
          <ellipse
            cx={p.x - s * 0.25}
            cy={p.y - s * 0.1}
            rx={s * 0.42}
            ry={s * 0.2}
            opacity="0.17"
          />
          <ellipse
            cx={p.x + s * 0.3}
            cy={p.y + s * 0.28}
            rx={s * 0.36}
            ry={s * 0.16}
            opacity="0.13"
          />
        </g>
      </g>
    );
  if (st === "building")
    return (
      <polygon points={pts} fill={`url(#soil${uid})`} pointerEvents="none" />
    );
  if (st === "done") return <Dome x={p.x} y={p.y} s={s} />;
  if (st === "dropped")
    return (
      <polygon
        points={corners(p.x, p.y, s * 0.75)
          .map((v) => `${v.x},${v.y}`)
          .join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeDasharray="2 3"
        pointerEvents="none"
      />
    );
  return null;
}

function Dome({ x, y, s }: { x: number; y: number; s: number }) {
  const r = s * 0.46;
  const by = y + s * 0.28;
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={by} rx={r * 1.05} ry={r * 0.22} fill="#173b29" />
      <path
        d={`M${x - r} ${by}A${r} ${r * 0.95} 0 0 1 ${x + r} ${by}Z`}
        fill="#8fe8b4"
        fillOpacity="0.8"
        stroke="#d6ffe6"
        strokeWidth="0.8"
      />
      <path
        d={`M${x - r * 0.45} ${by - r * 0.5}A${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.05} ${by - r * 0.82}`}
        stroke="#fff"
        strokeOpacity="0.6"
        fill="none"
        strokeWidth="0.9"
      />
      <rect
        x={x + r * 0.15}
        y={by - r * 0.42}
        width={r * 0.26}
        height={r * 0.3}
        fill="#fff4b5"
      />
      <rect
        x={x - r * 0.42}
        y={by - r * 0.32}
        width={r * 0.22}
        height={r * 0.24}
        fill="#fff4b5"
        opacity="0.8"
      />
    </g>
  );
}

function Rig({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 20;
  return (
    <g transform={`translate(${x - 9 * u} ${y - 2 * u}) scale(${u})`}>
      <rect x="0" y="9" width="13" height="4" rx="2" fill="#1f1a14" />
      <rect
        x="1"
        y="3"
        width="10"
        height="6.5"
        rx="1"
        fill="#f2a43a"
        stroke="#4a2f0d"
        strokeWidth="0.8"
      />
      <rect x="2.2" y="4.2" width="3.6" height="3" fill="#ffe6a8" />
      <g className={styles.dig}>
        <path
          d="M10 5 L17 -1 L20 4"
          fill="none"
          stroke="#f2a43a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M18.5 3.5 L21.5 3 L21 7 Z" fill="#c9862c" />
      </g>
    </g>
  );
}

function NoEntry({ x, y, s }: { x: number; y: number; s: number }) {
  const r = Math.max(5, s * 0.3);
  return (
    <g>
      <circle
        cx={x}
        cy={y - s * 0.05}
        r={r}
        fill="#e04646"
        stroke="#ffd0d0"
        strokeWidth="1.2"
      />
      <rect
        x={x - r * 0.62}
        y={y - s * 0.05 - r * 0.2}
        width={r * 1.24}
        height={r * 0.4}
        fill="#fff"
      />
    </g>
  );
}

/** 내가 정할 갈림길: 땅에 꽂힌 큰 노란 깃발 */
function MyFlag({
  x,
  y,
  s,
  title,
}: {
  x: number;
  y: number;
  s: number;
  title: string;
}) {
  const top = y - s * 1.5;
  const fw = s * 0.95;
  const fh = s * 0.55;
  return (
    <g>
      <title>{`내가 정할 갈림길: ${title}`}</title>
      <ellipse
        className={styles.ping}
        cx={x}
        cy={y + s * 0.15}
        rx={s * 0.5}
        ry={s * 0.2}
        fill="none"
        stroke="#ffd84a"
        strokeWidth="1.6"
      />
      <ellipse
        cx={x}
        cy={y + s * 0.15}
        rx={s * 0.22}
        ry={s * 0.08}
        fill="#000"
        opacity="0.4"
      />
      <path
        className={styles.flag}
        d={`M${x} ${top}C${x + fw * 0.35} ${top - fh * 0.18} ${x + fw * 0.65} ${top + fh * 0.18} ${x + fw} ${top + fh * 0.05}L${x + fw} ${top + fh}C${x + fw * 0.65} ${top + fh * 1.12} ${x + fw * 0.35} ${top + fh * 0.78} ${x} ${top + fh}Z`}
        fill="#ffd84a"
        stroke="#7a5a00"
        strokeWidth="0.9"
      />
      <line
        x1={x}
        y1={y + s * 0.15}
        x2={x}
        y2={top - 2}
        stroke="#f6efd8"
        strokeWidth={Math.max(1.6, s * 0.08)}
        strokeLinecap="round"
      />
      <circle cx={x} cy={top - 2} r={Math.max(1.5, s * 0.07)} fill="#fff" />
    </g>
  );
}

/** 남이 정할 갈림길: 낮은 회색 깃발 */
function OtherFlag({ x, y, s }: { x: number; y: number; s: number }) {
  const top = y - s * 0.75;
  return (
    <g>
      <line
        x1={x}
        y1={y + s * 0.15}
        x2={x}
        y2={top}
        stroke="#cfd4de"
        strokeWidth="1.2"
      />
      <path
        d={`M${x} ${top}L${x + s * 0.45} ${top + s * 0.14}L${x} ${top + s * 0.3}Z`}
        fill="#9aa3b5"
      />
    </g>
  );
}

function Antenna({
  x,
  y,
  s,
  waiting,
}: {
  x: number;
  y: number;
  s: number;
  waiting: boolean;
}) {
  const top = y - s * 0.7;
  const r1 = s * 0.25;
  const r2 = s * 0.45;
  return (
    <g stroke="#d6ecff" fill="none" strokeLinecap="round">
      <path
        d={`M${x - s * 0.18} ${y + s * 0.2}L${x} ${top}L${x + s * 0.18} ${y + s * 0.2}`}
        strokeWidth="1.3"
      />
      <circle cx={x} cy={top} r={Math.max(1.4, s * 0.06)} fill="#d6ecff" />
      <g className={waiting ? styles.signal : undefined} strokeWidth="1.2">
        <path
          d={`M${x - r1} ${top - r1 * 0.4}A${r1} ${r1} 0 0 1 ${x + r1} ${top - r1 * 0.4}`}
        />
        <path
          d={`M${x - r2} ${top - r2 * 0.4}A${r2} ${r2} 0 0 1 ${x + r2} ${top - r2 * 0.4}`}
          opacity="0.6"
        />
      </g>
    </g>
  );
}

function Crack({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 10;
  const d = `M${x - 6 * u} ${y - 3 * u}L${x - 2 * u} ${y - 1 * u}L${x - 3 * u} ${y + 2 * u}L${x + 2 * u} ${y + 1 * u}L${x + 1 * u} ${y + 4 * u}L${x + 6 * u} ${y + 5 * u}`;
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke="#140b0b" strokeWidth={Math.max(2.4, s * 0.12)} />
      <path d={d} stroke="#ff9b5c" strokeWidth={Math.max(1, s * 0.045)} />
    </g>
  );
}

function Lander({ x, y, s }: { x: number; y: number; s: number }) {
  const u = s / 14;
  return (
    <g transform={`translate(${x} ${y}) scale(${u})`}>
      <ellipse cx="0" cy="11" rx="13" ry="3.5" fill="#000" opacity="0.35" />
      <path
        d="M-9 4 L-13 11 M9 4 L13 11 M0 6 L0 11"
        stroke="#aab3c5"
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M-15 11 h4 M11 11 h4" stroke="#aab3c5" strokeWidth="1.6" />
      <path
        d="M-11 6 Q-11 -10 0 -16 Q11 -10 11 6 Z"
        fill="#dfe6f2"
        stroke="#7f8aa3"
        strokeWidth="1"
      />
      <circle
        cx="0"
        cy="-4"
        r="4"
        fill="#7ce0ff"
        stroke="#2a5d73"
        strokeWidth="1"
      />
      <path d="M-11 3 h22" stroke="#7f8aa3" strokeWidth="1" />
      <circle
        cx="-6"
        cy="5"
        r="1.1"
        fill="#ffd84a"
        className={styles.twinkle}
      />
      <circle cx="6" cy="5" r="1.1" fill="#ffd84a" />
    </g>
  );
}

function HereAnimal({ crew, size }: { crew?: Crew; size: number }) {
  if (!crew)
    return (
      <text x={size / 2} y={size} fontSize={size * 0.6} textAnchor="middle">
        📍
      </text>
    );
  return (
    <Animal
      kind={animalFor(crew.id)}
      pose={crew.status === "off" ? "stand" : poseFor(crew.status)}
      context={crew.context}
      size={size}
      furniture={false}
      label={`${crew.name} 선원, 지금 여기`}
    />
  );
}

/* ───────────── 이름표 ───────────── */

function Bubble({
  l,
  s,
  selected,
  onClick,
  onHover,
  title,
}: {
  l: PlacedLabel & { text: string; tone: string; fresh: boolean };
  s: number;
  selected: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
  title: string;
}) {
  const { x, y } = l.anchor;
  // 말풍선 꼬리: 가리키는 점 쪽 변 가운데에서
  const tail =
    l.side === "up"
      ? `M${x - 4} ${l.y + l.h}L${x} ${l.y + l.h + Math.min(6, s * 0.4)}L${x + 4} ${l.y + l.h}Z`
      : l.side === "down"
        ? `M${x - 4} ${l.y}L${x} ${l.y - Math.min(6, s * 0.4)}L${x + 4} ${l.y}Z`
        : l.side === "right"
          ? `M${l.x} ${y - 4}L${l.x - Math.min(6, s * 0.4)} ${y}L${l.x} ${y + 4}Z`
          : `M${l.x + l.w} ${y - 4}L${l.x + l.w + Math.min(6, s * 0.4)} ${y}L${l.x + l.w} ${y + 4}Z`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG 안이라 button을 쓸 수 없다
    <g
      data-region-label={l.id}
      role="button"
      tabIndex={-1}
      className="cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      onMouseEnter={() => onHover(l.id)}
      onMouseLeave={() => onHover(null)}
    >
      <title>{title}</title>
      <path d={tail} fill="rgba(10,10,16,0.88)" />
      <rect
        x={l.x}
        y={l.y}
        width={l.w}
        height={l.h}
        rx="4"
        fill="rgba(10,10,16,0.88)"
        stroke={selected ? "#fff" : l.tone}
        strokeWidth={selected ? 1.6 : 1}
      />
      <text
        x={l.x + 6}
        y={l.y + 12.5}
        fontSize="11"
        fill="rgba(255,255,255,0.9)"
      >
        {l.text}
      </text>
      {l.fresh && (
        <text
          x={l.x + l.w - 17}
          y={l.y + 12.5}
          fontSize="9.5"
          fontWeight="700"
          fill="#7ce0ff"
        >
          새
        </text>
      )}
    </g>
  );
}

function HoverTip({
  region,
  at,
  s,
  w,
}: {
  region: Region;
  at: P;
  s: number;
  w: number;
}) {
  const text = clip(region.title, 30);
  const tw = textWidth(text, 11.5) + 14;
  const x = Math.min(w - tw - 4, Math.max(4, at.x - tw / 2));
  const y = Math.max(4, at.y - s * 0.6 - 20);
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={tw}
        height={19}
        rx="4"
        fill="#0a0a10"
        stroke="rgba(255,255,255,0.5)"
      />
      <text x={x + 7} y={y + 13.5} fontSize="11.5" fill="#fff">
        {text}
      </text>
    </g>
  );
}
