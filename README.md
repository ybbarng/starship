# Starship

AI 코딩 세션과 나를 부르는 메시지를 한 화면에서 챙기는 **우주선 조종석** 대시보드.

- 첫 화면은 조종석: 위쪽 창밖으로 실제 별 배치·별자리를 따라 태양계와 유명한 별을 여행하고, 아래 계기판에 **지금 할 일**이 승무원별 결재함으로 보인다.
- 다른 사람이 부르면 다른 우주선이 교신해 온다.
- 스크롤을 내리면 우주선 전경이 나오고, 프로젝트마다 자리에 앉은 동물 선원과 이야기한다. 선원을 누르면 그 프로젝트의 선실(지도·책상)로 간다.

화면만 맡는다. 데이터는 [Starship 프로토콜](docs/protocol.md)을 따르는 서버(이 문서에서는 **본부**)에서 받는다. 본부가 없으면 지어낸 데모 데이터로 돈다.

## 1. 데모로 띄우기

Node.js 24와 pnpm이 필요하다.

```sh
pnpm install
pnpm dev                 # http://127.0.0.1:7790 (데모 모드)
```

빌드본으로 띄우려면 `pnpm build` 뒤 `pnpm start`(같은 주소). 두 스크립트 모두 `-H 127.0.0.1 -p 7790`으로 이 컴퓨터 안에서만 열린다. 앱은 `Host`가 127.0.0.1·localhost·[::1]이 아닌 요청을 거절하므로 다른 기기에서는 볼 수 없다([files.md](docs/files.md)).

둘러볼 곳:

| 주소 | 화면 |
|---|---|
| `/` | 조종석과 우주선 전경 |
| `/crew/web-shop`, `/crew/star-atlas` | 선실(지도·책상·브리핑). 뒤의 것은 구역이 많은 지도 |
| `/fuel`, `/usage` | 연료실, 연료 기록 노트(토큰 사용량) |

데모 시나리오는 주소 뒤에 붙인다: `?demo=empty`(할 일 0개), `?demo=busy`(승무원 30명), `?link=ok|warn|down|off|vpn-warn|vpn-down`(관제 링크 모습).

## 2. 본부에 붙이기

본부는 할 일·교신·승무원·계기판·지도·책상을 [프로토콜](docs/protocol.md) 모양으로 내주는 HTTP 서버다. 쓰고 있는 비서·세션 관리 도구에 이 모양을 내주는 어댑터를 달면 된다. 이 저장소에는 본부가 들어 있지 않다.

```sh
STARSHIP_SERVER_URL=http://127.0.0.1:7787/starship pnpm dev
```

