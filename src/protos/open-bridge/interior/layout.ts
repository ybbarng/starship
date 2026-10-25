// 모듈(업무·거주) 안 자리 계산. 모든 값은 설계 좌표.
// - 나를 기다리는 선원: 자리에서 일어나 사다리(=내가 내려오는 길) 쪽에 서서 손짓한다. 자리 두 칸을 쓴다.
// - 일하는 선원: 자기 책상. 자리 비움: 빈 책상. 쉬는 선원: 휴게석·침상으로.
// - 사다리에 가까울수록 급하다: 기다림 → 일함 → 빈 자리 순으로 사다리에서 바깥쪽으로 채운다.
// - 자리가 모자라면 칸을 줄이고, 그래도 모자라면 빈 자리부터 "+n"으로 접는다.
import type { Crew } from "@/protocol/v1";

export type Wing = { x0: number; x1: number; side: "left" | "right" };

export type DeskSeat = {
  key: string;
  crew: Crew;
  /** 책상 가운데 */
  deskX: number;
  /** 기다리는 선원이 서 있는 곳(없으면 책상에 앉아 있거나 비어 있다) */
  standX?: number;
  /** 서 있는 선원이 바라보는 쪽(사다리 쪽) */
  facing: 1 | -1;
  /** 이 자리가 차지하는 가로 범위 */
  x0: number;
  x1: number;
};

export type Stub = {
  key: string;
  x0: number;
  x1: number;
  crew: Crew[];
  label: string;
};

export type ModuleLayout = {
  unit: number;
  size: number;
  desks: DeskSeat[];
  stubs: Stub[];
  rest: Crew[];
};

const SIZES = [
  { unit: 86, size: 54 },
  { unit: 76, size: 48 },
  { unit: 66, size: 42 },
  { unit: 58, size: 38 },
];

type Entry =
  | { type: "crew"; crew: Crew; span: 1 | 2 }
  | { type: "stub"; crew: Crew[]; label: string; span: 1 };

const byName = (a: Crew, b: Crew) => a.name.localeCompare(b.name);

/** 날개 둘에 사다리 쪽부터 채운다. 넘친 것은 돌려준다. */
function pack(entries: Entry[], wings: Wing[], unit: number) {
  const used = wings.map(() => 0);
  const placed: { entry: Entry; wing: number; from: number }[] = [];
  const overflow: Entry[] = [];
  for (const e of entries) {
    const w = e.span * unit;
    // 남은 자리가 더 넓은 날개로
    let best = -1;
    let bestFree = -1;
    for (const [i, wing] of wings.entries()) {
      const free = wing.x1 - wing.x0 - (used[i] ?? 0);
      if (free >= w && free > bestFree) {
        best = i;
        bestFree = free;
      }
    }
    if (best < 0) {
      overflow.push(e);
      continue;
    }
    placed.push({ entry: e, wing: best, from: used[best] ?? 0 });
    used[best] = (used[best] ?? 0) + w;
  }
  return { placed, overflow };
}

export function layoutModule(crew: Crew[], wings: Wing[]): ModuleLayout {
  const need = crew
    .filter((c) => c.status === "needs-you")
    .sort((a, b) => (a.since ?? 0) - (b.since ?? 0));
  const work = crew.filter((c) => c.status === "working").sort(byName);
  const off = crew.filter((c) => c.status === "off").sort(byName);
  const rest = crew.filter((c) => c.status === "idle").sort(byName);

  const crewEntries = (list: Crew[], span: 1 | 2): Entry[] =>
    list.map((c) => ({ type: "crew", crew: c, span }));

  const plans: Entry[][] = [
    [...crewEntries(need, 2), ...crewEntries(work, 1), ...crewEntries(off, 1)],
  ];
  if (off.length) {
    plans.push([
      ...crewEntries(need, 2),
      ...crewEntries(work, 1),
      { type: "stub", crew: off, label: "빈 자리", span: 1 },
    ]);
  }

  let chosen: {
    unit: number;
    size: number;
    placed: ReturnType<typeof pack>["placed"];
  } | null = null;
  // 큰 칸 둘까지는 모두 펼쳐 보고, 그다음엔 빈 자리를 접어 큰 칸을 지키고, 그래도 안 되면 칸을 줄인다.
  const attempts: [Entry[], (typeof SIZES)[number]][] = [];
  for (const [i, s] of SIZES.entries()) {
    for (const plan of i < 2 ? [plans[0]] : plans) {
      if (plan) attempts.push([plan, s]);
    }
    if (i === 1 && plans[1]) {
      attempts.push([plans[1], SIZES[0] as (typeof SIZES)[number]]);
      attempts.push([plans[1], s]);
    }
  }
  for (const [plan, s] of attempts) {
    const r = pack(plan, wings, s.unit);
    if (r.overflow.length === 0) {
      chosen = { ...s, placed: r.placed };
      break;
    }
  }

  if (!chosen) {
    // 가장 작은 칸으로도 모자라면: 앞에서부터 들어가는 만큼 두고, 남은 선원을 "+n"으로
    const s = SIZES[SIZES.length - 1] ?? { unit: 58, size: 38 };
    const all = [...crewEntries(need, 2), ...crewEntries(work, 1)];
    const totalUnits = wings.reduce(
      (n, w) => n + Math.floor((w.x1 - w.x0) / s.unit),
      0,
    );
    const keep: Entry[] = [];
    let units = 1; // "+n" 한 칸
    for (const e of all) {
      if (units + e.span > totalUnits) break;
      keep.push(e);
      units += e.span;
    }
    const kept = new Set(
      keep.flatMap((e) => (e.type === "crew" ? [e.crew.id] : [])),
    );
    const folded = [...need, ...work, ...off].filter((c) => !kept.has(c.id));
    const r = pack(
      [...keep, { type: "stub", crew: folded, label: "더", span: 1 }],
      wings,
      s.unit,
    );
    chosen = { ...s, placed: r.placed };
  }

  const { unit, size, placed } = chosen;
  const desks: DeskSeat[] = [];
  const stubs: Stub[] = [];
  for (const p of placed) {
    const wing = wings[p.wing] as Wing;
    const w = p.entry.span * unit;
    // 왼쪽 날개는 사다리(오른쪽 끝)에서 왼쪽으로, 오른쪽 날개는 왼쪽 끝에서 오른쪽으로
    const x0 = wing.side === "left" ? wing.x1 - p.from - w : wing.x0 + p.from;
    const x1 = x0 + w;
    if (p.entry.type === "stub") {
      stubs.push({
        key: `stub-${p.entry.label}`,
        x0,
        x1,
        crew: p.entry.crew,
        label: p.entry.label,
      });
      continue;
    }
    const c = p.entry.crew;
    const facing = wing.side === "left" ? 1 : -1;
    if (p.entry.span === 2) {
      // 바깥 칸에 빈 책상, 사다리 쪽 칸에 일어선 선원
      const inner = wing.side === "left" ? x1 - unit / 2 : x0 + unit / 2;
      const outerX = wing.side === "left" ? x0 + unit / 2 : x1 - unit / 2;
      desks.push({
        key: c.id,
        crew: c,
        deskX: outerX,
        standX: inner,
        facing,
        x0,
        x1,
      });
    } else {
      desks.push({ key: c.id, crew: c, deskX: (x0 + x1) / 2, facing, x0, x1 });
    }
  }
  return { unit, size, desks, stubs, rest };
}
