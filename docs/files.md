# 선실에서 파일 바로 보기·열기 + PWA — 설계

세션이 만든 결과물 중에는 주소가 없는 것이 많다. 스크린샷, PDF 보고서, 화면 녹화, 기록 파일. 지금까지는 경로를 복사해 Finder나 터미널에서 찾아 열어야 했다. 이제 책상 카드의 "보기"·"열기" 단추로 바로 본다.

- **보기**: `GET /api/files?path=<절대 경로>` — 새 탭에서 바로 보인다(내려받지 않는다). md는 날 글 대신 그린 글로 보이는 화면 `/files/view?path=<경로>`로 연다(아래 "md 보기 화면").
- **열기**: `POST /api/files/open` `{ "path": "<절대 경로>" }` — 맥의 맞는 프로그램(미리보기·QuickTime 등)에서 연다.
- **PWA**: `src/app/manifest.ts`로 Chrome "앱으로 설치"를 켠다. 선실을 따로 된 창으로 띄워 두고 쓴다.

코드: [`src/server/files.ts`](../src/server/files.ts)(검사), [`src/app/api/files/route.ts`](../src/app/api/files/route.ts)(보기), [`src/app/api/files/open/route.ts`](../src/app/api/files/open/route.ts)(열기), [`src/ui/kit/FileButtons.tsx`](../src/ui/kit/FileButtons.tsx)(단추), [`src/ui/desk/waitFiles.ts`](../src/ui/desk/waitFiles.ts)(책상 글 속 경로 고르기), [`src/app/files/view/page.tsx`](../src/app/files/view/page.tsx)·[`src/ui/files/MdView.tsx`](../src/ui/files/MdView.tsx)(md 보기 화면). 시험: [`src/server/files.test.ts`](../src/server/files.test.ts), [`src/ui/desk/waitFiles.test.ts`](../src/ui/desk/waitFiles.test.ts), [`src/ui/kit/filePaths.test.ts`](../src/ui/kit/filePaths.test.ts).

## 비서가 설정할 환경 변수

| 이름 | 뜻 | 예 |
|---|---|---|
| `STARSHIP_FILE_ROOTS` | 보기·열기를 허용할 폴더. 콜론(`:`)으로 나눈다. `~`는 홈으로 펼친다. 절대 경로가 아닌 조각은 버린다 | `~/Desktop:~/Downloads:~/Documents/starship-out` |

- 이 값이 없으면: 서버 모드(`STARSHIP_SERVER_URL`이 있을 때)는 **모든 파일 요청을 거절**한다. 데모 모드는 저장소의 `public/demo-files`(지어낸 예시 파일)만 허용하고, 열기는 검사까지만 하고 실제로 실행하지 않는다.
- 허용 폴더는 좁게 잡는다. 홈 전체(`~`)는 권하지 않는다. 숨김 폴더는 막히지만, 홈 아래에는 숨김이 아닌 민감한 파일(`~/Library` 아래 메일·메시지 등)도 있다.
- 바꾼 뒤에는 앱(7790)을 다시 띄워야 반영된다.

## 1. 데이터의 뜻·연결·책임

- **책상의 `path`**(`options[].path`, `items[].path`): 세션이 "이 파일을 봐 달라"고 적는 이 맥의 파일 경로다. 형식은 [`desk.md`](desk.md), 원본은 `src/protocol/desk.ts`. 형식은 `/`나 `~/`로 시작하는지만 본다(`~/`는 아래 `expandHome`이 펼친다). 책임은 세션(비서가 책상 파일로 옮겨 적음)에 있다.
- **허용 폴더**(`STARSHIP_FILE_ROOTS`): 이 맥 주인이 "여기 있는 것은 선실에서 봐도 된다"고 정한 목록이다. 책임은 비서 설정에 있다.
- **끝점**: 책상과 따로 선다. 책상에 없는 경로도 같은 규칙으로 받는다. 책상과는 경로 글 하나로만 이어진다.

## 2. 꼭 지킬 규칙과 보장 방법

