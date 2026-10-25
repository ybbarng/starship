"use client";

// 스크롤 뒤 장면: 옆에서 자른 우주선 단면(개미농장). 위층 업무, 아래층 개인.
// 일함 = 책상에서 작업, 나를 기다림 = 통로로 나와 화면 쪽을 보며 손짓 + 머리 위 첫 줄 말풍선, 쉼 = 잠.
// 칸을 누르면 오른쪽 패널에 브리핑·할 일 체크.
import type { Context, Crew, Task } from "@/protocol/v1";
import { Animal, animalFor } from "@/ui/crew";
import { ago, CONTEXT_COLOR, CONTEXT_LABEL, CREW_STATUS_LABEL } from "@/ui/kit";
import { CrewDetail, CrewHeader } from "./CrewDetail";
import styles from "./classic.module.css";

/** 기준 화면(1372×872) 안에서의 자리. 선체·앞코·갑판이 이 값을 함께 쓴다. */
export const SHIP = {
  bandBottom: 0.3,
  hullTop: 290 / 872,
  hullBottom: 856 / 872,
  noseX: 108 / 1372,
  noseY: 573 / 872,
  /** 작아진 조종석 크기(화면 대비) */
  cockpitScale: 0.09,
};

export function Interior({
  crew,
  tasksByCrew,
  now,
  selectedId,
  onSelect,
  onCockpit,
  destination,
}: {
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  now: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCockpit: () => void;
  destination: { ko: string; fact: string };
}) {
  const selected = crew.find((c) => c.id === selectedId);
  const deck = (ctx: Context) =>
    crew
      .filter((c) => c.context === ctx)
      .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 바깥 우주(선체 둘레) */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: `${SHIP.bandBottom * 100}%`,
          background:
            "radial-gradient(80% 120% at 60% 40%, #0d1630 0%, #04060d 70%)",
        }}
      >
        <OuterStars />
      </div>

      <BandFrame destination={destination} onCockpit={onCockpit} />
      <Hull />

      {/* 앞코: 작아진 조종석이 여기에 앉는다. 누르면 돌아간다 */}
      <button
        type="button"
        onClick={onCockpit}
        aria-label="조종석으로 돌아가기"
        className="group absolute flex flex-col items-center justify-end"
        style={{
          left: `${SHIP.noseX * 100 - 5.5}%`,
          width: "11%",
          top: `${SHIP.noseY * 100 - 6}%`,
          height: "16%",
        }}
      >
        <span className="rounded bg-black/60 px-1.5 py-px text-[10px] text-white/70 group-hover:text-white">
          ▲ 조종석
        </span>
      </button>

      {/* 갑판 둘 */}
      <div
        className={`absolute flex flex-col transition-[right] duration-300 overflow-hidden rounded-[28px] ${styles.soil}`}
        style={{
          left: "14.4%",
          right: selected ? 416 : "6.4%",
          top: "35.2%",
          bottom: "4.6%",
          boxShadow:
            "inset 0 0 0 3px #0b0807, inset 0 6px 18px rgba(0,0,0,0.6)",
        }}
      >
        <Deck
          context="work"
          crew={deck("work")}
          tasksByCrew={tasksByCrew}
          now={now}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <div className="h-[6px] shrink-0 bg-[#120d0b] shadow-[0_1px_0_rgba(255,255,255,0.05)]" />
        <Deck
          context="personal"
          crew={deck("personal")}
          tasksByCrew={tasksByCrew}
          now={now}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>

      {selected && (
        <aside
          className={`absolute right-4 bottom-4 z-10 flex w-[384px] flex-col overflow-hidden rounded-xl border border-black/70 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] ${styles.metal}`}
          style={{ top: `${SHIP.hullTop * 100 + 1}%` }}
          aria-label={`${selected.name} 자리`}
        >
          <div className="flex items-start justify-between gap-2 border-b border-black/50 px-4 pt-3 pb-2.5">
            <CrewHeader crew={selected} now={now} />
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="패널 닫기"
              className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-auto px-4 py-3"
            data-scroll-inside
          >
            <CrewDetail
              crew={selected}
              tasks={tasksByCrew.get(selected.id) ?? []}
              now={now}
            />
          </div>
        </aside>
      )}
    </div>
  );
}

