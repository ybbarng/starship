// 선원이 아닌 줄 손님 그림: 다른 배에서 온 방문객(출처별 우주복 색)과 배의 알림 로봇.
// 가로:세로 = 1:1.25 로 Animal과 크기를 맞춘다.
import type { SourceKind } from "@/protocol/v1";

export const SUIT: Record<
  SourceKind,
  { suit: string; dark: string; label: string }
> = {
  chat: { suit: "#b58cff", dark: "#7a52c9", label: "채팅" },
  issue: { suit: "#7f8fff", dark: "#4b58c4", label: "이슈" },
  review: { suit: "#5d6475", dark: "#343947", label: "리뷰" },
  doc: { suit: "#5fb4ff", dark: "#2f78c0", label: "문서" },
  session: { suit: "#9aa3b5", dark: "#626b7d", label: "세션" },
  reminder: { suit: "#ffd36b", dark: "#c99a2c", label: "날짜" },
  monitor: { suit: "#ff8a7a", dark: "#c4534a", label: "점검" },
};

export function Visitor({
  source,
  service,
  size,
  pose,
}: {
  source: SourceKind;
  service?: string;
  size: number;
  pose: "wave" | "walk";
}) {
  const c = SUIT[source];
  const letter = (service ?? c.label).slice(0, 1);
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 80 100"
      role="img"
      aria-label={`${service ?? c.label}에서 온 방문객`}
      className={pose === "walk" ? "tr-bob-fast" : "tr-bob"}
    >
      {/* 깃발 */}
      <g className={pose === "wave" ? "tr-flag" : undefined}>
        <line
          x1="66"
          y1="30"
          x2="66"
          y2="86"
          stroke="#c9d2e6"
          strokeWidth="2"
        />
        <path d="M66 30 L79 34 L66 40 Z" fill={c.suit} stroke={c.dark} />
        <text
          x="70"
          y="37.5"
          fontSize="6"
          textAnchor="middle"
          fill="#fff"
          fontWeight="700"
        >
          {letter}
        </text>
      </g>
      {/* 다리 */}
      <g className={pose === "walk" ? "tr-legs" : undefined}>
        <rect x="27" y="78" width="10" height="16" rx="4" fill={c.dark} />
        <rect x="43" y="78" width="10" height="16" rx="4" fill={c.dark} />
        <rect x="25" y="90" width="14" height="7" rx="3.5" fill="#e9edf5" />
        <rect x="41" y="90" width="14" height="7" rx="3.5" fill="#e9edf5" />
      </g>
      {/* 등짐 */}
      <rect x="18" y="50" width="44" height="26" rx="8" fill="#d8deea" />
      {/* 몸통 */}
      <rect x="22" y="48" width="36" height="36" rx="12" fill={c.suit} />
      <rect x="32" y="58" width="16" height="10" rx="3" fill="#1c2233" />
      <circle cx="36" cy="63" r="1.6" fill="#5ee08a" />
      <circle cx="41" cy="63" r="1.6" fill="#ffcf5c" />
      {/* 팔: 오른팔은 손 흔들기 */}
      <rect x="13" y="54" width="10" height="22" rx="5" fill={c.suit} />
      <g
        className={pose === "wave" ? "tr-wave" : undefined}
        style={{ transformOrigin: "60px 56px" }}
      >
        <rect
          x="55"
          y="34"
          width="10"
          height="24"
          rx="5"
          fill={c.suit}
          transform="rotate(18 60 56)"
        />
        <circle cx="66" cy="34" r="5.5" fill="#e9edf5" />
      </g>
      {/* 헬멧 */}
      <circle cx="40" cy="30" r="22" fill="#e9edf5" />
      <circle
        cx="40"
        cy="31"
        r="17"
        fill="#1a2440"
        stroke={c.dark}
        strokeWidth="2"
      />
      {/* 얼굴(지어낸 외계 손님: 둥근 초록 얼굴, 큰 눈) */}
      <ellipse cx="40" cy="33" rx="12" ry="11" fill="#9fe3b0" />
      <ellipse cx="35" cy="31" rx="2.6" ry="3.2" fill="#13202e" />
      <ellipse cx="45" cy="31" rx="2.6" ry="3.2" fill="#13202e" />
      <circle cx="35.8" cy="30" r="0.9" fill="#fff" />
      <circle cx="45.8" cy="30" r="0.9" fill="#fff" />
      <path
        d="M36 38 Q40 41 44 38"
        stroke="#13202e"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M27 22 Q33 15 42 15"
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 안테나 */}
      <line x1="40" y1="8" x2="40" y2="2" stroke="#c9d2e6" strokeWidth="2" />
      <circle cx="40" cy="2.5" r="2.5" fill={c.suit} className="tr-blink" />
    </svg>
  );
}

