import type { CSSProperties, ReactNode } from "react";
import styles from "./Animal.module.css";

export const ANIMAL_KINDS = [
  "cat",
  "dog",
  "otter",
  "penguin",
  "owl",
  "rabbit",
  "fox",
  "bear",
  "hamster",
  "raccoon",
] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

export const POSES = ["work", "wave", "sleep", "walk", "stand", "off"] as const;
export type Pose = (typeof POSES)[number];

export type AnimalContext = "work" | "personal";

const ACCENT: Record<AnimalContext, string> = {
  work: "#6cb6ff",
  personal: "#ffb86c",
};

type Ear = "pointy" | "floppy" | "round" | "long" | "tufts" | "tiny" | "none";
type Tail = "cat" | "fox" | "raccoon" | "dog" | "otter" | "none";
type Face =
  | "cat"
  | "muzzle"
  | "penguin"
  | "owl"
  | "fox"
  | "hamster"
  | "raccoon"
  | "plain";

interface Spec {
  /** 화면에 읽어 줄 이름 */
  name: string;
  fur: string;
  /** 귀 끝·줄무늬처럼 진한 부분 */
  dark: string;
  /** 주둥이·얼굴 밝은 부분 */
  light: string;
  /** 귓속 */
  inner: string;
  nose: string;
  ear: Ear;
  tail: Tail;
  face: Face;
  /** 머리 가로·세로 반지름 */
  rx: number;
  ry: number;
}

const SPECS: Record<AnimalKind, Spec> = {
  cat: {
    name: "고양이",
    fur: "#f3b867",
    dark: "#c9803a",
    light: "#fde6c4",
    inner: "#ffa5b4",
    nose: "#e2667e",
    ear: "pointy",
    tail: "cat",
    face: "cat",
    rx: 34,
    ry: 32,
  },
  dog: {
    name: "강아지",
    fur: "#d9a46c",
    dark: "#8c5a34",
    light: "#f7e3c8",
    inner: "#8c5a34",
    nose: "#2a2230",
    ear: "floppy",
    tail: "dog",
    face: "muzzle",
    rx: 33,
    ry: 32,
  },
  otter: {
    name: "수달",
    fur: "#9b7253",
    dark: "#6e4e38",
    light: "#efd9b9",
    inner: "#6e4e38",
    nose: "#2a2230",
    ear: "tiny",
    tail: "otter",
    face: "muzzle",
    rx: 34,
    ry: 30,
  },
  penguin: {
    name: "펭귄",
    fur: "#46557a",
    dark: "#2e3a57",
    light: "#f6f7fb",
    inner: "#46557a",
    nose: "#ffaf45",
    ear: "none",
    tail: "none",
    face: "penguin",
    rx: 33,
    ry: 33,
  },
  owl: {
    name: "부엉이",
    fur: "#a07a58",
    dark: "#6f5139",
    light: "#f4e2c6",
    inner: "#6f5139",
    nose: "#f2a33c",
    ear: "tufts",
    tail: "none",
    face: "owl",
    rx: 35,
    ry: 32,
  },
  rabbit: {
    name: "토끼",
    fur: "#f2eee8",
    dark: "#cfc6bb",
    light: "#ffffff",
    inner: "#ffb3c1",
    nose: "#ef8aa0",
    ear: "long",
    tail: "none",
    face: "plain",
    rx: 32,
    ry: 30,
  },
  fox: {
    name: "여우",
    fur: "#f08a4b",
    dark: "#5b3a2e",
    light: "#fff4e8",
    inner: "#ffd0b0",
    nose: "#2a2230",
    ear: "pointy",
    tail: "fox",
    face: "fox",
    rx: 34,
    ry: 31,
  },
  bear: {
    name: "곰",
    fur: "#a8784f",
    dark: "#7a5434",
    light: "#ead0aa",
    inner: "#e0b48a",
    nose: "#2a2230",
    ear: "round",
    tail: "none",
    face: "muzzle",
    rx: 34,
    ry: 32,
  },
  hamster: {
    name: "햄스터",
    fur: "#f2b56f",
    dark: "#d38f48",
    light: "#fff4e3",
    inner: "#ffb3c1",
    nose: "#ef8aa0",
    ear: "tiny",
    tail: "none",
    face: "hamster",
    rx: 37,
    ry: 31,
  },
  raccoon: {
    name: "너구리",
    fur: "#a3a3b1",
    dark: "#3d3f4d",
    light: "#f1f1f5",
    inner: "#3d3f4d",
    nose: "#2a2230",
    ear: "round",
    tail: "raccoon",
    face: "raccoon",
    rx: 34,
    ry: 31,
  },
};