function Deck({
  context,
  crew,
  tasksByCrew,
  now,
  selectedId,
  onSelect,
}: {
  context: Context;
  crew: Crew[];
  tasksByCrew: Map<string, Task[]>;
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const n = Math.max(crew.length, 1);
  const narrow = n > 10;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-3 pt-2 pb-1.5">
      <div className="mb-1 flex items-center gap-2 pl-1 text-[11px]">
        <span
          className="rounded px-1.5 py-px font-semibold text-black"
          style={{ background: CONTEXT_COLOR[context] }}
        >
          {context === "work" ? "위층" : "아래층"} · {CONTEXT_LABEL[context]}
        </span>
        <span className="text-white/50">
          {crew.length}명 · 기다림{" "}
          {crew.filter((c) => c.status === "needs-you").length}
        </span>
      </div>
      {/* 칸 줄 + 통로 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative z-[1] flex min-h-0 flex-[1.7] gap-[6px]">
          {crew.map((c, i) => (
            <Room
              key={c.id}
              crew={c}
              task={tasksByCrew.get(c.id)?.[0]}
              count={tasksByCrew.get(c.id)?.length ?? 0}
              now={now}
              narrow={narrow}
              edge={
                i === 0 ? "left" : i === crew.length - 1 ? "right" : undefined
              }
              selected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))}
          {crew.length === 0 && (
            <p className="m-auto text-xs text-white/40">빈 층</p>
          )}
        </div>
        {/* 통로(굴) */}
        <div
          className="relative mt-[10px] flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(180deg, #3a2c24 0%, #4a382d 45%, #2c211b 100%)",
            boxShadow:
              "inset 0 3px 8px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(255,220,180,0.08)",
          }}
        >
          <div className="absolute inset-x-6 bottom-[22%] h-px bg-[#ffcf9a]/10" />
        </div>
      </div>
    </div>
  );
}

