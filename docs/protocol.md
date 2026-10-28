# Starship 프로토콜 v1 (`starship/1`)

Starship은 화면만 맡는다. 할 일·교신·승무원·계기판 데이터는 이 프로토콜을 따르는 서버에서 받는다.
타입과 검증 스키마의 원본은 [`src/protocol/v1.ts`](../src/protocol/v1.ts)(zod)다. 이 문서는 그 뜻을 설명한다.

어떤 비서·세션 관리 도구든 이 모양으로 데이터를 내주는 **어댑터**만 달면 Starship을 화면으로 쓸 수 있다.

## 연결

| 환경 변수 | 뜻 |
|---|---|
| (없음) | 데모 모드. 지어낸 데이터로 돈다 |
| `STARSHIP_SERVER_URL` | 프로토콜 서버 주소(예: `http://127.0.0.1:7787/starship`). Starship 서버가 이 주소로 요청을 대신 보낸다 |

브라우저는 Starship 자신의 `/api/v1/*`만 부르고, Starship 서버가 프로토콜 서버로 넘긴다. 그래서 프로토콜 서버는 브라우저 Origin을 따로 허용할 필요가 없다. Starship의 `POST /api/v1/actions`는 같은 출처(Origin = Host)의 요청만 받는다.

## 끝점

### `GET {base}/v1/snapshot` → `Snapshot`

화면 전체에 필요한 상태를 한 번에 준다. Starship은 5초마다 다시 읽는다.

```jsonc
{
  "protocol": "starship/1",
  "generatedAt": 1792900000000,   // Unix 밀리초
  "tasks": [/* Task, 급한 순. 첫째가 "지금 할 일" */],
  "hails": [/* Hail */],
  "crew": [/* Crew */],
  "gauges": [/* Gauge */],
  "link": { /* Link, 선택 */ },
  "notice": "데모 데이터"          // 선택. 화면 구석에 작게 적는다
}
```

### `POST {base}/v1/actions` ← `ActionRequest` → `ActionResult`

```jsonc
// 할 일에 대한 동작
{ "target": "task", "id": "t-1", "action": "answer", "answer": "허락" }
{ "target": "task", "id": "t-1", "action": "snooze", "until": 1792903600000 }
// 승무원에 대한 동작
{ "target": "crew", "id": "web-shop", "action": "focus" }
```

```jsonc
{ "ok": true, "note": "치웠어요", "openUrl": "https://..." }
```

- `note`는 화면에 잠깐 띄울 한 줄이다. 사람이 읽을 말로 쓴다.
- `openUrl`이 있으면 Starship이 새 탭으로 연다(원래 서비스에서 답해야 할 때).

### `GET {base}/v1/crew/{id}/map` → `CrewMapResponse`

승무원(프로젝트) 하나의 지도. 선실(`/crew/{id}`) 화면이 읽는다. 지도 형식 `starship-map/1`의 원본은 [`src/protocol/map.ts`](../src/protocol/map.ts)이고, 뜻은 [`map.md`](map.md)에 있다.

```jsonc
{
  "map": { "map": "starship-map/1", "title": "온라인 상점", "regions": [/* ... */] },
  "problems": ["regions.3.status: ..."], // 선택. 형식 검사에 걸린 것
  "stale": false,                        // 선택. 지도가 일보다 오래 뒤처졌나
  "mapAt": 1792900000000                 // 선택. map.json을 마지막으로 고친 때(Unix 밀리초)
}
```

- `map: null`은 지도가 아직 없다는 뜻이다. 선실에 "지도가 아직 없어요"를 보인다. 404도 같게 본다.
- `problems`가 있으면 서버는 마지막으로 맞았던 지도를 `map`에 그대로 준다(없으면 `null`). 화면은 지도를 그리고 문제를 따로 알린다.
- Starship은 받은 `map`을 다시 검사한다(id 중복, 없는 parent, 고리, 3단 넘김). 걸리면 `map: null`로 바꾸고 그 문제를 `problems`에 더한다.

## 개념

### Task — 할 일

내가 해야 하는 일 하나. 화면은 첫째 할 일을 가장 크게, 첫 줄(`title`)을 글로 보여 주고 `actions`에 있는 버튼만 놓는다.

