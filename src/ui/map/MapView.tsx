"use client";

// 선실 가운데의 지도 한 장. layoutMap으로 놓은 땅을 상태별 무늬로 그리고,
// 표지(갈림길·교신·위험)는 땅 위 아이콘으로, here 구역에는 승무원 동물을 앉힌다.
// 땅이 작으면 글을 줄이고(두 줄 → 한 줄 → 아이콘만) 넘치는 글은 자른다. 전체 이름은 title로 읽힌다.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isForkForMe,
  isNewFound,
  type ProjectMap,
  type Region,
} from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  REGION_STATUS_COLOR,
  REGION_STATUS_ICON,
  REGION_STATUS_LABEL,
  SIGN_ICON,
} from "./labels";
import { layoutMap, type Tile } from "./layout";
import styles from "./map.module.css";

const HEADER = 22;

/** 선실 가운데 지도 그림이 받는 것. 시안(`src/ui/cabin-protos/`)도 같은 모양을 받는다. */
export type MapViewProps = {
  map: ProjectMap;
  /** 이 지도의 승무원. here 구역에 앉힐 동물 선원 */
  crew?: Crew;
  /** 고른 구역 id. 오른쪽 판이 이 구역을 보인다 */
  selected: string | null;
  /** 구역을 누르면 부른다. 같은 구역을 다시 누르면 고르기가 풀린다 */
  onSelect: (id: string) => void;
  /** 버린 구역도 그릴까(아래쪽 "버린 구역 보기") */
  showDropped: boolean;
  now: number;
};

export function MapView({
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

  const tiles = useMemo(
    () =>
      size.w > 0
        ? layoutMap(
            map,
            { x: 0, y: 0, w: size.w, h: size.h },
            { showDropped, header: HEADER, gap: 4 },
          )
        : [],
    [map, size, showDropped],
  );

  return (
    <section
      ref={ref}
      data-map
      className="relative h-full w-full"
      aria-label={`${map.title} 지도`}
    >
      {tiles.map((t) => (
        <TileView
          key={t.region.id}
          tile={t}
          here={map.here === t.region.id}
          crew={crew}
          selected={selected === t.region.id}
          onSelect={onSelect}
          now={now}
        />
      ))}
    </section>
  );
}

function TileView({
  tile,
  here,
  crew,
  selected,
  onSelect,
  now,
}: {
  tile: Tile;
  here: boolean;
  crew?: Crew;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = tile.region;
  const status = tile.dropped ? "dropped" : r.status;
  const fresh = isNewFound(r, now);
  const label = `${r.title} · ${REGION_STATUS_LABEL[status]}${fresh ? " · 새 땅" : ""}`;
  const cls = [
    styles.tile,
    tile.container ? styles.container : styles[status],
    tile.container && tile.depth === 1 ? styles.depth1 : "",
    tile.container && status === "blocked" ? styles.blocked : "",
    tile.container && status === "dropped" ? styles.dropped : "",
    selected ? styles.selected : "",
  ].join(" ");
  const style = {
    left: tile.x,
    top: tile.y,
    width: tile.w,
    height: tile.h,
  };

  if (tile.container) {
    // 이름 띠만 누를 수 있다. 안쪽은 자식 땅이 덮는다.
    return (
      <div className={cls} style={style} data-region={r.id}>
        <button
          type="button"
          title={label}
          onClick={() => onSelect(r.id)}
          className="flex w-full items-center gap-1.5 px-2 text-left"
          style={{ height: HEADER }}
        >
          <span
            className={styles.bar}
            style={{ background: REGION_STATUS_COLOR[status] }}
          />
          <span
            className={`min-w-0 truncate font-semibold ${
              tile.depth === 1
                ? "text-[12px] tracking-wide text-white/85"
                : "text-[11px] text-white/70"
            }`}
          >
            {r.title}
          </span>
          {fresh && <NewBadge />}
          <Signs region={r} max={tile.w > 160 ? 4 : 2} />
          {here && <HereAnimal crew={crew} size={20} />}
        </button>
      </div>
    );
  }

  // 땅 크기에 따라 보일 것을 줄인다
  const tiny = tile.w < 46 || tile.h < 26;
  const short = tile.h < 44;
  const animal = here ? Math.min(52, Math.max(22, tile.h * 0.42)) : 0;
  const icon = REGION_STATUS_ICON[status];
  return (
    <button
      type="button"
      data-region={r.id}
      data-status={status}
      title={label}
      aria-pressed={selected}
      onClick={() => onSelect(r.id)}
      className={`${cls} flex flex-col p-1.5 text-left`}
      style={style}
    >
      {tiny ? (
        <span className="m-auto text-[11px] leading-none">
          {icon ??
            (r.signs?.length ? SIGN_ICON[r.signs[0]?.type ?? "risk"] : "")}
        </span>
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-1">
            <span
              className={`${short ? "truncate" : styles.title} min-w-0 flex-1 text-[12px] leading-[1.25] font-medium`}
            >
              {r.title}
            </span>
            {icon && tile.w > 70 && (
              <span className="shrink-0 text-[11px] leading-[1.25]">
                {icon}
              </span>
            )}
          </div>
          <div className="mt-auto flex min-w-0 items-end gap-1">
            <Signs region={r} max={tile.w > 120 ? 4 : tile.w > 70 ? 2 : 1} />
            {fresh && !short && <NewBadge />}
            {here && (
              <span className="ml-auto shrink-0">
                <HereAnimal crew={crew} size={animal} />
              </span>
            )}
          </div>
        </>
      )}
    </button>
  );
}

function NewBadge() {
  return (
    <span
      className={`${styles.newLand} shrink-0 rounded px-1 text-[9.5px] leading-[14px] font-bold`}
    >
      새 땅
    </span>
  );
}

/** 표지 아이콘. 내가 정할 갈림길을 맨 앞에, 눈에 띄게. 넘치면 +n */
function Signs({ region, max }: { region: Region; max: number }) {
  const signs = [...(region.signs ?? [])]
    .filter((s) => !(s.type === "fork" && s.status === "decided"))
    .filter((s) => !(s.type === "talk" && s.status === "done"))
    .sort((a, b) => Number(isForkForMe(b)) - Number(isForkForMe(a)));
  if (signs.length === 0) return null;
  const shown = signs.slice(0, max);
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {shown.map((s) => (
        <span
          key={s.id}
          title={s.title}
          className={`inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-0.5 text-[11px] leading-none ${
            isForkForMe(s)
              ? styles.forkMine
              : s.type === "risk"
                ? "bg-[#ff9b5c]/25 text-[#ffc9a3]"
                : "bg-black/45 text-white/85"
          }`}
        >
          {s.type === "fork" ? (
            <b className="text-[13px] leading-none">{SIGN_ICON.fork}</b>
          ) : (
            SIGN_ICON[s.type]
          )}
        </span>
      ))}
      {signs.length > shown.length && (
        <span className="text-[10px] text-white/60">
          +{signs.length - shown.length}
        </span>
      )}
    </span>
  );
}

function HereAnimal({ crew, size }: { crew?: Crew; size: number }) {
  if (!crew) return <span title="지금 여기">📍</span>;
  return (
    <span data-here title="지금 여기" className="block">
      <Animal
        kind={animalFor(crew.id)}
        pose={crew.status === "off" ? "stand" : poseFor(crew.status)}
        context={crew.context}
        size={size}
        furniture={false}
        label={`${crew.name} 선원, 지금 여기`}
      />
    </span>
  );
}