const POSE_LABEL: Record<Pose, string> = {
  work: "일하는 중",
  wave: "손을 흔들며 부르는 중",
  sleep: "자는 중",
  walk: "걷는 중",
  stand: "서 있음",
  off: "자리 비움",
};

const INK = "#1f2030";
const CHEEK = "#ff8fa3";
const BOOT = "#3a4258";
const CHAIR = "#353d55";
const CHAIR_EDGE = "#46506d";
const DESK_TOP = "#76809b";
const DESK_FRONT = "#4a5370";

export interface AnimalProps {
  kind: AnimalKind;
  pose: Pose;
  /** 가로 픽셀. 세로는 1.25배. 기본 64. */
  size?: number;
  context?: AnimalContext;
  /** 읽어 줄 이름. 없으면 "고양이 선원, 일하는 중"처럼 만든다. */
  label?: string;
  className?: string;
  /** work·off 자세에서 책상과 의자를 그린다. 기본 true. */
  furniture?: boolean;
}

/** 같은 그림이 동시에 같은 박자로 움직이지 않게 이름으로 시작점을 흩는다. */
function phaseOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `${-((Math.abs(h) % 1000) / 1000) * 3}s`;
}

const at = (x: number, y: number): CSSProperties => ({
  transformOrigin: `${x}px ${y}px`,
});

export function Animal({
  kind,
  pose,
  size = 64,
  context = "work",
  label,
  className,
  furniture = true,
}: AnimalProps) {
  const s = SPECS[kind];
  const text = label ?? `${s.name} 선원, ${POSE_LABEL[pose]}`;
  const style = {
    "--accent": ACCENT[context],
    "--phase": phaseOf(`${label ?? ""}${kind}${pose}`),
  } as CSSProperties;

  let body: ReactNode;
  switch (pose) {
    case "work":
      body = <WorkPose s={s} furniture={furniture} />;
      break;
    case "wave":
      body = <WavePose s={s} />;
      break;
    case "sleep":
      body = <SleepPose s={s} />;
      break;
    case "walk":
      body = <WalkPose s={s} />;
      break;
    case "stand":
      body = <StandPose s={s} />;
      break;
    case "off":
      body = <OffPose s={s} furniture={furniture} />;
      break;
  }

  return (
    <svg
      viewBox="0 0 160 200"
      width={size}
      height={size * 1.25}
      role="img"
      aria-label={text}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
    >
      <title>{text}</title>
      {body}
    </svg>
  );
}

/* ───────── 머리 ───────── */

type Eyes = "open" | "down" | "closed";
type Mouth = "smile" | "open" | "sleep";

function Head({
  s,
  x,
  y,
  eyes,
  mouth,
  lookX = 0,
  headset = true,
}: {
  s: Spec;
  x: number;
  y: number;
  eyes: Eyes;
  mouth: Mouth;
  lookX?: number;
  headset?: boolean;
}) {
  const dy = eyes === "down" ? 4 : 0;
  const fx = x + lookX;
  const fy = y + dy;
  return (
    <g>
      <EarsBack s={s} x={x} y={y} />
      <ellipse cx={x} cy={y} rx={s.rx} ry={s.ry} fill={s.fur} />
      <FacePatch s={s} x={fx} y={fy} />
      <EarsFront s={s} x={x} y={y} />
      {headset && <Headset s={s} x={x} y={y} />}
      <EyePair s={s} x={fx} y={fy} eyes={eyes} />
      <ellipse
        cx={fx - 22}
        cy={fy + 13}
        rx={6}
        ry={3.8}
        fill={CHEEK}
        opacity={0.6}
      />
      <ellipse
        cx={fx + 22}
        cy={fy + 13}
        rx={6}
        ry={3.8}
        fill={CHEEK}
        opacity={0.6}
      />
      <NoseMouth s={s} x={fx} y={fy} mouth={mouth} />
    </g>
  );
}

