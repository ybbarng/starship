# Starship 프로토콜 v1 (`starship/1`)

Starship은 화면만 맡는다. 할 일·교신·승무원·계기판 데이터는 이 프로토콜을 따르는 서버에서 받는다.
타입과 검증 스키마의 원본은 [`src/protocol/v1.ts`](../src/protocol/v1.ts)(zod)다. 이 문서는 그 뜻을 설명한다.

어떤 비서·세션 관리 도구든 이 모양으로 데이터를 내주는 **어댑터**만 달면 Starship을 화면으로 쓸 수 있다.

## 연결

| 환경 변수 | 뜻 |
|---|---|
| (없음) | 데모 모드. 지어낸 데이터로 돈다 |
| `STARSHIP_SERVER_URL` | 프로토콜 서버 주소(예: `http://127.0.0.1:7787/starship`). Starship 서버가 이 주소로 요청을 대신 보낸다 |

본부와 상관없는 설정(사용량·파일 보기 등)은 [README "환경 변수"](../README.md#환경-변수)에 모아 두었다.

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
  "notice": "데모 데이터",         // 선택. 화면 구석에 작게 적는다
  "problems": ["..."]              // 선택. 형식 검사에 걸린 것(아래)
}
```

- **틀린 항목은 그것만 뺀다(2026-11-03).** Starship은 `protocol`·`generatedAt`만 엄격하게 본다. `tasks`·`hails`·`crew`·`gauges`는 항목마다 따로 검사해, 틀린 항목(모르는 enum 값, http(s)가 아닌 주소, 빠진 필드 등)만 빼고 나머지는 그대로 보인다. 뺀 까닭은 `"tasks[3] (id t-9): kind: ..."` 꼴로 `problems`에 모은다. 본부가 `problems`를 보내면 그 뒤에 덧붙인다. 그래서 본부는 Starship보다 먼저 enum 값을 더해도 화면 전체가 죽지 않는다(그 항목만 안 보인다). `link`는 전부터 틀리면 그것만 뺐다.
- **같은 id가 겹치면 하나로 합친다(2026-11-03, `src/server/dedupe.ts`).** 승무원은 id마다 하나(처음 나온 자리에), 둘 중 꺼지지 않은 쪽(`status`가 `off`가 아닌 쪽), 둘 다 같으면 뒤에 온 쪽을 남긴다. 할 일은 id마다 처음 것만 남긴다. 겹침은 본부 쪽 잘못이니 본부에서 고치는 것이 맞고, 화면은 같은 서류가 두 장 생기지 않게 막기만 한다.
- Starship은 본부에 4초까지 기다린다(동작은 10초). 넘기면 스냅숏·지도·책상은 502, 동작은 `{ "ok": false, "note": "본부에 닿지 못했어요" }`다. 여러 탭이 동시에 물어도 스냅숏·책상은 진행 중인 요청을 함께 쓰고 1.5초 안이면 다시 쓴다(동작을 보낸 뒤에는 새로 묻는다).

### `POST {base}/v1/actions` ← `ActionRequest` → `ActionResult`

```jsonc
// 할 일에 대한 동작
{ "target": "task", "id": "t-1", "action": "answer", "answer": "허락" }
{ "target": "task", "id": "t-1", "action": "snooze", "until": 1792903600000 }
// 승무원에 대한 동작
{ "target": "crew", "id": "web-shop", "action": "focus" }
// 책상의 답해 둔 것을 읽음으로(서버가 책상에서 뺀다)
{ "target": "answer", "crewId": "web-shop", "id": "coupon-limit-why", "action": "read" }
// 지도 갈림길에 답하기(선실 깃발·구역 판)
{ "target": "sign", "crewId": "web-shop", "region": "server-payment", "id": "receipt", "action": "answer", "answer": "대행사 영수증" }
```

```jsonc
{ "ok": true, "note": "치웠어요", "openUrl": "https://..." }
```

- `note`는 화면에 잠깐 띄울 한 줄이다. 사람이 읽을 말로 쓴다.
- `openUrl`이 있으면 Starship이 새 탭으로 연다(원래 서비스에서 답해야 할 때). http(s)만 받고, 다른 주소면 그 칸만 버린다.
- 길이 상한: `id`·`crewId`·`region`은 200자, `answer`는 4000자. Starship은 64KB가 넘는 요청 본문을 413으로 거절한다. 넘는 요청은 본부까지 가지 않는다.
- `target: "sign"`은 `owner: me`인 열린 갈림길에 답한다. 서버는 그 승무원 세션에 "지도 갈림길 「제목」(구역 region): 답으로 정했어요"처럼 전하고, `map.json`은 세션이 고친다(`status: decided`, `decided`). 화면도 서버도 지도 파일을 직접 쓰지 않는다. 세션에 전할 수 없으면 `ok: false`와 까닭을 `note`에 준다.

### `GET {base}/v1/crew/{id}/map` → `CrewMapResponse`

승무원(프로젝트) 하나의 지도. 선실(`/crew/{id}`) 화면이 읽는다. 지도 형식 `starship-map/1`의 원본은 [`src/protocol/map.ts`](../src/protocol/map.ts)이고, 뜻은 [`map.md`](map.md)에 있다.

```jsonc
{
  "map": { "map": "starship-map/1", "title": "온라인 상점", "regions": [/* ... */] },
  "problems": ["regions[3] (id pay): status: ..."], // 선택. 형식 검사에 걸린 것
  "stale": false,                        // 선택. 지도가 일보다 오래 뒤처졌나
  "mapAt": 1792900000000                 // 선택. map.json을 마지막으로 고친 때(Unix 밀리초)
}
```

- `map: null`은 지도가 아직 없다는 뜻이다. 선실에 "지도가 아직 없어요"를 보인다. 404도 같게 본다.
- `problems`가 있으면 서버는 마지막으로 맞았던 지도를 `map`에 그대로 준다(없으면 `null`). 화면은 지도를 그리고 문제를 따로 알린다.
- Starship은 받은 `map`을 다시 검사한다(2026-11-03부터 틀린 것만 다룬다). 겉(`map` 이름·`title`·`regions` 배열 등)이 틀릴 때만 `map: null`로 바꾼다. 구역 하나의 필드가 틀리면 그 구역과 자손을 빼고, 짜임만 틀린 구역(없는 parent, 고리, 3단 넘김)은 맨 위로 올리고, 겹친 id는 뒤쪽을 빼고, http(s)가 아닌 링크·틀린 표지는 그것만 뺀다. 그 까닭을 `"regions[3] (id pay): status: ..."` 꼴로 본부가 보낸 `problems` 뒤에 더한다. 자세한 근거는 [`map.md`](map.md) "틀린 것 다루기".

### `GET {base}/v1/crew/{id}/map/history` → `CrewMapHistoryResponse`

지도가 지나온 모습. 선실 지도의 "되감기"가 읽는다(2026-11-02). 서버는 그 프로젝트 저장소의 `map.json` git 기록에서 고친 때마다 한 장씩, **오래된 것부터** 돌려준다. 많으면 고르게 솎아 **40장 안**으로 주고, 맨 처음과 맨 마지막(지금) 장은 꼭 넣는다.

```jsonc
{
  "frames": [
    { "at": 1792000000000, "map": { "map": "starship-map/1", "regions": [/* ... */] } },
    { "at": 1792900000000, "map": { /* ... */ } }
  ]
}
```

- `at`은 그 모습이 된 때(커밋 시각, Unix 밀리초)다.
- 기록이 없거나 서버가 이 끝점을 모르면(404) 빈 `frames`로 본다. 장이 둘 미만이면 선실은 되감기 단추를 감춘다.
- Starship은 장마다 `map`을 검사한다. 겉이 틀린 장은 빼고(예전 형식이었던 때 등), 구역 몇 개만 틀린 장은 지도 응답과 같은 규칙으로 고쳐 쓴다.
- 읽을 때만 부른다(되감기 단추를 누를 때). 5초마다 다시 읽지 않는다.

### `GET {base}/v1/crew/{id}/desk` → `CrewDeskResponse`

승무원 하나의 책상: 그 세션이 나를 기다리는 것과 지금 하는 일. 선실이 지도 옆에 보인다. 형식 `starship-desk/1`의 원본은 [`src/protocol/desk.ts`](../src/protocol/desk.ts)이고, 뜻은 [`desk.md`](desk.md)에 있다. 모양은 지도 응답과 같다.

```jsonc
{
  "desk": { "desk": "starship-desk/1", "updatedAt": "2026-10-31T10:12:00+09:00", "waiting": [/* ... */], "doing": [/* ... */] },
  "problems": ["waiting[0] (id pick): options: ..."], // 선택. 형식 검사에 걸린 것
  "deskAt": 1792900000000                  // 선택. 책상 파일을 마지막으로 고친 때(Unix 밀리초)
}
```

- `desk: null`은 책상이 아직 없다는 뜻이다. 404도 같게 본다.
- `problems`가 있으면 서버는 마지막으로 맞았던 책상을 `desk`에 그대로 준다(없으면 `null`).
- Starship은 받은 `desk`를 다시 검사한다(2026-11-03부터 틀린 항목만 뺀다). 겉(`desk` 이름·`updatedAt`·배열인지)이 틀릴 때만 `desk: null`로 바꾼다. `waiting`·`doing`·`answers`는 항목마다 보고, 틀린 항목(decide 선택지 2개 미만, check 항목 0개, http(s)가 아닌 주소 등)과 id가 겹친 뒤쪽 항목만 뺀다(`answers`는 답한 때가 이른 쪽을 뺀다). 그 까닭을 `"waiting[2] (id pick): ..."` 꼴로 본부가 보낸 `problems` 뒤에 더한다. 자세한 것은 [`desk.md`](desk.md).
- **답은 Task로 보낸다.** 서버는 기다림 하나하나를 스냅샷의 Task로도 내보내고, 그 id를 `desk:<crewId>:<waitId>`로 둔다. 선실 카드는 그 Task에 `answer`를 보낸다. 고를 것(`choices`)은 decide가 선택지 `label`들, approve가 `["승인","보류"]`, check가 `["확인함","고칠 것 있음"]`이고, answer는 글로만 답한다. 할 일의 `source`는 기다림의 `topic`이 `code-review`면 `{ kind: "review" }`, 아니면 `{ kind: "session" }`이다(`deskSource`). 코드 리뷰면 기다림의 첫 http(s) 주소(`items[].url`, 없으면 `options[].url`)를 할 일의 `url`로 내고, 다른 기다림은 `url`을 내지 않는다(`deskUrl`). 할 일의 `since`는 기다림의 `since`를 `parseWhen`으로 읽은 값이다(없으면 지금). 출처가 `review`인 책상 할 일로는 교신을 만들지 않는다. 고른 것에 글을 덧붙이면 `"고칠 것 있음 — 버튼 색이 흐려요"`처럼 ` — `로 잇는다(규칙은 `desk.md` "답하기"). 답을 받은 서버는 그 기다림을 책상과 할 일에서 뺀다.

### `GET {base}/v1/usage/limits` → `UsageLimits`

계정 사용 한도(2026-11-03). 연료실의 주 연료통, 연료 기록 노트의 주간 연료 띠, 조종석 연료 계기의 짧은 줄이 읽는다. 스키마 원본은 [`src/protocol/limits.ts`](../src/protocol/limits.ts)이고, 화면 설명은 [`usage.md`](usage.md) "주간 연료"에 있다.

```jsonc
{
  "protocol": "starship/1",
  "at": 1792900000000,          // 본부가 이 값을 마지막으로 받은 때(Unix 밀리초)
  "limits": [
    { "id": "week", "label": "주간", "usedPct": 50, "resetsAt": 1792925200000 },
    { "id": "five-hour", "label": "5시간", "usedPct": 30, "resetsAt": 1792908400000 }
  ]
}
```

- `id`는 `week`(주간), `five-hour`(5시간), `week-opus`처럼 모델별 주간이 올 수 있다. 모르는 id도 받아 `label`(없으면 id)로 적는다.
- `usedPct`는 쓴 몫(%)이다. 0~100 밖이면 잘라 받는다. `resetsAt`은 다시 차는 시각이고 없을 수 있다. 시각이 초 단위로 오면 밀리초로 바꾼다.
- 항목 하나가 틀리면 그 항목만 빼고 나머지를 쓴다.
- 값은 세션이 화면을 바꿀 때마다 갱신돼, 아무도 안 쓰면 멈춘다. Starship은 `at`이 30분보다 오래되면 "n분 전 값"으로 흐리게 보인다.
- 리셋 시각이 지난 한도는 본부가 뺀다. `limits`가 비면 "리셋됨 · 새 값 기다리는 중"을 보인다. Starship도 리셋 시각이 지난 항목은 보이지 않는다.
- 404거나 본부가 없으면(시간 제한 4초) 칸을 숨긴다. Starship 서버는 본부 값을 1분(실패는 15초) 기억한다.
- 한 번 받은 뒤 본부가 잠깐 실패하면(5xx·시간 초과·형식 오류) Starship 서버는 마지막으로 받은 값에 `stale: true`(선택 필드)와 실패 까닭(`note`)을 붙여 준다. `at`은 그대로라 화면은 칸을 숨기지 않고 "n분 전 값"으로 흐리게 보인다. 404는 "끝점 없음"이라 기억한 값을 쓰지 않는다.
- Starship의 `GET /api/v1/usage/limits`는 이 응답에 `ok`(본부 값을 받았나)와 `source`(`demo`·`remote`)를 더해 준다(`UsageLimitsResponse`). Starship은 계정 토큰을 다루지 않는다. 값을 구하는 일은 본부가 맡는다.

### 프로토콜 밖 비서 끝점

아래 둘은 `{base}/v1` 아래가 아니라 비서 서버 뿌리(`STARSHIP_SERVER_URL`의 origin)의 `/api/` 아래에 있다. 비서 자신의 기록이라 프로토콜 판(`starship/1`)과 따로 바뀐다. 404면 Starship은 "아직 없음"(`status: "none"`)으로 보인다.

- `GET {origin}/api/secure` — 1Password 신청서·호출 기록. Starship `GET /api/v1/secure`. 설명은 [secure.md](secure.md).
- `GET {origin}/api/relays?limit=200` → `{ "relays": [줄…] }` — 나르기 기록(`starship-relay/1`, 순서는 보장하지 않는다). Starship `GET /api/v1/relays`가 `{ source, status, log: { relays, problems? } }`로 중계한다. 형식 원본은 [`src/protocol/relay.ts`](../src/protocol/relay.ts), 설명은 [hq.md](hq.md) "나르기 기록".

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
| `url` | 원래 서비스 주소. http(s)만 받는다(`javascript:`·`data:`·`file:`은 형식 검사에 걸려 그 할 일만 빠진다). Hail의 `url`, ActionResult의 `openUrl`, 지도 구역 링크의 `url`도 같다 |

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
| `foreman`(선택) | 이 승무원이 작업팀이면 그 현장 소장의 승무원 id(2026-11-06). 작업팀에만 붙는다. 화면은 작업팀을 소장 아래로 접고, 소장 지도에 작업팀 그림을 세운다. 작업팀이 짓는 구역은 작업팀 책상의 `doing[].region`이다([desk.md](desk.md)) |
| `brief` | 요약·오늘·다음·위험 |
| `actions` | `focus` 그 창으로 가기 · `brief` 브리핑 다시 만들기 |
| `map` | 선택. 지도 요약 `{ progress, regions, found, forksForMe, stale }`. 진행률(0..1), 버림을 뺀 구역 수, 그 가운데 발견 구역 수, 내가 정할 열린 갈림길 수, 지도가 오래됐나. 계산 규칙은 `src/protocol/map.ts`의 `summarizeMap` |
| `desk` | 선택. 책상 요약 `{ waiting, doing, answers? }`. 나를 기다리는 것 수, 지금 하는 일 수, 답해 둔 것(아직 안 읽은 답) 수(없으면 생략하거나 0). 조종석 승무원 옆에 기다림 수가 보인다 |

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
  "tunnel": "ok",               // 선택. 비밀 통로(VPN·터널) 상태. vpn이 있으면 화면은 vpn을 쓴다
  "vpn": {                      // 선택. 회사 VPN
    "status": "ok",             // ok · warn · error · off
    "cause": "기기 키가 2일 뒤 만료돼요", // 선택. warn·error일 때 사람 말
    "keyDays": 7,               // 선택. 기기 키가 만료되기까지 남은 날
    "routers": { "online": 3, "total": 3 } // 선택. 회사 망으로 이어 주는 라우터
  }
}
```

