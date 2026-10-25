"use client";

// 항법 계기(왼쪽 위): 진짜 값만 작고 단정하게. 지금 목적지, 지구까지 거리, 교신 지연(빛 시간),
// 한국 시각, 보는 방향(적경·적위 / 황경·황위), 마우스가 가리키는 좌표.
// 이동 중엔 속도계(광속의 n배)와 남은 거리, 진행 막대가 끼어든다. 접으면 한 줄.
import { DESTINATION_BY_ID } from "@/sky/bodies";
import {
  formatDec,
  formatDistance,
  formatRA,
  formatSpeed,
} from "@/sky/telemetry";
import { useKoreaTime, useTelemetry } from "@/sky/useTelemetry";
import { useDestination, useVoyage } from "@/sky/voyage";
import styles from "./cockpit.module.css";
import { GLASS, LABEL, lightTime, usePersisted, VALUE } from "./ui";

const LIGHT_KM_S = 299_792.458;

const compact = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 한국 시각 "16:19:02" */
const SEOUL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** 0.1 AU보다 가까우면 km를 다 적고, 멀면 AU·광년으로 */
function dist(km: number): string {
  if (km < 14_959_787) return `${Math.round(km).toLocaleString("ko-KR")} km`;
  return formatDistance(km);
}

function signed(deg: number, digits = 2): string {
  return `${deg < 0 ? "−" : "+"}${Math.abs(deg).toFixed(digits)}°`;
}

function lon(deg: number): string {
  return `${(((deg % 360) + 360) % 360).toFixed(2)}°`;
}

export function NavInstrument({
  grid,
  onGrid,
}: {
  /** 적도 좌표 격자가 켜져 있나 */
  grid: boolean;
  onGrid: () => void;
}) {
  const t = useTelemetry();
  const { date } = useKoreaTime(); // 1초마다 다시 그려 준다
  const time = SEOUL.format(new Date());
  const dest = useDestination();
  const previousId = useVoyage((s) => s.previousId);
  const [ui, setUi] = usePersisted("open-bridge:nav", { folded: false });
  const atEarth = dest.id === "earth" && !t.traveling;
  const from = previousId ? DESTINATION_BY_ID.get(previousId) : undefined;

  if (ui.folded) {
    return (
      <section
        aria-label="항법 계기"
        className={`${GLASS} flex items-center gap-2.5 px-3 py-1.5`}
      >
        <span className="text-[12px] font-medium text-white/90">
          {t.traveling ? `→ ${dest.ko}` : dest.ko}
        </span>
        <span className={`${VALUE} text-white/60`}>{dist(t.earthKm)}</span>
        <span className={`${VALUE} text-white/60`}>
          ⟷ {lightTime(t.earthKm)}
        </span>
        {t.traveling && (
          <span className={`${VALUE} text-[#9fe3ff]`}>
            {formatSpeed(t.speedKmS)}
          </span>
        )}
        <span className={`${VALUE} text-white/60`} suppressHydrationWarning>
          {time.slice(0, 5)}
        </span>
        <button
          type="button"
          onClick={() => setUi({ folded: false })}
          aria-label="항법 계기 펼치기"
          className="ml-0.5 rounded px-1 text-[11px] text-white/45 hover:bg-white/10 hover:text-white"
        >
          ▾
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="항법 계기"
      className={`${GLASS} w-[264px] px-3.5 py-3`}
    >
      {/* 목적지 */}
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className={LABEL}>{t.traveling ? "이동 중" : "현재 위치"}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-white">
            {t.traveling && from ? (
              <>
                <span className="font-normal text-white/45">{from.ko} → </span>
                {dest.ko}
              </>
            ) : (
              dest.ko
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setUi({ folded: true })}
          aria-label="항법 계기 접기"
          title="한 줄로 접기"
          className="-mt-0.5 -mr-1 rounded px-1.5 py-0.5 text-[12px] text-white/55 hover:bg-white/10 hover:text-white"
        >
          ▴
        </button>
      </header>
      {!t.traveling && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/45">
          {dest.fact}
        </p>
      )}

      {t.traveling && (
        <Speedometer
          speedKmS={t.speedKmS}
          remainingKm={t.remainingKm}
          progress={t.progress}
        />
      )}

      <dl className="mt-2.5 grid grid-cols-[64px_1fr] gap-x-2 gap-y-[5px] border-t border-white/[0.07] pt-2.5">
        <Row label={atEarth ? "지구 고도" : "지구까지"}>{dist(t.earthKm)}</Row>
        {t.altitudeKm !== null && !atEarth && (
          <Row label={`${dest.ko} 고도`}>{dist(t.altitudeKm)}</Row>
        )}
        <Row label="교신 지연" title="지구까지 빛이 가는 시간(편도)">
          {lightTime(t.earthKm)}
          <span className="ml-1 text-white/35">편도</span>
        </Row>
        <Row label="한국 시각">
          <span suppressHydrationWarning>{time}</span>
          <span
            className="ml-1.5 font-sans text-white/45"
            suppressHydrationWarning
          >
            {date}
          </span>
        </Row>
      </dl>

      <dl className="mt-2.5 grid grid-cols-[64px_1fr] gap-x-2 gap-y-[5px] border-t border-white/[0.07] pt-2.5">
        <Row label="시선 적경">{formatRA(t.view.ra)}</Row>
        <Row label="적위">{formatDec(t.view.dec)}</Row>
        <Row label="황경 · 황위">
          {lon(t.view.lon)} {signed(t.view.lat)}
        </Row>
        <Row label="가리킨 곳" dim={!t.cursor}>
          {t.cursor
            ? `${formatRA(t.cursor.ra)} ${formatDec(t.cursor.dec)}`
            : "하늘 위에 올려 보세요"}
        </Row>
      </dl>
      <button
        type="button"
        onClick={onGrid}
        aria-pressed={grid}
        className="mt-2 w-full rounded-md border border-white/10 px-2 py-1 text-left text-[11px] text-white/60 hover:border-white/25 hover:text-white"
      >
        <span
          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ background: grid ? "#5fd4c4" : "rgba(255,255,255,.25)" }}
        />
        적도 좌표 격자 {grid ? "끄기" : "켜기"}
        <span className="ml-1 text-white/35">(적경 2시간 · 적위 15°)</span>
      </button>
    </section>
  );
}

