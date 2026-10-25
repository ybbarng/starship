// 우주선 단면도의 설계 좌표. 모든 그림과 글이 이 좌표(W × H)를 함께 쓰고, 화면에서는 통째로 늘이고 줄인다.
// 배는 로켓처럼 서 있다: 위가 함교, 아래가 기관실이고 엔진은 바닥 쪽으로 분사한다(추력 방향이 곧 "아래").

export const W = 1360;
export const H = 640;

/** 선체 = 초타원 |x/a|^n + |y/b|^n = 1 */
export const HULL = { cx: 660, cy: 302, a: 596, b: 294, n: 3, skin: 12 };

/** y 높이에서 선체 안쪽 벽까지의 반폭 */
export function halfWidth(y: number, inset = 0): number {
  const { cy, a, b, n } = HULL;
  const k = Math.min(1, Math.abs(y - cy) / (b - inset));
  // 서버와 브라우저의 소수점 끝자리가 달라 하이드레이션이 어긋나지 않게 반올림한다
  return Math.round((a - inset) * (1 - k ** n) ** (1 / n) * 10) / 10;
}

/** 선체 윤곽 path. inset만큼 안쪽으로 줄인 것. */
export function hullPath(inset = 0, steps = 160): string {
  const { cx, cy, a, b, n } = HULL;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + (a - inset) * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + (b - inset) * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

export type DeckId = "bridge" | "work" | "home" | "engine";

export type Deck = {
  id: DeckId;
  no: number;
  name: string;
  role: string;
  top: number;
  /** 바닥 높이(발끝) */
  floor: number;
  /** 벽 안쪽에서 쓸 수 있는 가로 범위(가장 좁은 높이 기준) */
  x0: number;
  x1: number;
};

/** 바닥 판 두께(갑판 사이) */
export const SLAB = 12;

function deck(
  id: DeckId,
  no: number,
  name: string,
  role: string,
  top: number,
  floor: number,
): Deck {
  const narrow = Math.min(
    halfWidth(top, HULL.skin),
    halfWidth(floor, HULL.skin),
  );
  const hw = narrow - 14;
  return { id, no, name, role, top, floor, x0: HULL.cx - hw, x1: HULL.cx + hw };
}

export const DECKS: Record<DeckId, Deck> = {
  bridge: deck("bridge", 1, "함교·통신실", "내 자리", 46, 152),
  work: deck("work", 2, "업무 모듈", "업무 선원", 164, 294),
  home: deck("home", 3, "거주 모듈", "개인 선원·침상", 306, 436),
  engine: deck("engine", 4, "기관실·도킹 베이", "교신선이 붙는 곳", 448, 560),
};

export const DECK_ORDER: DeckId[] = ["bridge", "work", "home", "engine"];

/** 가운데 사다리 통로 */
export const LADDER = { x: HULL.cx - 22, w: 44 };

/** 갑판마다 쉬는 곳·주방 같은 고정 시설이 차지하는 가로 범위 */
export const FIXTURES = {
  /** 업무 모듈 오른쪽 끝 휴게석 */
  lounge: { x0: DECKS.work.x1 - 150, x1: DECKS.work.x1 },
  /** 거주 모듈 왼쪽 끝 주방 */
  galley: { x0: DECKS.home.x0, x1: DECKS.home.x0 + 168 },
  /** 거주 모듈 오른쪽 끝 침상 */
  bunks: { x0: DECKS.home.x1 - 190, x1: DECKS.home.x1 },
  /** 도킹 베이(기관실 갑판 왼쪽) */
  bay: { x0: DECKS.engine.x0, x1: LADDER.x - 8 },
  /** 기관실(오른쪽) */
  engine: { x0: LADDER.x + LADDER.w + 8, x1: DECKS.engine.x1 },
};
