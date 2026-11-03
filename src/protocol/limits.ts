// 계정 사용 한도(주간·5시간 등). 본부의 GET {base}/v1/usage/limits 응답 모양이다. 설명은 docs/protocol.md.
// 본부가 새 한도(id)를 더해도 화면이 깨지지 않게 너그럽게 읽는다: 모르는 id도 받고, 틀린 항목은 그것만 뺀다.
import { z } from "zod";

/** 초 단위로 온 시각(10^11보다 작음)은 밀리초로 바꾼다. 2001년 이후 밀리초는 늘 10^12를 넘는다 */
function toMs(v: number): number {
  return v > 0 && v < 1e11 ? v * 1000 : v;
}

const Ms = z.number().finite().nonnegative().transform(toMs);

/** 한도 하나. id 예: "week"(주간), "five-hour"(5시간), "week-opus"(모델별 주간) */
export const UsageLimit = z.object({
  id: z.string().min(1),
  /** 화면에 적을 이름. 없으면 id로 정한다(limitLabel) */
  label: z.string().min(1).optional(),
  /** 쓴 몫(%). 0~100 밖이면 잘라서 받는다 */
  usedPct: z
    .number()
    .finite()
    .transform((v) => Math.min(100, Math.max(0, v))),
  /** 다시 차는 시각(Unix 밀리초). 모르면 없다 */
  resetsAt: Ms.optional(),
});
export type UsageLimit = z.infer<typeof UsageLimit>;

/** 항목을 하나씩 검사해, 틀린 것만 뺀다 */
const LenientLimits = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.flatMap((item) => {
      const r = UsageLimit.safeParse(item);
      return r.success ? [r.data] : [];
    }),
  );

/** 본부 응답. at은 본부가 값을 마지막으로 받은 때(Unix 밀리초) */
export const UsageLimits = z.object({
  protocol: z.string().optional(),
  at: Ms,
  limits: LenientLimits.default([]),
});
export type UsageLimits = z.infer<typeof UsageLimits>;

/**
 * Starship의 GET /api/v1/usage/limits 응답. ok:false면 본부가 없거나(데모 아님) 끝점을 모르거나 실패한 것이라
 * 화면은 칸을 숨긴다. ok:true인데 limits가 비면 리셋되어 새 값을 기다리는 중이다.
 */
export const UsageLimitsResponse = z.object({
  ok: z.boolean(),
  source: z.enum(["demo", "remote"]),
  at: Ms.optional(),
  limits: LenientLimits.default([]),
  note: z.string().optional(),
});
export type UsageLimitsResponse = z.infer<typeof UsageLimitsResponse>;

const LABEL: Record<string, string> = {
  week: "주간",
  "five-hour": "5시간",
  "week-opus": "주간(Opus)",
  "week-sonnet": "주간(Sonnet)",
};

export function limitLabel(l: Pick<UsageLimit, "id" | "label">): string {
  return l.label ?? LABEL[l.id] ?? l.id;
}