function Row({
  label,
  title,
  dim,
  children,
}: {
  label: string;
  title?: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className={`${LABEL} self-baseline whitespace-nowrap`} title={title}>
        {label}
      </dt>
      <dd
        className={`${VALUE} self-baseline truncate ${dim ? "font-sans text-[10.5px] text-white/30" : ""}`}
      >
        {children}
      </dd>
    </>
  );
}

/** 속도계: 광속 배수를 로그 눈금(1c ~ 10⁸c) 반원 위에 바늘로, 옆에 글로 */
function Speedometer({
  speedKmS,
  remainingKm,
  progress,
}: {
  speedKmS: number;
  remainingKm: number;
  progress: number;
}) {
  const c = speedKmS / LIGHT_KM_S;
  const v = Math.max(0, Math.min(1, Math.log10(Math.max(c, 1)) / 8));
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const tickLabel = ["1", "10²", "10⁴", "10⁶", "10⁸"];
  return (
    <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 100 62" className="h-[74px] w-[120px] shrink-0">
          <title>속도계</title>
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="1.2"
          />
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            stroke="#9fe3ff"
            strokeWidth="2.2"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${v} 1`}
            style={{ transition: "stroke-dasharray 260ms ease-out" }}
          />
          {ticks.map((i) => {
            const a = Math.PI - (Math.PI * i) / 8;
            const r1 = i % 2 ? 36 : 33;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * r1}
                y1={50 - Math.sin(a) * r1}
                x2={50 + Math.cos(a) * 38}
                y2={50 - Math.sin(a) * 38}
                stroke="rgba(255,255,255,.35)"
                strokeWidth="0.8"
              />
            );
          })}
          {ticks
            .filter((i) => i % 2 === 0)
            .map((i) => {
              const a = Math.PI - (Math.PI * i) / 8;
              return (
                <text
                  key={i}
                  x={50 + Math.cos(a) * 25}
                  y={50 - Math.sin(a) * 25 + 2}
                  fontSize="7"
                  textAnchor="middle"
                  fill="rgba(255,255,255,.4)"
                  fontFamily="ui-monospace, SF Mono, monospace"
                >
                  {tickLabel[i / 2]}
                </text>
              );
            })}
          <g
            className={styles.needle}
            style={{ transform: `rotate(${-90 + 180 * v}deg)` }}
          >
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="14"
              stroke="#fff"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
          <circle cx="50" cy="50" r="2.2" fill="#fff" />
          <text
            x="50"
            y="60.5"
            fontSize="5.5"
            textAnchor="middle"
            fill="rgba(255,255,255,.35)"
          >
            × 광속
          </text>
        </svg>
        <div className="min-w-0">
          <div className={LABEL}>속도</div>
          <div className="font-mono text-[15px] font-medium tabular-nums text-[#c9f1ff]">
            {formatSpeed(speedKmS)}
          </div>
          <div className="font-mono text-[10.5px] tabular-nums text-white/45">
            {compact.format(Math.round(speedKmS))} km/s
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={LABEL}>남은 거리</span>
        <span className={VALUE}>{dist(remainingKm)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#9fe3ff]"
            style={{
              width: `${Math.round(progress * 100)}%`,
              transition: "width 200ms linear",
            }}
          />
        </div>
        <span className={`${VALUE} w-8 text-right text-white/55`}>
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}
