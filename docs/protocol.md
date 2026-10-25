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

### Gauge — 계기판 등

정기 작업, 서비스 상태처럼 늘 지켜보는 것. `status`는 `ok`·`warn`·`error`·`off`, `value`는 등 옆에 적을 짧은 값.

## 버전

- 필드를 **더하는** 것은 같은 버전 안에서 한다. 화면은 모르는 필드를 무시한다.
- 필드의 뜻을 바꾸거나 지우면 `starship/2`로 올린다.
