import Link from "next/link";

const PROTOS = [
  { href: "/proto/classic", name: "정석 조종석", line: "준비 중" },
  { href: "/proto/three-rooms", name: "세 방을 오가는 선원", line: "준비 중" },
  { href: "/proto/docking", name: "도킹하는 교신선", line: "준비 중" },
  { href: "/proto/ring", name: "돌아오는 회전 고리", line: "준비 중" },
  { href: "/proto/hud", name: "앞 유리 투영", line: "준비 중" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Starship 시안</h1>
      <ul className="mt-8 space-y-3">
        {PROTOS.map((p) => (
          <li key={p.href}>
            <Link className="text-glow-work underline" href={p.href}>
              {p.name}
            </Link>
            <span className="ml-3 text-sm text-white/60">{p.line}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
