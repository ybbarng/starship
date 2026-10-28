// 데모 지도 한 장: 지어낸 온라인 상점 프로젝트(승무원 web-shop).
// 상태(안개·공사·완공·막힘·버림)와 표지(갈림길·교신·위험)가 골고루 섞이고, 발견 구역이 몇 개 있다.
// 날짜는 지금 기준으로 만들어서 "새 땅"과 "지도 갱신 n시간 전"이 늘 같은 모습으로 보인다.
import type { ProjectMap, Region } from "@/protocol/map";

const DAY = 86_400_000;

/** 지도가 있는 데모 승무원 */
export const DEMO_MAP_CREW = "web-shop";

/** n일 전 날짜("2026-10-22"), 한국 시각 기준 */
function daysAgo(now: number, n: number): string {
  return new Date(now - n * DAY + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function buildDemoMap(now = Date.now()): ProjectMap {
  const d = (n: number) => daysAgo(now, n);
  const regions: Region[] = [
    // 서버
    { id: "server", title: "서버", status: "building", size: 1 },
    {
      id: "server-catalog",
      title: "상품 목록",
      parent: "server",
      status: "done",
      size: 2,
      summary: "상품·재고 조회 API. 검색은 이름 앞부분만 맞춘다",
      since: d(15),
      links: [{ label: "API 문서", path: "docs/api/catalog.md" }],
    },
    {
      id: "server-payment",
      title: "결제",
      parent: "server",
      status: "building",
      size: 3,
      summary: "결제 대행사 A로 정했다(결정 0002). 승인 API를 붙이는 중",
      next: "환불 정책을 운영 담당에게 확인",
      since: d(6),
      links: [
        { label: "결정 0002", path: "docs/decisions/0002-payment.md" },
        { label: "SHOP-12", url: "https://example.com/issues/SHOP-12" },
      ],
      signs: [
        {
          id: "receipt",
          type: "fork",
          title: "영수증 발급 방식",
          owner: "me",
          options: ["대행사 영수증", "직접 발급"],
          recommend: "대행사 영수증",
          status: "open",
        },
        {
          id: "ops-refund",
          type: "talk",
          title: "환불 정책",
          with: "운영 담당",
          status: "draft",
          path: "docs/drafts/refund-questions.md",
        },
        {
          id: "outage",
          type: "risk",
          title: "대행사 장애가 길 때 동작이 정해지지 않았다",
        },
      ],
    },
    {
      id: "server-refund",
      title: "환불",
      parent: "server",
      status: "blocked",
      size: 2,
      summary: "부분 환불을 대행사가 지원하는지 몰라 멈췄다",
      next: "대행사 답을 받으면 다시 시작",
      since: d(3),
      found: d(5),
      signs: [
        {
          id: "pg-partial",
          type: "talk",
          title: "부분 환불 지원 여부",
          with: "대행사 지원팀",
          status: "waiting",
        },
      ],
    },
    {
      id: "server-coupon",
      title: "쿠폰",
      parent: "server",
      status: "building",
      size: 1,
      summary: "쿠폰 두 장을 같이 쓰면 금액이 틀리는 버그가 있었다",
    },
    {
      id: "coupon-stack",
      title: "중복 쿠폰 계산",
      parent: "server-coupon",
      status: "building",
      size: 2,
      summary: "할인 순서를 정률 → 정액으로 고정하고 테스트를 더하는 중",
      next: "리뷰 받기(web-shop#212)",
      since: d(1),
      found: d(2),
    },
    {
      id: "coupon-expire",
      title: "만료 처리",
      parent: "server-coupon",
      status: "done",
      size: 1,
      since: d(9),
    },
    {
      id: "coupon-admin",
      title: "쿠폰 발급 화면",
      parent: "server-coupon",
      status: "fog",
      size: 1,
      signs: [
        {
          id: "coupon-limit",
          type: "fork",
          title: "한 사람당 발급 한도",
          owner: "me",
          options: ["1장", "3장", "제한 없음"],
          recommend: "3장",
          status: "open",
        },
      ],
    },
    // 프론트
    { id: "front", title: "화면", status: "building", size: 1 },
    {
      id: "front-product",
      title: "상품 상세",
      parent: "front",
      status: "done",
      size: 2,
      since: d(11),
    },
    {
      id: "front-cart",
      title: "장바구니",
      parent: "front",
      status: "building",
      size: 2,
      summary: "수량 바꾸기와 쿠폰 넣기 칸을 붙이는 중",
      next: "빈 장바구니 화면",
      since: d(4),
      signs: [
        {
          id: "empty-copy",
          type: "fork",
          title: "빈 장바구니에 추천 상품을 보일까",
          owner: "디자이너",
          options: ["보인다", "문구만"],
          status: "open",
        },
      ],
    },
    {
      id: "front-checkout",
      title: "주문서",
      parent: "front",
      status: "fog",
      size: 3,
      summary: "배송지·결제 수단·쿠폰을 한 화면에",
    },
    {
      id: "front-mobile",
      title: "모바일 맞춤",
      parent: "front",
      status: "fog",
      size: 2,
      found: d(12),
    },
    // 운영
    { id: "ops", title: "운영", status: "fog", size: 1 },
    {
      id: "ops-deploy",
      title: "배포",
      parent: "ops",
      status: "done",
      size: 1,
      since: d(18),
    },
    {
      id: "ops-alert",
      title: "장애 알림",
      parent: "ops",
      status: "fog",
      size: 2,
      signs: [
        {
          id: "alert-night",
          type: "risk",
          title: "밤에 알림을 받을 사람이 없다",
        },
      ],
    },
    {
      id: "ops-backup",
      title: "직접 백업",
      parent: "ops",
      status: "dropped",
      size: 1,
      summary: "호스팅의 자동 백업으로 충분해서 버렸다",
      found: d(14),
    },
    // 출시 준비
    { id: "launch", title: "출시 준비", status: "fog", size: 1 },
    {
      id: "launch-terms",
      title: "약관·개인정보",
      parent: "launch",
      status: "building",
      size: 1,
      since: d(2),
      signs: [
        {
          id: "terms-review",
          type: "talk",
          title: "약관 초안 검토",
          with: "자문 변호사",
          status: "sent",
          path: "docs/drafts/terms.md",
        },
      ],
    },
    {
      id: "launch-beta",
      title: "베타 손님 모으기",
      parent: "launch",
      status: "fog",
      size: 2,
      found: d(1),
      signs: [
        {
          id: "beta-size",
          type: "fork",
          title: "베타 손님 수",
          owner: "me",
          options: ["10명", "50명"],
          recommend: "10명",
          status: "open",
        },
      ],
    },
  ];
  return {
    map: "starship-map/1",
    title: "온라인 상점",
    goal: "첫 손님이 주문하고 결제·배송까지 끝난다",
    baselineAt: d(21),
    updatedAt: new Date(now - 2 * 3_600_000).toISOString(),
    here: "coupon-stack",
    regions,
  };
}
