// 프로젝트마다 다른 행성: 승무원 id로 늘 같은 행성을 고른다(2026-11-02 사용자). 선실을 옮겨 다닐 때 어느 방인지 바로 알게.
// 땅 상태 색(GROUND)과 지역 테두리 색은 그대로 두고 행성 표면·대기·달만 바꾼다(상태 읽기가 행성마다 달라지지 않게).

export type Planet = {
  id: string;
  name: string;
  /** 표면 가운데 → 가장자리 */
  ground: [string, string, string];
  /** 지평선 위 대기 빛 */
  air: string;
  /** 아직 개척하지 않은 옅은 칸 선 */
  grid: string;
  /** 하늘의 달 */
  moon: string;
};

export const PLANETS: Planet[] = [
  {
    id: "rust",
    name: "붉은 사막 행성",
    ground: ["#3a2a26", "#24191b", "#161015"],
    air: "#e9a37a",
    grid: "rgba(255,230,210,0.07)",
    moon: "#c9cfdc",
  },
  {
    id: "ice",
    name: "얼음 행성",
    ground: ["#2b3646", "#1b2331", "#10151e"],
    air: "#9fd4ff",
    grid: "rgba(210,235,255,0.08)",
    moon: "#f1e2c4",
  },
  {
    id: "jungle",
    name: "이끼 행성",
    ground: ["#26392b", "#18261d", "#0f1813"],
    air: "#a6eaa0",
    grid: "rgba(215,255,215,0.07)",
    moon: "#d8c9ff",
  },
  {
    id: "crystal",
    name: "수정 행성",
    ground: ["#352a43", "#221b2d", "#150f1d"],
    air: "#cfa8ff",
    grid: "rgba(235,215,255,0.08)",
    moon: "#bfe9ff",
  },
  {
    id: "dune",
    name: "황금 모래 행성",
    ground: ["#3e3524", "#282116", "#19140e"],
    air: "#f2cf86",
    grid: "rgba(255,240,200,0.07)",
    moon: "#c9cfdc",
  },
  {
    id: "tide",
    name: "물결 행성",
    ground: ["#1f3739", "#142426", "#0c1718"],
    air: "#7fe0d2",
    grid: "rgba(200,255,245,0.07)",
    moon: "#ffd6c4",
  },
];

/** 문자열 → 0 이상 정수(FNV-1a). 같은 승무원은 늘 같은 행성 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function planetFor(key: string): Planet {
  return PLANETS[hash(key) % PLANETS.length] ?? (PLANETS[0] as Planet);
}
