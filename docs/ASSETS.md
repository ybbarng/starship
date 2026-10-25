# 외부 자료와 라이선스

공개 배포할 수 있는 라이선스만 들인다. 새 자료를 들이기 전에 여기에 출처·라이선스·쓰는 곳을 적는다.

| 자료 | 출처 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| 별 위치·밝기·색(6등급까지 5,044개) | [d3-celestial](https://github.com/ofrohn/d3-celestial) 0.7.35 `stars.6.json` (원자료: XHIP, Anderson & Francis 2012 / Hipparcos) | BSD-3-Clause | `public/sky/sky.json` |
| 별 이름(한국어 포함) | d3-celestial `starnames.json` (번역: Stellarium skycultures) | BSD-3-Clause | 같은 파일 |
| 별자리 선·별자리 이름 | d3-celestial `constellations.lines.json`, `constellations.json` (원자료: IAU) | BSD-3-Clause | 같은 파일 |
| 행성·소행성 궤도 요소 | d3-celestial `planets.json` (원자료: JPL "Keplerian Elements for Approximate Positions of the Major Planets") | BSD-3-Clause | 같은 파일 |
| 행성·지구·달·태양 텍스처 13장(2K) | [Solar System Scope](https://www.solarsystemscope.com/textures/) (원자료: NASA 등) | CC BY 4.0 — 출처 표기 | `public/textures/` |
| 글꼴 Pretendard | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) 1.3.9 (npm) | SIL OFL 1.1 | 전체 화면 |

`public/sky/sky.json`은 `pnpm sky:build`(`scripts/build-sky.mjs`)가 d3-celestial 패키지에서 만든다. d3-celestial 저작권 고지:

> Copyright (c) 2015, Olaf Frohn. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the conditions of the BSD 3-Clause License are met.

## 들이지 않은 것

- d3-celestial의 은하수 윤곽(`mw.json`): 원자료(Jose R. Vieira) 라이선스가 분명하지 않아 쓰지 않는다. 은하수는 코드로 그린다.
- 영화·드라마·책·게임 속 캐릭터와 함선: 저작권·상표 문제로 쓰지 않는다. 이벤트의 외계인(모아·포포·도르·끙)은 모두 이 저장소에서 지어냈다.

## 행성 표면

태양·수성·금성(구름)·지구(낮·밤 불빛·구름)·달·화성·목성·토성(고리 포함)·천왕성·해왕성은 Solar System Scope 텍스처를 쓴다. 출처 표기: "Textures by Solar System Scope (solarsystemscope.com), CC BY 4.0". 받은 파일 이름을 `public/textures/{천체}.jpg`로 바꿔 두었다. 텍스처가 없는 위성과 왜소행성은 코드(셰이더)로 그린다. `NEXT_PUBLIC_PLANET_TEXTURES=off`면 모두 코드로, 다른 폴더 주소를 주면 그 폴더의 `{id}.jpg`를 읽는다.

지구는 그리니치 평균 항성시로 지금 이 순간의 자전 각도를 맞춰, 낮·밤 경계와 밤의 도시 불빛이 실제와 같다.

## 비상업 라이선스 자료

사용자는 상업화 계획이 없다(2026-10-25). 그래서 비상업 이용만 허용하는 자료(CC BY-NC 등)도 후보로 둘 수 있다. 다만 공개 저장소의 다른 사용자에게는 제약이 되니, 들일 때 이 표에 "비상업"으로 따로 표시한다. 지금은 없다.