브라우저는 Starship 자신의 `/api/v1/*`만 부르고, Starship 서버가 본부로 넘긴다. 그래서 본부는 이 컴퓨터 안에만 열어 두면 되고 CORS를 따로 둘 필요가 없다. 본부가 내줘야 하는 끝점은 [protocol.md "끝점"](docs/protocol.md#끝점)에 있다.

## 3. 사용량(연료실)

본부와 따로, Starship 서버가 이 컴퓨터의 Claude Code 기록을 직접 읽어 토큰 사용량을 보인다. 설정하지 않으면 지어낸 숫자를 보인다.

```sh
STARSHIP_USAGE_DIR=~/.claude/projects \
STARSHIP_USAGE_AREAS="work:~/company;personal:~/personal" \
pnpm dev
```

주간 한도(주 연료통)는 기록에 없어 본부의 `GET {base}/v1/usage/limits`에서 받는다. 본부가 없으면 그 칸만 숨긴다. 읽는 방식과 한계는 [usage.md](docs/usage.md).

## 4. 파일 보기·열기

책상 카드에 적힌 파일 경로(스크린샷·PDF·md 등)를 "보기"(새 탭)·"열기"(macOS `open`)로 바로 다룬다. 허용할 폴더를 콜론으로 이어 준다.

```sh
STARSHIP_FILE_ROOTS=~/Desktop:~/Downloads pnpm dev
```

- 본부에 붙였는데 이 값이 없으면 파일 요청을 모두 거절한다. 데모 모드는 `public/demo-files`의 예시 파일만 보인다.
- 숨김 파일·폴더, 실행 파일, svg·html은 받지 않는다. 홈 전체(`~`)는 권하지 않는다.
- 서버가 127.0.0.1에만 묶였을 때만 내준다. `pnpm dev`·`pnpm start`는 이미 그렇게 띄운다. 다른 방식으로 띄우면 `STARSHIP_BIND`를 실제로 묶은 주소로 둔다.

자세한 규칙은 [files.md](docs/files.md).

## 5. 책상과 지도

선실의 두 판은 세션(AI)이 직접 적는 파일에서 온다. 본부가 파일을 찾아 읽고 끝점으로 내준다.

- **책상**(`starship-desk/1`): 세션이 나를 기다리는 것(고르기·확인·승인·질문)과 지금 하는 일. 형식은 [desk.md](docs/desk.md), 원본 스키마는 [`src/protocol/desk.ts`](src/protocol/desk.ts).
- **지도**(`starship-map/1`): 프로젝트 저장소 안의 `map.json`. 구역·진척·갈림길·교신. 형식은 [map.md](docs/map.md), 원본 스키마는 [`src/protocol/map.ts`](src/protocol/map.ts). 이 저장소의 [`map.json`](map.json)이 실제 예다.

## 환경 변수

모두 Starship 서버가 읽는다. 셸에서 앞에 붙이거나 `.env.local`(git에 올라가지 않는다)에 적는다. `~`는 앱이 홈으로 펼친다. 바꾼 뒤에는 앱을 다시 띄운다.

| 변수 | 뜻 | 없으면 | 예 |
|---|---|---|---|
| `STARSHIP_SERVER_URL` | 본부 주소 | 데모 데이터 | `http://127.0.0.1:7787/starship` |
| `STARSHIP_USAGE_DIR` | Claude Code 기록 폴더 | 지어낸 사용량 | `~/.claude/projects` |
| `STARSHIP_USAGE_AREAS` | 프로젝트 경로를 업무·개인·기타로 나누는 규칙. `영역:경로`를 `;`로 잇고, 영역은 `work`·`personal`·`other`. 가장 긴 경로가 이긴다 | 모두 기타 | `work:~/company;personal:~/personal` |
| `STARSHIP_USAGE_ACCOUNT_SWITCH` | 계정을 바꾼 날(`YYYY-MM-DD`). 연료 기록 노트에 그날 앞뒤 기록이 섞여 있다고 적는다 | 적지 않음 | `2026-11-01` |
| `STARSHIP_STATE_DIR` | 사용량을 어디까지 읽었는지와 합계를 남길 폴더 | `~/.local/state/starship` | |
| `STARSHIP_FILE_ROOTS` | 보기·열기를 허용할 폴더, `:`로 나눔 | 본부 모드는 모두 거절, 데모는 `public/demo-files`만 | `~/Desktop:~/Downloads` |
| `STARSHIP_BIND` | 서버를 묶은 주소. 파일 보기·열기가 이 컴퓨터 안에서만 열렸는지 판단할 때 쓴다. 띄울 때 인자(`-H`)가 보이면 둘 다 이 컴퓨터 자신이어야 열린다. `pnpm dev`는 마지막 `-H` 값으로 저절로 둔다 | 인자 → `HOSTNAME` 순으로 보고, 다 없으면 파일을 내주지 않음 | `127.0.0.1` |
| `STARSHIP_DIST_DIR` | 빌드 폴더. 늘 켜 둔 앱의 `.next`를 덮지 않고 따로 빌드해 볼 때 | `.next` | `.next-check` |
| `STARSHIP_DENYLIST` | (커밋 검사용) 금지어 목록 파일 | `~/.config/starship/denylist` | |

## 개발

```sh
pnpm lint        # biome
pnpm typecheck
pnpm test        # vitest
pnpm sky:build   # 별 데이터 다시 만들기
```

커밋 전 lefthook이 biome, [gitleaks](https://github.com/gitleaks/gitleaks)(비밀 검사), 금지어 검사를 돌린다. 금지어 목록은 저장소 밖 `~/.config/starship/denylist`(한 줄에 하나, `STARSHIP_DENYLIST`로 바꿀 수 있다)에 두며, 파일이 없으면 검사를 건너뛴다.

따로 빌드해 확인할 때는 띄워 둔 앱과 빌드 폴더가 겹치지 않게 한다.

```sh
STARSHIP_DIST_DIR=.next-check pnpm build
STARSHIP_DIST_DIR=.next-check pnpm exec next start -H 127.0.0.1 -p 7791
```

## 문서

[docs/README.md](docs/README.md)에 문서마다 무엇을 정했는지 한 줄씩 적어 두었다. 처음이면 이 순서로 읽는다.

1. [protocol.md](docs/protocol.md) — 본부와 주고받는 모양
2. [desk.md](docs/desk.md), [map.md](docs/map.md) — 세션이 적는 책상·지도 형식
3. [usage.md](docs/usage.md), [files.md](docs/files.md) — 본부 없이 Starship 서버가 직접 하는 일
4. [ASSETS.md](docs/ASSETS.md) — 외부 자료와 라이선스

## 라이선스

코드는 [MIT](LICENSE). 별 데이터와 글꼴은 각자의 라이선스를 따른다([ASSETS.md](docs/ASSETS.md)).