| 필드 | 뜻 |
|---|---|
| `kind` | `question` 질문 · `permission` 허락 · `input` 다음 지시 대기 · `reply` 일을 마쳤으니 봐 달라 · `mention` 사람이 부름 · `review` 봐 달라 · `todo` 할 일 · `alert` 경보 |
| `source` | `{ kind, service? }`. kind는 `session` AI 세션 · `chat` 채팅 · `issue` 이슈 트래커 · `review` 코드 리뷰 · `doc` 문서 · `reminder` 날짜 할 일 · `monitor` 정기 작업. `service`는 화면에 그대로 적을 서비스 이름 |
| `context` | `work` 업무 · `personal` 개인 |
| `title` | 첫 줄. 가장 크게 보인다 |
| `detail` | 나머지 글. 모달에서 펼친다 |
| `from` | 누가 기다리나(사람, 세션 이름) |
| `crewId` | 어느 승무원(프로젝트)의 일인가. 없으면 "새 일" |
| `since` | 언제부터 기다렸나 |
| `actions` | `focus` 그곳으로 가기 · `answer` 바로 답하기 · `snooze` 미루기 · `dismiss` 치우기 · `handoff` 비서에게 넘기기 |
| `choices` | `answer`로 고를 선택지 |
| `url` | 원래 서비스 주소 |

**정렬은 서버가 정한다.** 권장: 세션이 멈춰 있는 것(permission·question·input) → 세션이 끝난 것(reply) → 사람이 부른 것 → 나머지, 같은 단계에서는 오래 기다린 순.

### Hail — 교신

사람이 나에게 보낸 메시지 한 통. 화면은 "다른 우주선이 교신해 온다"로 그린다. 출처(`source.service`)마다 우주선 모양이 다르다. `taskId`가 있으면 그 할 일의 동작으로 답한다.

### Crew — 승무원

프로젝트 하나(와 그 AI 세션). 화면은 자리에 앉은 동물 선원으로 그린다.

| 필드 | 뜻 |
|---|---|
| `status` | `working` 일하는 중 · `needs-you` 나를 기다림 · `idle` 쉼(세션은 있음) · `off` 세션 없음 |
| `activity` | 지금 하는 일 한 줄 |
| `onDeck` | 창(터미널)이 열려 있나. 열린 승무원은 크게, 나머지는 작게 |
| `brief` | 요약·오늘·다음·위험 |
| `actions` | `focus` 그 창으로 가기 · `brief` 브리핑 다시 만들기 |
| `map` | 선택. 지도 요약 `{ progress, regions, found, forksForMe, stale }`. 진행률(0..1), 버림을 뺀 구역 수, 그 가운데 발견 구역 수, 내가 정할 열린 갈림길 수, 지도가 오래됐나. 계산 규칙은 `src/protocol/map.ts`의 `summarizeMap` |

### Gauge — 계기판 등

정기 작업, 서비스 상태처럼 늘 지켜보는 것. `status`는 `ok`·`warn`·`error`·`off`, `value`는 등 옆에 적을 짧은 값.

### Link — 관제 링크(회선 상태)

`Snapshot.link`, 선택. 우주선(이 컴퓨터) → 중계 위성(Wi-Fi) → 지상국(공유기) → 지구(인터넷) → 항법 신호(DNS)로 이어지는 통신 사슬이다. 측정은 서버가 하고, 화면은 조종석 유리창 왼쪽 위에 작게 그린다. `warn`·`down`이면 눈에 띄게 하고 경고등 줄에도 등을 켠다.

```jsonc
{
  "at": 1792900000000,          // 마지막 측정
  "place": "home",              // 선택. home 집 · office 회사 · other 기타(그 밖의 이름은 그대로 적는다)
  "verdict": "ok",              // ok 정상 · warn 불안 · down 끊김 · off 측정이 멈춤("관제 신호 없음")
  "cause": "공유기 너머 인터넷이 끊겼어요", // 선택. 원인 한 줄(사람 말)
  "hops": [
    { "id": "wifi", "status": "ok", "value": "SSID" },
    { "id": "gateway", "status": "ok", "value": "2ms" },
    { "id": "internet", "status": "error" },
    { "id": "dns", "status": "off" }
  ],
  "drops": { "today": 1, "lastAt": 1792899000000, "lastSecs": 103 }, // 오늘 끊긴 횟수, 마지막 끊김 때와 길이(초)
  "tunnel": "ok"                // 선택. 비밀 통로(VPN·터널) 상태
}
```

- `hops[].status`는 `Gauge.status`와 같은 `ok`·`warn`·`error`·`off`다. 처음 `error`인 칸에서 사슬이 끊겨 보이고, 그 뒤 칸은 흐려진다.
- 모르는 `hops[].id`는 id를 그대로 이름으로 그린다.
- `link`의 형식이 틀리면 Starship은 스냅샷 전체를 버리지 않고 `link`만 뺀다.
- 데모 모드에서는 주소 뒤 `?link=ok|warn|down|off`로 네 가지 모습을 볼 수 있다.

## 버전

- 필드를 **더하는** 것은 같은 버전 안에서 한다. 화면은 모르는 필드를 무시한다.
- 필드의 뜻을 바꾸거나 지우면 `starship/2`로 올린다.