| 규칙 | 보장 |
|---|---|
| `~/` 경로도 받는다(2026-11-02) | 세션들이 경로를 `~/…`로 적는다. `expandHome`이 홈 아래로 펼친 뒤 아래 검사를 똑같이 한다. `path.join`을 쓰지 않고 이어 붙여서 `~/../x`의 `..`도 그대로 거절된다 |
| 허용 폴더 안의 파일만 | 경로와 허용 폴더를 모두 `realpath`로 푼 뒤 `isInside`로 본다. `../`는 글 단계(`checkInput`)에서도 거절한다. 이름만 비슷한 옆 폴더(`root-sibling`)는 `path.relative`로 걸러진다 |
| 심볼릭 링크로 밖에 나가지 못한다 | 판단은 풀린 실제 경로로 한다. 확장자도 실제 파일 이름으로 본다(`a.pdf` → `run.sh` 링크는 sh로 판단) |
| 숨김 파일·폴더(`.ssh`, `.env`, `.git` …)는 거절 | 허용 폴더 아래 상대 경로에 `.`으로 시작하는 조각이 있으면 거절(`hasHiddenPart`). 허용 폴더 자체가 숨김 폴더 아래 있는 것은 괜찮다. 예외: 세션 작업 사본 `.claude/worktrees/<이름>/` 안의 파일(사본 안의 `.git`·`.env` 같은 숨김 조각은 계속 거절, 2026-11-01) |
| 보기는 정한 종류만 | `VIEW_TYPES`: png jpg jpeg gif webp pdf mp4 mov webm txt md log json csv. svg·html은 스크립트를 담을 수 있어 받지 않는다. md·log·json·csv는 `text/plain`으로 준다 |
| 보기 응답이 이 앱 출처로 스크립트를 돌리지 못한다 | `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Content-Disposition: inline` |
| 보기는 200MB까지 | `MAX_VIEW_BYTES`. 넘으면 413, 열기로 본다 |
| 다른 사이트가 내 파일을 끌어가지 못한다 | 보기는 `Sec-Fetch-Site`가 `same-origin`(카드 링크)이고 `Host`가 이 컴퓨터 자신(127.0.0.1·localhost·[::1])일 때만. `none`(주소창)은 브라우저가 아닌 클라이언트가 마음대로 넣을 수 있어 받지 않는다(2026-11-01 비서 지적). `Host`를 보면 DNS 재바인딩도 막힌다 |
| 같은 Wi-Fi·VPN의 다른 기기가 못 본다 | 서버를 `next start -H 127.0.0.1`로 띄운다(비서 install-starship.sh). 코드는 ① `STARSHIP_BIND` 환경 변수 ② 띄울 때 인자(`-H`·`--hostname`) ③ `HOSTNAME` 순서로 보고, 처음 보이는 값이 이 컴퓨터 자신이 아니면(아무것도 없어도) 모든 주소로 뜬 것으로 보고 보기·열기를 거절한다(`boundToLoopback`). 다른 기기는 `Host`·`Origin`을 꾸밀 수 있어서다. 데모 예시 파일만 예외 |
| `next dev`에서도 보기·열기가 된다(2026-11-03) | `next dev`는 서버를 자식 프로세스로 띄우며 `-H`를 인자로 넘기지 않아(`next/dist/cli/next-dev.js`) ②가 보이지 않고 늘 거절됐다. 그래서 `pnpm dev`는 `STARSHIP_BIND=127.0.0.1 next dev -H 127.0.0.1`로 띄운다. `pnpm start`도 `-H 127.0.0.1`을 붙인다(`next start`는 같은 프로세스라 ②로 보인다). 다른 방식으로 띄우면 `STARSHIP_BIND`를 실제로 묶은 주소와 같게 둔다 |
| 앱 전체가 이 컴퓨터 자신의 이름으로만 열린다 | `src/proxy.ts`가 모든 요청의 `Host`를 보고 127.0.0.1·localhost·[::1]이 아니면 421(2026-11-01 사용자 결정). 남의 도메인이 127.0.0.1을 가리키게 하는 DNS 재바인딩으로 조종석·API를 읽지 못한다. 조종석을 다른 기기에서 보지 않기로 해 로그인은 두지 않았다. 폰 등에서 보게 되면 이 검사를 넓히기 전에 로그인부터 둔다 |
| 다른 사이트가 내 맥에서 파일을 열지 못한다 | 열기는 `isSameOrigin`(Origin = Host)일 때만 |
| 실행 파일은 열지 않는다 | 열기는 `OPEN_EXTS`(문서·이미지·영상·소리) 확장자만. 보통 파일만(`.app`·폴더 거절), 실행 권한 비트가 붙은 파일도 거절 |
| 셸을 거치지 않는다 | `execFile("/usr/bin/open", ["--", 경로])` |
| md 보기 화면도 같은 검사를 받는다(2026-11-03) | `/files/view`는 서버에서 파일을 읽지 않는다(주소의 경로로 문서 제목만 정한다). 화면이 브라우저에서 `/api/files`를 fetch하므로 `Sec-Fetch-Site: same-origin`·허용 폴더·숨김 검사가 그대로 걸린다. 거절되면 서버가 준 까닭 글을 그대로 보인다 |
| md 속 HTML·스크립트는 그리지 않는다 | `react-markdown`에 `rehype-raw`를 붙이지 않아 HTML은 글자로만 나온다(`<script>`·`<img onerror>`도 글자). 위험한 주소(`javascript:` 등)는 기본 `urlTransform`이 빈 값으로 바꾸고, 링크는 http(s)·mailto만 새 탭(`noopener noreferrer`)으로 연다. 상대 경로 링크는 링크로 두지 않는다 |
| md 속 그림이 검사를 우회하지 않는다 | 그림은 불러오지 않고 `[그림: 대체 글]`로 둔다(http(s)면 그 주소로 가는 링크). 로컬 경로 그림을 `<img>`로 부르면 같은 출처 요청이라 다른 파일을 끌어 쓸 수 있고, 바깥 주소면 파일을 연 사실이 밖으로 나간다 |
| 글 속 경로에도 단추를 단다(2026-11-03) | 책상 선택지·확인 항목에 `path`가 없으면 label·look·note에서, 기다림 세부에서도 `findPaths`로 경로를 찾는다. `path`가 있으면 그것만. 같은 경로는 한 번만 붙인다(`src/ui/desk/waitFiles.ts`, 시험 `waitFiles.test.ts`). 찾은 경로도 서버가 똑같이 검사한다 |

