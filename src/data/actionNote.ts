// 동작이 본부에 닿지 못했을 때 토스트에 띄울 한 줄. 실패 번호만 보이면 무엇이 남았는지 몰라서
// "무엇이 그대로 있는지"를 함께 적는다.
import type { ActionRequest } from "@/protocol/v1";

const LEFT: Record<ActionRequest["target"], string> = {
  task: "서류는 그대로 있어요",
  crew: "승무원에게는 아직 전하지 않았어요",
  answer: "답은 그대로 남겨 둘게요",
  sign: "갈림길은 그대로 있어요",
};

/** status가 없으면 본부에 아예 닿지 못한 것(네트워크 오류) */
export function failNote(req: ActionRequest, status?: number): string {
  const head =
    status === undefined
      ? "본부에 닿지 못했어요"
      : `본부가 받지 못했어요(${status})`;
  return `${head}. ${LEFT[req.target]}`;
}
