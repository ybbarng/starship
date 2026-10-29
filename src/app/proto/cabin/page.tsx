import Link from "next/link";

// 선실 지도 시안 모음. 아이디어와 채점은 docs/ideas/cabin/scores.md.
const PROTOS = [
  {
    slug: "rooms",
    name: "1. 선원 작업실 단면도",
    line: "우주선을 옆으로 자른 단면. 갑판 층마다 방이 구역이고, 방 안 선원의 자세가 상태다. 내가 정할 것이 있는 방에서는 선원이 손짓한다.",
  },
  {
    slug: "shipyard",
    name: "2. 조선소에서 짓는 우주선",
    line: "프로젝트가 건조대 위에서 짓고 있는 배 한 척. 블록마다 비계·용접·칠. 발견 구역이 생기면 배가 꼬리 쪽으로 길어진다.",
  },
  {
    slug: "towers",
    name: "3. 함께 쌓는 탑",
    line: "맨 위 구역마다 탑 하나. 완공 블록은 아래에 쌓이고 공사 블록은 크레인에. 점선이 목표 높이.",
  },
  {
    slug: "frontier",
    name: "4. 퍼져 가는 육각 개척지",
    line: "행성 표면의 착륙선 둘레로 육각 땅이 나선으로 퍼진다. 처음 계획은 안쪽, 발견은 바깥.",
  },
  {
    slug: "factory",
    name: "5. 컨베이어 조립 공장",
    line: "상태가 곧 자리. 입구(안개) → 작업대(공사) → 출하장(완공)으로 흐르고 목표 상자가 차오른다.",
  },
];

const MAPS = [
  { crew: "web-shop", name: "온라인 상점 · 20구역" },
  { crew: "star-atlas", name: "별자리 앱 · 40구역" },
];

export default function CabinProtos() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">선실 지도 시안</h1>
      <p className="mt-2 text-sm text-white/60">
        같은 지도 데이터를 다섯 가지로 그린다. 위쪽 줄과 오른쪽 판은 모두 같고
        가운데 그림만 다르다. 데모 지도 두 장(20구역, 40구역)으로 볼 수 있다.
      </p>
      <ul className="mt-8 space-y-6">
        {PROTOS.map((p) => (
          <li key={p.slug}>
            <div className="text-lg font-medium text-glow-work">{p.name}</div>
            <p className="mt-1 text-sm text-white/65">{p.line}</p>
            <div className="mt-1.5 flex gap-3 text-sm">
              {MAPS.map((m) => (
                <Link
                  key={m.crew}
                  href={`/proto/cabin/${p.slug}?crew=${m.crew}`}
                  className="text-white/75 underline-offset-4 hover:text-white hover:underline"
                >
                  {m.name}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-sm font-semibold text-white/50">비교</h2>
      <div className="mt-2 flex gap-3 text-sm">
        {MAPS.map((m) => (
          <Link
            key={m.crew}
            href={`/proto/cabin/treemap?crew=${m.crew}`}
            className="text-white/70 hover:text-white"
          >
            지금 선실(treemap) · {m.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