시험(`files.test.ts`)은 임시 폴더에 진짜 파일·링크를 만들어 위 규칙을 하나씩 확인한다: `../`, 밖으로 가는 링크, 안에서 도는 링크, 이름만 pdf인 링크, 숨김 파일·숨김을 가리키는 링크, 허용 폴더 밖·옆 폴더, html·sh·.app·실행 권한 파일.

남는 틈: 검사와 읽기 사이에 파일을 바꿔치는 경쟁(TOCTOU)은 막지 않는다. 허용 폴더에 쓸 수 있는 것은 이 맥의 주인 자신뿐이라는 전제다.

## 3. 사람과 AI가 찾아 쓰는 법

- **세션(AI)**: 결과물을 허용 폴더(예: `~/Desktop`) 아래에 저장하고, 책상 기다림의 `options[].path`나 `items[].path`에 경로를 적는다. 절대 경로(`/Users/…`)나 `~/…` 둘 다 된다. `~user/…`나 상대 경로는 형식 검사에서 걸린다.
- **사람**: 선실 책상 카드에서 파일 이름 옆 "보기"(새 탭) 또는 "열기"(맥 프로그램)를 누른다. 조종석 결재함에서는 서류 제목·세부에 적힌 경로(`/…`·`~/…`, 확장자로 끝남, `src/ui/kit/filePaths.ts`의 `findPaths`)마다 같은 단추가 붙는다. 거절되면 까닭이 알림으로 뜬다("허용 폴더 밖이에요", "숨김 파일·폴더예요" 등).
- **글 속 경로**: 세션이 `path`를 빠뜨리고 label 글에만 "초안 /…/foo.md"처럼 적어도 선실 책상 카드가 그 경로에 단추를 붙인다. 그래도 세션은 되도록 `path`에 적는다(단추 자리가 분명하다).
- **md 보기 화면**: md의 "보기"는 `/files/view?path=<경로>`를 새 탭으로 연다. 제목·목록·표·체크 목록·코드·인용을 어두운 화면에 72ch 폭으로 그린다(`src/ui/files/MdView.tsx`, 글 모양은 `globals.css`의 `.md-body`). 위에 파일 이름·전체 경로·"열기"·"날 글 보기" 전환이 있다. 탭 제목은 파일 이름이다. 라이브러리: `react-markdown` 10.1.0, `remark-gfm` 4.0.1(정확한 버전으로 고정).
- **직접 확인**: 선실 책상 카드의 "보기"로 연다. 데모 선실(`/crew/web-shop`) "결제 화면 연출 4개 확인"의 릴리스 노트 항목이 label 글 속 경로 + md 보기 예다(`public/demo-files/release-notes.md`). 주소창에 직접 넣으면(`Sec-Fetch-Site: none`) 거절된다.
- **PWA**: Chrome 주소창 오른쪽의 설치 아이콘 또는 메뉴 → "앱으로 설치". 따로 된 창에서 "보기"는 기본 브라우저 탭으로 열린다.
- **Dock 배지**: 설치한 앱의 Dock 아이콘에 모든 승무원 책상의 기다림 수 합계가 뜬다(`src/ui/AppBadge.tsx`, Badging API, 0이면 지운다). 모든 화면이 쓰는 5초 스냅숏의 `crew[].desk.waiting`을 더한다. 앱 창이 열려 있을 때만 바뀌고, 창을 닫으면 마지막 숫자가 남는다. 서버에 못 닿으면 마지막 숫자를 그대로 둔다. 브라우저 탭에서는 아무 일도 하지 않는다.
- **새 빌드 반영**: 앱 창은 7790 화면을 그대로 보여 주므로 따로 업데이트할 것이 없다. 다만 열려 있는 창은 새 빌드가 떠도 옛 화면 코드를 계속 돌린다(데이터는 5초마다 새로 받는다). Cmd+R로 새로 고치면 새 화면이 된다. 이름·아이콘(manifest)이 바뀌면 Chrome이 스스로 다시 받는다.

