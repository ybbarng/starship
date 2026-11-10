// 보안 구역 데모: 지어낸 신청서와 호출 기록. 데모 모드(STARSHIP_SERVER_URL 없음)에서만 쓴다.
// 공개 저장소라 금고·항목·세션 이름은 모두 지어낸 것이다(데모 승무원 이름을 쓴다).
// 비서 서버가 보내는 모양(시각은 ISO 글)으로 만들어 진짜 기록과 같은 검사(src/protocol/secure.ts)를 거친다.

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * 값처럼 보이는 지어낸 글자. 화면에 그려지면 안 되는 것을 시험한다.
 * 비밀 검사(gitleaks)가 글자 그대로의 가짜 값도 잡아서 조각을 이어 만든다.
 */
export const DEMO_FAKE_SECRET = ["Zp4QeW9t", "Lx2NvB7k", "Hs5JdR8m"].join("");

const sessions = {
  shop: {
    key: "demo-web-shop",
    name: "web-shop",
    cwd: "~/projects/web-shop",
    tmuxPane: "%12",
  },
  blog: {
    key: "demo-lunar-blog",
    name: "lunar-blog",
    cwd: "~/projects/lunar-blog",
    tmuxPane: "%15",
  },
  forge: {
    key: "demo-pixel-forge",
    name: "pixel-forge",
    cwd: "~/projects/pixel-forge",
    tmuxPane: "%9",
  },
  garden: {
    key: "demo-garden-bot",
    name: "garden-bot",
    cwd: "~/projects/garden-bot",
    tmuxPane: "%21",
  },
  billing: {
    key: "demo-billing-api",
    name: "billing-api",
    cwd: "~/projects/billing-api",
    tmuxPane: "%4",
  },
  pipeline: {
    key: "demo-data-pipeline",
    name: "data-pipeline",
    cwd: "~/projects/data-pipeline",
    tmuxPane: "%30",
  },
};

