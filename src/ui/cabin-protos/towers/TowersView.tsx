"use client";

// 시안 3. 함께 쌓는 탑: 우주 정거장 갑판 위에 맨 위 구역마다 탑 하나가 선다.
// 블록은 아래부터 완공 → 공사중 → 막힘 순으로 쌓이고, 안개는 아직 올리지 않은 점선 윤곽으로 그 위를 채운다.
// 그래서 탑 꼭대기의 점선이 목표 높이이고, 단단한 부분이 얼마나 올라왔는지가 곧 진행이다.
// 처음 계획 높이와 목표 사이는 탑 옆 하늘색 괄호(+발견)로 보인다. 자리 계산은 layout.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { isForkForMe, isNewFound } from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  REGION_STATUS_COLOR,
  REGION_STATUS_LABEL,
  SIGN_ICON,
} from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import { layoutTowers, type Piece, TOWER_CONST, type Tower } from "./layout";
import styles from "./towers.module.css";

export function TowersView({
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

  const layout = useMemo(
    () =>
      size.w > 0
        ? layoutTowers(
            map,
            { w: size.w - 8, h: size.h - 6 },
            { showDropped, here: map.here },
          )
        : null,
    [map, size, showDropped],
  );

  return (
    <section
      ref={ref}
      data-map
      className={`${styles.scene} relative h-full w-full overflow-hidden`}
      aria-label={`${map.title} 지도, 구역마다 쌓는 탑`}
    >
      {layout && (
        <div className="absolute inset-[3px_4px]">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <Deck towers={layout.towers} />
          </svg>
          {layout.towers.map((t) => (
            <TowerPieces
              key={t.region.id}
              tower={t}
              here={map.here}
              selected={selected}
              onSelect={onSelect}
              now={now}
            />
          ))}
          <svg
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
            aria-hidden
          >
            {layout.towers.map((t) => (
              <TowerLines key={t.region.id} tower={t} unit={layout.unit} />
            ))}
          </svg>
          {layout.towers.map((t) =>
            t.crane && t.crane.targetId === map.here ? (
              <HereAnimal
                key={t.region.id}
                crew={crew}
                size={layout.animal}
                left={t.crane.mastX + 3}
                top={t.crane.jibY + 3}
                waving={hereHasFork(t, map.here)}
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function hereHasFork(t: Tower, here?: string): boolean {
  const p = t.pieces.find((q) => q.region.id === here);
  return !!p && (p.region.signs ?? []).some(isForkForMe);
}

/** 갑판: 탑마다 철골 바닥판 */
function Deck({ towers }: { towers: Tower[] }) {
  const { GROUND_H } = TOWER_CONST;
  return (
    <>
      <defs>
        <pattern
          id="towers-truss"
          width="12"
          height={GROUND_H}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0 ${GROUND_H} L6 0 L12 ${GROUND_H}`}
            stroke="#5b6680"
            strokeWidth="1"
            fill="none"
          />
        </pattern>
      </defs>
      {towers.map((t) => (
        <g key={t.region.id}>
          <rect
            x={t.body.x - 4}
            y={t.groundY}
            width={t.body.w + t.gutter.w - 2}
            height={GROUND_H}
            fill="#252c3f"
          />
          <rect
            x={t.body.x - 4}
            y={t.groundY}
            width={t.body.w + t.gutter.w - 2}
            height={GROUND_H}
            fill="url(#towers-truss)"
          />
          <line
            x1={t.body.x - 4}
            x2={t.body.x + t.body.w + t.gutter.w - 6}
            y1={t.groundY + 0.5}
            y2={t.groundY + 0.5}
            stroke="#8a96b3"
          />
        </g>
      ))}
    </>
  );
}

/** 목표 점선, 처음 계획 괄호, 크레인 */
function TowerLines({ tower: t, unit }: { tower: Tower; unit: number }) {
  if (t.total === 0) return null;
  const right = t.body.x + t.body.w;
  const grew = t.total - t.baseline;
  const bx = t.gutter.x + t.gutter.w - 9;
  const c = t.crane;
  const craneColor = c?.stopped ? "#ff6b6b" : "#ffcf5c";
  return (
    <g>
      {/* 목표 높이 */}
      <line
        x1={t.body.x - 4}
        x2={right + t.gutter.w - 4}
        y1={t.topY}
        y2={t.topY}
        stroke="rgb(255 255 255 / 0.6)"
        strokeDasharray="5 4"
      />
      <text
        x={right + 3}
        y={t.topY - 4}
        fontSize="10"
        fill="rgb(255 255 255 / 0.6)"
      >
        목표
      </text>
      {/* 처음 계획 → 목표: 발견만큼 늘어난 높이 */}
      {grew > 0 && (
        <g stroke="#7ce0ff" strokeWidth="1.5">
          <line x1={bx} x2={bx} y1={t.baselineY} y2={t.topY + 2} />
          <line x1={bx - 4} x2={bx} y1={t.baselineY} y2={t.baselineY} />
          <line
            x1={t.body.x - 4}
            x2={t.body.x}
            y1={t.baselineY}
            y2={t.baselineY}
          />
          <line x1={right} x2={right + 4} y1={t.baselineY} y2={t.baselineY} />
          {grew * unit > 26 && (
            <text
              x={bx - 3}
              y={(t.baselineY + t.topY) / 2 + 4}
              fontSize="10.5"
              fontWeight="700"
              textAnchor="end"
              fill="#7ce0ff"
              stroke="none"
            >
              +{grew}
            </text>
          )}
          <title>{`처음 계획 ${t.baseline} → 지금 ${t.total} (발견 +${grew})`}</title>
        </g>
      )}
      {c && (
        <g stroke={craneColor} fill="none" strokeWidth="1.5">
          {/* 기둥과 팔 */}
          <line x1={c.mastX} x2={c.mastX} y1={c.baseY} y2={c.jibY - 5} />
          <line x1={c.jibX1} x2={c.jibX2} y1={c.jibY} y2={c.jibY} />
          <line
            x1={c.mastX}
            x2={c.jibX2}
            y1={c.jibY - 5}
            y2={c.jibY}
            strokeWidth="0.8"
          />
          {/* 줄과 고리 */}
          <line
            x1={c.cableX}
            x2={c.cableX}
            y1={c.jibY}
            y2={c.hookY - 3}
            strokeWidth="1"
            strokeDasharray={c.stopped ? "2 2" : undefined}
          />
          <path
            d={`M${c.cableX - 4} ${c.hookY - 4} h8 M${c.cableX} ${c.hookY - 4} v3`}
            strokeWidth="2"
          />
          {c.stopped && (
            <text
              x={c.jibX2}
              y={c.jibY - 4}
              fontSize="10"
              textAnchor="end"
              fill="#ff8f8f"
              stroke="none"
            >
              멈춤
            </text>
          )}
        </g>
      )}
    </g>
  );
}

function TowerPieces({
  tower: t,
  here,
  selected,
  onSelect,
  now,
}: {
  tower: Tower;
  here?: string;
  selected: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = t.region;
  const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
  const dropped = r.status === "dropped";
  const topForks = (r.signs ?? []).filter(isForkForMe);
  return (
    <>
      {t.pieces.map((p) => (
        <PieceView
          key={p.region.id}
          piece={p}
          here={here === p.region.id}
          selected={selected === p.region.id}
          onSelect={onSelect}
          now={now}
        />
      ))}
      {t.pieces.flatMap((p) => {
        const forks = (p.region.signs ?? []).filter(isForkForMe);
        if (forks.length === 0) return [];
        return [
          <button
            key={`flag-${p.region.id}`}
            type="button"
            className={styles.flag}
            style={{ left: t.body.x + t.body.w - 1, top: p.y + 2 }}
            title={`내가 정할 갈림길: ${forks.map((f) => f.title).join(", ")}`}
            onClick={() => onSelect(p.region.id)}
          >
            {SIGN_ICON.fork}
          </button>,
        ];
      })}
      {t.chips.length > 0 && (
        <div
          className="pointer-events-none absolute rounded-b border border-t-0 border-white/20"
          style={{
            left: t.chips[0]?.x ? t.chips[0].x - 2 : t.gutter.x,
            top: (t.chips.at(-1)?.y ?? t.groundY) - 4,
            width: (t.chips[0]?.w ?? 20) + 4,
            height: t.groundY - (t.chips.at(-1)?.y ?? t.groundY) + 4,
          }}
          title="버린 구역"
        />
      )}
      {t.chips.map((c) => (
        <button
          key={c.region.id}
          type="button"
          data-region={c.region.id}
          data-status="dropped"
          className={`${styles.chip} ${selected === c.region.id ? styles.selected : ""}`}
          style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
          title={`${c.region.title} · 버림`}
          onClick={() => onSelect(c.region.id)}
        >
          {c.region.title}
        </button>
      ))}
      {t.moreChips > 0 && (
        <span
          className="absolute text-[9.5px] text-white/50"
          style={{ left: t.gutter.x + 3, top: (t.chips.at(-1)?.y ?? 0) - 14 }}
        >
          +{t.moreChips}
        </span>
      )}
      <button
        type="button"
        data-region={r.id}
        data-tower
        aria-pressed={selected === r.id}
        className={`${styles.plate} ${selected === r.id ? styles.selected : ""} flex items-center gap-1.5 px-1.5 text-left ${dropped ? "opacity-50" : ""}`}
        style={{
          left: t.plate.x,
          top: t.plate.y,
          width: t.plate.w,
          height: t.plate.h,
        }}
        title={`${r.title} · 완공 ${t.done} / 목표 ${t.total}${dropped ? " · 버림" : ""}`}
        onClick={() => onSelect(r.id)}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background:
              REGION_STATUS_COLOR[dropped ? "dropped" : statusOfTower(t)],
          }}
        />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/90">
          {r.title}
        </span>
        {!dropped && (
          <span className="shrink-0 text-[11px] tabular-nums text-white/55">
            {pct}%
          </span>
        )}
        {topForks.length > 0 && (
          <span className="shrink-0 rounded bg-[#ffcf5c] px-1 text-[11px] font-bold text-[#241a00]">
            {SIGN_ICON.fork}
          </span>
        )}
      </button>
    </>
  );
}

function statusOfTower(t: Tower) {
  if (t.total > 0 && t.done === t.total) return "done";
  if (t.pieces.some((p) => p.status === "blocked")) return "blocked";
  if (t.pieces.some((p) => p.status === "building")) return "building";
  return t.done > 0 ? "building" : "fog";
}

function PieceView({
  piece: p,
  here,
  selected,
  onSelect,
  now,
}: {
  piece: Piece;
  here: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = p.region;
  const fresh = isNewFound(r, now);
  const label = `${r.title} · ${REGION_STATUS_LABEL[p.status]}${fresh ? " · 새 블록" : ""}${here ? " · 지금 여기" : ""}`;
  const rect = { left: p.x, top: p.y, width: p.w, height: p.h };

  if (p.kind === "module") {
    // 틀은 그림만, 누르는 곳은 왼쪽 이름판. 안쪽은 띠가 덮는다.
    return (
      <div
        className={`${styles.module} ${selected ? styles.selected : ""} ${here ? styles.here : ""}`}
        style={rect}
        data-region={r.id}
        data-status={p.status}
      >
        <button
          type="button"
          className={styles.strip}
          title={`${label} (안쪽 ${p.units}칸)`}
          aria-pressed={selected}
          onClick={() => onSelect(r.id)}
        >
          {r.title}
        </button>
      </div>
    );
  }

  const band = p.kind === "band";
  const showText = p.h >= 13;
  const twoLines = p.h >= 34 && !band;
  const others = (r.signs ?? []).filter(
    (s) => s.type !== "fork" && !(s.type === "talk" && s.status === "done"),
  );
  return (
    <button
      type="button"
      data-region={r.id}
      data-status={p.status}
      title={label}
      aria-pressed={selected}
      onClick={() => onSelect(r.id)}
      className={[
        styles.piece,
        styles[p.status],
        selected ? styles.selected : "",
        here ? `${styles.here} ${styles.sway}` : "",
        fresh && p.w <= 96 ? styles.freshCorner : "",
        "flex items-center gap-1 px-1.5 text-left",
      ].join(" ")}
      style={{
        ...rect,
        alignItems: twoLines ? "flex-start" : "center",
        paddingTop: twoLines ? 3 : 0,
      }}
    >
      {showText && (
        <>
          <span
            className={`min-w-0 flex-1 ${band ? "text-[11px]" : "text-[12px]"} leading-[1.2] font-medium ${
              twoLines ? "line-clamp-2 break-keep" : "truncate"
            }`}
          >
            {r.title}
          </span>
          {fresh && p.w > 96 && (
            <span
              className={`${styles.newBadge} shrink-0 rounded px-1 text-[9.5px] leading-[13px] font-bold`}
            >
              새
            </span>
          )}
          {p.status === "blocked" && (
            <span className="shrink-0 text-[11px]">⛔</span>
          )}
          {p.w > 90 && others.length > 0 && (
            <span
              className="shrink-0 text-[10.5px] opacity-80"
              title={others.map((s) => s.title).join("\n")}
            >
              {others.map((s) => SIGN_ICON[s.type]).join("")}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function HereAnimal({
  crew,
  size,
  left,
  top,
  waving,
}: {
  crew?: Crew;
  size: number;
  left: number;
  top: number;
  waving: boolean;
}) {
  const style = { left, top };
  if (!crew)
    return (
      <span
        data-here
        className="absolute z-[6] text-[18px]"
        style={style}
        title="지금 여기"
      >
        📍
      </span>
    );
  const pose = waving
    ? "wave"
    : crew.status === "off"
      ? "stand"
      : poseFor(crew.status);
  return (
    <span
      data-here
      className="pointer-events-none absolute z-[6] block"
      style={style}
      title="지금 여기"
    >
      <Animal
        kind={animalFor(crew.id)}
        pose={pose}
        context={crew.context}
        size={size}
        furniture={false}
        label={`${crew.name} 선원, 지금 여기`}
      />
    </span>
  );
}
