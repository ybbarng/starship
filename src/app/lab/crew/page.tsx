import { ANIMAL_KINDS, Animal, POSES, type Pose } from "@/ui/crew";

const POSE_NAME: Record<Pose, string> = {
  work: "일함",
  wave: "부름",
  sleep: "잠",
  walk: "걷기",
  stand: "서기",
  off: "자리 비움",
};

export default function CrewLab() {
  return (
    <main
      className="min-h-screen px-6 py-8 text-white"
      style={{ background: "#05070d" }}
    >
      <h1 className="text-lg font-semibold">동물 선원 확인판</h1>
      <p className="mt-1 text-sm text-white/60">
        열 가지 동물 × 여섯 자세. 홀수 줄은 업무(파랑), 짝수 줄은 개인(주황).
      </p>
      <table className="mt-6 border-separate border-spacing-x-3 border-spacing-y-1">
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
    </main>
  );
}
