import Link from "next/link";
import { CrewCabins } from "@/ui/map/CrewCabins";

const PROTOS = [
  {
    href: "/proto/cockpit",
    name: "★ 3차 · 조종석과 감상창",
    line: '평소엔 일하는 조종석: 넓게 트인 유리창 너머 우주, 계기판 한가운데 지금 할 일 하나, 경고등·승무원판·교신 수신등. 유리의 "우주 감상하기"(G)로 2차의 트인 함교에 들어갔다 Esc로 나온다. 내리면 네 갑판 단면.',
  },
  {
    href: "/proto/open-bridge",
    name: "2차 · 트인 함교",
    line: "1차 피드백을 모아 하나로. 창틀 없는 우주를 끌어 둘러보고 천체를 눌러 날아간다. 일은 가장자리 한 줄로 조용히, 계기는 실제 거리·교신 지연·한국 시각·속도·좌표. 내리면 네 갑판의 우주선 단면.",
  },
  {
    href: "/proto/classic",
    name: "1. 정석 조종석",
    line: "앞 유리 다섯 장, 가운데 주 표시창과 양옆 승무원 토글 스위치, 교신은 화상 창. 내리면 개미농장 같은 옆 단면.",
  },
  {
    href: "/proto/three-rooms",
    name: "2. 세 방을 오가는 선원",
    line: "선원이 상태에 따라 작업실·대기실·휴게실을 걸어서 옮긴다. 할 일을 치울 때마다 오늘의 항로를 한 칸 워프.",
  },
  {
    href: "/proto/docking",
    name: "3. 도킹하는 교신선",
    line: "나를 부른 메시지가 출처별 배가 되어 실제 별 방향에서 날아와 옆구리 포트에 붙는다. 내리면 위에서 본 평면도.",
  },
  {
    href: "/proto/ring",
    name: "4. 돌아오는 회전 고리",
    line: "창밖은 위에서 본 오늘의 태양계. 내리면 원심 회전 고리가 돌고, 나를 부르는 선원 칸이 내 앞으로 돌아와 멈춘다.",
  },
  {
    href: "/proto/hud",
    name: "5. 앞 유리 투영",
    line: "가장 넓은 창밖을 끌어서 둘러보고, 할 일은 유리 위 투영으로. 내리면 바닥이 투명해져 아래층 원탁 갑판이 보인다.",
  },
];

const LABS = [
  { href: "/lab/sky", name: "창밖 우주 확인판" },
  { href: "/lab/crew", name: "동물 선원 확인판" },
  { href: "/lab/events", name: "이벤트 확인판" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Starship 시안</h1>
      <p className="mt-2 text-sm text-white/60">
        모든 시안은 같은 데이터(기본은 데모)와 같은 창밖 우주를 쓴다. 주소 뒤에{" "}
        <code>?demo=empty</code>, <code>?demo=busy</code>, <code>?reset=1</code>
        을 붙여 볼 수 있다.
      </p>
      <ul className="mt-8 space-y-5">
        {PROTOS.map((p) => (
          <li key={p.href}>
            <Link
              className="text-lg font-medium text-glow-work underline-offset-4 hover:underline"
              href={p.href}
            >
              {p.name}
            </Link>
            <p className="mt-1 text-sm text-white/65">{p.line}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-sm font-semibold text-white/50">
        선실 · 승무원을 누르면 그 프로젝트의 지도로 들어가요
      </h2>
      <CrewCabins />
      <h2 className="mt-12 text-sm font-semibold text-white/50">확인판</h2>
      <ul className="mt-2 flex gap-4 text-sm">
        {LABS.map((l) => (
          <li key={l.href}>
            <Link className="text-white/70 hover:text-white" href={l.href}>
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