- `hops[].status`는 `Gauge.status`와 같은 `ok`·`warn`·`error`·`off`다. 처음 `error`인 칸에서 사슬이 끊겨 보이고, 그 뒤 칸은 흐려진다.
- 모르는 `hops[].id`는 id를 그대로 이름으로 그린다.
- `hops[].why`(선택)는 주의·끊김인 칸에만 싣는 사람 말 한 줄이다. 예: 지상국 "공유기까지 보낸 핑의 33%가 돌아오지 않음(20초마다 잼)", 지구(핑만 놓친 경우) "핑만 놓침. 실제 연결(TCP)은 정상이라 쓰는 데 지장 없음". 화면은 칸에 마우스를 올리면 칸의 실제 뜻(지상국 = 공유기 등)과 함께 보이고, "회선 불안"·"끊김" 글에 올리면 문제인 칸의 why를 모두 모아 `cause`와 함께 보인다.
- `link`의 형식이 틀리면 Starship은 스냅샷 전체를 버리지 않고 `link`만 뺀다.
- `vpn`은 사슬 아래 따로 한 줄("함대 통신망", 마우스를 올리면 "회사 VPN(Tailscale)")로 그린다. 인터넷은 되는데 VPN만 안 되는 경우를 가르려는 칸이다. `warn`·`error`면 그 줄만 호박색·붉은색이 되고, 인터넷이 정상이면 "인터넷은 정상"을 붙이고, 경고등 줄에도 "함대 통신망 주의/끊김" 등을 켠다. 판정(error: 꺼짐·키 만료·회사 망 오프라인·라우터 모두 꺼짐, warn: 건강 경고·키 3일 안 만료·라우터 일부 꺼짐)은 서버가 한다. `vpn`의 형식이 틀리면 `vpn`만 뺀다.
- 데모 모드에서는 주소 뒤 `?link=ok|warn|down|off|vpn-warn|vpn-down`으로 여섯 가지 모습을 볼 수 있다.

## 버전

- 필드를 **더하는** 것은 같은 버전 안에서 한다. 화면은 모르는 필드를 무시한다.
- 필드의 뜻을 바꾸거나 지우면 `starship/2`로 올린다.