/** 데모 기록. now 기준으로 지어 늘 "지금 유효한 신청서" 둘이 보인다. 둘 다 최근순. */
export function demoSecureLog(now: number) {
  const iso = (ago: number) => new Date(now - ago).toISOString();
  const later = (ahead: number) => new Date(now + ahead).toISOString();

  const requests = [
    {
      id: "req-blog-2",
      at: iso(2 * MIN),
      expiresAt: later(28 * MIN),
      actor: "ai",
      session: sessions.blog,
      purpose: "블로그 배포 토큰이 만료되어 새 토큰을 배포 설정에 넣는다",
      plan: [
        "금고에서 배포 토큰 항목을 찾아 읽는다",
        "배포 설정 파일에 넣고 시험 배포를 한 번 돌린다",
        "읽은 값은 화면·기록에 남기지 않는다",
      ],
      items: [
        {
          ref: "op://Personal/blog.deploy.prod/DEPLOY_TOKEN",
          action: "read",
        },
        { ref: "op://Personal/blog.deploy.prod/DEPLOY_HOST", action: "read" },
      ],
    },
    {
      id: "req-shop-7",
      at: iso(6 * MIN),
      expiresAt: later(24 * MIN),
      actor: "ai",
      session: sessions.shop,
      purpose: "결제 시험 서버에 쓸 API 키를 .env.local에 넣는다",
      plan: ["op read로 시험 키를 읽는다", ".env.local에 쓴다"],
      items: [
        {
          ref: "op://Shop-Staging/payment-sandbox.api.v2/API_SECRET",
          action: "read",
        },
      ],
      card: "SHOP-142",
    },
    {
      id: "req-billing-3",
      at: iso(3 * HOUR),
      expiresAt: iso(2.5 * HOUR),
      actor: "ai",
      session: sessions.billing,
      purpose: "청구 서버 로컬 실행에 필요한 데이터베이스 비밀번호를 주입한다",
      plan: ["op run으로 환경 변수를 넣어 서버를 띄운다"],
      items: [
        {
          ref: "op://Billing-Dev/billing-db.local/password",
          action: "inject",
        },
      ],
      card: "BILL-88",
    },
    {
      id: "req-shop-6",
      at: iso(26 * HOUR),
      expiresAt: iso(25.5 * HOUR),
      actor: "ai",
      session: sessions.shop,
      purpose: "상품 이미지 저장소 접근 키를 바꾼 뒤 동작을 확인한다",
      plan: ["새 접근 키를 읽는다", "이미지 올리기 시험을 돌린다"],
      items: [
        {
          ref: "op://Shop-Staging/image-bucket.access/ACCESS_KEY",
          action: "read",
        },
      ],
    },
    {
      id: "req-pipeline-1",
      at: iso(3 * 24 * HOUR),
      expiresAt: iso(3 * 24 * HOUR - 30 * MIN),
      actor: "ai",
      session: sessions.pipeline,
      purpose: "야간 집계 작업이 쓰는 저장소 토큰을 새로 받아 확인한다",
      plan: ["토큰을 읽는다", "집계 작업을 한 번 손으로 돌린다"],
      items: [
        {
          ref: "op://Data/nightly-export.token/TOKEN",
          action: "read",
        },
      ],
    },
  ];

  const ai = (session: (typeof sessions)[keyof typeof sessions]) => ({
    actor: "ai",
    session,
  });

  const calls = [
    // lunar-blog: hook + wrapper 짝, 신청서 있음
    {
      id: "call-blog-w2",
      at: iso(MIN - 900),
      ...ai(sessions.blog),
      via: "wrapper",
      command: {
        sub: "item",
        args: [
          "get",
          "blog.deploy.prod",
          "--vault",
          "Personal",
          "--fields",
          "label=DEPLOY_HOST",
        ],
      },
      requestId: "req-blog-2",
      exit: 0,
      ms: 520,
    },
    {
      id: "call-blog-h2",
      at: iso(MIN),
      ...ai(sessions.blog),
      via: "hook",
      command: {
        sub: "item",
        args: ["get", "blog.deploy.prod", "--vault", "Personal"],
      },
      requestId: "req-blog-2",
      decision: "allowed",
    },
    // web-shop: hook + wrapper 짝, 신청서 있음
    {
      id: "call-shop-w7",
      at: iso(4 * MIN - 1_400),
      ...ai(sessions.shop),
      via: "wrapper",
      command: {
        sub: "read",
        args: ["op://Shop-Staging/payment-sandbox.api.v2/API_SECRET"],
      },
      requestId: "req-shop-7",
      exit: 0,
      ms: 410,
    },
    {
      id: "call-shop-h7",
      at: iso(4 * MIN),
      ...ai(sessions.shop),
      via: "hook",
      command: {
        sub: "read",
        args: ["op://Shop-Staging/payment-sandbox.api.v2/API_SECRET"],
      },
      requestId: "req-shop-7",
      decision: "allowed",
    },
    // 사람의 직접 실행
    {
      id: "call-me-1",
      at: iso(12 * MIN),
      actor: "human",
      via: "wrapper",
      context: {
        tty: "/dev/ttys004",
        termProgram: "iTerm.app",
        parentCmd: "-zsh",
        gitRoot: "~/projects/home-lab",
      },
      command: {
        sub: "read",
        args: ["op://Personal/home-router/admin-password"],
      },
      requestId: null,
      exit: 0,
      ms: 1_830,
    },
    // pixel-forge: 신청서 없이 부르려다 hook이 막음
    {
      id: "call-forge-h1",
      at: iso(20 * MIN),
      ...ai(sessions.forge),
      via: "hook",
      command: {
        sub: "read",
        args: ["op://Personal/sprite-cdn.upload/UPLOAD_KEY"],
      },
      requestId: null,
      decision: "denied",
    },
    // garden-bot: hook을 거치지 않고 wrapper로만 나간 호출(신청서 없음)
    {
      id: "call-garden-w1",
      at: iso(35 * MIN),
      ...ai(sessions.garden),
      via: "wrapper",
      command: { sub: "item", args: ["list", "--vault=Home-Automation"] },
      requestId: null,
      exit: 0,
      ms: 690,
    },
    {
      id: "call-me-2",
      at: iso(2 * HOUR),
      actor: "human",
      via: "wrapper",
      context: {
        tty: "/dev/ttys001",
        termProgram: "Apple_Terminal",
        parentCmd: "-zsh",
      },
      command: { sub: "signin", args: [] },
      requestId: null,
      exit: 0,
      ms: 4_200,
    },
    // billing-api: 비서가 인자를 미리 가려 보낸 호출
    {
      id: "call-billing-w3",
      at: iso(3 * HOUR - 50 * 1_000),
      ...ai(sessions.billing),
      via: "wrapper",
      command: { sub: "run", args: ["<가림>"] },
      requestId: "req-billing-3",
      exit: 0,
      ms: 2_950,
    },
    {
      id: "call-billing-h3",
      at: iso(3 * HOUR - 52 * 1_000),
      ...ai(sessions.billing),
      via: "hook",
      command: { sub: "run", args: ["<가림>"] },
      requestId: "req-billing-3",
      decision: "allowed",
    },
    // 사람이 값을 인자로 바로 넣은 호출(화면에는 그 글자를 그리지 않는다)
    {
      id: "call-me-3",
      at: iso(5 * HOUR),
      actor: "human",
      via: "wrapper",
      context: {
        tty: "/dev/ttys004",
        termProgram: "iTerm.app",
        parentCmd: "-zsh",
        gitRoot: "~/projects/lunar-blog",
      },
      command: {
        sub: "item",
        args: [
          "edit",
          "blog.deploy.prod",
          "--vault",
          "Personal",
          `DEPLOY_TOKEN=${DEMO_FAKE_SECRET}`,
        ],
      },
      requestId: null,
      exit: 0,
      ms: 2_100,
    },
    {
      id: "call-shop-w6",
      at: iso(26 * HOUR - 3 * MIN),
      ...ai(sessions.shop),
      via: "wrapper",
      command: {
        sub: "read",
        args: ["op://Shop-Staging/image-bucket.access/ACCESS_KEY"],
      },
      requestId: "req-shop-6",
      exit: 0,
      ms: 380,
    },
    {
      id: "call-pipeline-w1",
      at: iso(3 * 24 * HOUR - 5 * MIN),
      ...ai(sessions.pipeline),
      via: "wrapper",
      command: { sub: "read", args: ["op://Data/nightly-export.token/TOKEN"] },
      requestId: "req-pipeline-1",
      exit: 1,
      ms: 240,
    },
  ];

  return { requests, calls };
}