export function Robot({ source, size }: { source: SourceKind; size: number }) {
  const c = SUIT[source];
  const alert = source === "monitor";
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 80 100"
      role="img"
      aria-label={alert ? "점검 로봇" : "날짜 알림 로봇"}
      className="tr-bob"
    >
      <ellipse cx="40" cy="96" rx="20" ry="3" fill="#000" opacity="0.35" />
      {/* 바퀴 */}
      <rect x="22" y="84" width="36" height="10" rx="5" fill="#3a4258" />
      <circle cx="29" cy="89" r="3" fill="#8b93a8" />
      <circle cx="51" cy="89" r="3" fill="#8b93a8" />
      {/* 몸 */}
      <rect x="20" y="52" width="40" height="34" rx="8" fill="#c9d0de" />
      <rect x="26" y="60" width="28" height="6" rx="3" fill={c.suit} />
      <rect x="26" y="70" width="18" height="4" rx="2" fill="#8b93a8" />
      {/* 팔 */}
      <rect x="10" y="58" width="10" height="5" rx="2.5" fill="#8b93a8" />
      <g className="tr-wave" style={{ transformOrigin: "60px 60px" }}>
        <rect x="60" y="50" width="5" height="14" rx="2.5" fill="#8b93a8" />
        <circle cx="62.5" cy="48" r="4" fill="#c9d0de" />
      </g>
      {/* 머리 화면 */}
      <rect x="16" y="14" width="48" height="36" rx="9" fill="#c9d0de" />
      <rect x="21" y="19" width="38" height="26" rx="6" fill="#141b2f" />
      {alert ? (
        <g className="tr-blink">
          <path d="M40 23 L50 40 L30 40 Z" fill={c.suit} />
          <rect x="39" y="28" width="2" height="7" fill="#141b2f" />
          <rect x="39" y="36.5" width="2" height="2" fill="#141b2f" />
        </g>
      ) : (
        <g>
          <rect x="30" y="24" width="20" height="17" rx="2" fill="#fff" />
          <rect x="30" y="24" width="20" height="5" rx="2" fill={c.suit} />
          <text
            x="40"
            y="39"
            fontSize="9"
            textAnchor="middle"
            fill="#141b2f"
            fontWeight="700"
          >
            18
          </text>
        </g>
      )}
      <line x1="40" y1="14" x2="40" y2="6" stroke="#8b93a8" strokeWidth="2" />
      <circle cx="40" cy="5" r="3" fill={c.suit} className="tr-blink" />
    </svg>
  );
}

/** 이 시안 전용 움직임. 루트에서 한 번 넣는다. */
export const FIGURE_CSS = `
@keyframes tr-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes tr-bob-fast { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes tr-wave { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-22deg) } }
@keyframes tr-flag { 0%,100% { transform: skewY(0deg) } 50% { transform: skewY(-6deg) } }
@keyframes tr-blink { 0%,60%,100% { opacity: 1 } 70%,90% { opacity: .25 } }
@keyframes tr-legs { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes tr-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes tr-pop { 0% { opacity: 0; transform: scale(.92) translateY(8px) } 100% { opacity: 1; transform: none } }
@keyframes tr-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,207,92,.0) } 50% { box-shadow: 0 0 18px 2px rgba(255,207,92,.45) } }
@keyframes tr-warp-in { 0% { opacity: 0; transform: translate(-50%, 10px) scale(.9) } 12% { opacity: 1; transform: translate(-50%, 0) scale(1) } 82% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -6px) } }
@keyframes tr-cell { 0% { transform: scale(1) } 40% { transform: scale(1.25) } 100% { transform: scale(1) } }
@keyframes tr-dash { to { stroke-dashoffset: -20 } }
.tr-bob { animation: tr-bob 2.4s ease-in-out infinite; }
.tr-bob-fast { animation: tr-bob-fast .45s ease-in-out infinite; }
.tr-wave { animation: tr-wave .9s ease-in-out infinite; }
.tr-flag { animation: tr-flag 1.6s ease-in-out infinite; transform-origin: 66px 34px; }
.tr-blink { animation: tr-blink 2.2s linear infinite; }
.tr-legs { animation: tr-legs .45s ease-in-out infinite; }
.tr-rise { animation: tr-rise .5s cubic-bezier(.2,.8,.2,1) both; }
.tr-pop { animation: tr-pop .28s cubic-bezier(.2,.8,.2,1) both; }
.tr-glow { animation: tr-glow 2s ease-in-out infinite; }
.tr-cell-hit { animation: tr-cell .9s ease-out; }
.tr-dash { animation: tr-dash 1s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .tr-bob, .tr-bob-fast, .tr-wave, .tr-flag, .tr-blink, .tr-legs, .tr-glow, .tr-dash { animation: none; }
}
`;
