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

/** 구역이 많은 데모 지도가 있는 승무원 */
export const DEMO_BIG_MAP_CREW = "star-atlas";

/**
 * 구역 40개짜리 데모 지도: 지어낸 별자리 앱. 실제 지도처럼 3단, 25자 넘는 긴 이름,
 * 절반 넘게 발견 구역이 섞여 있어 시안이 많은 구역에서 무너지지 않는지 본다.
 */
export function buildBigDemoMap(now = Date.now()): ProjectMap {
  const d = (n: number) => daysAgo(now, n);
  type Seed = [
    id: string,
    title: string,
    parent: string | undefined,
    status: Region["status"],
    size: number,
    foundDaysAgo?: number,
  ];
  const seeds: Seed[] = [
    ["sky", "하늘 그리기", undefined, "building", 1],
    ["sky-stars", "별 목록 읽기", "sky", "done", 2],
    ["sky-lines", "별자리 선", "sky", "done", 2],
    ["sky-names", "별 이름표 겹침 피하기", "sky", "building", 2, 6],
    ["sky-milky", "은하수 띠", "sky", "fog", 1, 3],
    ["sky-planets", "행성 위치 계산", "sky", "building", 1],
    ["planet-orbit", "궤도 요소로 위치 구하기", "sky-planets", "done", 2],
    ["planet-moon", "달의 위상", "sky-planets", "building", 1, 4],
    ["planet-rings", "토성 고리 기울기", "sky-planets", "fog", 1, 2],
    ["view", "보는 방법", undefined, "building", 1],
    ["view-drag", "끌어서 둘러보기", "view", "done", 1],
    ["view-zoom", "확대·축소", "view", "done", 1],
    ["view-time", "시간 되감기와 빨리 감기", "view", "building", 2],
    ["view-place", "관측 장소 고르기", "view", "fog", 2],
    ["view-ar", "휴대폰을 하늘에 들면 그 방향 보이기", "view", "fog", 3, 5],
    ["view-a11y", "화면 읽기 프로그램으로 별자리 듣기", "view", "fog", 2, 1],
    ["learn", "배우기", undefined, "fog", 1],
    ["learn-cards", "별자리 이야기 카드", "learn", "building", 2],
    ["learn-quiz", "별자리 맞히기 놀이", "learn", "fog", 2, 6],
    ["learn-tour", "오늘 밤 볼 것 안내", "learn", "fog", 1, 2],
    ["learn-kids", "어린이용 쉬운 말 설명", "learn", "dropped", 1, 9],
    ["data", "자료", undefined, "building", 1],
    ["data-catalog", "별 목록 출처와 라이선스 정리", "data", "done", 1],
    ["data-size", "별 목록 크기 줄이기", "data", "blocked", 2, 5],
    ["data-offline", "인터넷 없이 쓰기", "data", "fog", 2, 3],
    ["data-sync", "즐겨찾기 기기 사이 동기화", "data", "fog", 2, 1],
    ["ship", "내보내기", undefined, "fog", 1],
    ["ship-web", "웹으로 배포", "ship", "done", 1],
    ["ship-app", "앱 스토어", "ship", "fog", 1],
    ["app-review", "앱 심사 준비", "ship-app", "fog", 1, 2],
    ["app-icon", "앱 아이콘과 첫 화면 그림", "ship-app", "building", 1, 4],
    [
      "app-store-text",
      "스토어 소개 글과 스크린샷 다섯 장",
      "ship-app",
      "fog",
      1,
      4,
    ],
    ["ship-perf", "느린 휴대폰에서 초당 60장", "ship", "blocked", 2, 6],
    ["ship-crash", "오류 알림 모으기", "ship", "fog", 1, 5],
    ["ship-beta", "시험 사용자 모으기", "ship", "fog", 1, 1],
    ["ops", "운영", undefined, "fog", 1, 6],
    ["ops-cost", "지도 타일 비용 살피기", "ops", "fog", 1, 6],
    ["ops-backup", "사용자 자료 백업", "ops", "fog", 1, 6],
    ["ops-feedback", "의견 받는 창구", "ops", "building", 1, 3],
    ["ops-status", "서비스 상태 쪽", "ops", "dropped", 1, 6],
  ];
  const regions: Region[] = seeds.map(
    ([id, title, parent, status, size, f]) => ({
      id,
      title,
      parent,
      status,
      size,
      found: f === undefined ? undefined : d(f),
      since: status === "fog" ? undefined : d(Math.max(1, (f ?? 14) - 1)),
    }),
  );
  const byId = new Map(regions.map((r) => [r.id, r]));
  const sign = (id: string, s: NonNullable<Region["signs"]>[number]) => {
    const r = byId.get(id);
    if (r) r.signs = [...(r.signs ?? []), s];
  };
  sign("sky-names", {
    id: "label-rule",
    type: "fork",
    title: "이름표가 겹치면 밝은 별을 먼저",
    owner: "me",
    options: ["밝은 별 먼저", "가까운 별 먼저"],
    recommend: "밝은 별 먼저",
    status: "open",
  });
  sign("view-ar", {
    id: "ar-sensor",
    type: "fork",
    title: "방향 센서 권한을 처음부터 물을까",
    owner: "me",
    options: ["처음부터", "처음 쓸 때"],
    recommend: "처음 쓸 때",
    status: "open",
  });
  sign("data-size", {
    id: "catalog-mirror",
    type: "talk",
    title: "작은 별 목록 나눠 받기",
    with: "자료 관리자",
    status: "waiting",
  });
  sign("ship-perf", {
    id: "gpu-old",
    type: "risk",
    title: "오래된 휴대폰 그래픽 칩에서 셰이더가 안 돈다",
  });
  sign("learn-cards", {
    id: "card-tone",
    type: "fork",
    title: "이야기 카드 말투",
    owner: "편집자",
    options: ["다정하게", "담백하게"],
    status: "open",
  });
  sign("app-store-text", {
    id: "store-copy",
    type: "talk",
    title: "소개 글 검토",
    with: "편집자",
    status: "draft",
  });
  const planetOrbit = byId.get("planet-orbit");
  if (planetOrbit) {
    planetOrbit.summary = "궤도 요소 표로 오늘 날짜의 행성 위치를 계산한다";
    planetOrbit.links = [{ label: "계산 메모", path: "docs/orbit.md" }];
  }
  const here = byId.get("view-time");
  if (here) {
    here.summary =
      "시간 막대를 끌면 하늘이 그 시각으로 돈다. 빨리 감기 속도 단계를 고르는 중";
    here.next = "하루를 10초에 도는 속도 확인";
  }
  return {
    map: "starship-map/1",
    title: "별자리 앱",
    goal: "처음 쓰는 사람이 오늘 밤 하늘에서 별자리 하나를 찾는다",
    baselineAt: d(15),
    updatedAt: new Date(now - 40 * 60_000).toISOString(),
    here: "view-time",
    regions,
  };
}