function EarsBack({ s, x, y }: { s: Spec; x: number; y: number }) {
  switch (s.ear) {
    case "pointy":
      return (
        <g strokeLinejoin="round">
          {[-1, 1].map((d) => (
            <g key={d}>
              <path
                d={`M${x + d * 30} ${y - 8} L${x + d * 25} ${y - 44} L${x + d * 6} ${y - 28} Z`}
                fill={s.fur}
                stroke={s.fur}
                strokeWidth={6}
              />
              <path
                d={`M${x + d * 25} ${y - 14} L${x + d * 23} ${y - 36} L${x + d * 11} ${y - 26} Z`}
                fill={s.inner}
              />
              {s.face === "fox" && (
                <path
                  d={`M${x + d * 27.5} ${y - 33} L${x + d * 25} ${y - 44} L${x + d * 18} ${y - 38} Z`}
                  fill={s.dark}
                  stroke={s.dark}
                  strokeWidth={4}
                  strokeLinejoin="round"
                />
              )}
            </g>
          ))}
        </g>
      );
    case "round":
      return (
        <g>
          {[-1, 1].map((d) => (
            <g key={d}>
              <circle cx={x + d * 25} cy={y - 24} r={12} fill={s.fur} />
              <circle cx={x + d * 25} cy={y - 24} r={6.5} fill={s.inner} />
            </g>
          ))}
        </g>
      );
    case "tiny":
      return (
        <g>
          {[-1, 1].map((d) => (
            <g key={d}>
              <circle cx={x + d * 24} cy={y - 24} r={9} fill={s.fur} />
              <circle cx={x + d * 24} cy={y - 24} r={4.5} fill={s.inner} />
            </g>
          ))}
        </g>
      );
    case "long":
      return (
        <g>
          {[-1, 1].map((d) => (
            <g key={d} transform={`rotate(${d * 9} ${x + d * 13} ${y - 26})`}>
              <ellipse
                cx={x + d * 13}
                cy={y - 46}
                rx={9.5}
                ry={22}
                fill={s.fur}
              />
              <ellipse
                cx={x + d * 13}
                cy={y - 44}
                rx={4.5}
                ry={15}
                fill={s.inner}
              />
            </g>
          ))}
        </g>
      );
    case "tufts":
      return (
        <g strokeLinejoin="round">
          {[-1, 1].map((d) => (
            <path
              key={d}
              d={`M${x + d * 30} ${y - 12} L${x + d * 30} ${y - 38} L${x + d * 12} ${y - 28} Z`}
              fill={s.dark}
              stroke={s.dark}
              strokeWidth={5}
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function EarsFront({ s, x, y }: { s: Spec; x: number; y: number }) {
  if (s.ear !== "floppy") return null;
  return (
    <g>
      {[-1, 1].map((d) => (
        <ellipse
          key={d}
          cx={x + d * 31}
          cy={y - 2}
          rx={10}
          ry={21}
          fill={s.dark}
          transform={`rotate(${d * -18} ${x + d * 31} ${y - 18})`}
        />
      ))}
    </g>
  );
}

function FacePatch({ s, x, y }: { s: Spec; x: number; y: number }) {
  switch (s.face) {
    case "cat":
      return (
        <g stroke={s.dark} strokeWidth={3} strokeLinecap="round">
          <line x1={x} y1={y - 30} x2={x} y2={y - 21} />
          <line x1={x - 8} y1={y - 29} x2={x - 7} y2={y - 22} />
          <line x1={x + 8} y1={y - 29} x2={x + 7} y2={y - 22} />
        </g>
      );
    case "muzzle":
      return <ellipse cx={x} cy={y + 13} rx={15} ry={11} fill={s.light} />;
    case "penguin":
      return (
        <g fill={s.light}>
          <circle cx={x - 11} cy={y + 3} r={16} />
          <circle cx={x + 11} cy={y + 3} r={16} />
          <ellipse cx={x} cy={y + 14} rx={22} ry={14} />
        </g>
      );
    case "owl":
      return (
        <g fill={s.light}>
          <circle cx={x - 13} cy={y + 1} r={14} />
          <circle cx={x + 13} cy={y + 1} r={14} />
        </g>
      );
    case "fox":
      return (
        <g fill={s.light}>
          <ellipse cx={x - 13} cy={y + 14} rx={16} ry={12} />
          <ellipse cx={x + 13} cy={y + 14} rx={16} ry={12} />
        </g>
      );
    case "hamster":
      return (
        <g fill={s.light}>
          <ellipse cx={x - 20} cy={y + 13} rx={14} ry={11} />
          <ellipse cx={x + 20} cy={y + 13} rx={14} ry={11} />
          <ellipse cx={x} cy={y + 14} rx={11} ry={9} />
        </g>
      );
    case "raccoon":
      return (
        <g>
          <ellipse cx={x} cy={y + 14} rx={15} ry={10} fill={s.light} />
          <ellipse
            cx={x - 13}
            cy={y + 2}
            rx={13}
            ry={9}
            fill={s.dark}
            transform={`rotate(-14 ${x - 13} ${y + 2})`}
          />
          <ellipse
            cx={x + 13}
            cy={y + 2}
            rx={13}
            ry={9}
            fill={s.dark}
            transform={`rotate(14 ${x + 13} ${y + 2})`}
          />
          <ellipse
            cx={x}
            cy={y - 13}
            rx={5}
            ry={7}
            fill={s.light}
            opacity={0.7}
          />
        </g>
      );
    default:
      return null;
  }
}

function EyePair({
  s,
  x,
  y,
  eyes,
}: {
  s: Spec;
  x: number;
  y: number;
  eyes: Eyes;
}) {
  const big = s.face === "owl" ? 1.3 : 1;
  const gap = s.face === "owl" ? 13 : 12;
  if (eyes === "closed") {
    return (
      <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <path
          d={`M${x - gap - 5} ${y + 1} Q${x - gap} ${y + 5} ${x - gap + 5} ${y + 1}`}
        />
        <path
          d={`M${x + gap - 5} ${y + 1} Q${x + gap} ${y + 5} ${x + gap + 5} ${y + 1}`}
        />
      </g>
    );
  }
  const ry = eyes === "down" ? 4 : 6.2;
  const ring = s.face === "raccoon" || s.face === "penguin";
  return (
    <g className={styles.blink}>
      {[-1, 1].map((d) => (
        <g key={d}>
          {ring && (
            <circle cx={x + d * gap} cy={y + 1} r={7.6} fill="#ffffff" />
          )}
          <ellipse
            cx={x + d * gap}
            cy={y + 1}
            rx={5.2 * big}
            ry={ry * big}
            fill={INK}
          />
          {eyes === "open" && (
            <>
              <circle
                cx={x + d * gap + 1.8 * big}
                cy={y - 1.6 * big}
                r={2.1 * big}
                fill="#fff"
              />
              <circle
                cx={x + d * gap - 1.6 * big}
                cy={y + 3 * big}
                r={1}
                fill="#fff"
                opacity={0.8}
              />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

function NoseMouth({
  s,
  x,
  y,
  mouth,
}: {
  s: Spec;
  x: number;
  y: number;
  mouth: Mouth;
}) {
  const beak = s.face === "penguin" || s.face === "owl";
  if (beak) {
    return (
      <g>
        {mouth === "open" ? (
          <>
            <path
              d={`M${x - 6} ${y + 9} L${x + 6} ${y + 9} L${x} ${y + 15} Z`}
              fill={s.nose}
            />
            <path
              d={`M${x - 5} ${y + 16} L${x + 5} ${y + 16} L${x} ${y + 21} Z`}
              fill={s.nose}
            />
          </>
        ) : (
          <path
            d={`M${x - 6} ${y + 9} L${x + 6} ${y + 9} L${x} ${y + 17} Z`}
            fill={s.nose}
            stroke={s.nose}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </g>
    );
  }
  return (
    <g>
      <path
        d={`M${x - 3.6} ${y + 9} L${x + 3.6} ${y + 9} L${x} ${y + 12.4} Z`}
        fill={s.nose}
        stroke={s.nose}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {mouth === "open" ? (
        <path
          d={`M${x - 6} ${y + 15} Q${x} ${y + 15.5} ${x + 6} ${y + 15} Q${x + 5} ${y + 24} ${x} ${y + 24} Q${x - 5} ${y + 24} ${x - 6} ${y + 15} Z`}
          fill="#7a2c3e"
        />
      ) : mouth === "sleep" ? (
        <ellipse
          cx={x}
          cy={y + 17}
          rx={2}
          ry={1.6}
          fill="#7a2c3e"
          opacity={0.7}
        />
      ) : (
        <path
          d={`M${x - 6} ${y + 14} Q${x - 3} ${y + 18} ${x} ${y + 14} Q${x + 3} ${y + 18} ${x + 6} ${y + 14}`}
          stroke={INK}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

function Headset({ s, x, y }: { s: Spec; x: number; y: number }) {
  const side = s.rx + 1;
  return (
    <g>
      <path
        d={`M${x - side} ${y - 2} Q${x - side} ${y - s.ry - 12} ${x} ${y - s.ry - 6} Q${x + side} ${y - s.ry - 12} ${x + side} ${y - 2}`}
        fill="none"
        stroke="#cfd6e4"
        strokeWidth={3.2}
      />
      <rect
        x={x - side - 5}
        y={y - 9}
        width={9}
        height={16}
        rx={4}
        fill="#5a6482"
      />
      <rect
        x={x + side - 4}
        y={y - 9}
        width={9}
        height={16}
        rx={4}
        fill="#5a6482"
      />
      <path
        d={`M${x - side} ${y + 6} Q${x - side + 2} ${y + 22} ${x - 14} ${y + 22}`}
        fill="none"
        stroke="#5a6482"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <circle cx={x - 13} cy={y + 22} r={3} className={styles.glow} />
    </g>
  );
}

/* ───────── 몸 ───────── */

function Suit({
  cx,
  cy,
  rx,
  ry,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className={styles.suit} />
      <ellipse
        cx={cx + rx * 0.35}
        cy={cy + ry * 0.2}
        rx={rx * 0.55}
        ry={ry * 0.7}
        className={styles.suitShade}
        opacity={0.35}
      />
      {/* 흰 옷깃 */}
      <path
        d={`M${cx - 16} ${cy - ry + 6} L${cx} ${cy - ry + 20} L${cx + 16} ${cy - ry + 6}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 가슴 배지: 작은 별 */}
      <circle cx={cx + 12} cy={cy - ry + 30} r={6} fill="#ffffff" />
      <path
        d={starPath(cx + 12, cy - ry + 30, 4, 1.8)}
        className={styles.suitShade}
      />
    </g>
  );
}

function starPath(cx: number, cy: number, r: number, ir: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : ir;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(
      `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`,
    );
  }
  return `M${pts.join(" L")} Z`;
}

function Arm({
  x1,
  y1,
  x2,
  y2,
  s,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  s: Spec;
}) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={13}
        strokeLinecap="round"
        className={styles.suitStroke}
      />
      <circle cx={x2} cy={y2} r={7.5} fill={s.fur} />
    </g>
  );
}

function Leg({ x, top, s }: { x: number; top: number; s: Spec }) {
  return (
    <g>
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={top + 18}
        strokeWidth={13}
        strokeLinecap="round"
        className={styles.suitStroke}
      />
      <ellipse
        cx={x}
        cy={top + 22}
        rx={10}
        ry={6}
        fill={s.face === "penguin" ? s.nose /* 펭귄은 주황 발 */ : BOOT}
      />
    </g>
  );
}

function TailShape({ s, x, y }: { s: Spec; x: number; y: number }) {
  switch (s.tail) {
    case "cat":
      return (
        <path
          d={`M${x} ${y} Q${x + 30} ${y + 4} ${x + 26} ${y - 30} Q${x + 24} ${y - 40} ${x + 32} ${y - 42}`}
          fill="none"
          stroke={s.fur}
          strokeWidth={8}
          strokeLinecap="round"
        />
      );
    case "dog":
      return (
        <path
          d={`M${x} ${y} Q${x + 22} ${y - 4} ${x + 20} ${y - 22}`}
          fill="none"
          stroke={s.fur}
          strokeWidth={8}
          strokeLinecap="round"
        />
      );
    case "otter":
      return (
        <path
          d={`M${x - 2} ${y - 6} Q${x + 26} ${y} ${x + 34} ${y + 14} Q${x + 18} ${y + 14} ${x - 2} ${y + 6} Z`}
          fill={s.dark}
        />
      );
    case "fox":
      return (
        <g transform={`rotate(38 ${x + 14} ${y - 12})`}>
          <ellipse cx={x + 14} cy={y - 12} rx={13} ry={26} fill={s.fur} />
          <ellipse cx={x + 14} cy={y - 32} rx={8} ry={8} fill={s.light} />
        </g>
      );
    case "raccoon":
      return (
        <g transform={`rotate(36 ${x + 14} ${y - 12})`}>
          <ellipse cx={x + 14} cy={y - 12} rx={10} ry={25} fill={s.fur} />
          {[-24, -14, -4].map((o) => (
            <rect
              key={o}
              x={x + 4}
              y={y + o}
              width={20}
              height={5}
              rx={2.5}
              fill={s.dark}
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}

/* ───────── 가구 ───────── */

function Chair() {
  return (
    <g>
      <rect x={34} y={98} width={92} height={64} rx={18} fill={CHAIR} />
      <rect
        x={40}
        y={104}
        width={80}
        height={50}
        rx={14}
        fill={CHAIR_EDGE}
        opacity={0.5}
      />
    </g>
  );
}

function Desk({ lit }: { lit: boolean }) {
  return (
    <g>
      {/* 모니터 */}
      <rect x={124} y={150} width={6} height={4} fill="#3a4258" />
      <rect x={116} y={110} width={38} height={30} rx={4} fill="#2a3146" />
      <rect
        x={119}
        y={113}
        width={32}
        height={24}
        rx={2}
        fill={lit ? "#132036" : "#161a26"}
      />
      {lit && (
        <g className={styles.glow}>
          <rect
            x={122}
            y={117}
            width={16}
            height={2.4}
            rx={1.2}
            opacity={0.9}
          />
          <rect
            x={122}
            y={122}
            width={22}
            height={2.4}
            rx={1.2}
            opacity={0.6}
          />
          <rect
            x={122}
            y={127}
            width={12}
            height={2.4}
            rx={1.2}
            opacity={0.6}
          />
          <rect
            x={136}
            y={127}
            width={3}
            height={4}
            className={styles.cursor}
          />
        </g>
      )}
      <rect x={130} y={140} width={6} height={12} fill="#3a4258" />
      {/* 책상 */}
      <path d="M8 150 L152 150 L160 160 L0 160 Z" fill={DESK_TOP} />
      <rect x={0} y={160} width={160} height={40} fill={DESK_FRONT} />
      <rect x={0} y={160} width={160} height={3} fill="#000" opacity={0.18} />
      <rect
        x={64}
        y={174}
        width={32}
        height={4}
        rx={2}
        fill="#000"
        opacity={0.2}
      />
    </g>
  );
}

function Keyboard() {
  return (
    <g>
      <path d="M56 147 L104 147 L107 154 L53 154 Z" fill="#d6dce8" />
      {[60, 68, 76, 84, 92].map((kx) => (
        <rect
          key={kx}
          x={kx}
          y={149}
          width={6}
          height={2.4}
          rx={1}
          fill="#9aa4bb"
        />
      ))}
    </g>
  );
}

/* ───────── 자세 ───────── */

function WorkPose({ s, furniture }: { s: Spec; furniture: boolean }) {
  return (
    <g>
      {furniture && <Chair />}
      <Suit cx={80} cy={154} rx={29} ry={32} />
      <g className={`${styles.pivot} ${styles.nod}`} style={at(80, 124)}>
        <Head s={s} x={80} y={94} eyes="down" mouth="smile" />
      </g>
      {furniture ? <Desk lit /> : null}
      <Keyboard />
      <g className={styles.typeA}>
        <Arm s={s} x1={58} y1={134} x2={66} y2={147} />
      </g>
      <g className={styles.typeB}>
        <Arm s={s} x1={102} y1={134} x2={94} y2={147} />
      </g>
    </g>
  );
}

function WavePose({ s }: { s: Spec }) {
  return (
    <g className={styles.hop}>
      <TailShape s={s} x={96} y={160} />
      <Leg x={64} top={164} s={s} />
      <Leg x={88} top={164} s={s} />
      <Suit cx={76} cy={140} rx={27} ry={32} />
      <Arm s={s} x1={54} y1={126} x2={46} y2={154} />
      <Head s={s} x={74} y={78} eyes="open" mouth="open" />
      {/* 크게 흔드는 손: 머리 앞, 바깥쪽으로 높이 */}
      <g className={`${styles.pivot} ${styles.waveArm}`} style={at(100, 124)}>
        <Arm s={s} x1={100} y1={124} x2={126} y2={64} />
        <Palm s={s} x={126} y={60} />
      </g>
      {/* 흔드는 손 옆 움직임 선 */}
      <g
        className={`${styles.pivot} ${styles.shout}`}
        style={at(150, 58)}
        stroke="#ffffff"
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M144 44 Q152 56 146 70" />
        <path d="M153 36 Q164 56 155 78" opacity={0.6} />
      </g>
    </g>
  );
}

/** 활짝 편 손바닥: 둥근 손에 손가락 셋 */
function Palm({ s, x, y }: { s: Spec; x: number; y: number }) {
  return (
    <g fill={s.fur}>
      <circle cx={x - 7} cy={y - 8} r={4} />
      <circle cx={x} cy={y - 11} r={4} />
      <circle cx={x + 7} cy={y - 8} r={4} />
      <circle cx={x} cy={y} r={10} />
      <ellipse
        cx={x}
        cy={y + 2}
        rx={4.5}
        ry={3.5}
        fill={s.inner}
        opacity={0.7}
      />
    </g>
  );
}

function SleepPose({ s }: { s: Spec }) {
  return (
    <g>
      <g className={styles.breathe}>
        <TailShape s={s} x={104} y={180} />
        <Suit cx={80} cy={162} rx={33} ry={27} />
        <ellipse cx={60} cy={188} rx={11} ry={6} fill={BOOT} />
        <ellipse cx={100} cy={188} rx={11} ry={6} fill={BOOT} />
        <circle cx={70} cy={166} r={7.5} fill={s.fur} />
        <circle cx={90} cy={166} r={7.5} fill={s.fur} />
        <g transform="rotate(-10 80 140)">
          <Head s={s} x={80} y={110} eyes="closed" mouth="sleep" />
        </g>
      </g>
      <g fill="#cfe0ff" fontFamily="system-ui, sans-serif" fontWeight={700}>
        <text x={116} y={64} fontSize={20} className={styles.zz}>
          Z
        </text>
        <text x={128} y={50} fontSize={14} className={styles.zz2}>
          z
        </text>
      </g>
    </g>
  );
}

function WalkPose({ s }: { s: Spec }) {
  return (
    <g className={`${styles.pivot} ${styles.walk}`} style={at(80, 190)}>
      <TailShape s={s} x={98} y={160} />
      <g className={styles.legA}>
        <Leg x={68} top={164} s={s} />
      </g>
      <g className={styles.legB}>
        <Leg x={92} top={164} s={s} />
      </g>
      <Suit cx={80} cy={140} rx={27} ry={32} />
      <g className={styles.legB}>
        <Arm s={s} x1={58} y1={126} x2={52} y2={152} />
      </g>
      <g className={styles.legA}>
        <Arm s={s} x1={102} y1={126} x2={108} y2={152} />
      </g>
      <Head s={s} x={80} y={78} eyes="open" mouth="smile" lookX={6} />
    </g>
  );
}

function StandPose({ s }: { s: Spec }) {
  return (
    <g>
      <TailShape s={s} x={100} y={160} />
      <Leg x={68} top={164} s={s} />
      <Leg x={92} top={164} s={s} />
      <Suit cx={80} cy={140} rx={27} ry={32} />
      <Arm s={s} x1={58} y1={126} x2={52} y2={154} />
      <Arm s={s} x1={102} y1={126} x2={108} y2={154} />
      <Head s={s} x={80} y={78} eyes="open" mouth="smile" />
    </g>
  );
}

function OffPose({ s, furniture }: { s: Spec; furniture: boolean }) {
  if (furniture) {
    return (
      <g>
        <Chair />
        <Desk lit={false} />
        <Keyboard />
      </g>
    );
  }
  return (
    <g className={styles.ghost}>
      <StandPose s={s} />
    </g>
  );
}
