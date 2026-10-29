"use client";

// 선실 가운데를 조립 공장으로 그린다. 맨 위 구역 하나가 컨베이어 한 줄이고,
// 상자는 상태 칸(입구 → 작업대 → 멈춤 → 출하장)에 놓인다. 출하장 끝 큰 화물 상자가 진행률만큼 찬다.
// 자리는 layoutFactory가 계산하고, 여기서는 겉모습(상자 무늬·벨트·경광등·쪽지)만 그린다.
import { useEffect, useMemo, useRef, useState } from "react";
import { isForkForMe, isNewFound, type Region } from "@/protocol/map";
import type { Crew } from "@/protocol/v1";
import { Animal, animalFor, poseFor } from "@/ui/crew";
import { REGION_STATUS_COLOR, REGION_STATUS_LABEL } from "@/ui/map/labels";
import type { MapViewProps } from "@/ui/map/MapView";
import styles from "./factory.module.css";
import {
  type Box,
  type Column,
  type FactoryLayout,
  layoutFactory,
} from "./layout";

const COLUMN_LABEL: Record<
  Column,
  { long: string; short: string; color: string }
> = {
  fog: { long: "입구 · 안 뜯은 상자", short: "입구", color: "#c9b48f" },
  building: { long: "작업대 · 조립 중", short: "작업대", color: "#ffcf5c" },
  blocked: { long: "멈춤", short: "멈춤", color: "#ff8f8f" },
  done: { long: "출하장 · 완성", short: "출하", color: "#5ee08a" },
};

const COLUMN_TINT: Record<Column, string> = {
  fog: "rgb(200 170 120 / 0.03)",
  building: "rgb(255 207 92 / 0.04)",
  blocked: "rgb(255 107 107 / 0.06)",
  done: "rgb(94 224 138 / 0.04)",
};

export function FactoryView({
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
    () => (size.w > 0 ? layoutFactory(map, size, { showDropped }) : null),
    [map, size, showDropped],
  );
  const groupColor = useMemo(() => {
    const m = new Map<string, { color: string; title: string }>();
    for (const r of layout?.rows ?? [])
      for (const g of r.groups)
        m.set(g.region.id, { color: g.color, title: g.region.title });
    return m;
  }, [layout]);

  return (
    <section
      ref={ref}
      data-map
      className={`${styles.floor} relative h-full w-full overflow-hidden`}
      aria-label={`${map.title} 조립 공장`}
    >
      {layout && (
        <>
          <Columns layout={layout} />
          {layout.rows.map((row) => (
            <div key={row.region.id}>
              <RowHead
                row={row}
                here={map.here}
                selected={selected}
                onSelect={onSelect}
                now={now}
              />
              {/* 빈 벨트는 그리지 않는다. 첫 줄은 비어도 둬서 줄이 있다는 것은 보인다 */}
              {Array.from({ length: layout.lanes }, (_, li) => li)
                .filter(
                  (li) =>
                    li === 0 ||
                    layout.boxes.some(
                      (b) => b.row === row.region.id && b.lane === li,
                    ),
                )
                .map((li) => (
                  <div
                    key={li}
                    className={styles.belt}
                    style={{
                      left: row.belt.x,
                      width: row.belt.w,
                      top: row.belt.y + (li + 1) * layout.laneH - 6,
                    }}
                  />
                ))}
              {row.bin && (
                <div
                  className={`${styles.bin} absolute flex items-center px-2 text-[10.5px] text-white/45`}
                  style={{
                    left: row.bin.x,
                    top: row.bin.y,
                    width: row.bin.w,
                    height: row.bin.h,
                  }}
                >
                  🗑 폐기 통
                </div>
              )}
              {row.bin?.items.map((it) => (
                <button
                  key={it.region.id}
                  type="button"
                  data-region={it.region.id}
                  data-status="dropped"
                  title={`${it.region.title} · 버림`}
                  aria-pressed={selected === it.region.id}
                  onClick={() => onSelect(it.region.id)}
                  className={`absolute truncate rounded bg-white/[0.06] px-1.5 text-left text-[10.5px] leading-4 text-white/45 line-through ${
                    selected === it.region.id ? styles.selected : ""
                  }`}
                  style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
                >
                  {it.region.title}
                </button>
              ))}
            </div>
          ))}
          {layout.boxes.map((b) => (
            <BoxView
              key={b.region.id}
              box={b}
              here={map.here === b.region.id}
              selected={selected === b.region.id}
              onSelect={onSelect}
              now={now}
              group={b.group ? groupColor.get(b.group) : undefined}
            />
          ))}
          {layout.boxes
            .filter((b) => b.region.id === map.here)
            .map((b) => (
              <HereWorker key="here" box={b} crew={crew} />
            ))}
          <Crate layout={layout} goal={map.goal ?? map.title} />
        </>
      )}
    </section>
  );
}

