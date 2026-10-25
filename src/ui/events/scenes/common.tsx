import { type CSSProperties, type ReactNode, useId } from "react";

export type Direction = "ltr" | "rtl";

export interface SceneProps {
  /** 이벤트 전체 길이(밀리초) */
  durationMs: number;
  /** 씨앗으로 만든 무작위 값 줄 */
  rand: () => number;
  /** 움직임 줄이기를 켠 사람이면 true */
  reduced: boolean;
  /** 손님을 눌렀을 때 부른다 */
  onPoke: () => void;
}

/** SVG 그라디언트 id가 다른 그림과 겹치지 않게 한다 */
export function useSvgId(prefix: string): (name: string) => string {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (name) => `${prefix}-${raw}-${name}`;
}

interface TravelerProps {
  width: number;
  height: number;
  /** 띠 안에서 높이(0 = 맨 위, 1 = 맨 아래) */
  y: number;
  dir: Direction;
  durationMs: number;
  /** 지나가는 동안 위아래로 흐르는 정도(px) */
  drift?: number;
  reduced: boolean;
  children: ReactNode;
}

/**
 * 창을 한쪽 끝에서 다른 쪽 끝으로 가로지르는 틀.
 * 움직임 줄이기를 켜면 가운데 근처에 가만히 나타났다 사라진다.
 */
export function Traveler({
  width,
  height,
  y,
  dir,
  durationMs,
  drift = 0,
  reduced,
  children,
}: TravelerProps) {
  const outside = `calc(-1 * ${width}px)`;
  const style = {
    "--dur": `${durationMs}ms`,
    "--x0": dir === "ltr" ? outside : "100%",
    "--x1": dir === "ltr" ? "100%" : outside,
    "--dy": `${drift}px`,
    ...(reduced ? { transform: `translateX(calc(58% - ${width / 2}px))` } : {}),
  } as CSSProperties;
  return (
    <div
      className={`ev-track ${reduced ? "ev-still" : "ev-cross"}`}
      style={style}
    >
      <div
        className="ev-actor"
        style={{
          width,
          height,
          top: `calc((100% - ${height}px) * ${y.toFixed(3)})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface BubbleProps {
  children: ReactNode;
  left?: number;
  right?: number;
  top: number;
  tail?: "left" | "right";
  className?: string;
}

export function Bubble({
  children,
  left,
  right,
  top,
  tail = "left",
  className = "",
}: BubbleProps) {
  return (
    <div
      className={`ev-bubble ${tail === "right" ? "ev-tail-right" : ""} ${className}`}
      style={{ left, right, top }}
    >
      {children}
    </div>
  );
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("빈 목록에서 고를 수 없다");
  return item;
}

export function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}
