// 나르기 기록 데모: 지어낸 나르기. 데모 모드(STARSHIP_SERVER_URL 없음)에서만 쓴다.
// 공개 저장소라 세션·일 이름·카드 번호는 모두 지어낸 것이다(데모 승무원 이름을 쓴다).
// 비서 서버가 보내는 모양(시각은 ISO 글, 순서는 섞임)으로 만들어 진짜 기록과 같은 검사(src/protocol/relay.ts)를 거친다.
// 나르기 판의 모든 모습이 보이게 둔다: 넘기기 전·진행 중·멈춤·돌려줌·끝·그만둠·7일 지나 빠지는 끝·어느 일인지 모르는 넘김.

const MIN = 60_000;
const HOUR = 60 * MIN;

type Kind = "open" | "forward" | "update" | "return" | "close" | "cancel";

function at(now: number, ago: number) {
  return new Date(now - ago).toISOString();
}

/** GET {비서}/api/relays 본문 모양의 지어낸 기록. 시각은 now 기준 상대값이다. */
export function demoRelayLog(now = Date.now()): { relays: unknown[] } {
  const line = (
    id: string | undefined,
    kind: Kind,
    ago: number,
    more: Record<string, string> = {},
  ) => ({
    relay: "starship-relay/1",
    ...(id ? { id } : {}),
    at: at(now, ago),
    kind,
    ...more,
  });
  const relays = [
    // 진행 중: 상점 세션이 부탁한 문서 검토가 아이콘 세션에 가 있다
    line("R-demo-a1", "open", 3 * HOUR, {
      from: "web-shop",
      title: "쿠폰 계산 문서 검토",
      card: "DEMO-12",
    }),
    line("R-demo-a1", "forward", 3 * HOUR - 5 * MIN, { to: "pixel-forge" }),
    line("R-demo-a1", "update", 40 * MIN, { note: "절반 봤어요" }),
    // 멈춤: 하루 넘게 소식이 없다
    line("R-demo-b2", "open", 31 * HOUR, {
      from: "lunar-blog",
      title: "글 목록 번역 확인",
    }),
    line("R-demo-b2", "forward", 30 * HOUR, { to: "orbit-notes" }),
    // 돌려줌: 결과가 처음 세션에 돌아갔다
    line("R-demo-c3", "open", 5 * HOUR, {
      from: "garden-bot",
      title: "물 주기 알림 문구 다듬기",
    }),
    line("R-demo-c3", "forward", 4 * HOUR, { to: "lunar-blog" }),
    line("R-demo-c3", "return", 20 * MIN, { note: "고칠 곳 2건" }),
    // 넘기기 전: 비서가 막 받았다
    line("R-demo-d4", "open", 8 * MIN, {
      from: "billing-api",
      title: "영수증 PDF 글꼴 고르기",
    }),
    // 끝
    line("R-demo-e5", "open", 50 * HOUR, {
      from: "star-atlas",
      title: "별자리 이름 표기 맞추기",
    }),
    line("R-demo-e5", "forward", 49 * HOUR, { to: "kanji-cards" }),
    line("R-demo-e5", "return", 47 * HOUR),
    line("R-demo-e5", "close", 46 * HOUR, { note: "반영 끝" }),
    // 그만둠
    line("R-demo-f6", "open", 26 * HOUR, {
      from: "admin-console",
      title: "권한 표 다시 그리기",
    }),
    line("R-demo-f6", "cancel", 25 * HOUR, { note: "요구가 바뀌어 그만둠" }),
    // 7일이 지나 판에서 빠지는 끝
    line("R-demo-g7", "open", 10 * 24 * HOUR, {
      from: "recipe-box",
      title: "재료 단위 고치기",
    }),
    line("R-demo-g7", "close", 9 * 24 * HOUR),
    // 어느 일인지 모르는 넘김(hook이 id 표시 없는 메시지를 보았다)
    line(undefined, "forward", 55 * MIN, { to: "star-atlas" }),
    line(undefined, "forward", 6 * HOUR, { to: "home-lab" }),
  ];
  // 비서는 순서를 보장하지 않는다: 화면이 정렬하는지 데모로도 보이게 섞는다
  return { relays: [...relays].reverse() };
}
