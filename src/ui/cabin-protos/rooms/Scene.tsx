// 방 안의 바탕 그림: 천장 등, 문과 문 위 등, 바닥, 상태별 가구.
// 공사중은 책상·켜진 화면·공구함, 완공은 정돈된 선반과 화분, 막힘은 경광등과 멈춘 톱니,
// 안개는 덮개 씌운 가구 윤곽, 버림은 판자. 방 크기 그대로(px)를 viewBox로 써서 찌그러지지 않는다.
import type { RegionStatus } from "@/protocol/map";
import styles from "./rooms.module.css";

const DOOR_LAMP: Partial<Record<RegionStatus, string>> = {
  building: "#ffcf5c",
  done: "#5ee08a",
  blocked: "#ff6b6b",
};

export function Scene({
  w,
  h,
  status,
  here,
  /** 동물이 문 앞에 서 있어 가구를 왼쪽으로 몬다 */
  occupied,
}: {
  w: number;
  h: number;
  status: RegionStatus;
  here: boolean;
  occupied: boolean;
}) {
  if (w < 8 || h < 8) return null;
  const floor = h - 4;
  const doorW = w >= 70 ? 9 : 0;
  const doorH = Math.min(46, Math.max(16, h * 0.5));
  const doorX = w - doorW - 4;
  const lamp = DOOR_LAMP[status];
  // 가구를 놓을 너비: 문과 동물 자리를 뺀다
  const room = w - doorW - 8 - (occupied ? Math.min(60, w * 0.42) : 0);
  const unit = Math.max(0, Math.min(1.15, (h - 40) / 46));
  const lx = Math.max(10, w * 0.38);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      {/* 바닥 */}
      <rect x={0} y={floor} width={w} height={4} fill="#2b3243" />

      {/* 천장 등 */}
      {status === "building" || here ? (
        <g className={styles.lamp}>
          <path
            d={`M${lx - 5},4 L${lx + 5},4 L${lx + 30},${floor} L${lx - 30},${floor} Z`}
            fill={here ? "#fff3c4" : "#ffd36a"}
            opacity={here ? 0.16 : 0.1}
          />
          <rect
            x={lx - 7}
            y={0}
            width={14}
            height={4}
            rx={1.5}
            fill={here ? "#fff7da" : "#ffcf5c"}
          />
        </g>
      ) : status === "done" ? (
        <rect
          x={lx - 8}
          y={0}
          width={16}
          height={3}
          rx={1.5}
          fill="#e9fff1"
          opacity={0.7}
        />
      ) : status === "blocked" ? (
        <g>
          <circle
            className={styles.beacon}
            cx={w / 2}
            cy={5}
            r={9}
            fill="#ff4d4d"
            opacity={0.35}
          />
          <rect
            x={w / 2 - 4}
            y={0}
            width={8}
            height={7}
            rx={3}
            fill="#ff6b6b"
          />
        </g>
      ) : null}

      {/* 문과 문 위 등 */}
      {doorW > 0 && (
        <g>
          <rect
            x={doorX}
            y={floor - doorH}
            width={doorW}
            height={doorH}
            rx={1.5}
            fill={status === "fog" ? "#161b26" : "#1b2130"}
            stroke={status === "fog" ? "#2c3446" : "#56607a"}
            strokeWidth={1}
          />
          <circle
            cx={doorX + doorW - 2.5}
            cy={floor - doorH / 2}
            r={0.9}
            fill="#8a94a8"
          />
          {lamp && (
            <>
              <circle
                cx={doorX + doorW / 2}
                cy={floor - doorH - 5}
                r={5}
                fill={lamp}
                opacity={0.25}
              />
              <circle
                cx={doorX + doorW / 2}
                cy={floor - doorH - 5}
                r={2.4}
                fill={lamp}
              />
            </>
          )}
          {status === "blocked" && (
            <g stroke="#ff6b6b" strokeWidth={2}>
              <path
                d={`M${doorX - 2},${floor - doorH * 0.7} l${doorW + 4},${doorH * 0.25}`}
              />
              <path
                d={`M${doorX - 2},${floor - doorH * 0.35} l${doorW + 4},${-doorH * 0.25}`}
              />
            </g>
          )}
        </g>
      )}

      {/* 가구 */}
      {unit > 0.15 && room > 24 && (
        <g transform={`translate(6 ${floor}) scale(${unit})`}>
          <Furniture status={status} room={room / unit} here={here} />
        </g>
      )}

      {/* 버림: 판자로 막는다 */}
      {status === "dropped" && (
        <g opacity={0.9}>
          {[0.25, 0.55, 0.8].map((t) => (
            <rect
              key={t}
              x={-10}
              y={h * t - 5}
              width={w + 20}
              height={9}
              fill="#4b4237"
              stroke="#2a241d"
              transform={`rotate(${t === 0.55 ? -8 : 6} ${w / 2} ${h * t})`}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/** 바닥(0) 위로 그린다. room은 쓸 수 있는 너비(축척 전) */
function Furniture({
  status,
  room,
  here,
}: {
  status: RegionStatus;
  room: number;
  here: boolean;
}) {
  const wide = room > 110;
  switch (status) {
    case "building":
      return (
        <g>
          {/* 책상과 켜진 화면 */}
          <rect x={0} y={-16} width={34} height={3} fill="#8a6d3d" />
          <rect x={3} y={-13} width={2} height={13} fill="#6b5430" />
          <rect x={29} y={-13} width={2} height={13} fill="#6b5430" />
          <rect x={8} y={-30} width={18} height={12} rx={1} fill="#20283a" />
          <rect
            className={here ? styles.screen : undefined}
            x={10}
            y={-28}
            width={14}
            height={8}
            fill="#7ce0ff"
            opacity={0.8}
          />
          {wide && (
            <g>
              {/* 공구함과 페인트 통 */}
              <rect x={44} y={-9} width={18} height={9} rx={1} fill="#d8573c" />
              <rect x={50} y={-12} width={6} height={3} fill="#a33f2a" />
              <rect
                x={68}
                y={-11}
                width={9}
                height={11}
                rx={1.5}
                fill="#e9d38a"
              />
              <rect x={68} y={-11} width={9} height={3} fill="#bfa95e" />
            </g>
          )}
        </g>
      );
    case "done":
      return (
        <g>
          {/* 정돈된 선반 */}
          <rect x={0} y={-34} width={30} height={2} fill="#7a8aa0" />
          <rect x={0} y={-18} width={30} height={2} fill="#7a8aa0" />
          <rect
            x={2}
            y={-44}
            width={8}
            height={10}
            fill="#5ee08a"
            opacity={0.75}
          />
          <rect
            x={12}
            y={-42}
            width={8}
            height={8}
            fill="#7ce0ff"
            opacity={0.7}
          />
          <rect
            x={22}
            y={-44}
            width={6}
            height={10}
            fill="#e9d38a"
            opacity={0.7}
          />
          <rect
            x={3}
            y={-27}
            width={10}
            height={9}
            fill="#9fb1c8"
            opacity={0.6}
          />
          <rect
            x={15}
            y={-27}
            width={12}
            height={9}
            fill="#9fb1c8"
            opacity={0.45}
          />
          {wide && (
            <g>
              {/* 화분 */}
              <path d="M46,0 L56,0 L58,-9 L44,-9 Z" fill="#b8734a" />
              <circle cx={51} cy={-15} r={6} fill="#4fbf74" />
              <circle cx={47} cy={-19} r={4} fill="#5ee08a" />
            </g>
          )}
        </g>
      );
    case "blocked":
      return (
        <g>
          {/* 테이프 붙은 상자와 멈춘 톱니 */}
          <rect x={0} y={-16} width={22} height={16} fill="#5a4a3a" />
          <path
            d="M0,-16 L22,0 M22,-16 L0,0"
            stroke="#ffcf5c"
            strokeWidth={2.5}
          />
          {wide && (
            <g transform="translate(40 -14)">
              <circle r={11} fill="#4a5162" />
              {[0, 45, 90, 135].map((a) => (
                <rect
                  key={a}
                  x={-2.5}
                  y={-14}
                  width={5}
                  height={28}
                  fill="#4a5162"
                  transform={`rotate(${a})`}
                />
              ))}
              <circle r={4} fill="#1e2330" />
            </g>
          )}
        </g>
      );
    case "fog":
      return (
        <g fill="rgb(160 172 196 / 0.08)" stroke="rgb(160 172 196 / 0.35)">
          {/* 덮개 씌운 가구 윤곽 */}
          <path
            d="M0,0 Q0,-14 6,-16 L34,-16 Q40,-14 40,0 Z"
            strokeDasharray="3 2"
          />
          {wide && (
            <path
              d="M50,0 L50,-28 Q50,-32 54,-32 L68,-32 Q72,-32 72,-28 L72,0 Z"
              strokeDasharray="3 2"
            />
          )}
        </g>
      );
    default:
      return null;
  }
}
