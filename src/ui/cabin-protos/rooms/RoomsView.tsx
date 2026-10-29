"use client";

// 시안: 선원 작업실 단면도. 우주선을 옆으로 잘라 층(맨 위 구역)과 방(구역)을 들여다본다.
// 방 안의 모습이 상태다(Scene). here 방만 환하고 그 승무원의 동물이 일한다.
// 내가 정할 갈림길이 있는 방에서는 같은 동물이 문 앞에서 손짓한다(그 승무원이 나를 부르는 자리).
// 교신·위험은 방 벽의 작은 아이콘, 발견 7일 안 방은 새 벽지와 "새 방" 꼬리표.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { isForkForMe, isNewFound, type Region } from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import {
  REGION_STATUS_COLOR,
  REGION_STATUS_LABEL,
  SIGN_ICON,
} from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import { type Cell, layoutRooms } from "./layout";
import styles from "./rooms.module.css";
import { Scene } from "./Scene";

const PAD = { x: 14, y: 12 };
const HEADER = 18;
const SLAB = 8;
const LABEL = 84;

export function RoomsView({
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

  const cells = useMemo(
    () =>
      size.w > 0
        ? layoutRooms(
            map,
            {
              x: PAD.x,
              y: PAD.y,
              w: size.w - PAD.x * 2,
              h: size.h - PAD.y * 2,
            },
            { showDropped, header: HEADER, slab: SLAB, label: LABEL },
          )
        : [],
    [map, size, showDropped],
  );
  const decks = cells.filter((c) => c.kind === "deck");
  const rooms = cells.filter((c) => c.kind === "room");
  const bottom = decks.reduce((m, d) => Math.max(m, d.y + d.h), 0);

  return (
    <section
      ref={ref}
      data-map
      className="relative h-full w-full"
      aria-label={`${map.title} 단면도`}
    >
      <div
        className={styles.hull}
        style={{ bottom: Math.max(4, size.h - bottom - PAD.y + 4) }}
      />
      {decks.map((d, i) => (
        <DeckView
          key={d.region.id}
          cell={d}
          floor={i + 1}
          last={i === decks.length - 1}
          selected={selected === d.region.id}
          onSelect={onSelect}
          now={now}
        />
      ))}
      {rooms.map((c) => (
        <RoomView
          key={c.region.id}
          cell={c}
          here={map.here === c.region.id}
          crew={crew}
          selected={selected === c.region.id}
          onSelect={onSelect}
          now={now}
        />
      ))}
    </section>
  );
}

function DeckView({
  cell,
  floor,
  last,
  selected,
  onSelect,
  now,
}: {
  cell: Cell;
  floor: number;
  last: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = cell.region;
  const status = cell.dropped ? "dropped" : r.status;
  const fresh = isNewFound(r, now);
  return (
    <>
      <div
        className={styles.deck}
        style={{ left: cell.x, top: cell.y, width: cell.w, height: cell.h }}
      />
      <button
        type="button"
        // 칸막이 없는 층은 방 쪽이 data-region을 갖는다
        data-region={cell.container ? r.id : undefined}
        title={`${floor}층 · ${r.title} · ${REGION_STATUS_LABEL[status]}${fresh ? " · 새 층" : ""}`}
        aria-pressed={selected}
        onClick={() => onSelect(r.id)}
        className={`${styles.plate} ${selected ? styles.selected : ""} flex flex-col items-start gap-0.5 px-2 py-1.5 text-left`}
        style={{
          left: cell.x,
          top: cell.y,
          width: LABEL,
          height: cell.h,
        }}
      >
        <span className="flex w-full items-center gap-1 text-[10px] font-semibold tracking-widest text-white/40">
          {floor}층
          <span
            className="ml-auto h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: REGION_STATUS_COLOR[status] }}
          />
        </span>
        <span
          className={`w-full text-[12.5px] leading-[1.2] font-semibold text-white/85 ${cell.h > 54 ? "line-clamp-2" : "truncate"}`}
        >
          {r.title}
        </span>
        {fresh && cell.h > 70 && (
          <span
            className={`${styles.newTag} rounded px-1 text-[9.5px] leading-[14px] font-bold`}
          >
            새 층
          </span>
        )}
      </button>
      {!last && (
        <div
          className={styles.slab}
          style={{
            left: cell.x,
            top: cell.y + cell.h + 1,
            width: cell.w,
            height: SLAB - 2,
          }}
        />
      )}
    </>
  );
}

function RoomView({
  cell,
  here,
  crew,
  selected,
  onSelect,
  now,
}: {
  cell: Cell;
  here: boolean;
  crew?: Crew;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = cell.region;
  const status = cell.dropped ? "dropped" : r.status;
  const fresh = isNewFound(r, now);
  const forks = (r.signs ?? []).filter(isForkForMe);
  const label = `${r.title} · ${REGION_STATUS_LABEL[status]}${fresh ? " · 새 방" : ""}${here ? " · 지금 여기" : ""}${forks.length ? ` · 내가 정할 갈림길 ${forks.length}` : ""}`;
  const pos = { left: cell.x, top: cell.y, width: cell.w, height: cell.h };

  if (cell.container) {
    // 칸막이 방: 벽과 이름 띠만 그리고 안은 작은 칸(3단)이 덮는다
    return (
      <div
        className={`${styles.room} ${styles.shell} ${status === "blocked" ? styles.blocked : ""} ${selected ? styles.selected : ""}`}
        style={pos}
        data-region={r.id}
      >
        <button
          type="button"
          title={label}
          aria-pressed={selected}
          onClick={() => onSelect(r.id)}
          className="flex w-full items-center gap-1.5 px-1.5 text-left"
          style={{ height: HEADER }}
        >
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: REGION_STATUS_COLOR[status] }}
          />
          <span className="min-w-0 truncate text-[11.5px] font-semibold text-white/75">
            {r.title}
          </span>
          {fresh && cell.w > 120 && <Tag kind="new">새 방</Tag>}
          <Signs region={r} max={cell.w > 160 ? 3 : 1} />
        </button>
      </div>
    );
  }

  // 동물: here 방은 그 승무원이 일하고, 내가 정할 갈림길 방은 문 앞에서 손짓한다
  const waving = forks.length > 0;
  const animalSize =
    crew && (here || waving)
      ? Math.max(18, Math.min(54, (cell.h - 22) / 1.25, cell.w * 0.42))
      : 0;
  // 동물이 있으면 명판은 한 줄로 두어 동물 머리와 겹치지 않게 한다
  const tall = cell.h >= (animalSize > 0 ? 130 : 78) && cell.w >= 96;
  const pose = waving
    ? "wave"
    : crew?.status === "off"
      ? "stand"
      : status === "blocked"
        ? "stand"
        : crew
          ? poseFor(crew.status)
          : "work";
  const waitedDays = r.since
    ? (now - Date.parse(r.since)) / 86_400_000
    : undefined;

  return (
    <button
      type="button"
      data-region={r.id}
      data-status={status}
      data-here={here || undefined}
      title={label}
      aria-pressed={selected}
      onClick={() => onSelect(r.id)}
      className={`${styles.room} ${styles[status]} ${here ? styles.here : ""} ${selected ? styles.selected : ""} flex flex-col text-left`}
      style={pos}
    >
      {fresh && <span className={styles.wallpaper} />}
      <Scene
        w={cell.w}
        h={cell.h}
        status={status}
        here={here}
        occupied={animalSize > 0}
      />
      {/* 명판 */}
      <span className="relative flex min-w-0 items-start gap-1 px-1.5 pt-1">
        <span
          className={`min-w-0 flex-1 text-[11.5px] leading-[1.25] font-medium ${tall ? "line-clamp-2" : "truncate"}`}
        >
          {r.title}
        </span>
        {cell.w >= 110 && <Signs region={r} max={cell.w > 150 ? 3 : 2} />}
      </span>
      {/* 꼬리표 줄 */}
      <span
        className="relative mt-0.5 flex min-w-0 flex-wrap items-center gap-1 px-1.5"
        style={
          animalSize > 0 ? { maxWidth: cell.w - animalSize - 18 } : undefined
        }
      >
        {here && cell.h >= 50 && <Tag kind="here">지금 여기</Tag>}
        {waving && cell.h >= 50 && (
          <Tag kind="fork">
            {SIGN_ICON.fork} 정할 것{forks.length > 1 ? ` ${forks.length}` : ""}
          </Tag>
        )}
        {cell.h >= 40 && cell.w >= 60 && (
          <span
            className="shrink-0 rounded bg-black/40 px-1 text-[9.5px] leading-[14px] font-semibold"
            style={{ color: REGION_STATUS_COLOR[status] }}
          >
            {REGION_STATUS_LABEL[status]}
          </span>
        )}
        {fresh && cell.h >= 64 && cell.w >= 70 && <Tag kind="new">새 방</Tag>}
        {cell.w < 110 && cell.h >= 64 && <Signs region={r} max={1} />}
      </span>
      {animalSize > 0 && crew && (
        <span
          className="pointer-events-none absolute bottom-[3px]"
          style={{ right: cell.w >= 70 ? 16 : 2 }}
        >
          <Animal
            kind={animalFor(crew.id)}
            pose={pose}
            context={crew.context}
            size={animalSize}
            furniture={false}
            urgency={
              waving && waitedDays !== undefined
                ? Math.min(1, 0.4 + waitedDays / 10)
                : undefined
            }
            label={
              waving
                ? `${crew.name} 선원, 정할 것이 있다고 부르는 중`
                : `${crew.name} 선원, 지금 여기`
            }
          />
        </span>
      )}
    </button>
  );
}

function Tag({
  kind,
  children,
}: {
  kind: "new" | "fork" | "here";
  children: ReactNode;
}) {
  const cls =
    kind === "new"
      ? styles.newTag
      : kind === "fork"
        ? styles.forkTag
        : styles.hereTag;
  return (
    <span
      className={`${cls} shrink-0 rounded px-1 text-[9.5px] leading-[14px] font-bold whitespace-nowrap`}
    >
      {children}
    </span>
  );
}

/** 벽에 붙은 교신·위험 아이콘. 내가 정할 갈림길은 동물과 꼬리표가 따로 알리니 남이 정할 갈림길만 */
function Signs({ region, max }: { region: Region; max: number }) {
  const signs = (region.signs ?? []).filter(
    (s) =>
      !(s.type === "fork" && (s.status === "decided" || isForkForMe(s))) &&
      !(s.type === "talk" && s.status === "done"),
  );
  if (signs.length === 0) return null;
  const shown = signs.slice(0, max);
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {shown.map((s) => (
        <span
          key={s.id}
          title={s.title}
          className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded px-0.5 text-[10.5px] leading-none ${
            s.type === "risk"
              ? "bg-[#ffcf5c]/25 text-[#ffd98a]"
              : "bg-black/50 text-white/85"
          }`}
        >
          {SIGN_ICON[s.type]}
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