## 4. 요구사항이 바뀌면

- **보기 종류를 더하기**(예: heic): `VIEW_TYPES`에 한 줄 더하고 시험에 한 줄 더한다. 브라우저가 그 종류를 바로 보여 주는지 먼저 확인한다.
- **열기 종류를 더하기**: `OPEN_EXTS`에 더한다. 스크립트·설치 파일·앱 묶음(`sh command tool pkg app` 등)은 넣지 않는다.
- **허용 폴더 바꾸기**: 환경 변수만 바꾸고 앱을 다시 띄운다. 코드는 그대로다.
- **다른 기계(맥이 아닌 곳)**: 열기는 501을 준다. 리눅스용 `xdg-open`이 필요해지면 `openOnMac` 옆에 하나 더 둔다.
- **폴더 목록 보기·여러 파일 묶어 보기**가 필요해지면: 지금 끝점은 파일 하나만 다룬다. 새 끝점을 두고 같은 `resolveFile` 검사를 쓴다.
- **서비스 워커(오프라인)**가 필요해지면: 늘 켜 둔 앱이 새 빌드를 받았을 때 옛 화면이 남지 않도록 갱신 규칙부터 정한다.

## 5. 다른 방법과 고른 이유

지도 표지 `files-way`에서 "starship 서버 + PWA"로 정했다(2026-11-01).

| 방법 | 좋은 점 | 아쉬운 점 |
|---|---|---|
| **starship 서버 + PWA(고름)** | 이미 켜 둔 Next 서버에 끝점 두 개만 더하면 된다. 브라우저가 이미지·PDF·영상을 잘 보여 준다. PWA로 따로 된 창도 얻는다 | 웹 서버가 로컬 파일을 내주므로 출처 검사·허용 폴더·숨김 검사를 꼼꼼히 해야 한다 |
| 맥 앱(Tauri) | 파일 시스템을 직접 다룬다. 메뉴 막대·알림도 된다 | 새 빌드 체계(Rust)와 서명·배포를 따로 챙겨야 한다. 화면 코드도 둘로 갈린다 |
| 보기만 | 가장 작고 안전하다 | 키노트·엑셀·큰 영상처럼 브라우저가 못 보여 주는 결과물을 다시 경로 복사로 열어야 한다 |
| `file://` 링크 | 서버가 필요 없다 | Chrome이 http 페이지에서 `file://` 링크를 막는다 |

서비스 워커는 두지 않았다. 늘 켜 둔 앱이 새로 빌드돼도 캐시된 옛 화면이 남는 문제를 피하려고다. Chrome은 manifest와 아이콘만으로 설치를 허용한다.

그래서 서버가 아직 안 떴을 때(로그인 직후 앱 창이 `next start`보다 먼저 열리거나, 서버가 다시 뜨는 사이) 앱 창에는 Chrome의 "연결할 수 없음" 화면이 뜨고 저절로 다시 시도하지 않는다. Cmd+R로 새로 고치면 된다(2026-11-01 사용자: 이 정도면 괜찮다). 저절로 넘어가게 하려면 캐시 없이 연결 실패 때만 대기 화면을 주고 서버를 찔러 보는 작은 서비스 워커를 둔다.
