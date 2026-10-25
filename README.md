# Starship

AI 코딩 세션과 나를 부르는 메시지를 한 화면에서 챙기는 **우주선 조종석** 대시보드.

- 첫 화면은 조종석: 위쪽 창밖으로 실제 별 배치·별자리를 따라 태양계와 유명한 별을 여행하고, 아래 계기판에 **지금 할 일 하나**가 글과 버튼으로 보인다.
- 다른 사람이 부르면 다른 우주선이 교신해 온다.
- 스크롤을 내리면 우주선 전경이 나오고, 프로젝트마다 자리에 앉은 동물 선원과 이야기한다.

화면만 맡는다. 데이터는 [Starship 프로토콜](docs/protocol.md)을 따르는 서버에서 받는다. 서버가 없으면 지어낸 데모 데이터로 돈다.

## 실행

```sh
pnpm install
pnpm dev            # http://127.0.0.1:7790 (데모 모드)
STARSHIP_SERVER_URL=http://127.0.0.1:7787/starship pnpm dev   # 프로토콜 서버에 붙이기
```

데모 시나리오: 주소 뒤에 `?demo=empty`(할 일 0개), `?demo=busy`(승무원 30명).

## 개발

```sh
pnpm lint        # biome
pnpm typecheck
pnpm test        # vitest
pnpm sky:build   # 별 데이터 다시 만들기
```

커밋 전 lefthook이 biome, [gitleaks](https://github.com/gitleaks/gitleaks)(비밀 검사), 금지어 검사를 돌린다. 금지어 목록은 저장소 밖 `~/.config/starship/denylist`(한 줄에 하나)에 두며, 파일이 없으면 검사를 건너뛴다.

## 문서

- [프로토콜](docs/protocol.md)
- [외부 자료와 라이선스](docs/ASSETS.md)
- [아이디어와 채점](docs/ideas/)

## 라이선스

코드는 [MIT](LICENSE). 별 데이터와 글꼴은 각자의 라이선스를 따른다([ASSETS.md](docs/ASSETS.md)).