function Room({
  crew,
  task,
  count,
  now,
  narrow,
  edge,
  selected,
  onSelect,
}: {
  crew: Crew;
  task: Task | undefined;
  count: number;
  now: number;
  narrow: boolean;
  edge?: "left" | "right";
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = CONTEXT_COLOR[crew.context];
  const lit = crew.status === "working" || crew.status === "needs-you";
  const kind = animalFor(crew.id);
  const size = narrow ? 44 : 64;
  return (
    <button
      type="button"
      onClick={onSelect}
      data-room={crew.id}
      className="group relative flex min-w-0 flex-1 flex-col items-center"
      aria-label={`${crew.name} · ${CREW_STATUS_LABEL[crew.status]}`}
    >
      {/* 굴 칸 */}
      <div
        className="relative flex w-full flex-1 flex-col items-center overflow-visible transition"
        style={{
          borderRadius: "46% 46% 18% 18% / 38% 38% 14% 14%",
          background: lit
            ? `radial-gradient(90% 80% at 50% 30%, ${crew.context === "work" ? "#3f5f8f" : "#8f6440"} 0%, ${crew.context === "work" ? "#1d2c47" : "#3f2a1d"} 80%)`
            : crew.status === "idle"
              ? "radial-gradient(90% 80% at 50% 30%, #2a2a3a 0%, #15141c 80%)"
              : "#120f0e",
          boxShadow: selected
            ? `0 0 0 2px ${accent}, 0 0 18px ${accent}66, inset 0 2px 10px rgba(0,0,0,0.6)`
            : "inset 0 2px 10px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {/* 천장 등 */}
        <span
          className="mt-1 h-1.5 w-6 rounded-full"
          style={{
            background: lit ? "#fff3c7" : "#3a3330",
            boxShadow: lit ? "0 0 10px 3px rgba(255,236,170,0.45)" : "none",
          }}
        />
        <span
          className={`mt-0.5 max-w-[94%] truncate rounded-[2px] bg-black/70 px-1 font-mono ${narrow ? "text-[9px]" : "text-[10px]"} leading-tight text-white/90`}
        >
          {crew.name}
        </span>
        {count > 0 && (
          <span className="absolute top-1 right-1.5 rounded-full bg-[#ffd84a] px-1 text-[9px] font-bold text-black">
            {count}
          </span>
        )}
        <div
          className={`relative flex w-full flex-1 items-end ${narrow && edge === "left" ? "justify-start" : narrow && edge === "right" ? "justify-end" : "justify-center"}`}
        >
          {crew.status === "needs-you" ? (
            <Bubble
              text={task?.title ?? crew.activity ?? "불러요"}
              wait={crew.since ? ago(crew.since, now) : ""}
              narrow={narrow}
            />
          ) : (
            <div
              className={crew.status === "off" ? "opacity-40 grayscale" : ""}
            >
              <Animal
                kind={kind}
                pose={
                  crew.status === "working"
                    ? "work"
                    : crew.status === "idle"
                      ? "sleep"
                      : "off"
                }
                context={crew.context}
                size={size}
              />
            </div>
          )}
        </div>
        <span
          className={`pb-0.5 ${narrow ? "text-[9px]" : "text-[10px]"} text-white/45`}
        >
          {crew.status === "working"
            ? "일함"
            : crew.status === "idle"
              ? "쉼"
              : crew.status === "off"
                ? "자리 비움"
                : ""}
        </span>
      </div>
      {/* 굴과 통로를 잇는 짧은 수직 굴 */}
      <div className="h-[12px] w-[34%] bg-[#3a2c24] shadow-[inset_2px_0_3px_rgba(0,0,0,0.5),inset_-2px_0_3px_rgba(0,0,0,0.5)]" />
      {/* 나를 기다리는 선원은 통로로 나와 손짓 */}
      {crew.status === "needs-you" && (
        <div
          className={`pointer-events-none absolute -bottom-[52%] z-[2] ${styles.bob}`}
        >
          <Animal
            kind={kind}
            pose="wave"
            context={crew.context}
            size={narrow ? 42 : 54}
          />
        </div>
      )}
    </button>
  );
}

function Bubble({
  text,
  wait,
  narrow,
}: {
  text: string;
  wait: string;
  narrow: boolean;
}) {
  return (
    <div
      className={`relative z-[3] mb-1 rounded-lg ${narrow ? "w-[128px] shrink-0" : "mx-1"} bg-[#fffbea] px-1.5 py-1 text-left text-[#1d1a14] shadow-[0_2px_8px_rgba(0,0,0,0.5)] ${narrow ? "text-[9.5px]" : "text-[11px]"} leading-[1.3]`}
    >
      <span
        className={`${narrow ? "line-clamp-3" : "line-clamp-3"} font-medium`}
      >
        {text}
      </span>
      {wait && (
        <span className="mt-0.5 block text-[9.5px] font-semibold text-[#b07a00]">
          {wait}째 기다림
        </span>
      )}
      <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-[#fffbea]" />
    </div>
  );
}

/** 선체: 앞코(왼쪽)부터 엔진(오른쪽)까지. 기준 화면 좌표로 그려 늘려 쓴다. */
function Hull() {
  return (
    <svg
      viewBox="0 0 1372 872"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="cl-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d7688" />
          <stop offset="0.12" stopColor="#4a5262" />
          <stop offset="0.85" stopColor="#323845" />
          <stop offset="1" stopColor="#1f232c" />
        </linearGradient>
        <radialGradient id="cl-flame" cx="0" cy="0.5" r="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.25" stopColor="#9fd8ff" />
          <stop offset="1" stopColor="#3b7bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 엔진 불꽃 */}
      <g className={styles.engine} style={{ transformOrigin: "1336px 573px" }}>
        <ellipse cx={1350} cy={470} rx={40} ry={26} fill="url(#cl-flame)" />
        <ellipse cx={1350} cy={676} rx={40} ry={26} fill="url(#cl-flame)" />
      </g>
      {/* 선체 */}
      <path
        d="M210,292 H1270 Q1312,292 1312,334 V814 Q1312,856 1270,856 H210 Q70,846 28,640 Q16,573 28,506 Q70,300 210,292 Z"
        fill="url(#cl-hull)"
        stroke="#0d0f14"
        strokeWidth={3}
      />
      {/* 엔진 종 */}
      {[470, 676].map((y) => (
        <path
          key={y}
          d={`M1310,${y - 22} L1340,${y - 32} V${y + 32} L1310,${y + 22} Z`}
          fill="#2a2f3a"
          stroke="#14171d"
          strokeWidth={2}
        />
      ))}
      <path
        d="M212,298 H1268"
        stroke="#fff"
        strokeOpacity={0.18}
        strokeWidth={2}
      />
      {/* 앞코 칸막이와 조종석 자리 */}
      <path
        d="M196,300 Q186,573 196,848"
        fill="none"
        stroke="#1a1e26"
        strokeWidth={3}
      />
      <ellipse
        cx={108}
        cy={573}
        rx={78}
        ry={56}
        fill="#0c1018"
        stroke="#1a1e26"
        strokeWidth={3}
      />
      {/* 리벳 */}
      {Array.from({ length: 26 }, (_, i) => 240 + i * 40).map((x) => (
        <g key={x}>
          <circle cx={x} cy={300} r={1.8} fill="#9aa3b4" opacity={0.5} />
          <circle cx={x} cy={850} r={1.8} fill="#9aa3b4" opacity={0.35} />
        </g>
      ))}
      {/* 안테나와 핀 */}
      <path
        d="M700,292 V262 M700,262 L716,250"
        stroke="#7a8496"
        strokeWidth={3}
      />
      <circle cx={716} cy={250} r={4} fill="#ff6b6b" className={styles.blink} />
      <path
        d="M1180,292 L1230,252 H1262 L1252,292 Z"
        fill="#3b4250"
        stroke="#0d0f14"
        strokeWidth={2}
      />
    </svg>
  );
}

function BandFrame({
  destination,
  onCockpit,
}: {
  destination: { ko: string; fact: string };
  onCockpit: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: `${SHIP.bandBottom * 100}%` }}
    >
      {/* 관측창 기둥 */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: 6 }, (_, i) => i).map((i) => (
          <div
            key={i}
            className="flex-1 rounded-[18px]"
            style={{
              boxShadow:
                "0 0 0 10px #1b2029, inset 0 0 0 2px #05070b, inset 0 0 30px rgba(120,170,255,0.06)",
              margin: "12px 6px 14px",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-3 bg-[#1b2029]" />
      <div className="absolute inset-x-0 bottom-0 h-[14px] bg-[#1b2029] shadow-[0_-1px_0_rgba(255,255,255,0.08)]" />
      <div className="absolute bottom-5 left-6 max-w-[60%] truncate rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/75">
        창밖 · <b className="font-semibold text-white">{destination.ko}</b> —{" "}
        {destination.fact}
      </div>
      <button
        type="button"
        onClick={onCockpit}
        className="pointer-events-auto absolute right-6 bottom-5 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/75 hover:text-white"
      >
        ▲ 위로 밀면 조종석
      </button>
    </div>
  );
}

function OuterStars() {
  let a = 42;
  const rand = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  const stars = Array.from({ length: 70 }, (_, i) => ({
    i,
    x: rand() * 100,
    y: rand() * 100,
    r: rand() < 0.1 ? 2 : 1,
    o: 0.3 + rand() * 0.6,
  }));
  return (
    <>
      {stars.map((s) => (
        <span
          key={s.i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            opacity: s.o,
          }}
        />
      ))}
    </>
  );
}
