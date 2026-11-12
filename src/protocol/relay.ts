// 나르기 기록 형식(starship-relay/1): 비서가 세션 사이에 일을 나를 때마다 덧붙이는 JSON 한 줄.
// 정의 출처는 비서 서버의 GET /api/relays 응답이다. 설명: docs/hq.md "나르기 기록".
// 바깥(relays가 배열인지)만 엄격하고, 줄은 하나씩 따로 검사해 틀린 줄만 빼고 problems에 적는다(보안 기록과 같은 방식).
// 줄을 나르기 하나로 접는 일은 src/relay/fold.ts가 맡는다.
import { z } from "zod";
import { Instant, lenientArray, opt } from "./common";

/** 형식 이름과 판. 판이 바뀌면 화면이 모르는 줄로 보고 뺀다. */
export const RELAY_FORMAT = "starship-relay/1" as const;

/**
 * 줄의 종류. 뜻과 이 줄 뒤 상태·지금 있는 곳은 docs/hq.md 표와 같다.
 * open 부탁 받음 · forward 다른 세션에 넘김 · update 진행 소식 · return 결과를 처음 세션에 돌려줌 · close 끝 · cancel 그만둠
 */
export const RelayKind = z.enum([
  "open",
  "forward",
  "update",
  "return",
  "close",
  "cancel",
]);
export type RelayKind = z.infer<typeof RelayKind>;

const MaybeText = opt(z.string());

/**
 * 기록 한 줄. id는 나르기 하나를 가리킨다. hook이 쓴 forward는 메시지에 id 표시가 없으면 id 없이 온다
 * (어느 일인지 모르는 넘김). forward가 아닌 줄은 id가 있어야 한다.
 */
export const RelayLine = z
  .object({
    relay: z.literal(RELAY_FORMAT),
    id: opt(z.string().min(1)),
    at: Instant,
    kind: RelayKind,
    /** open에만: 처음 부탁한 세션(세션을 연 폴더 이름) */
    from: MaybeText,
    /** forward에만: 넘겨받은 세션 */
    to: MaybeText,
    /** 일의 짧은 이름(40자 안쪽). 자료 원문은 적지 않는다 */
    title: MaybeText,
    /** 관련 카드 번호 */
    card: MaybeText,
    /** 짧은 한 줄 */
    note: MaybeText,
  })
  .refine((l) => l.id !== undefined || l.kind === "forward", {
    message: "forward가 아닌 줄에는 id가 있어야 해요",
    path: ["id"],
  });
export type RelayLine = z.infer<typeof RelayLine>;

/**
 * GET {비서}/api/relays 응답. 줄 순서는 보장하지 않는다(정렬은 src/relay/fold.ts가).
 * 줄 하나가 틀리면 그것만 빼고, 까닭은 problems에 "relays[3] (id R-1): …" 꼴로 적는다.
 */
export const RelayLog = z
  .object({
    relays: lenientArray(RelayLine, "relays"),
    problems: z.array(z.string()).optional(),
  })
  .transform(({ relays, problems }) => {
    const all = [...(problems ?? []), ...relays.problems];
    return { relays: relays.items, ...(all.length ? { problems: all } : {}) };
  });
export type RelayLog = z.infer<typeof RelayLog>;

/**
 * Starship의 GET /api/v1/relays 응답.
 * source: demo면 지어낸 기록, remote면 비서가 남긴 진짜 기록이다(둘을 섞지 않는다).
 * status: none이면 비서에 나르기 기록 끝점이 아직 없다(404). 그때 log.relays는 빈 배열이다.
 */
export const RelayResponse = z.object({
  source: z.enum(["demo", "remote"]),
  status: z.enum(["ok", "none"]),
  log: RelayLog,
});
export type RelayResponse = z.infer<typeof RelayResponse>;