/** 칸 이름과 칸 경계 세로선. 모든 줄이 같은 선을 쓴다. */
function Columns({ layout }: { layout: FactoryLayout }) {
  const top = layout.header.y;
  const bottom = layout.crate.y + layout.crate.h;
  return (
    <>
      {layout.columns.map((c, i) => {
        const l = COLUMN_LABEL[c.key];
        return (
          <div key={c.key}>
            <div
              className="pointer-events-none absolute"
              style={{
                left: c.x,
                top: top + layout.header.h,
                width: c.w,
                height: bottom - top - layout.header.h,
                background: COLUMN_TINT[c.key],
                borderLeft:
                  i > 0 ? "1px dashed rgb(255 255 255 / 0.1)" : undefined,
              }}
            />
            <div
              className="absolute truncate px-1 text-[10.5px] font-semibold tracking-wide"
              title={l.long}
              style={{
                left: c.x,
                top,
                width: c.w,
                height: layout.header.h,
                color: l.color,
              }}
            >
              {c.w > 120 ? l.long : l.short}
              {i < layout.columns.length - 1 && c.w > 70 && (
                <span className="text-white/25"> →</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RowHead({
  row,
  here,
  selected,
  onSelect,
  now,
}: {
  row: FactoryLayout["rows"][number];
  here?: string;
  selected: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const r = row.region;
  const status = row.dropped ? "dropped" : r.status;
  return (
    <div
      className="absolute flex min-w-0 items-center gap-1.5 overflow-hidden"
      style={{
        left: row.head.x,
        top: row.head.y,
        width: row.head.w,
        height: row.head.h,
      }}
    >
      <button
        type="button"
        data-region={r.id}
        data-status={status}
        title={`${r.title} 줄 · ${REGION_STATUS_LABEL[status]}${isNewFound(r, now) ? " · 추가 주문" : ""}`}
        aria-pressed={selected === r.id}
        onClick={() => onSelect(r.id)}
        className={`flex max-w-[45%] shrink-0 items-center gap-1 rounded px-1 text-[11.5px] font-semibold text-white/85 hover:bg-white/[0.07] ${
          selected === r.id ? "bg-white/15 ring-1 ring-white" : ""
        }`}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-sm"
          style={{ background: REGION_STATUS_COLOR[status] }}
        />
        <span className="truncate">{r.title}</span>
        {here === r.id && <span title="지금 여기">📍</span>}
      </button>
      {row.groups.map((g) => (
        <button
          key={g.region.id}
          type="button"
          data-region={g.region.id}
          data-status={g.region.status}
          title={`묶음: ${g.region.title} · ${REGION_STATUS_LABEL[g.region.status]}`}
          aria-pressed={selected === g.region.id}
          onClick={() => onSelect(g.region.id)}
          className={`flex min-w-0 items-center gap-1 rounded-sm px-1 text-[10.5px] text-white/65 hover:bg-white/[0.07] ${
            selected === g.region.id ? "bg-white/15 ring-1 ring-white" : ""
          }`}
          style={{ borderTop: `3px solid ${g.color}` }}
        >
          <span className="truncate">{g.region.title}</span>
          {here === g.region.id && <span title="지금 여기">📍</span>}
          <SignIcons region={g.region} compact />
        </button>
      ))}
    </div>
  );
}

function BoxView({
  box,
  here,
  selected,
  onSelect,
  now,
  group,
}: {
  box: Box;
  here: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
  group?: { color: string; title: string };
}) {
  const r = box.region;
  const fresh = isNewFound(r, now);
  const forkMine = (r.signs ?? []).some(isForkForMe);
  const risk = (r.signs ?? []).some((s) => s.type === "risk");
  const label = [
    group ? `${group.title} › ${r.title}` : r.title,
    REGION_STATUS_LABEL[r.status],
    forkMine ? "내가 정할 갈림길" : "",
    fresh ? "추가 주문" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const workerW = here ? workerSize(box) : 0;
  const narrow = box.w < 52;
  const twoLines = box.h >= 40 && box.w - workerW >= 64;
  return (
    <>
      {/* 상자 아래 벨트 조각: here는 돌고, 막힘은 멈춘 붉은 띠 */}
      {(here || r.status === "blocked") && (
        <div
          className={`${styles.belt} ${here ? styles.moving : styles.stopped}`}
          style={{ left: box.x - 2, width: box.w + 4, top: box.y + box.h + 2 }}
        />
      )}
      <button
        type="button"
        data-region={r.id}
        data-status={r.status}
        title={label}
        aria-pressed={selected}
        onClick={() => onSelect(r.id)}
        className={[
          styles.box,
          styles[r.status],
          here ? styles.here : "",
          forkMine ? styles.fork : "",
          selected ? styles.selected : "",
          "flex flex-col text-left",
        ].join(" ")}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      >
        {group && (
          <span
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: group.color }}
          />
        )}
        <span
          className="flex min-w-0 items-start gap-1 px-1 pt-[5px]"
          style={{ paddingRight: workerW ? workerW + 2 : undefined }}
        >
          {forkMine && (
            <span className={`${styles.beacon} mt-[2px] shrink-0`} />
          )}
          {r.status === "blocked" && (
            <span className={`${styles.stopLight} mt-[2px] shrink-0`} />
          )}
          {!narrow && (
            <span
              className={`min-w-0 flex-1 text-[11.5px] leading-[1.25] font-medium ${
                twoLines ? "line-clamp-2 break-keep" : "truncate"
              }`}
            >
              {r.title}
            </span>
          )}
          {narrow && !forkMine && r.status !== "blocked" && (
            <span className="min-w-0 truncate text-[10.5px] leading-[1.25]">
              {r.title}
            </span>
          )}
        </span>
        {box.h >= 34 && box.w - workerW >= 40 && (
          <span
            className="mt-auto flex min-w-0 items-center gap-1 overflow-hidden px-1 pb-[5px]"
            style={{ paddingRight: workerW ? workerW + 2 : undefined }}
          >
            <SignIcons region={r} compact={box.w - workerW < 90} />
            {fresh && (
              <span
                className={`${styles.note} shrink-0 px-1 text-[9.5px] leading-[13px] font-bold`}
              >
                {box.w - workerW >= 100 ? "추가 주문" : "추가"}
              </span>
            )}
          </span>
        )}
        {risk && <span className={styles.hazard} />}
      </button>
    </>
  );
}

/** 표지: 내 갈림길은 레일 스위치(⑂), 교신은 인터폰(☎). 위험은 상자 바닥 줄무늬로 따로 그린다. */
function SignIcons({ region, compact }: { region: Region; compact?: boolean }) {
  const signs = (region.signs ?? [])
    .filter((s) => (s.type === "fork" ? s.status === "open" : true))
    .filter((s) => !(s.type === "talk" && s.status === "done"))
    .filter((s) => s.type !== "risk")
    .sort((a, b) => Number(isForkForMe(b)) - Number(isForkForMe(a)));
  if (signs.length === 0) return null;
  const shown = signs.slice(0, compact ? 1 : 3);
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {shown.map((s) => (
        <span
          key={s.id}
          title={s.title}
          className={`inline-flex h-[15px] items-center justify-center rounded px-1 text-[10px] leading-none font-bold ${
            isForkForMe(s)
              ? "bg-[#ffd84a] text-[#2a2000]"
              : "bg-black/45 text-white/80"
          }`}
        >
          {s.type === "fork"
            ? isForkForMe(s) && !compact
              ? "⑂ 정할 것"
              : "⑂"
            : "☎"}
        </span>
      ))}
      {signs.length > shown.length && (
        <span className="text-[9.5px] text-white/55">
          +{signs.length - shown.length}
        </span>
      )}
    </span>
  );
}

function workerSize(box: Box) {
  return Math.round(Math.max(18, Math.min(box.w * 0.42, (box.h + 8) / 1.25)));
}

/** here 작업대의 승무원. 상자 오른쪽에 서서 일한다(벨트 위로 살짝 올라온다). */
function HereWorker({ box, crew }: { box: Box; crew?: Crew }) {
  const s = workerSize(box);
  const left = box.x + box.w - s - 1;
  const top = box.y + box.h - s * 1.25 + 2;
  return (
    <span
      data-here
      title="지금 여기"
      className="pointer-events-none absolute"
      style={{ left, top, width: s, zIndex: 5 }}
    >
      {crew ? (
        <Animal
          kind={animalFor(crew.id)}
          pose={crew.status === "off" ? "stand" : poseFor(crew.status)}
          context={crew.context}
          size={s}
          furniture={false}
          label={`${crew.name} 선원, 지금 여기`}
        />
      ) : (
        <span className="text-[14px]">📍</span>
      )}
    </span>
  );
}

/** 출하장 끝 목표 화물 상자. 완공 크기만큼 아래에서 차오른다. */
function Crate({ layout, goal }: { layout: FactoryLayout; goal: string }) {
  const c = layout.crate;
  const pct = Math.round(c.fill * 100);
  return (
    <div
      className={`${styles.crate} absolute`}
      style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
      title={`목표: ${goal} · ${pct}% 찼어요`}
      data-crate
      data-fill={c.fill}
    >
      <div
        className={`${styles.crateFill} absolute inset-x-0 bottom-0`}
        style={{ height: `${c.fill * 100}%` }}
      />
      <div className="relative flex h-full flex-col p-2">
        <div className="text-[10px] font-semibold tracking-wider text-[#5ee08a]/80">
          목표 화물
        </div>
        <div className="mt-1 line-clamp-4 text-[11.5px] leading-[1.3] font-semibold break-keep text-white/90">
          {goal}
        </div>
        <div className="mt-auto text-[26px] leading-none font-bold text-white tabular-nums drop-shadow">
          {pct}%
        </div>
      </div>
    </div>
  );
}
