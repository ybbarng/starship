import {
  ACTS,
  type Act,
  ANIMAL_KINDS,
  Animal,
  POSES,
  type Pose,
} from "@/ui/crew";

const POSE_NAME: Record<Pose, string> = {
  work: "일함",
  wave: "부름",
  sleep: "잠",
  walk: "걷기",
  stand: "서기",
  off: "자리 비움",
};

const ACT_NAME: Record<Act, string> = {
  look: "화면 보기",
  chin: "턱 괴기",
  sip: "한 모금",
  stretch: "기지개",
  yawn: "하품",
  ear: "귀 쫑긋",
  nodoff: "꾸벅",
  toss: "뒤척",
  peek: "실눈",
  tail: "꼬리",
  glance: "두리번",
  tilt: "갸웃",
  raise: "손 반쯤",
  beckon: "손짓",
  hop: "깡충",
};

const URGENCY = [
  { u: 0.15, name: "낮음 0.15 · 슬쩍 돌아보고 갸웃" },
  { u: 0.6, name: "보통 0.6 · 손을 들어 부름" },
  { u: 0.95, name: "높음 0.95 · 몸을 기울여 손짓, 깡충" },
];

/** 동작마다 보여 줄 동물: 귀·꼬리가 있는 쪽으로 */
const ACT_KIND: Partial<Record<Act, (typeof ANIMAL_KINDS)[number]>> = {
  ear: "rabbit",
  tail: "fox",
  peek: "owl",
  sip: "bear",
};

export default function CrewLab() {
  return (
    <main
      className="min-h-screen px-6 py-8 text-white"
      style={{ background: "#05070d" }}
    >
      <h1 className="text-lg font-semibold">동물 선원 확인판</h1>
      <p className="mt-1 text-sm text-white/60">
        뜻이 있는 동작(부름)은 모두 같은 신호에 세기만 다르다. 뜻이 없는
        동작(일함·잠·서기)은 동물마다 성격대로, 순서와 간격은 이름으로 흩는다.
      </p>

      <section className="mt-6">
        <h2 className="text-sm text-white/70">부름의 세기 (urgency)</h2>
        <div className="mt-2 flex flex-col gap-2">
          {URGENCY.map(({ u, name }) => (
            <div key={u} className="flex items-end gap-2">
              <span className="w-56 shrink-0 pb-4 text-xs text-white/50">
                {name}
              </span>
              {ANIMAL_KINDS.map((kind, i) => (
                <Animal
                  key={kind}
                  kind={kind}
                  pose="wave"
                  urgency={u}
                  context={i % 2 === 0 ? "work" : "personal"}
                  size={64}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-white/70">
          짧은 동작 하나씩 (확인용으로 되풀이)
        </h2>
        {(["work", "sleep", "stand", "wave"] as const).map((pose) => (
          <div key={pose} className="mt-2 flex items-end gap-4">
            <span className="w-16 shrink-0 pb-4 text-xs text-white/50">
              {POSE_NAME[pose]}
            </span>
            {ACTS[pose].map((act) => (
              <figure key={act} className="flex flex-col items-center">
                <Animal
                  kind={ACT_KIND[act] ?? (pose === "work" ? "cat" : "dog")}
                  pose={pose}
                  act={act}
                  urgency={0.8}
                  size={72}
                  label={`${ACT_NAME[act]} 확인`}
                />
                <figcaption className="text-[11px] text-white/50">
                  {ACT_NAME[act]}
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-white/70">
          열 가지 동물 × 여섯 자세 (저절로). 홀수 줄은 업무(파랑), 짝수 줄은
          개인(주황).
        </h2>
        <table className="mt-2 border-separate border-spacing-x-3 border-spacing-y-1">
          <thead>
            <tr className="text-xs text-white/50">
              <th />
              {POSES.map((p) => (
                <th key={p} className="font-normal">
                  {POSE_NAME[p]}
                </th>
              ))}
              <th className="pl-6 font-normal">작게(32)</th>
            </tr>
          </thead>
          <tbody>
            {ANIMAL_KINDS.map((kind, i) => {
              const context = i % 2 === 0 ? "work" : "personal";
              return (
                <tr key={kind}>
                  <td className="pr-2 text-right text-xs text-white/50">
                    {kind}
                  </td>
                  {POSES.map((pose) => (
                    <td key={pose}>
                      <Animal
                        kind={kind}
                        pose={pose}
                        context={context}
                        size={72}
                      />
                    </td>
                  ))}
                  <td className="pl-6">
                    <div className="flex items-end gap-1">
                      <Animal
                        kind={kind}
                        pose="wave"
                        context={context}
                        size={32}
                      />
                      <Animal
                        kind={kind}
                        pose="work"
                        context={context}
                        size={32}
                      />
                      <Animal
                        kind={kind}
                        pose="off"
                        context={context}
                        size={32}
                        furniture={false}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
